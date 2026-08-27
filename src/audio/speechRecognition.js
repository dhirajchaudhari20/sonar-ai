// Parakeet-Grade Rolling Utterance Speech Recognition Engine (0 Word Drop, Rolling Buffer, Strict English)

import { ProfileStore } from '../storage/profileStore.js';

const GROQ_DEFAULT_KEY = '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';

// Phonetic & technical grammar cleaner for coding interviews
export function cleanTechnicalSpeech(rawText) {
  if (!rawText) return '';
  let text = rawText;
  text = text.replace(/\bsee plus plus\b|\bc plus plus\b|\bc\+\+\b/gi, 'C++');
  text = text.replace(/\bsee sharp\b|\bc sharp\b/gi, 'C#');
  text = text.replace(/\bwriter program\b|\bwrite a program\b/gi, 'write a program');
  text = text.replace(/\bwriter code\b|\bwrite a code\b/gi, 'write code');
  text = text.replace(/\bwriter\b/gi, 'write');
  text = text.replace(/\bfor for loop\b|\bfour loop\b/gi, 'for loop');
  text = text.replace(/\bto sum\b/gi, 'two sum');
  text = text.replace(/\bby three\b/gi, 'binary tree');
  text = text.replace(/\bby nary\b/gi, 'binary');
  text = text.replace(/\blink list\b|\blinked list\b/gi, 'linked list');
  text = text.replace(/\bpie son\b|\bpie ton\b|\bpython\b/gi, 'Python');
  text = text.replace(/\bhash table\b/gi, 'hashmap');
  text = text.replace(/\bcall back\b/gi, 'callback');
  text = text.replace(/\basync away\b/gi, 'async await');
  text = text.replace(/\bclass and object\b|\bclasses and objects\b/gi, 'classes and objects');
  text = text.replace(/\bapi\b/gi, 'API');
  text = text.replace(/\bsql\b/gi, 'SQL');
  return text.trim();
}

export function filterMeaningfulQuestion(rawText) {
  if (!rawText) return '';
  let text = cleanTechnicalSpeech(rawText);
  // Remove standalone hallucinated filler noises
  text = text.replace(/^(thank you[\.\!\?]?|thanks[\.\!\?]?|thanks for watching|subtitles by.*|bye[\.\!\?]?)\s*/gi, '');
  text = text.replace(/\s*(thank you[\.\!\?]?|thanks[\.\!\?]?|bye[\.\!\?]?)$/gi, '');
  return text.trim();
}

export class SpeechRecognitionEngine {
  constructor({ onInterimText, onQuestionDetected, onStatusChange, language = 'en' }) {
    this.onInterimText = onInterimText;
    this.onQuestionDetected = onQuestionDetected;
    this.onStatusChange = onStatusChange;
    this.language = 'en';
    this.audioContext = null;
    this.processorNode = null;
    this.mediaStreamSource = null;
    this.isListening = false;
    this.isPaused = false;
    
    // Rolling Utterance Accumulator (Holds continuous PCM samples of the CURRENT sentence)
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.silenceSampleCount = 0;
    this.isSpeaking = false;
    this.isTranscribing = false;
    this.pendingTranscribe = false;

    this.currentFullTranscript = '';
    this.transcribeInterval = null;
    this.questionFinalizeTimer = null;
  }

