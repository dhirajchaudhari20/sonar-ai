// Dynamic Resume Ingestion, OCR Vision & RAG Knowledge Base Extractor
// Multi-Strategy Ingestion: Stream Decompression + PDF.js + AI Vision OCR + DOCX + RAG Indexing

import { inflate } from 'pako';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { createWorker } from 'tesseract.js';
import { resumeRag } from './ragEngine.js';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
} catch (e) {
  console.warn('[ResumeParser] PDF Worker initialization:', e);
}

// 1. Direct High-Speed Binary Stream Decompressor (Zero Worker Dependency, Works on All PDFs)
export function extractPdfTextWithStreams(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const latin1 = Array.from(bytes.subarray(0, Math.min(bytes.length, 1200000)))
      .map(b => String.fromCharCode(b))
      .join('');

    let extractedText = '';

    // Step A: Extract literal uncompressed text blocks
    const uncompressedMatches = latin1.match(/\(([^()]+)\)\s*T[jJ]/g) || [];
    for (const m of uncompressedMatches) {
      const textMatch = m.match(/\(([^()]+)\)/);
      if (textMatch && textMatch[1]) {
        extractedText += textMatch[1] + ' ';
      }
    }

    // Step B: Search for Deflate streams and decompress
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;

    while ((match = streamRegex.exec(latin1)) !== null) {
      const streamStartIndex = match.index + match[0].indexOf('\n') + 1;
      const streamLength = match[1].length;
      const streamBytes = bytes.subarray(streamStartIndex, streamStartIndex + streamLength);

      try {
        const decompressed = inflate(streamBytes);
        const streamText = new TextDecoder('utf-8', { fatal: false }).decode(decompressed);

        // Match (Text) Tj
        const tjMatches = streamText.match(/\(([^)]+)\)\s*T[jJ]/g) || [];
        for (const tm of tjMatches) {
          const str = tm.replace(/\)\s*T[jJ]/, '').replace(/^\(/, '');
          if (str) extractedText += str + ' ';
        }

        // Match [(T)(e)(x)(t)] TJ (Kerning text arrays)
        const tjArrayMatches = streamText.match(/\[(.*?)\]\s*TJ/g) || [];
        for (const tam of tjArrayMatches) {
          const innerStrings = tam.match(/\(([^)]+)\)/g) || [];
          const combined = innerStrings.map(s => s.slice(1, -1)).join('');
          if (combined) extractedText += combined + ' ';
        }

        // Match BT ... ET blocks
        const btMatches = streamText.match(/BT[\s\S]*?ET/g) || [];
        for (const bt of btMatches) {
          const parts = bt.match(/\(([^)]+)\)/g) || [];
          if (parts.length > 0) {
            extractedText += parts.map(t => t.slice(1, -1)).join(' ') + '\n';
          }
        }
      } catch {
        // Stream was not Deflate compressed or was an image - continue to next stream
      }
    }

    // Clean and decode escape sequences
    const cleaned = extractedText
      .replace(/\\([0-9]{3})/g, (match, octal) => String.fromCharCode(parseInt(octal, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '')
      .replace(/\\t/g, ' ')
      .replace(/\\([\\()])/g, '$1')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return cleaned;
  } catch (err) {
    console.warn('[ResumeParser] Stream decompression error:', err);
    return '';
  }
}

