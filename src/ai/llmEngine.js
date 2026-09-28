// Multi-LLM Orchestration Engine with Full Multi-Turn Conversation Memory (Groq, Gemini, OpenAI, Anthropic)

import { buildSystemPrompt, buildInterviewPrompt, isExperienceQuestion } from './promptBuilder.js';
import { findMockMatch } from './mockData.js';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_FALLBACK_MODELS = [
  'qwen/qwen3.8-27b',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.6-27b',
  'groq/compound',
  'groq/compound-mini'
];

export class LLMEngine {
  constructor(getApiKeys, getSettings, getProfile) {
    this.getApiKeys = getApiKeys;
    this.getSettings = getSettings;
    this.getProfile = getProfile;
  }

  // Format conversation history for OpenAI-compatible chat completions
  buildChatMessages(currentQuestion, conversationHistory = []) {
    const profile = this.getProfile ? this.getProfile() : null;
    const systemPrompt = buildSystemPrompt(profile, currentQuestion);

    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Append past turns (up to last 8 turns to retain deep context without exceeding token limits)
    const recentTurns = conversationHistory.slice(-8);
    for (const turn of recentTurns) {
      if (turn.question) {
        messages.push({ role: 'user', content: turn.question });
      }
      if (turn.rawAnswer || turn.formattedText || turn.rawCode) {
        const assistantContent = turn.rawAnswer || turn.formattedText || (turn.rawCode ? `Code:\n\`\`\`\n${turn.rawCode}\n\`\`\`` : '');
        if (assistantContent) {
          messages.push({ role: 'assistant', content: assistantContent });
        }
      }
    }

    // Append current question
    messages.push({
      role: 'user',
      content: buildInterviewPrompt(currentQuestion)
    });

    // ── EXPERIENCE QUESTION PREFILL ──────────────────────────────────────────
    // For "have you worked on X?" type questions, inject an assistant prefill
    // message that FORCES the model to start from "Yes, I have worked on..."
    // This is far more reliable than system prompt instructions alone.
    if (isExperienceQuestion(currentQuestion)) {
      // Extract the core topic from the question
      const topicMatch = currentQuestion.match(
        /(?:worked on|used|built|experience with|familiar with|background in|experience in|knowledge of|about|with)\s+([\w\s.+#-]{2,40})/i
      );
      const topic = topicMatch
        ? topicMatch[1].trim().replace(/[?.!,]+$/, '')
        : currentQuestion.replace(/^(have you|do you have|are you familiar with|tell me about your experience with|did you work on)\s*/i, '').replace(/[?.!,]+$/, '').trim();

      const prefill = `✅ Direct Answer (Bol do confidently):
• Yes, I have worked on ${topic} — hands-on experience through real projects.

🚀 Project Reference:`;

      messages.push({
        role: 'assistant',
        content: prefill
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    return messages;
  }

  async generateAnswer(question, conversationHistory = [], onChunk, onComplete, onError) {
    const startTime = performance.now();
    const settings = this.getSettings ? this.getSettings() : {};
    const keys = this.getApiKeys ? this.getApiKeys() : {};
    const provider = settings.provider || 'groq';
    const activeKey = keys[provider] || keys.groq;

    if (!activeKey || !activeKey.trim()) {
      const errMsg = '⚠️ Groq API Key required. Click "🔑 API Key" in the menu to enter your free Groq key from console.groq.com/keys';
      if (onError) onError(new Error(errMsg));
      if (onComplete) onComplete(errMsg, 0, 'No Key');
      return;
    }

    const messages = this.buildChatMessages(question, conversationHistory);

    try {
      if (provider === 'groq') {
        let lastErr = null;
        for (const modelCandidate of GROQ_FALLBACK_MODELS) {
          try {
            await this.callOpenAICompatible(
              GROQ_ENDPOINT,
              activeKey,
              modelCandidate,
              messages,
              onChunk,
              onComplete,
              startTime
            );
            return; // Success
          } catch (modelErr) {
            lastErr = modelErr;
            console.warn(`[LLMEngine] Groq model ${modelCandidate} failed, trying next candidate...`, modelErr);
          }
        }
        throw lastErr || new Error('All Groq models failed');
      } else if (provider === 'gemini') {
        await this.callGemini(activeKey, messages, settings.model || 'gemini-1.5-flash', onChunk, onComplete, startTime);
      } else if (provider === 'openai') {
        await this.callOpenAICompatible(
          'https://api.openai.com/v1/chat/completions',
          activeKey,
          settings.model || 'gpt-4o',
          messages,
          onChunk,
          onComplete,
          startTime
        );
      } else if (provider === 'anthropic') {
        await this.callAnthropic(activeKey, messages, settings.model || 'claude-3-5-sonnet-20241022', onChunk, onComplete, startTime);
      } else {
        if (onComplete) onComplete('⚠️ Unknown provider: ' + provider, 0, 'Error');
      }
    } catch (err) {
      console.error(`[LLMEngine] ${provider} API error:`, err);
      if (onError) onError(err);
      if (onComplete) {
        onComplete(`❌ API Error (${provider}): ${err.message}\n\nPlease check your API key or network connection.`, 0, 'Error');
      }
    }
  }

  // Google Gemini API Multi-Turn Stream
  async callGemini(apiKey, messages, model, onChunk, onComplete, startTime) {
    const cleanModel = model.includes('gemini') ? model : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

    // Convert messages to Gemini format
    const contents = [];
    let systemInstruction = null;

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = { parts: [{ text: msg.content }] };
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
    }

    const payload = {
      contents: contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500
      }
    };
    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
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
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const chunk = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (chunk) {
              fullText += chunk;
              if (onChunk) onChunk(chunk, fullText);
            }
          } catch {}
        }
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    if (onComplete) onComplete(fullText, latencyMs, `Gemini (${cleanModel})`);
  }

  // OpenAI / Groq Compatible Multi-Turn Streaming
  async callOpenAICompatible(endpoint, apiKey, model, messages, onChunk, onComplete, startTime) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.15,
        max_tokens: 1500,
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
            const delta = parsed.choices?.[0]?.delta || {};
            const content = delta.content || delta.reasoning || '';
            if (content) {
              fullText += content;
              if (onChunk) onChunk(content, fullText);
            }
          } catch {}
        }
      }
    }

    // Fallback: if streaming yielded an empty response, try non-streaming once
    if (!fullText || fullText.trim().length === 0) {
      try {
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: messages,
            temperature: 0.2,
            max_tokens: 1500,
            stream: false
          })
        });
        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          const content = data.choices?.[0]?.message?.content || '';
          if (content) {
            fullText = content;
            if (onChunk) onChunk(content, fullText);
          }
        }
      } catch (fbErr) {
        console.warn(`[LLMEngine] Non-streaming fallback failed for ${model}:`, fbErr);
      }
    }

    if (!fullText || fullText.trim().length === 0) {
      throw new Error(`Model ${model} returned an empty response`);
    }

    const latencyMs = Math.round(performance.now() - startTime);
    if (onComplete) onComplete(fullText, latencyMs, model);
  }

  // Anthropic API streaming with Conversation History
  async callAnthropic(apiKey, messages, model, onChunk, onComplete, startTime) {
    let systemPrompt = '';
    const anthropicMessages = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemPrompt = msg.content;
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      }
    }

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
        max_tokens: 1500,
        system: systemPrompt,
        messages: anthropicMessages,
        stream: true
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${errText}`);
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
              if (onChunk) onChunk(data.delta.text, fullText);
            }
          } catch {}
        }
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    if (onComplete) onComplete(fullText, latencyMs, model);
  }
}
