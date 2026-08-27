// Sonar AI — Multi-Turn Live Interview Copilot (Continuous Question Flow + History Pagination + Parakeet UI)

import { INITIAL_SESSIONS, INITIAL_USER } from './data/initialSessions.js';
import { LLMEngine } from './ai/llmEngine.js';
import { ProfileStore } from './storage/profileStore.js';
import { audioCapture } from './audio/audioCapture.js';
import { SpeechRecognitionEngine, cleanTechnicalSpeech, filterMeaningfulQuestion } from './audio/speechRecognition.js';
import { ScreenCaptureAssistant } from './vision/screenCapture.js';

class SonarAiApp {
  constructor() {
    this.isHudMode = window.location.hash === '#hud' || !!window.shadowDesktop;
    if (this.isHudMode) {
      document.body.classList.add('hud-mode');
    }

    this.sessions = [...INITIAL_SESSIONS];
    this.user = { ...INITIAL_USER };
    this.isListening = false;
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.currentRawCode = '';
    this.isSynthesizing = false;
    this.isAnswerLocked = false;
    this.autoAnswerEnabled = true;

    // Multi-Turn History
    this.sessionHistory = [];
    this.currentHistoryIndex = 0;

    this.profile = ProfileStore.getProfile();
    this.settings = ProfileStore.getSettings();
    this.apiKeys = ProfileStore.getApiKeys();

    this.llmEngine = new LLMEngine(
      () => this.apiKeys,
      () => this.settings,
      () => this.profile
    );

    this.screenAssistant = new ScreenCaptureAssistant();

    this.initElements();
    this.initNotchWidget();
    this.initDraggableHUD();
    this.initSpeechEngine();
    this.initWaveformCanvas();
    this.startSessionTimer();
  }

  initElements() {
    this.topNotchWidget = document.getElementById('topNotchWidget');
    this.notchPillBar = document.getElementById('notchPillBar');
    this.notchDragGrip = document.getElementById('notchDragGrip');
    this.btnNotchAudioToggle = document.getElementById('btnNotchAudioToggle');
    this.notchWaveCanvas = document.getElementById('notchWaveCanvas');
    this.btnNotchAnswer = document.getElementById('btnNotchAnswer');
    this.btnNotchScreenshot = document.getElementById('btnNotchScreenshot');
    this.btnNotchChat = document.getElementById('btnNotchChat');
    this.btnNotchAutoAnswer = document.getElementById('btnNotchAutoAnswer');
    this.btnNotchMute = document.getElementById('btnNotchMute');
    this.btnNotchMenu = document.getElementById('btnNotchMenu');
    this.btnNotchClear = document.getElementById('btnNotchClear');
    this.btnNotchEndSession = document.getElementById('btnNotchEndSession');
    this.notchTimerText = document.getElementById('notchTimerText');
    this.notchSubtitlesCard = document.getElementById('notchSubtitlesCard');
    this.subtitlesLiveText = document.getElementById('subtitlesLiveText');
    this.notchSettingsDropdown = document.getElementById('notchSettingsDropdown');
    this.notchAnswerTeleprompter = document.getElementById('notchAnswerTeleprompter');
    this.teleprompterQTitle = document.getElementById('teleprompterQTitle');
    this.teleprompterBodyContent = document.getElementById('teleprompterBodyContent');

    this.btnCloseTeleprompter = document.getElementById('btnCloseTeleprompter');
    this.btnCopyAnswer = document.getElementById('btnCopyAnswer');
    this.btnClearTeleprompter = document.getElementById('btnClearTeleprompter');
    this.btnPagerPrev = document.getElementById('btnPagerPrev');
    this.btnPagerNext = document.getElementById('btnPagerNext');
    this.pagerText = document.getElementById('pagerText');

    this.togPrivate = document.getElementById('togPrivate');
    this.togAutoDetect = document.getElementById('togAutoDetect');
    this.togAutoAnswer = document.getElementById('togAutoAnswer');
    this.btnMenuDashboard = document.getElementById('btnMenuDashboard');
  }

