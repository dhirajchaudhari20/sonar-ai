// Session history and QA transcript store

export class SessionStore {
  constructor() {
    this.sessionStartTime = new Date();
    this.entries = []; // { id, timestamp, question, answer, model, latencyMs, tags, notes }
    this.isRecording = false;
  }

  startSession() {
    this.sessionStartTime = new Date();
    this.entries = [];
    this.isRecording = true;
  }

  addEntry({ question, answer, model = 'Gemini 1.5', latencyMs = 1200, category = 'General' }) {
    const entry = {
      id: 'qa_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      relativeTime: this.getElapsedTimeString(),
      question,
      answer,
      model,
      latencyMs,
      category,
      starred: false,
      notes: ''
    };
    this.entries.unshift(entry);
    return entry;
  }

  getElapsedTimeString() {
    const diff = Math.floor((Date.now() - this.sessionStartTime.getTime()) / 1000);
    const mins = Math.floor(diff / 60).toString().padStart(2, '0');
    const secs = (diff % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  getAllEntries() {
    return this.entries;
  }

  toggleStar(id) {
    const item = this.entries.find(e => e.id === id);
    if (item) item.starred = !item.starred;
  }

  exportMarkdown(candidateName = 'Candidate') {
    let md = `# Interview Transcript & Debrief\n`;
    md += `**Date:** ${new Date().toLocaleDateString()} | **Candidate:** ${candidateName}\n`;
    md += `**Total Questions Handled:** ${this.entries.length}\n\n---\n\n`;

    this.entries.slice().reverse().forEach((e, idx) => {
      md += `### ${idx + 1}. [${e.relativeTime}] ${e.question}\n`;
      md += `*Generated via ${e.model} in ${(e.latencyMs / 1000).toFixed(2)}s*\n\n`;
      md += `${e.answer}\n\n`;
      if (e.notes) {
        md += `> **Self Notes:** ${e.notes}\n\n`;
      }
      md += `---\n\n`;
    });

    return md;
  }

  exportJSON() {
    return JSON.stringify({
      sessionStartTime: this.sessionStartTime,
      totalCount: this.entries.length,
      entries: this.entries
    }, null, 2);
  }
}

export const sessionStore = new SessionStore();
