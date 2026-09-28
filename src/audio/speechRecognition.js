// Sonar AI High-Precision Dual-Engine Speech Recognition (Web Speech API + Groq Whisper V3)
// Specially engineered with Full Utterance Debouncing & Smart Noise Gate to Prevent False Triggers and Sentence Truncation

import { ProfileStore } from '../storage/profileStore.js';
import { audioCapture } from './audioCapture.js';

// Phonetic & technical grammar cleaner for coding interviews
export function cleanTechnicalSpeech(rawText) {
  if (!rawText) return '';
  let text = rawText;

  // Programming Languages & Environments
  text = text.replace(/\b(see program|c program)\b/gi, 'C program');
  text = text.replace(/\b(see language|c language)\b/gi, 'C language');
  text = text.replace(/\b(see plus plus|c plus plus|c\+\+)\b/gi, 'C++');
  text = text.replace(/\b(see sharp|c sharp)\b/gi, 'C#');
  text = text.replace(/\b(pie son|pie ton|python)\b/gi, 'Python');
  text = text.replace(/\b(java script|javascript)\b/gi, 'JavaScript');
  text = text.replace(/\b(type script|typescript)\b/gi, 'TypeScript');
  text = text.replace(/\b(post gres|postgres|postgresql)\b/gi, 'PostgreSQL');
  text = text.replace(/\b(mongo db|mongodb)\b/gi, 'MongoDB');
  text = text.replace(/\b(s q l|sql|sequel)\b/gi, 'SQL');
  text = text.replace(/\b(go lang|golang)\b/gi, 'Go');
  text = text.replace(/\b(rust lang|rustlang)\b/gi, 'Rust');
  text = text.replace(/\b(fast api|fastapi)\b/gi, 'FastAPI');
  text = text.replace(/\b(react js|reactjs)\b/gi, 'React');
  text = text.replace(/\b(node js|nodejs)\b/gi, 'Node.js');
  text = text.replace(/\b(next js|nextjs)\b/gi, 'Next.js');
  text = text.replace(/\b(vue js|vuejs)\b/gi, 'Vue.js');
  text = text.replace(/\b(docker container|dockers)\b/gi, 'Docker');
  text = text.replace(/\b(kubernetes|k8s)\b/gi, 'Kubernetes');

  // Common Phrasings in Interviews & Follow-ups
  text = text.replace(/\b(writer program|write a program|write program)\b/gi, 'write a program');
  text = text.replace(/\b(writer code|write a code|write code)\b/gi, 'write code');
  text = text.replace(/\b(writer function|write a function|write function)\b/gi, 'write a function');
  text = text.replace(/\b(create a program|create program)\b/gi, 'create a program');
  text = text.replace(/\b(create a function|create function)\b/gi, 'create a function');
  text = text.replace(/\bwriter\b/gi, 'write');

  // Data Structures & Algorithms
  text = text.replace(/\b(to sum|too sum|two sum)\b/gi, 'two sum');
  text = text.replace(/\b(three sum|3 sum)\b/gi, 'three sum');
  text = text.replace(/\b(by three|by nary tree|binary tree)\b/gi, 'binary tree');
  text = text.replace(/\b(by nary|binary)\b/gi, 'binary');
  text = text.replace(/\b(binary search tree|b s t)\b/gi, 'binary search tree');
  text = text.replace(/\b(link list|linked list)\b/gi, 'linked list');
  text = text.replace(/\b(hash table|hash map)\b/gi, 'hashmap');
  text = text.replace(/\b(for for loop|four loop|for loop)\b/gi, 'for loop');
  text = text.replace(/\b(while loop)\b/gi, 'while loop');
  text = text.replace(/\b(call back|callbacks)\b/gi, 'callback');
  text = text.replace(/\b(async away|async await)\b/gi, 'async await');
  text = text.replace(/\b(dynamic programming|d p)\b/gi, 'dynamic programming');
  text = text.replace(/\b(time complexity)\b/gi, 'time complexity');
  text = text.replace(/\b(space complexity)\b/gi, 'space complexity');
  text = text.replace(/\b(big o|big o of|big o notation)\b/gi, 'Big-O');
  text = text.replace(/\b(sliding window)\b/gi, 'sliding window');
  text = text.replace(/\b(breadth first search|b f s)\b/gi, 'BFS');
  text = text.replace(/\b(depth first search|d f s)\b/gi, 'DFS');
  text = text.replace(/\b(l r u cache|lru cache)\b/gi, 'LRU cache');
  text = text.replace(/\b(palindrome|palindromic)\b/gi, 'palindrome');
  text = text.replace(/\b(fibonacci)\b/gi, 'Fibonacci');
  text = text.replace(/\b(classes and objects|class and object)\b/gi, 'classes and objects');
  text = text.replace(/\b(rest api|restful api|api)\b/gi, 'API');

  return text.trim();
}