  initNotchWidget() {
    // Menu Dropdown toggle
    if (this.btnNotchMenu) {
      this.btnNotchMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = this.notchSettingsDropdown.classList.toggle('open');
        if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
          window.shadowDesktop.resizeWindow(720, isOpen ? 480 : (this.isAnswerLocked ? 580 : 90));
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (this.topNotchWidget && !this.topNotchWidget.contains(e.target)) {
        this.notchSettingsDropdown.classList.remove('open');
        if (!this.isAnswerLocked) {
          if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
            window.shadowDesktop.resizeWindow(720, 90);
          }
        }
      }
    });

    // Auto Answer Toggle Pill
    if (this.btnNotchAutoAnswer) {
      this.btnNotchAutoAnswer.addEventListener('click', () => {
        this.autoAnswerEnabled = !this.autoAnswerEnabled;
        this.btnNotchAutoAnswer.classList.toggle('active', this.autoAnswerEnabled);
        if (this.togAutoAnswer) this.togAutoAnswer.classList.toggle('checked', this.autoAnswerEnabled);
      });
    }
    if (this.togAutoAnswer) {
      this.togAutoAnswer.addEventListener('click', () => {
        this.togAutoAnswer.classList.toggle('checked');
        this.autoAnswerEnabled = this.togAutoAnswer.classList.contains('checked');
        if (this.btnNotchAutoAnswer) this.btnNotchAutoAnswer.classList.toggle('active', this.autoAnswerEnabled);
      });
    }

    // Close Teleprompter Button
    if (this.btnCloseTeleprompter) {
      this.btnCloseTeleprompter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAnswerCard();
      });
    }

    // Clear Screen Buttons
    const handleClear = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      this.clearAll();
    };
    if (this.btnNotchClear) this.btnNotchClear.addEventListener('click', handleClear);
    if (this.btnClearTeleprompter) this.btnClearTeleprompter.addEventListener('click', handleClear);

    // History Pagers [◀] 1/3 [▶]
    if (this.btnPagerPrev) {
      this.btnPagerPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.sessionHistory.length > 0 && this.currentHistoryIndex > 0) {
          this.currentHistoryIndex--;
          this.renderHistoryItem();
        }
      });
    }
    if (this.btnPagerNext) {
      this.btnPagerNext.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.sessionHistory.length > 0 && this.currentHistoryIndex < this.sessionHistory.length - 1) {
          this.currentHistoryIndex++;
          this.renderHistoryItem();
        }
      });
    }

    // Copy Answer Button
    if (this.btnCopyAnswer) {
      this.btnCopyAnswer.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.currentRawCode) {
          navigator.clipboard.writeText(this.currentRawCode);
          this.btnCopyAnswer.style.color = '#4ade80';
          setTimeout(() => { this.btnCopyAnswer.style.color = '#94a3b8'; }, 1500);
        }
      });
    }

    // End Session Button
    if (this.btnNotchEndSession) {
      this.btnNotchEndSession.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.endSession();
      });
    }

    // Google Meet / System Tab Audio Share
    if (this.btnNotchMute) {
      this.btnNotchMute.addEventListener('click', async () => {
        const ok = await audioCapture.initSystemStream();
        if (ok) {
          this.btnNotchMute.classList.add('active');
          this.btnNotchMute.style.borderColor = '#22c55e';
          const mixedStream = audioCapture.getMixedStream();
          if (mixedStream && this.speechEngine) {
            this.speechEngine.start(mixedStream);
          }
          if (this.subtitlesLiveText) {
            this.subtitlesLiveText.textContent = "🎧 Google Meet / Call Audio Connected. Listening to interviewer...";
          }
        }
      });
    }

    // AI Answer Button (⌘↩)
    if (this.btnNotchAnswer) {
      this.btnNotchAnswer.addEventListener('click', () => {
        this.requestAiAnswer();
      });
    }

    // 📸 Screenshot (⌘⇧S)
    if (this.btnNotchScreenshot) {
      this.btnNotchScreenshot.addEventListener('click', () => {
        this.performScreenSnipe();
      });
    }

    // Chat (⌘K)
    if (this.btnNotchChat) {
      this.btnNotchChat.addEventListener('click', () => {
        const q = prompt("Ask Sonar AI (Real-Time Copilot):", "Write a C program for taking input and output");
        if (q) this.triggerNotchAnswer(q);
      });
    }

    // Open Web Dashboard
    if (this.btnMenuDashboard) {
      this.btnMenuDashboard.addEventListener('click', () => {
        window.open('http://localhost:3000', '_blank');
      });
    }

    // Global Key Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        this.requestAiAnswer();
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.performScreenSnipe();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const q = prompt("Ask Sonar AI (Real-Time Copilot):");
        if (q) this.triggerNotchAnswer(q);
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        this.clearAll();
      }
      if (e.key === 'Escape') {
        this.closeAnswerCard();
      }
    });
  }

  clearAll() {
    if (this.speechEngine) this.speechEngine.clearTranscript();
    this.sessionHistory = [];
    this.currentHistoryIndex = 0;
    if (this.pagerText) this.pagerText.textContent = `1/1`;
    if (this.subtitlesLiveText) {
      this.subtitlesLiveText.innerHTML = `<span style="color: #94a3b8; font-style: italic;">Listening for live interviewer speech...</span>`;
    }
    this.closeAnswerCard();
  }

  renderHistoryItem() {
    if (this.sessionHistory.length === 0) return;
    const item = this.sessionHistory[this.currentHistoryIndex];
    if (!item) return;

    if (this.pagerText) this.pagerText.textContent = `${this.currentHistoryIndex + 1}/${this.sessionHistory.length}`;
    if (this.teleprompterQTitle) this.teleprompterQTitle.textContent = `💬 Question: ${item.question}`;
    if (this.teleprompterBodyContent) this.teleprompterBodyContent.innerHTML = item.formattedHtml;
    this.currentRawCode = item.rawCode || '';
  }

  requestAiAnswer() {
    const transcript = this.speechEngine ? this.speechEngine.getAccumulatedTranscript() : '';
    const activeText = cleanTechnicalSpeech(transcript || (this.subtitlesLiveText ? this.subtitlesLiveText.textContent.replace(/LIVE:.*?|🎙️.*?|Listening.*?/g, '').trim() : ''));
    
    if (activeText && activeText.length > 2) {
      this.triggerNotchAnswer(activeText);
      if (this.speechEngine) this.speechEngine.clearTranscript();
    } else {
      const q = prompt("Ask Sonar AI (or speak into mic):", "Write a C program for taking input and output");
      if (q) this.triggerNotchAnswer(q);
    }
  }

  closeAnswerCard() {
    this.isAnswerLocked = false;
    this.notchAnswerTeleprompter.classList.remove('visible');
    this.notchSettingsDropdown.classList.remove('open');
    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(720, 90);
    }
  }

  initDraggableHUD() {
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let widgetPosX = 0;
    let widgetPosY = 8;

    const dragTarget = this.notchDragGrip || this.notchPillBar;

    if (dragTarget) {
      dragTarget.addEventListener('mousedown', (e) => {
        if (e.target.closest('.notch-pill-btn') || e.target.closest('button')) return;
        
        isDragging = true;
        startX = e.screenX || e.clientX;
        startY = e.screenY || e.clientY;
        document.body.style.cursor = 'grabbing';
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const currentX = e.screenX || e.clientX;
        const currentY = e.screenY || e.clientY;
        const deltaX = currentX - startX;
        const deltaY = currentY - startY;

        startX = currentX;
        startY = currentY;

        if (window.shadowDesktop && window.shadowDesktop.moveWindowBy) {
          window.shadowDesktop.moveWindowBy(deltaX, deltaY);
        } else if (this.topNotchWidget) {
          widgetPosX += deltaX;
          widgetPosY += deltaY;
          this.topNotchWidget.style.transform = `translate(${widgetPosX}px, ${widgetPosY}px)`;
        }
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          document.body.style.cursor = 'default';
        }
      });
    }
  }

  async performScreenSnipe() {
    this.isAnswerLocked = true;
    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(720, 580);
    }
    this.teleprompterQTitle.textContent = "💬 Question: Analyzing Screen Coding Challenge...";
    this.teleprompterBodyContent.innerHTML = `<span style="color: #fb923c; font-style: italic;">📸 Extracting problem from screen & generating solution via Groq (0.2s)...</span>`;
    this.notchAnswerTeleprompter.classList.add('visible');

    const screenshot = await this.screenAssistant.captureScreenSnippet();
    const problem = await this.screenAssistant.analyzeProblemImage(screenshot);
    this.triggerNotchAnswer(problem.extractedPrompt);
  }

  initSpeechEngine() {
    this.speechEngine = new SpeechRecognitionEngine({
      language: 'en',
      onInterimText: (wordsArray, conversationText) => {
        if (this.subtitlesLiveText) {
          if (Array.isArray(wordsArray) && wordsArray.length > 0) {
            const pillsHtml = wordsArray.map((w, idx) => {
              const isLast = idx === wordsArray.length - 1;
              return `<span class="asr-word-pill ${isLast ? 'latest' : ''}">${w}</span>`;
            }).join(' ');
            this.subtitlesLiveText.innerHTML = `<div class="asr-words-container">${pillsHtml}</div>`;
          } else {
            this.subtitlesLiveText.textContent = conversationText || "Listening for live interviewer speech...";
          }
        }
      },
      onQuestionDetected: (framedQuestion) => {
        if (this.autoAnswerEnabled && !this.isSynthesizing && framedQuestion && framedQuestion.length > 4) {
          const isJustNoise = /^(thank you[\.\!\?]?|thanks[\.\!\?]?|bye[\.\!\?]?)$/i.test(framedQuestion.trim());
          if (!isJustNoise) {
            this.triggerNotchAnswer(framedQuestion);
          }
        }
      }
    });

    audioCapture.initMicStream().then(ok => {
      if (ok && audioCapture.micStream) {
        this.speechEngine.start(audioCapture.micStream);
        this.isListening = true;
        if (this.subtitlesLiveText) {
          this.subtitlesLiveText.innerHTML = `<span style="color: #22c55e;">🎙️ Real-time listening active.</span> <span style="color: #94a3b8;">Listening for interviewer...</span>`;
        }
      }
    });
  }

  initWaveformCanvas() {
    const canvas = this.notchWaveCanvas;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const drawMiniBars = () => {
        requestAnimationFrame(drawMiniBars);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const count = 5;
        const time = Date.now() / 200;
        for (let i = 0; i < count; i++) {
          const h = this.isListening ? Math.sin(time + i) * 5 + 7 : 2;
          ctx.fillStyle = this.isListening ? '#22c55e' : '#64748b';
          ctx.fillRect(i * 6 + 2, (14 - h) / 2, 3, h);
        }
      };
      drawMiniBars();
    }
  }

  startSessionTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.elapsedSeconds = 0;
    this.timerInterval = setInterval(() => {
      this.elapsedSeconds++;
      const m = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
      const s = (this.elapsedSeconds % 60).toString().padStart(2, '0');
      if (this.notchTimerText) this.notchTimerText.textContent = `${m}:${s}`;
    }, 1000);
  }

  endSession() {
    if (this.speechEngine) this.speechEngine.stop();
    audioCapture.stop();
    this.isListening = false;

    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.subtitlesLiveText) {
      this.subtitlesLiveText.textContent = "⏹️ Session Ended.";
    }

    if (window.shadowDesktop && window.shadowDesktop.endSession) {
      window.shadowDesktop.endSession();
    } else {
      window.location.reload();
    }
  }

  async triggerNotchAnswer(question) {
    if (this.isSynthesizing) return;
    this.isSynthesizing = true;
    this.isAnswerLocked = true;

    // Reset speech buffer so the NEXT question spoken by the interviewer starts fresh!
    if (this.speechEngine) {
      this.speechEngine.clearTranscript();
    }

    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(720, 580);
    }
    
    const cleanedQ = cleanTechnicalSpeech(question);
    this.teleprompterQTitle.textContent = `💬 Question: ${cleanedQ}`;
    this.teleprompterBodyContent.innerHTML = `<span style="color: #4ade80; font-style: italic;">⚡ Analyzing & streaming solution (sub-200ms)...</span>`;
    this.notchAnswerTeleprompter.classList.add('visible');

    try {
      await this.llmEngine.generateAnswer(
        cleanedQ,
        (chunk, fullText) => {
          this.renderAnswerContent(fullText, cleanedQ, false);
        },
        (fullText) => {
          this.renderAnswerContent(fullText, cleanedQ, true);
          this.isSynthesizing = false;
        }
      );
    } catch (err) {
      this.isSynthesizing = false;
      this.teleprompterBodyContent.innerHTML = `<span style="color: #f87171;">❌ Synthesis error: ${err.message}</span>`;
    }
  }

  renderAnswerContent(text, questionTitle, isFinal = false) {
    let raw = text;
    const codeMatch = raw.match(/```(\w+)?\n([\s\S]*?)```/);
    let codeHtml = '';
    if (codeMatch) {
      this.currentRawCode = codeMatch[2].trim();
      codeHtml = `<pre><code>${this.currentRawCode.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>`;
    }

    let formattedHtml = raw
      .replace(/💬 Question:?\s*(.*?)(?=\n|$)/gi, '<div style="font-weight: 700; color: #f8fafc; margin-bottom: 6px;">💬 Question: <span style="font-weight: 500; color: #e2e8f0;">$1</span></div>')
      .replace(/⭐ Answer:?\s*(.*?)(?=\n|$)/gi, '<div style="margin-bottom: 8px;"><strong style="color: #38bdf8;">⭐ Answer:</strong> <span style="color: #f1f5f9;">$1</span></div>')
      .replace(/🔑 Key Steps:?/gi, '<div style="font-weight: 700; color: #facc15; margin: 8px 0 4px 0;">🔑 Key Steps:</div>')
      .replace(/💻 Code:?/gi, '<div style="font-weight: 700; color: #38bdf8; margin: 10px 0 4px 0;">💻 Code:</div>')
      .replace(/💡 Explanation:?/gi, '<div style="font-weight: 700; color: #a855f7; margin: 10px 0 4px 0;">💡 Explanation:</div>')
      .replace(/•\s*(.*?)(?=\n|$)/g, '<li style="margin-left: 14px; margin-bottom: 3px; color: #e2e8f0; font-size: 0.88rem; line-height: 1.5;">$1</li>')
      .replace(/```(\w+)?\n[\s\S]*?```/g, codeHtml);

    this.teleprompterBodyContent.innerHTML = formattedHtml;

    if (isFinal) {
      // Push into multi-turn session history
      this.sessionHistory.push({
        question: questionTitle,
        formattedHtml: formattedHtml,
        rawCode: this.currentRawCode
      });
      this.currentHistoryIndex = this.sessionHistory.length - 1;
      if (this.pagerText) {
        this.pagerText.textContent = `${this.sessionHistory.length}/${this.sessionHistory.length}`;
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.sonarApp = new SonarAiApp();
});
