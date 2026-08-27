// Multi-LLM Orchestration Engine (Groq, Gemini, OpenAI, Anthropic, and Offline Simulator)

import { buildInterviewPrompt } from './promptBuilder.js';
import { findMockMatch, MOCK_INTERVIEW_DATA } from './mockData.js';

// Hardcoded Groq fallback key — ensures live API fires even if localStorage is empty (Electron first run)
const GROQ_FALLBACK_KEY = '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';
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_PRIMARY_MODEL = 'openai/gpt-oss-120b';
const GROQ_FALLBACK_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b'];

export class LLMEngine {
  constructor(getApiKeys, getSettings, getProfile) {
    this.getApiKeys = getApiKeys;
    this.getSettings = getSettings;
    this.getProfile = getProfile;
  }

  async generateAnswer(question, onChunk, onComplete, onError) {
    const startTime = performance.now();
    const settings = this.getSettings();
    const keys = this.getApiKeys();
    const prompt = buildInterviewPrompt(question);

    // Default to groq (fastest). Use hardcoded key as fallback if localStorage is empty.
    const provider = settings.provider || 'groq';
    const activeKey = keys[provider] || (provider === 'groq' ? GROQ_FALLBACK_KEY : null);

    // If no key at all, show error so user knows
    if (!activeKey || provider === 'mock') {
      onComplete('⚠️ No API key configured. Open Settings and add a Groq or OpenAI key.', 0, 'No Provider');
      return;
    }

    try {
      if (provider === 'groq') {
        let lastErr = null;
        for (const modelCandidate of GROQ_FALLBACK_MODELS) {
          try {
            await this.callOpenAICompatible(
              GROQ_ENDPOINT,
              activeKey,
              modelCandidate,
              prompt,
              onChunk,
              onComplete,
              startTime
            );
            return; // Success!
          } catch (modelErr) {
            lastErr = modelErr;
            console.warn(`[LLMEngine] Groq model ${modelCandidate} failed, trying next candidate...`, modelErr);
          }
        }
        throw lastErr || new Error('All Groq models failed');
      } else if (provider === 'gemini') {
        await this.callGemini(activeKey, prompt, settings.model || 'gemini-1.5-flash', onChunk, onComplete, startTime);
      } else if (provider === 'openai') {
        await this.callOpenAICompatible(
          'https://api.openai.com/v1/chat/completions',
          activeKey,
          settings.model || 'gpt-4o',
          prompt,
          onChunk,
          onComplete,
          startTime
        );
      } else if (provider === 'anthropic') {
        await this.callAnthropic(activeKey, prompt, settings.model || 'claude-3-5-sonnet-20241022', onChunk, onComplete, startTime);
      } else {
        onComplete('⚠️ Unknown provider: ' + provider, 0, 'Error');
      }
    } catch (err) {
      // Show actual error in HUD — do NOT silently switch to simulator
      console.error(`[LLMEngine] ${provider} API error:`, err);
      onComplete(`❌ API Error (${provider}): ${err.message}\n\nCheck your API key or network connection.`, 0, 'Error');
    }
  }

  // Google Gemini API Stream
  async callGemini(apiKey, prompt, model, onChunk, onComplete, startTime) {
    const cleanModel = model.includes('gemini') ? model : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API returned ${response.status}: ${errText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep remaining incomplete line

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const chunk = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
              fullText += chunk;
              onChunk(chunk, fullText);
            }
          } catch {
            // Ignore parse errors on SSE ping lines
          }
        }
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    onComplete(fullText, latencyMs, `Gemini (${cleanModel})`);
  }

  // OpenAI / Groq Compatible Streaming
  async callOpenAICompatible(endpoint, apiKey, model, prompt, onChunk, onComplete, startTime) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        stream: true
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`HTTP ${response.status}: ${err}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullText += delta;
              onChunk(delta, fullText);
            }
          } catch {
            // ignore
          }
        }
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    onComplete(fullText, latencyMs, model);
  }

  // Anthropic API streaming
  async callAnthropic(apiKey, prompt, model, onChunk, onComplete, startTime) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'dangerously-allow-browser': 'true'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`Anthropic error ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullText += data.delta.text;
              onChunk(data.delta.text, fullText);
            }
          } catch {}
        }
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    onComplete(fullText, latencyMs, model);
  }

  // Built-in intelligent simulator with streaming effect
  async runSimulator(question, startTime, onChunk, onComplete, prefix = '') {
    const match = findMockMatch(question);
    let rawText = '';

    if (match) {
      rawText = `### ⚡ QUICK TALKING POINTS
${match.quickBullets.map(b => `- ${b}`).join('\n')}

---

### 🎯 STRUCTURED ANSWER (${match.category})
${match.starAnswer}`;
    } else {
      // Dynamic synthesis for unrecognized queries
      rawText = `### ⚡ QUICK TALKING POINTS
- **Direct Answer:** Ground this in my 6+ years building real-time full-stack architectures.
- **Key Metric:** Highlight 45% p99 latency reduction and 1.2M DAU scale at Nexus Tech.
- **Outcome:** Emphasize reliable execution, cross-functional alignment, and clean maintainable code.

---

### 🎯 STRUCTURED RESPONSE
**Situation & Context:**
In my previous role leading core engineering at Nexus Tech, I dealt directly with similar challenges around high availability and system resilience.

**Action Taken:**
1. Broke down the problem into decoupled sub-components with clear interface contracts.
2. Implemented automated profiling, telemetry metrics, and load testing against peak simulated traffic.
3. Collaborated closely with product stakeholders to align on SLA constraints and fallback degradations.

**Result & Takeaway:**
Successfully shipped the feature with zero downtime, lowering incident rates by 30% and creating a reusable architectural blueprint for the engineering team.`;
    }

    if (prefix) rawText = prefix + rawText;

    // Simulate natural fast streaming (15ms per token/word)
    const tokens = rawText.split(/(\s+)/);
    let streamed = '';

    for (let i = 0; i < tokens.length; i++) {
      streamed += tokens[i];
      onChunk(tokens[i], streamed);
      await new Promise(r => setTimeout(r, 12));
    }

    const latencyMs = Math.round(performance.now() - startTime);
    onComplete(streamed, latencyMs, 'Parakeet Copilot (Instant Neural Engine)');
  }
}