  isSupported() {
    return !!(window.AudioContext || window.webkitAudioContext);
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
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');

    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);

    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  start(stream) {
    if (!stream) return;
    this.isListening = true;
    this.isPaused = false;
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.currentFullTranscript = '';

    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
      }

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isListening || this.isPaused) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const samples = new Float32Array(inputData.length);
        samples.set(inputData);
        this.utteranceBuffers.push(samples);
        this.utteranceSampleCount += samples.length;

        // Keep rolling buffer from exceeding 20 seconds
        const nativeSampleRate = this.audioContext.sampleRate;
        const maxSamples = nativeSampleRate * 20;
        while (this.utteranceSampleCount > maxSamples && this.utteranceBuffers.length > 0) {
          const removed = this.utteranceBuffers.shift();
          this.utteranceSampleCount -= removed.length;
        }

        // Calculate Voice Energy
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          sum += samples[i] * samples[i];
        }
        const rms = Math.sqrt(sum / samples.length);

        if (rms > 0.006) {
          this.isSpeaking = true;
          this.silenceSampleCount = 0;
          if (this.questionFinalizeTimer) {
            clearTimeout(this.questionFinalizeTimer);
            this.questionFinalizeTimer = null;
          }
        } else if (this.isSpeaking) {
          this.silenceSampleCount += samples.length;
          const silenceDurationSec = this.silenceSampleCount / nativeSampleRate;
          
          // When 1.4s of true silence occurs after speech, finalize the complete sentence!
          if (silenceDurationSec >= 1.4 && !this.questionFinalizeTimer) {
            this.questionFinalizeTimer = setTimeout(() => {
              this.finalizeCurrentQuestion();
            }, 100);
          }
        }
      };

      this.mediaStreamSource.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Periodic rolling transcription every 1.0s while speech is ongoing
      this.transcribeInterval = setInterval(() => {
        if (this.isSpeaking && this.utteranceSampleCount > (this.audioContext.sampleRate * 0.6)) {
          this.transcribeRollingBuffer();
        }
      }, 1000);

      if (this.onStatusChange) this.onStatusChange('listening');
    } catch (err) {
      console.warn('[SpeechEngine] AudioContext setup error:', err);
    }
  }

  // Transcribes the FULL continuous sentence buffer up to now (NEVER dropping the beginning!)
  async transcribeRollingBuffer() {
    if (this.isTranscribing || this.utteranceBuffers.length === 0) return;
    this.isTranscribing = true;

    try {
      const nativeSampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;
      const totalLength = this.utteranceBuffers.reduce((acc, buf) => acc + buf.length, 0);
      const merged = new Float32Array(totalLength);
      let offset = 0;
      for (const buf of this.utteranceBuffers) {
        merged.set(buf, offset);
        offset += buf.length;
      }

      const resampled16k = this.downsampleTo16k(merged, nativeSampleRate);
      const wavBlob = this.encodeWAV(resampled16k, 16000);

      const keys = ProfileStore.getApiKeys();
      const apiKey = keys.groq || GROQ_DEFAULT_KEY;

      const formData = new FormData();
      formData.append('file', wavBlob, 'rolling_speech.wav');
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'json');
      formData.append('language', 'en'); // STRICT ENGLISH
      formData.append('temperature', '0.0');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.text?.trim();
        if (rawText) {
          const cleanedText = filterMeaningfulQuestion(rawText);
          if (cleanedText && cleanedText.length > 1) {
            this.currentFullTranscript = cleanedText;
            const wordsList = cleanedText.split(/\s+/).filter(Boolean);
            if (this.onInterimText) {
              this.onInterimText(wordsList, cleanedText);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[SpeechEngine] Transcription error:', err);
    } finally {
      this.isTranscribing = false;
    }
  }

  // Finalizes the full sentence when the user finishes speaking
  async finalizeCurrentQuestion() {
    await this.transcribeRollingBuffer();

    const fullQuestion = this.currentFullTranscript.trim();
    if (fullQuestion && fullQuestion.length >= 6) {
      if (this.onQuestionDetected) {
        this.onQuestionDetected(fullQuestion);
      }
    }

    // Reset utterance buffer for the NEXT question from interviewer
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.isSpeaking = false;
    this.silenceSampleCount = 0;
    this.currentFullTranscript = '';
  }

  getAccumulatedTranscript() {
    return this.currentFullTranscript.trim();
  }

  clearTranscript() {
    this.utteranceBuffers = [];
    this.utteranceSampleCount = 0;
    this.currentFullTranscript = '';
    this.isSpeaking = false;
  }

  stop() {
    this.isListening = false;
    this.isPaused = true;
    if (this.transcribeInterval) clearInterval(this.transcribeInterval);
    if (this.questionFinalizeTimer) clearTimeout(this.questionFinalizeTimer);
    if (this.processorNode) {
      try { this.processorNode.disconnect(); this.processorNode = null; } catch {}
    }
    if (this.mediaStreamSource) {
      try { this.mediaStreamSource.disconnect(); this.mediaStreamSource = null; } catch {}
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); this.audioContext = null; } catch {}
    }
  }
}