// 2. Render PDF to Canvas for Vision OCR
async function renderPageToCanvas(page, scale = 2.0) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// 3. Groq Vision OCR Extractor (Sub-second Multimodal OCR)
export async function extractWithGroqVision(imageBase64Url, apiKey) {
  if (!apiKey || !apiKey.trim()) return null;

  try {
    const prompt = `Extract all text and structured candidate profile details from this resume image. Return ONLY valid JSON:
{
  "candidateName": "Full name of candidate",
  "targetRole": "Candidate primary job title / role",
  "yearsOfExperience": "e.g. 5+ years",
  "targetCompany": "Target company if mentioned, else tech industry",
  "keyStrengths": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5", "Skill 6"],
  "resumeText": "Full transcription of all experience, projects, skills, education, and bullet points"
}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: { url: imageBase64Url }
              }
            ]
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        return JSON.parse(content);
      }
    }
  } catch (err) {
    console.warn('[ResumeParser] Groq Vision error:', err);
  }
  return null;
}

// 4. Offline Tesseract OCR
export async function performOfflineOcr(imageSource, onProgress) {
  try {
    if (onProgress) onProgress('Running OCR text recognition (Tesseract)...');
    const worker = await createWorker('eng');
    const ret = await worker.recognize(imageSource);
    await worker.terminate();
    return ret.data?.text || '';
  } catch (err) {
    console.warn('[ResumeParser] Tesseract error:', err);
    return '';
  }
}

// 5. Universal PDF Ingestion Pipeline
export async function parsePdfResume(arrayBuffer, apiKey, onProgress) {
  // Strategy 1: Direct Flate Stream Decompression (instant, 100% offline, zero worker)
  if (onProgress) onProgress('Reading PDF binary streams & text layers...');
  const streamText = extractPdfTextWithStreams(arrayBuffer);

  if (streamText && streamText.length >= 40) {
    if (onProgress) onProgress('Analyzing candidate profile & building RAG index...');
    const profile = await parseResumeWithAI(streamText, apiKey);
    resumeRag.indexResume(profile.resumeText, profile);
    return profile;
  }

  // Strategy 2: PDF.js native text extraction
  let pdf = null;
  try {
    const uint8Array = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      isEvalSupported: false,
      disableFontFace: true
    });
    pdf = await loadingTask.promise;

    let pdfJsText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map(item => (item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean);
      pdfJsText += pageStrings.join(' ') + '\n\n';
    }

    if (pdfJsText && pdfJsText.trim().length >= 40) {
      if (onProgress) onProgress('Structuring candidate profile & skills...');
      const profile = await parseResumeWithAI(pdfJsText.trim(), apiKey);
      resumeRag.indexResume(profile.resumeText, profile);
      return profile;
    }
  } catch (err) {
    console.warn('[ResumeParser] PDF.js extraction fallback:', err);
  }

  // Strategy 3: Scanned / Image PDF -> Render Canvas & Vision OCR
  if (pdf && pdf.numPages > 0) {
    if (onProgress) onProgress('Image-based PDF detected. Rendering canvas for Vision OCR...');
    const page1 = await pdf.getPage(1);
    const canvas = await renderPageToCanvas(page1, 2.0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

    if (apiKey && apiKey.trim()) {
      if (onProgress) onProgress('Running Groq Vision OCR (0.6s)...');
      const visionResult = await extractWithGroqVision(dataUrl, apiKey);
      if (visionResult && visionResult.resumeText && visionResult.resumeText.length > 20) {
        resumeRag.indexResume(visionResult.resumeText, visionResult);
        return visionResult;
      }
    }

    if (onProgress) onProgress('Running client-side OCR...');
    const ocrText = await performOfflineOcr(canvas, onProgress);
    if (ocrText && ocrText.trim().length > 20) {
      const profile = await parseResumeWithAI(ocrText.trim(), apiKey);
      resumeRag.indexResume(profile.resumeText, profile);
      return profile;
    }
  }

  // Final fallback: if stream text had anything at all
  if (streamText && streamText.length > 10) {
    const profile = extractProfileFromText(streamText);
    resumeRag.indexResume(profile.resumeText, profile);
    return profile;
  }

  throw new Error('Unable to extract text from this PDF. You can paste your resume text directly into the box below.');
}

// 6. Word DOCX Ingestion
export async function parseDocxResume(arrayBuffer, apiKey) {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const documentXml = await zip.file('word/document.xml')?.async('text');
    if (!documentXml) throw new Error('Invalid DOCX format');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(documentXml, 'text/xml');
    const paragraphs = xmlDoc.getElementsByTagName('w:p');
    let fullText = '';

    for (let i = 0; i < paragraphs.length; i++) {
      const textNodes = paragraphs[i].getElementsByTagName('w:t');
      let pText = '';
      for (let j = 0; j < textNodes.length; j++) {
        pText += textNodes[j].textContent || '';
      }
      if (pText.trim()) fullText += pText.trim() + '\n';
    }

    const trimmed = fullText.trim();
    const profile = await parseResumeWithAI(trimmed, apiKey);
    resumeRag.indexResume(profile.resumeText, profile);
    return profile;
  } catch (err) {
    console.warn('[ResumeParser] DOCX error:', err);
    throw new Error('Could not parse DOCX file. Please upload as PDF or TXT.');
  }
}

// 7. Image Resume Ingestion (PNG, JPG, WEBP)
export async function parseImageResume(file, apiKey, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      if (apiKey && apiKey.trim()) {
        if (onProgress) onProgress('Running Groq Vision OCR on resume image...');
        const visionResult = await extractWithGroqVision(dataUrl, apiKey);
        if (visionResult && visionResult.resumeText) {
          resumeRag.indexResume(visionResult.resumeText, visionResult);
          return resolve(visionResult);
        }
      }

      if (onProgress) onProgress('Running Tesseract OCR on resume image...');
      const ocrText = await performOfflineOcr(dataUrl, onProgress);
      if (ocrText && ocrText.trim().length > 20) {
        const profile = await parseResumeWithAI(ocrText.trim(), apiKey);
        resumeRag.indexResume(profile.resumeText, profile);
        return resolve(profile);
      }

      reject(new Error('Could not read text from image. Please paste text manually.'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

// 8. Heuristic Fallback Profile Parser
export function extractProfileFromText(text) {
  if (!text || typeof text !== 'string') {
    return {
      candidateName: '',
      targetRole: '',
      yearsOfExperience: '',
      targetCompany: '',
      keyStrengths: [],
      resumeText: ''
    };
  }

  const clean = text.replace(/\r\n/g, '\n');
  const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
  let candidateName = '';
  let targetRole = '';
  let yearsOfExperience = '';
  const keyStrengths = [];

  for (let i = 0; i < Math.min(lines.length, 6); i++) {
    const line = lines[i];
    if (
      line.length >= 3 &&
      line.length <= 40 &&
      !/resume|curriculum|vitae|email|phone|http|github|linkedin|summary|objective|portfolio|contact/i.test(line) &&
      !/\d/.test(line) &&
      !/@/.test(line) &&
      !/\|/.test(line) &&
      line.split(/\s+/).length <= 4
    ) {
      candidateName = line.replace(/^(name\s*:\s*)/i, '').trim();
      break;
    }
  }

  const roleRegex = /(senior|lead|staff|principal|junior|associate|chief|vp)?\s*(software engineer|software developer|frontend engineer|frontend developer|backend engineer|backend developer|full stack engineer|fullstack developer|genai engineer|ai engineer|machine learning engineer|data engineer|data scientist|devops engineer|cloud engineer|cloud architect|solutions architect|product manager|python developer|react developer|java developer|systems engineer)/i;
  
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const match = lines[i].match(roleRegex);
    if (match) {
      targetRole = match[0].trim();
      break;
    }
  }

  const expMatch = clean.match(/(\d+\+?)\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp|in software|in development)/i);
  if (expMatch) {
    yearsOfExperience = expMatch[1].endsWith('+') ? expMatch[1] : `${expMatch[1]}+`;
  }

  const techCatalog = [
    'Python', 'JavaScript', 'TypeScript', 'C++', 'Java', 'Golang', 'Rust', 'C#',
    'React', 'Node.js', 'Next.js', 'Vue.js', 'FastAPI', 'Django', 'Flask', 'Spring Boot',
    'PostgreSQL', 'MongoDB', 'Redis', 'MySQL', 'DynamoDB', 'SQL',
    'AWS', 'GCP', 'Azure', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD',
    'GraphQL', 'REST APIs', 'LangChain', 'LlamaIndex', 'RAG', 'Machine Learning',
    'System Design', 'Microservices', 'Kafka', 'RabbitMQ', 'Git', 'Linux'
  ];

  for (const tech of techCatalog) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const isSpecialTrailing = /[\+\#]$/.test(tech);
    const pattern = isSpecialTrailing
      ? `(?:^|\\s|[.,;()/\`"'])(${escaped})(?:$|\\s|[.,;()/\`"'])`
      : `\\b${escaped}\\b`;

    try {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(clean) && !keyStrengths.includes(tech)) {
        keyStrengths.push(tech);
      }
    } catch {
      if (clean.toLowerCase().includes(tech.toLowerCase()) && !keyStrengths.includes(tech)) {
        keyStrengths.push(tech);
      }
    }
  }

  return {
    candidateName: candidateName || '',
    targetRole: targetRole || '',
    yearsOfExperience: yearsOfExperience || '',
    targetCompany: '',
    keyStrengths: keyStrengths.slice(0, 10),
    resumeText: clean.trim()
  };
}

// 9. AI Structured Extractor via Groq
export async function parseResumeWithAI(resumeText, apiKey) {
  if (!apiKey || !apiKey.trim() || !resumeText || resumeText.length < 20) {
    return extractProfileFromText(resumeText);
  }

  try {
    const prompt = `Extract candidate profile details from this resume text. Return ONLY a valid JSON object:
{
  "candidateName": "Full name of candidate",
  "targetRole": "Candidate primary job title or role",
  "yearsOfExperience": "e.g. 5+ years",
  "targetCompany": "Target company if mentioned, else tech industry",
  "keyStrengths": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
  "resumeText": "Clean formatted text summary of work experience and past projects"
}

Resume Text:
${resumeText.slice(0, 5000)}`;

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        return {
          candidateName: parsed.candidateName || '',
          targetRole: parsed.targetRole || '',
          yearsOfExperience: parsed.yearsOfExperience || '',
          targetCompany: parsed.targetCompany || '',
          keyStrengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths : [],
          resumeText: parsed.resumeText || resumeText.trim()
        };
      }
    }
  } catch (err) {
    console.warn('[ResumeParser] Groq AI parsing fallback:', err);
  }

  return extractProfileFromText(resumeText);
}