// Strict filter against hallucinated subtitles, background noise tokens, and Whisper silence artifacts
export function filterMeaningfulQuestion(rawText) {
  if (!rawText) return '';
  let text = cleanTechnicalSpeech(rawText);

  // Common Whisper silence hallucinations and non-speech artifacts blacklist
  const hallucinationPatterns = [
    /^(thank you[\.\!\?]?|thanks[\.\!\?]?|thanks for watching[\.\!\?]?|subtitles by.*|bye[\.\!\?]?|you[\.\!\?]?|thank you very much[\.\!\?])$/i,
    /^(am i audible|can you hear me|can you see my screen|am i visible)[\.\?\!]*/gi,
    /^(okay|ok|yeah|yep|yes|no|nope|hello|hi|hey|i'm sorry|sorry|please subscribe|like and subscribe|see you in the next one|see you next time|welcome back|all right guys|let's get started)[\.\!\?]?$/i,
    /^(uh|um|ah|hmm|huh|er|oh|well|cool|sure|right|alright|fine|good|nice|great)[\.\!\?]?$/i,
    /^(\[.*?\]|\(.*?\))$/,
    /^(\.+|\,+|\?+|\!+|\-+|\s+)$/
  ];

  const trimmed = text.trim();
  for (const pat of hallucinationPatterns) {
    if (pat.test(trimmed)) return '';
  }

  // Remove leading/trailing filler artifacts that Whisper adds during pauses
  text = text.replace(/^(thank you[\.\!\?]?|thanks[\.\!\?]?|thanks for watching[\.\!\?]?|subtitles by.*?|bye[\.\!\?]?)\s*/gi, '');
  text = text.replace(/\s*(thank you[\.\!\?]?|thanks[\.\!\?]?|bye[\.\!\?]?|thanks for watching[\.\!\?])$/gi, '');
  text = text.replace(/^(\[.*?\]|\(.*?\))\s*/g, '');
  text = text.replace(/\s*(\[.*?\]|\(.*?\))$/g, '');

  // Strip conversational filler prefixes that confuse the LLM
  text = text.replace(/^(yeah|yes|no|okay|ok|alright|hmm|uh|um|so|like|i mean|you know|thank you|thanks|hello|hi|hey)[\.\!\?,]*\s*/i, '');
  // Try twice in case they chain them: "Yeah, so, can you..."
  text = text.replace(/^(yeah|yes|no|okay|ok|alright|hmm|uh|um|so|like|i mean|you know|thank you|thanks|hello|hi|hey)[\.\!\?,]*\s*/i, '');

  text = text.trim();

  // Guard against very short/meaningless blips
  if (text.length < 8) return '';
  
  // Ignore if the entire string is just noise/fillers
  const fillersOnly = /^(yeah|yes|no|okay|ok|alright|hmm|uh|um|so|like|i mean|you know|thank you|thanks|hello|hi|hey)[\.\!\?,]*\s*$/i;
  if (fillersOnly.test(text)) return '';

  return text;
}

