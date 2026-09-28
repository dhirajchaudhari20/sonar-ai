// Sonar AI Candidate Resume RAG (Retrieval-Augmented Generation) Knowledge Base Engine
// Performs semantic & keyword retrieval over candidate resume artifacts to inject into live interview answers

export class ResumeRagEngine {
  constructor() {
    this.chunks = [];
  }

  // Chunk resume into semantic sections
  indexResume(resumeText, profile = {}) {
    if (!resumeText || typeof resumeText !== 'string') return;
    this.chunks = [];

    const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean);
    let currentSection = 'General Experience';
    let currentChunk = [];

    const sectionHeaders = [
      /^(experience|work experience|professional experience|employment)/i,
      /^(projects|key projects|notable projects|personal projects)/i,
      /^(skills|technical skills|technologies|core competencies|tools)/i,
      /^(education|academic background|certifications|degrees)/i,
      /^(summary|professional summary|about me|profile)/i
    ];

    for (const line of lines) {
      let isHeader = false;
      for (const rx of sectionHeaders) {
        if (rx.test(line) && line.length < 40) {
          if (currentChunk.length > 0) {
            this.chunks.push({
              section: currentSection,
              content: currentChunk.join(' ')
            });
            currentChunk = [];
          }
          currentSection = line;
          isHeader = true;
          break;
        }
      }

      if (!isHeader) {
        currentChunk.push(line);
        // Split large paragraphs into smaller chunks (~300 chars)
        if (currentChunk.join(' ').length > 350) {
          this.chunks.push({
            section: currentSection,
            content: currentChunk.join(' ')
          });
          currentChunk = [];
        }
      }
    }

    if (currentChunk.length > 0) {
      this.chunks.push({
        section: currentSection,
        content: currentChunk.join(' ')
      });
    }

    // Also index skills as a dedicated high-priority chunk
    if (Array.isArray(profile.keyStrengths) && profile.keyStrengths.length > 0) {
      this.chunks.push({
        section: 'Core Skills',
        content: `Core candidate competencies: ${profile.keyStrengths.join(', ')}`
      });
    }
  }

  // Retrieve top relevant resume snippets based on interview question
  retrieve(question, topK = 3) {
    if (!question || this.chunks.length === 0) return [];

    const qTerms = question.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !/^(the|and|for|with|that|this|what|how|why|can|you|are|was|were)$/i.test(w));

    if (qTerms.length === 0) {
      return this.chunks.slice(0, topK).map(c => `[${c.section}]: ${c.content}`);
    }

    const scored = this.chunks.map(chunk => {
      let score = 0;
      const lower = (chunk.section + ' ' + chunk.content).toLowerCase();

      for (const term of qTerms) {
        if (lower.includes(term)) {
          score += 2;
          try {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const count = (lower.match(new RegExp(`\\b${escaped}\\b`, 'gi')) || []).length;
            score += count * 1.5;
          } catch {
            score += 1;
          }
        }
      }

      return { chunk, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored
      .filter(item => item.score > 0)
      .slice(0, topK)
      .map(item => `[${item.chunk.section}]: ${item.chunk.content}`);
  }
}

export const resumeRag = new ResumeRagEngine();