// Intelligent detection of interview questions, coding prompts, and follow-ups
export function isLikelyInterviewQuestion(text) {
  if (!text) return false;
  const clean = filterMeaningfulQuestion(text);
  if (!clean || clean.length < 5) return false;

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length < 2) return false;

  // Conversational filler phrases to ignore (should not trigger auto AI answer)
  const conversationalFillers = [
    /^(ok|okay|yeah|yes|no|nope|sure|right|cool|got it|i see|sounds good|makes sense|alright|hello|hi|hey|thank you|thanks)[\.\!\?]?$/i,
    /^(can you hear me|am i audible|is my screen visible|give me a second|let me think|just a moment)[\.\!\?]?$/i,
    /^(how are you|good morning|good afternoon|good evening|nice to meet you)[\.\!\?]?$/i
  ];
  for (const filler of conversationalFillers) {
    if (filler.test(clean)) return false;
  }

  // Definite question or prompt patterns
  const questionKeywords = /\b(how|what|why|where|when|which|can you|could you|would you|explain|describe|implement|write|create|build|solve|design|calculate|compare|difference between|how do|how does|what is|what are|tell me|walk me through|optimize|refactor|find|show me)\b/i;
  
  // Technical interview keywords
  const technicalKeywords = /\b(python|javascript|typescript|c\+\+|c#|java|golang|rust|sql|postgresql|mongodb|database|api|rest|graphql|docker|kubernetes|aws|microservices|algorithm|data structure|binary tree|binary search|linked list|hashmap|array|string|stack|queue|graph|heap|trie|dynamic programming|sliding window|recursion|two sum|lru cache|time complexity|space complexity|big-o|bfs|dfs|react|async await|concurrency|multithreading|thread|deadlock|cache|redis|kafka|system design|scalability|load balancer)\b/i;

  // 1. Direct question with punctuation
  if (clean.endsWith('?') && words.length >= 3) return true;

  // 2. Starts with / contains question or task prompt keywords
  if (questionKeywords.test(clean) && words.length >= 3) return true;

  // 3. Technical interview topic prompt
  if (technicalKeywords.test(clean) && words.length >= 3) return true;

  // 4. Substantive instruction / sentence (>= 5 words and not simple filler)
  if (words.length >= 5) return true;

  return false;
}

export class SpeechRecognitionEngine {
  constructor({ onInterimText, onQuestionDetected, onStatusChange, language = 'en-US' }) {
    this.onInterimText = onInterimText;
    this.onQuestionDetected = onQuestionDetected;
    this.onStatusChange = onStatusChange;
    this.language = language;
    
    this.isListening = false;
    this.isPaused = false;
    this.isMuted = false;

    // Web Speech API Instance (Instant subtitle streaming)
    this.webSpeech = null;
    this.webSpeechActive = false;
    this.accumulatedFinalWebSpeech = '';
    this.initWebSpeech();

    // VAD & Utterance Accumulator for Whisper (Fallback & Google Meet Tab Audio)
    this.preRollBuffers = [];
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.silenceSampleCount = 0;
    this.speechDurationSamples = 0;
    this.isSpeaking = false;
    this.isTranscribing = false;

    this.currentFullTranscript = '';
    this.questionFinalizeTimer = null;
    this.lastTriggeredQuestion = '';
    this.lastTriggeredTime = 0;

    // Hook directly into unified audioCapture PCM stream with Speaker Diarization
    audioCapture.onPcmData = (inputData, sampleRate, speaker) => {
      this.handlePcmData(inputData, sampleRate, speaker);
    };
  }

  initWebSpeech() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        this.webSpeech = new SpeechRecognition();
        this.webSpeech.continuous = true;
        this.webSpeech.interimResults = true;
        this.webSpeech.lang = this.language;
        this.webSpeech.maxAlternatives = 1;

        this.webSpeech.onstart = () => {
          this.webSpeechActive = true;
        };

        this.webSpeech.onresult = (event) => {
          if (this.isMuted || !this.isListening) return;

          let fullFinal = '';
          let interimTranscript = '';

          for (let i = 0; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              fullFinal += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          const combined = (fullFinal + interimTranscript).trim();
          if (combined) {
            const cleaned = filterMeaningfulQuestion(cleanTechnicalSpeech(combined));
            if (cleaned && cleaned.length > 2) {
              this.currentFullTranscript = cleaned;
              const wordsList = cleaned.split(/\s+/).filter(Boolean);
              const speaker = audioCapture.currentSpeaker || 'interviewer';
              
              if (this.onInterimText) {
                this.onInterimText(wordsList, cleaned, speaker);
              }

              // Auto-Answer Debounce: Wait 800ms after speaker stops talking
              // This guarantees "write a program for Python" is fully captured without cutting off trailing words!
              if (isLikelyInterviewQuestion(cleaned)) {
                this.queueDetectedQuestion(cleaned, 800);
              }
            }
          }
        };

        this.webSpeech.onerror = (e) => {
          if (e.error === 'network') {
            // In Electron or offline environments without Google Speech credentials, WebSpeech network error is permanent.
            // Disable WebSpeech gracefully to prevent infinite reconnect loops and chunked upload errors.
            console.info('[WebSpeech] Network service unavailable for WebSpeech, falling back to Groq Whisper.');
            this.webSpeechDisabled = true;
            try { this.webSpeech.abort(); } catch {}
            return;
          }
          if (e.error !== 'no-speech' && e.error !== 'aborted') {
            console.warn('[WebSpeech] Event error:', e.error);
          }
        };

        this.webSpeech.onend = () => {
          this.webSpeechActive = false;
          if (this.webSpeechDisabled) return;
          // Auto-restart unless explicitly stopped, muted, or disabled
          if (this.isListening && !this.isPaused && !this.isMuted) {
            try {
              setTimeout(() => {
                if (this.isListening && !this.isPaused && !this.isMuted && !this.webSpeechDisabled) {
                  this.webSpeech.start();
                }
              }, 150);
            } catch {}
          }
        };
      } catch (err) {
        console.warn('[WebSpeech] Native SpeechRecognition initialization:', err);
      }
    }
  }

  queueDetectedQuestion(question, debounceMs = 1500) {
    const cleanQ = filterMeaningfulQuestion(cleanTechnicalSpeech(question));
    if (!cleanQ || !isLikelyInterviewQuestion(cleanQ)) return;

    // Refresh debounce timer every time new words arrive
    if (this.questionFinalizeTimer) {
      clearTimeout(this.questionFinalizeTimer);
      this.questionFinalizeTimer = null;
    }

    this.questionFinalizeTimer = setTimeout(() => {
      this.executeDetectedQuestion(cleanQ);
    }, debounceMs);
  }

  executeDetectedQuestion(question) {
    const cleanQ = filterMeaningfulQuestion(cleanTechnicalSpeech(question));
    if (!cleanQ || !isLikelyInterviewQuestion(cleanQ)) return;

    const now = Date.now();
    // Prevent duplicate trigger within 3 seconds
    if (this.lastTriggeredQuestion.toLowerCase() === cleanQ.toLowerCase() && (now - this.lastTriggeredTime) < 3000) {
      return;
    }

    this.lastTriggeredQuestion = cleanQ;
    this.lastTriggeredTime = now;

    // Clear accumulated WebSpeech session transcript so next turn starts fresh
    if (this.webSpeech) {
      try {
        this.webSpeech.abort();
      } catch {}
    }
    this.clearTranscript();

    if (this.onQuestionDetected && !this.isMuted) {
      this.onQuestionDetected(cleanQ);
    }
  }

  handlePcmData(inputData, sampleRate = 16000, speaker = 'interviewer') {
    if (!this.isListening || this.isPaused || this.isMuted) return;

    this.currentSpeaker = speaker;
    const samples = new Float32Array(inputData.length);
    samples.set(inputData);

    // Calculate Voice Energy (RMS) & Peak Amplitude
    let sum = 0;
    let peakAmp = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > peakAmp) peakAmp = abs;
      sum += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sum / samples.length);

    // Maintain 1000ms pre-roll buffer to preserve beginning of sentences
    const preRollMaxSamples = Math.round(sampleRate * 1.0);
    this.preRollBuffers.push(samples);
    let preRollCount = this.preRollBuffers.reduce((acc, b) => acc + b.length, 0);
    while (preRollCount > preRollMaxSamples && this.preRollBuffers.length > 1) {
      const shifted = this.preRollBuffers.shift();
      preRollCount -= shifted.length;
    }

    // ROBUST NOISE GATE: Require real voice energy to prevent hallucinating on ambient background static
    const VOICE_RMS_THRESHOLD = 0.015;
    const VOICE_PEAK_THRESHOLD = 0.040;

    if (rms >= VOICE_RMS_THRESHOLD && peakAmp >= VOICE_PEAK_THRESHOLD) {
      if (!this.isSpeaking) {
        this.isSpeaking = true;
        for (const pb of this.preRollBuffers) {
          this.utteranceBuffers.push(pb);
          this.utteranceSampleCount += pb.length;
        }
        this.preRollBuffers = [];
      }
      this.utteranceBuffers.push(samples);
      this.utteranceSampleCount += samples.length;
      this.speechDurationSamples += samples.length;
      this.silenceSampleCount = 0;
    } else if (this.isSpeaking) {
      this.utteranceBuffers.push(samples);
      this.utteranceSampleCount += samples.length;
      this.silenceSampleCount += samples.length;

      const silenceDurationSec = this.silenceSampleCount / sampleRate;
      const speechDurationSec = this.speechDurationSamples / sampleRate;

      // When 1.3s of silence occurs after genuine speech (>=0.6s), transcribe the full utterance
      if (silenceDurationSec >= 1.3 && speechDurationSec >= 0.6) {
        this.finalizeUtteranceWithWhisper(sampleRate);
      }
    }

    // Cap utterance buffer to maximum 25s
    const maxSamples = sampleRate * 25;
    while (this.utteranceSampleCount > maxSamples && this.utteranceBuffers.length > 0) {
      const removed = this.utteranceBuffers.shift();
      this.utteranceSampleCount -= removed.length;
    }
  }

  isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext || window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  setMute(isMuted) {
    this.isMuted = isMuted;
    if (isMuted) {
      this.isSpeaking = false;
      this.utteranceBuffers = [];
      this.utteranceSampleCount = 0;
      this.speechDurationSamples = 0;
      this.currentFullTranscript = '';
      if (this.questionFinalizeTimer) {
        clearTimeout(this.questionFinalizeTimer);
        this.questionFinalizeTimer = null;
      }
      if (this.webSpeech) {
        try { this.webSpeech.stop(); } catch {}
      }
    } else {
      if (this.isListening && this.webSpeech) {
        try { this.webSpeech.start(); } catch {}
      }
    }
  }

  downsampleTo16k(inputBuffer, inputSampleRate) {
    if (inputSampleRate === 16000) return inputBuffer;
    const ratio = inputSampleRate / 16000;
    const newLength = Math.round(inputBuffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < inputBuffer.length; i++) {
        accum += inputBuffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? (accum / count) : inputBuffer[offsetBuffer];
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  encodeWAV(samples, sampleRate = 16000) {
    let maxAmp = 0;
    for (let i = 0; i < samples.length; i++) {
      const abs = Math.abs(samples[i]);
      if (abs > maxAmp) maxAmp = abs;
    }
    const gain = maxAmp > 0.01 ? Math.min(2.5, 0.9 / maxAmp) : 1.0;

    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // Linear PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16 bits

    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i] * gain));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  restart(newStream) {
    this.stop();
    if (newStream) {
      setTimeout(() => {
        this.start(newStream);
      }, 150);
    }
  }

  start(stream) {
    this.stop();
    this.isListening = true;
    this.isPaused = false;
    this.preRollBuffers = [];
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.speechDurationSamples = 0;
    this.currentFullTranscript = '';

    if (this.webSpeech && !this.isMuted) {
      try { this.webSpeech.start(); } catch {}
    }

    if (this.onStatusChange) this.onStatusChange('listening');
  }

  async finalizeUtteranceWithWhisper(sampleRate = 16000) {
    if (this.isMuted || !this.isListening || this.isPaused || this.isTranscribing || this.utteranceBuffers.length === 0) {
      this.resetUtteranceState();
      return;
    }

    // Merge utterance audio buffer
    const totalLength = this.utteranceBuffers.reduce((acc, buf) => acc + buf.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    let maxAmp = 0;
    let sum = 0;

    for (const buf of this.utteranceBuffers) {
      merged.set(buf, offset);
      for (let i = 0; i < buf.length; i++) {
        const abs = Math.abs(buf[i]);
        if (abs > maxAmp) maxAmp = abs;
        sum += buf[i] * buf[i];
      }
      offset += buf.length;
    }

    const overallRms = Math.sqrt(sum / totalLength);
    // Strict energy check to prevent sending ambient background noise to Whisper
    if (maxAmp < 0.04 || overallRms < 0.015) {
      this.resetUtteranceState();
      return;
    }

    this.isTranscribing = true;

    try {
      const actualSampleRate = audioCapture.audioContext ? audioCapture.audioContext.sampleRate : sampleRate;
      const resampled16k = this.downsampleTo16k(merged, actualSampleRate);
      const wavBlob = this.encodeWAV(resampled16k, 16000);

      const keys = ProfileStore.getApiKeys();
      const apiKey = keys.groq;
      if (!apiKey || !apiKey.trim()) {
        this.resetUtteranceState();
        return;
      }

      const formData = new FormData();
      formData.append('file', wavBlob, 'interview_speech.wav');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      formData.append('language', 'en');
      formData.append('temperature', '0.0');
      formData.append('prompt', 'Technical coding interview questions, programming in Python, Java, C++, JavaScript, algorithms, data structures, and system design.');

      // Use XMLHttpRequest instead of fetch() to avoid Chromium's chunked_data_pipe_upload_data_stream
      // Error:-2 bug that occurs with fetch()+FormData+Blob in transparent Electron renderer windows.
      const rawText = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.groq.com/openai/v1/audio/transcriptions');
        xhr.setRequestHeader('Authorization', `Bearer ${apiKey}`);
        xhr.timeout = 15000; // 15s timeout
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data.text?.trim() || '');
            } catch {
              resolve('');
            }
          } else {
            console.warn('[Whisper] HTTP error:', xhr.status, xhr.responseText?.slice(0, 200));
            resolve('');
          }
        };
        xhr.onerror = () => { console.warn('[Whisper] XHR network error'); resolve(''); };
        xhr.ontimeout = () => { console.warn('[Whisper] XHR timeout'); resolve(''); };
        xhr.send(formData);
      });

      if (rawText && !this.isMuted) {
        const cleanedText = filterMeaningfulQuestion(cleanTechnicalSpeech(rawText));
        if (cleanedText && cleanedText.length > 4) {
          this.currentFullTranscript = cleanedText;
          const wordsList = cleanedText.split(/\s+/).filter(Boolean);
          if (this.onInterimText) {
            this.onInterimText(wordsList, cleanedText, this.currentSpeaker || 'interviewer');
          }

          if (isLikelyInterviewQuestion(cleanedText)) {
            this.queueDetectedQuestion(cleanedText, 400);
          }
        }
      }
    } catch (err) {
      console.warn('[SpeechEngine] Whisper transcription error:', err);
    } finally {
      this.isTranscribing = false;
      this.resetUtteranceState();
    }
  }


  resetUtteranceState() {
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.speechDurationSamples = 0;
    this.isSpeaking = false;
    this.silenceSampleCount = 0;
  }

  getAccumulatedTranscript() {
    return this.currentFullTranscript.trim();
  }

  clearTranscript() {
    this.resetUtteranceState();
    this.currentFullTranscript = '';
    if (this.questionFinalizeTimer) {
      clearTimeout(this.questionFinalizeTimer);
      this.questionFinalizeTimer = null;
    }
  }

  stop() {
    this.isListening = false;
    this.isPaused = true;
    if (this.webSpeech) {
      try { this.webSpeech.stop(); } catch {}
    }
    if (this.questionFinalizeTimer) {
      clearTimeout(this.questionFinalizeTimer);
      this.questionFinalizeTimer = null;
    }
    this.resetUtteranceState();
  }
}
