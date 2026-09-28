// Sonar AI — Multi-Turn Live Interview Copilot with Deep Context Memory, Dual Audio Engine & Mic Mute
// Real-Time Google Meet / Zoom Audio Loopback + Candidate Mic Digital Mixer + Fast Groq Streaming
// Eye-Contact Teleprompter Mode + Follow-Up Predictor + STAR Behavioral + System Design Diagrams + Knowledge Base + Debrief Exporter

import { INITIAL_SESSIONS, INITIAL_USER } from './data/initialSessions.js';
import { LLMEngine } from './ai/llmEngine.js';
import { ProfileStore } from './storage/profileStore.js';
import { parsePdfResume, parseDocxResume, parseImageResume, parseResumeWithAI } from './storage/resumeParser.js';
import { audioCapture } from './audio/audioCapture.js';
import { SpeechRecognitionEngine, cleanTechnicalSpeech, filterMeaningfulQuestion } from './audio/speechRecognition.js';
import { ScreenCaptureAssistant } from './vision/screenCapture.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// Convert raw interview question to a short Hinglish topic label for the UI header
function getHinglishQuestionLabel(question) {
  if (!question) return '...';
  const q = question.trim();

  // Experience / background pattern
  if (/have you (worked|used|built|implemented|deployed|done|experience|familiar)|do you have experience|are you familiar|tell me about your experience|did you work|have you ever|experience with|background in|used before/i.test(q)) {
    // Extract the technology/topic after the pattern
    const topicMatch = q.match(/(?:worked on|used|built|experience with|familiar with|background in|experience in|knowledge of|about)\s+([\w\s.#+]{2,40})/i)
      || q.match(/(?:have you worked|do you have experience|tell me about).{0,20}?([A-Z][\w.+# ]{2,30})/i);
    const topic = topicMatch ? topicMatch[1].trim().replace(/[?.!,]+$/, '') : q.slice(0, 40);
    return `💬 Experience: ${topic}`;
  }

  // Coding / algorithm pattern
  if (/write|implement|code|function|program|leetcode|algorithm|solve/i.test(q)) {
    const words = q.replace(/^(write|implement|code|create|build|solve)\s+(a\s+)?(function|program|solution|code)?\s*/i, '').slice(0, 45);
    return `⚡ Code: ${words}`;
  }

  // System design pattern
  if (/design|architecture|scalab|system|microservice|distributed/i.test(q)) {
    return `🏗️ Design: ${q.slice(0, 45)}`;
  }

  // Behavioral pattern
  if (/tell me about|walk me through|describe a time|give me an example|strength|weakness|conflict|leadership/i.test(q)) {
    return `🎯 Behavioral: ${q.slice(0, 40)}`;
  }

  // Default: just show first 50 chars
  return `💬 ${q.length > 55 ? q.slice(0, 52) + '...' : q}`;
}
class SonarAiApp {
  constructor() {
    this.isHudMode = window.location.hash === '#hud' || !!window.shadowDesktop;
    if (this.isHudMode) {
      document.body.classList.add('hud-mode');
    }

    this.sessions = [...INITIAL_SESSIONS];
    this.user = { ...INITIAL_USER };
    this.isListening = false;
    this.isMicMuted = false;
    this.isTransparencyMode = false;
    this.hudOpacity = 70; // percent
    this.elapsedSeconds = 0;
    this.timerInterval = null;
    this.currentRawCode = '';
    this.isSynthesizing = false;
    this.synthesisSafetyTimer = null;
    this.isAnswerLocked = false;
    this.autoAnswerEnabled = true;
    this.isEyeContactMode = false;
    this.isStallMode = true;    // Show stalling phrase while AI loads
    this.isKeywordMode = false;  // Show keywords-only instead of full answers

    // Full Multi-Turn Conversation Memory
    this.sessionHistory = []; // Array of { question, rawAnswer, formattedHtml, rawCode, followUps, timestamp }
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
    this.initModals();
    this.startSessionTimer();
  }

  initElements() {
    this.topNotchWidget = document.getElementById('topNotchWidget');
    this.notchPillBar = document.getElementById('notchPillBar');
    this.notchDragGrip = document.getElementById('notchDragGrip');
    this.btnNotchAudioToggle = document.getElementById('btnNotchAudioToggle');
    this.micStatusDot = document.getElementById('micStatusDot');
    this.micLabelText = document.getElementById('micLabelText');
    this.notchWaveCanvas = document.getElementById('notchWaveCanvas');
    this.btnNotchAnswer = document.getElementById('btnNotchAnswer');
    this.btnNotchScreenshot = document.getElementById('btnNotchScreenshot');
    this.btnNotchChat = document.getElementById('btnNotchChat');
    this.btnNotchAutoAnswer = document.getElementById('btnNotchAutoAnswer');
    this.btnNotchEyeContact = document.getElementById('btnNotchEyeContact');
    this.btnNotchMute = document.getElementById('btnNotchMute');
    this.btnNotchDebrief = document.getElementById('btnNotchDebrief');
    this.btnNotchMenu = document.getElementById('btnNotchMenu');
    this.btnNotchClear = document.getElementById('btnNotchClear');
    this.btnNotchEndSession = document.getElementById('btnNotchEndSession');
    this.btnNotchStall = document.getElementById('btnNotchStall');
    this.btnNotchKeywords = document.getElementById('btnNotchKeywords');
    this.notchTimerText = document.getElementById('notchTimerText');
    this.notchSubtitlesCard = document.getElementById('notchSubtitlesCard');
    this.subtitlesLiveText = document.getElementById('subtitlesLiveText');
    this.subtitlesSpeakerBadge = document.getElementById('subtitlesSpeakerBadge');
    this.subtitlesBadgeText = document.getElementById('subtitlesBadgeText');
    this.notchSettingsDropdown = document.getElementById('notchSettingsDropdown');
    this.notchAnswerTeleprompter = document.getElementById('notchAnswerTeleprompter');
    this.teleprompterQTitle = document.getElementById('teleprompterQTitle');
    this.teleprompterBodyContent = document.getElementById('teleprompterBodyContent');
    this.teleprompterFollowupsContainer = document.getElementById('teleprompterFollowupsContainer');
    this.followupChipsRow = document.getElementById('followupChipsRow');

    this.btnCloseTeleprompter = document.getElementById('btnCloseTeleprompter');
    this.btnTeleprompterEyeContact = document.getElementById('btnTeleprompterEyeContact');
    this.btnCopyAnswer = document.getElementById('btnCopyAnswer');
    this.btnClearTeleprompter = document.getElementById('btnClearTeleprompter');
    this.btnPagerPrev = document.getElementById('btnPagerPrev');
    this.btnPagerNext = document.getElementById('btnPagerNext');
    this.pagerText = document.getElementById('pagerText');

    this.togMuteMic = document.getElementById('togMuteMic');
    this.btnMenuMuteMic = document.getElementById('btnMenuMuteMic');
    this.togAutoDetect = document.getElementById('togAutoDetect');
    this.togAutoAnswer = document.getElementById('togAutoAnswer');
    this.togEyeContact = document.getElementById('togEyeContact');
    this.togTransparency = document.getElementById('togTransparency');
    this.btnNotchTransparency = document.getElementById('btnNotchTransparency');
    this.transparencySliderRow = document.getElementById('transparencySliderRow');
    this.transparencySlider = document.getElementById('transparencySlider');
    this.transparencyValueLabel = document.getElementById('transparencyValueLabel');
    this.btnMenuResume = document.getElementById('btnMenuResume');
    this.btnMenuDebrief = document.getElementById('btnMenuDebrief');
    this.btnMenuApiKey = document.getElementById('btnMenuApiKey');

    // Modals
    this.apiKeyModalBackdrop = document.getElementById('apiKeyModalBackdrop');
    this.btnCloseApiKeyModal = document.getElementById('btnCloseApiKeyModal');
    this.btnCancelApiKeyModal = document.getElementById('btnCancelApiKeyModal');
    this.btnSaveApiKeyModal = document.getElementById('btnSaveApiKeyModal');
    this.inputGroqApiKey = document.getElementById('inputGroqApiKey');

    this.resumeModalBackdrop = document.getElementById('resumeModalBackdrop');
    this.btnCloseResumeModal = document.getElementById('btnCloseResumeModal');
    this.btnCancelResumeModal = document.getElementById('btnCancelResumeModal');
    this.btnSaveResumeModal = document.getElementById('btnSaveResumeModal');
    this.inputCandidateName = document.getElementById('inputCandidateName');
    this.inputTargetRole = document.getElementById('inputTargetRole');
    this.inputResumeText = document.getElementById('inputResumeText');
    this.inputJobDescription = document.getElementById('inputJobDescription');
    this.resumeUploadZone = document.getElementById('resumeUploadZone');
    this.resumeFileInput = document.getElementById('resumeFileInput');
    this.btnBrowseResume = document.getElementById('btnBrowseResume');
    this.uploadZonePrompt = document.getElementById('uploadZonePrompt');
    this.uploadParsingStatus = document.getElementById('uploadParsingStatus');
    this.uploadStatusText = document.getElementById('uploadStatusText');
    this.extractedSkillsGroup = document.getElementById('extractedSkillsGroup');
    this.skillsTagsContainer = document.getElementById('skillsTagsContainer');

    this.debriefModalBackdrop = document.getElementById('debriefModalBackdrop');
    this.btnCloseDebriefModal = document.getElementById('btnCloseDebriefModal');
    this.btnQuitAppSession = document.getElementById('btnQuitAppSession');
    this.btnCopyDebrief = document.getElementById('btnCopyDebrief');
    this.btnDownloadDebrief = document.getElementById('btnDownloadDebrief');
    this.statQuestionCount = document.getElementById('statQuestionCount');
    this.statSessionDuration = document.getElementById('statSessionDuration');
    this.debriefHistoryPreview = document.getElementById('debriefHistoryPreview');

    // Onboarding check: prompt for API key or dynamic Resume setup if profile not configured
    if (!this.apiKeys.groq || !this.apiKeys.groq.trim()) {
      setTimeout(() => this.openApiKeyModal(), 350);
    } else if (!ProfileStore.isProfileConfigured()) {
      setTimeout(() => this.openResumeModal(), 350);
    }
  }

  initNotchWidget() {
    // Menu Dropdown toggle
    if (this.btnNotchMenu) {
      this.btnNotchMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = this.notchSettingsDropdown.classList.toggle('open');
        if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
          const targetH = isOpen ? 480 : (this.isAnswerLocked ? (this.isEyeContactMode ? 140 : 580) : 105);
          window.shadowDesktop.resizeWindow(1080, targetH);
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (this.topNotchWidget && !this.topNotchWidget.contains(e.target)) {
        this.notchSettingsDropdown.classList.remove('open');
        if (!this.isAnswerLocked) {
          if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
            window.shadowDesktop.resizeWindow(1080, 105);
          }
        }
      }
    });

    // Dedicated Mic Mute/Unmute Toggle (Click & ⌘M)
    if (this.btnNotchAudioToggle) {
      this.btnNotchAudioToggle.addEventListener('click', () => {
        this.toggleMic();
      });
    }
    if (this.btnMenuMuteMic) {
      this.btnMenuMuteMic.addEventListener('click', () => {
        this.toggleMic();
      });
    }

    // Auto Answer Toggle Pill
    if (this.btnNotchAutoAnswer) {
      this.btnNotchAutoAnswer.addEventListener('click', () => {
        this.autoAnswerEnabled = !this.autoAnswerEnabled;
        this.btnNotchAutoAnswer.classList.toggle('active', this.autoAnswerEnabled);
        if (this.togAutoAnswer) this.togAutoAnswer.classList.toggle('checked', this.autoAnswerEnabled);
        if (this.togAutoDetect) this.togAutoDetect.classList.toggle('checked', this.autoAnswerEnabled);
      });
    }
    if (this.togAutoAnswer) {
      this.togAutoAnswer.addEventListener('click', () => {
        this.togAutoAnswer.classList.toggle('checked');
        this.autoAnswerEnabled = this.togAutoAnswer.classList.contains('checked');
        if (this.btnNotchAutoAnswer) this.btnNotchAutoAnswer.classList.toggle('active', this.autoAnswerEnabled);
        if (this.togAutoDetect) this.togAutoDetect.classList.toggle('checked', this.autoAnswerEnabled);
      });
    }
    if (this.togAutoDetect) {
      this.togAutoDetect.addEventListener('click', () => {
        this.togAutoDetect.classList.toggle('checked');
        this.autoAnswerEnabled = this.togAutoDetect.classList.contains('checked');
        if (this.btnNotchAutoAnswer) this.btnNotchAutoAnswer.classList.toggle('active', this.autoAnswerEnabled);
        if (this.togAutoAnswer) this.togAutoAnswer.classList.toggle('checked', this.autoAnswerEnabled);
      });
    }

    // Stall Phrases Toggle
    if (this.btnNotchStall) {
      this.btnNotchStall.addEventListener('click', () => {
        this.isStallMode = !this.isStallMode;
        this.btnNotchStall.classList.toggle('active', this.isStallMode);
      });
    }

    // Keywords-Only Mode Toggle
    if (this.btnNotchKeywords) {
      this.btnNotchKeywords.addEventListener('click', () => {
        this.isKeywordMode = !this.isKeywordMode;
        this.btnNotchKeywords.classList.toggle('active', this.isKeywordMode);
        // Visual feedback label
        const span = this.btnNotchKeywords.querySelector('span');
        if (span) span.textContent = this.isKeywordMode ? '🔑 Keys ON' : '🔑 Keys';
      });
    }

    // Eye-Contact Mode Toggle
    const handleEyeContactToggle = () => {
      this.toggleEyeContactMode();
    };
    if (this.btnNotchEyeContact) this.btnNotchEyeContact.addEventListener('click', handleEyeContactToggle);
    if (this.btnTeleprompterEyeContact) this.btnTeleprompterEyeContact.addEventListener('click', handleEyeContactToggle);
    if (this.togEyeContact) this.togEyeContact.addEventListener('click', handleEyeContactToggle);

    // Glass / Transparency Mode Toggle
    const handleTransparencyToggle = () => {
      this.toggleTransparencyMode();
    };
    if (this.btnNotchTransparency) this.btnNotchTransparency.addEventListener('click', handleTransparencyToggle);
    if (this.togTransparency) this.togTransparency.addEventListener('click', handleTransparencyToggle);

    // Transparency slider
    if (this.transparencySlider) {
      this.transparencySlider.addEventListener('input', () => {
        this.hudOpacity = parseInt(this.transparencySlider.value, 10);
        if (this.transparencyValueLabel) this.transparencyValueLabel.textContent = `${this.hudOpacity}%`;
        document.documentElement.style.setProperty('--hud-opacity', (this.hudOpacity / 100).toFixed(2));
      });
    }

    // Debrief Modal Open
    const handleDebriefOpen = () => {
      this.openDebriefModal();
    };
    if (this.btnNotchDebrief) this.btnNotchDebrief.addEventListener('click', handleDebriefOpen);
    if (this.btnMenuDebrief) this.btnMenuDebrief.addEventListener('click', handleDebriefOpen);

    // Resume Modal Open
    if (this.btnMenuResume) {
      this.btnMenuResume.addEventListener('click', () => {
        this.openResumeModal();
      });
    }

    // Close Teleprompter Button
    if (this.btnCloseTeleprompter) {
      this.btnCloseTeleprompter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeAnswerCard();
      });
    }

    // Clear Screen & Reset Session History
    const handleClear = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      this.clearAll();
    };
    if (this.btnNotchClear) this.btnNotchClear.addEventListener('click', handleClear);
    if (this.btnClearTeleprompter) this.btnClearTeleprompter.addEventListener('click', handleClear);

    // Multi-Turn History Pagers [◀] 1/3 [▶]
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

    // Copy Current Solution Code
    if (this.btnCopyAnswer) {
      this.btnCopyAnswer.addEventListener('click', (e) => {
        e.stopPropagation();
        const textToCopy = this.currentRawCode || this.teleprompterBodyContent.textContent;
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy);
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

    // Google Meet / Zoom / Tab Audio Share Connector
    if (this.btnNotchMute) {
      this.btnNotchMute.addEventListener('click', async () => {
        if (this.subtitlesLiveText) {
          this.subtitlesLiveText.innerHTML = `<span style="color: #38bdf8;">🎧 Select Google Meet tab & check "Also share tab audio"...</span>`;
        }

        const res = await audioCapture.initSystemStream();
        if (res.success) {
          this.btnNotchMute.classList.add('active');
          this.btnNotchMute.style.borderColor = '#22c55e';
          this.btnNotchMute.style.color = '#4ade80';
          this.btnNotchMute.title = "Google Meet / Call Audio Connected";

          // Restart speech engine so it picks up the new mixed stream (tab audio)
          if (this.speechEngine) {
            const mixedStream = audioCapture.getMixedStream();
            this.speechEngine.restart(mixedStream);
          }

          if (this.subtitlesLiveText) {
            this.subtitlesLiveText.innerHTML = `<span style="color: #22c55e; font-weight: 600;">🎧 Meet Audio + 🎙️ Mic Live!</span> <span style="color: #94a3b8;">Listening to interviewer...</span>`;
          }
        } else {
          if (res.reason === 'no_audio_track') {
            if (this.subtitlesLiveText) {
              this.subtitlesLiveText.innerHTML = `<span style="color: #fb923c;">⚠️ Please check "Also share tab audio" when selecting Google Meet tab.</span>`;
            }
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

    // Screenshot Screen Coding Challenge (⌘⇧S)
    if (this.btnNotchScreenshot) {
      this.btnNotchScreenshot.addEventListener('click', () => {
        this.performScreenSnipe();
      });
    }

    // Chat / Custom Prompt (⌘K)
    if (this.btnNotchChat) {
      this.btnNotchChat.addEventListener('click', () => {
        const q = prompt("Ask Sonar AI (Live Interview Copilot):", "Write a Python function for two sum with hashmap");
        if (q) this.triggerNotchAnswer(q);
      });
    }

    // Global Key Shortcuts
    window.addEventListener('keydown', (e) => {
      // ⌘M: Toggle Mic Mute
      if ((e.metaKey || e.ctrlKey) && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        this.toggleMic();
      }
      // ⌘E: Toggle Eye-Contact Mode
      if ((e.metaKey || e.ctrlKey) && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        this.toggleEyeContactMode();
      }
      // ⌘D: Open Debrief
      if ((e.metaKey || e.ctrlKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        this.openDebriefModal();
      }
      // ⌘↩: Trigger AI Answer
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        this.requestAiAnswer();
      }
      // ⌘⇧S: Screenshot Snipe
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        this.performScreenSnipe();
      }
      // ⌘K: Prompt
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const q = prompt("Ask Sonar AI (Live Interview Copilot):");
        if (q) this.triggerNotchAnswer(q);
      }
      // ⌘⌫: Clear
      if ((e.metaKey || e.ctrlKey) && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault();
        this.clearAll();
      }
      // ⌘[: Prev History
      if ((e.metaKey || e.ctrlKey) && e.key === '[') {
        e.preventDefault();
        if (this.sessionHistory.length > 0 && this.currentHistoryIndex > 0) {
          this.currentHistoryIndex--;
          this.renderHistoryItem();
        }
      }
      // ⌘]: Next History
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        if (this.sessionHistory.length > 0 && this.currentHistoryIndex < this.sessionHistory.length - 1) {
          this.currentHistoryIndex++;
          this.renderHistoryItem();
        }
      }
      if (e.key === 'Escape') {
        this.closeAnswerCard();
        if (this.resumeModalBackdrop) this.resumeModalBackdrop.classList.remove('open');
        if (this.debriefModalBackdrop) this.debriefModalBackdrop.classList.remove('open');
      }
    });
  }

  toggleEyeContactMode(forceState = null) {
    this.isEyeContactMode = forceState !== null ? forceState : !this.isEyeContactMode;
    
    if (this.notchAnswerTeleprompter) {
      this.notchAnswerTeleprompter.classList.toggle('eye-contact-mode', this.isEyeContactMode);
    }
    if (this.btnNotchEyeContact) {
      this.btnNotchEyeContact.classList.toggle('active', this.isEyeContactMode);
    }
    if (this.togEyeContact) {
      this.togEyeContact.classList.toggle('checked', this.isEyeContactMode);
    }
    if (this.btnTeleprompterEyeContact) {
      this.btnTeleprompterEyeContact.style.color = this.isEyeContactMode ? '#38bdf8' : '#94a3b8';
    }

    if (this.isAnswerLocked && window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(1080, this.isEyeContactMode ? 140 : 580);
    }
  }

  toggleTransparencyMode(forceState = null) {
    this.isTransparencyMode = forceState !== null ? forceState : !this.isTransparencyMode;

    // Apply/remove glass-mode class to the HUD container
    if (this.topNotchWidget) {
      this.topNotchWidget.classList.toggle('glass-mode', this.isTransparencyMode);
    }

    // Sync pill button
    if (this.btnNotchTransparency) {
      this.btnNotchTransparency.classList.toggle('active', this.isTransparencyMode);
    }

    // Sync settings dropdown toggle
    if (this.togTransparency) {
      this.togTransparency.classList.toggle('checked', this.isTransparencyMode);
    }

    // Show/hide the opacity slider row
    if (this.transparencySliderRow) {
      this.transparencySliderRow.style.display = this.isTransparencyMode ? 'flex' : 'none';
    }

    // Apply current opacity value to CSS variable
    if (this.isTransparencyMode) {
      document.documentElement.style.setProperty('--hud-opacity', (this.hudOpacity / 100).toFixed(2));
    } else {
      // Reset to fully opaque when off
      document.documentElement.style.removeProperty('--hud-opacity');
    }
  }

  initModals() {
    // Dynamic Resume Upload & Knowledge Base Modal
    if (this.btnCloseResumeModal) this.btnCloseResumeModal.addEventListener('click', () => this.resumeModalBackdrop.classList.remove('open'));
    if (this.btnCancelResumeModal) this.btnCancelResumeModal.addEventListener('click', () => this.resumeModalBackdrop.classList.remove('open'));
    
    // File upload triggers
    if (this.btnBrowseResume && this.resumeFileInput) {
      this.btnBrowseResume.addEventListener('click', (e) => {
        e.stopPropagation();
        this.resumeFileInput.click();
      });
    }
    if (this.resumeUploadZone && this.resumeFileInput) {
      this.resumeUploadZone.addEventListener('click', () => {
        this.resumeFileInput.click();
      });

      this.resumeUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        this.resumeUploadZone.classList.add('dragover');
      });

      this.resumeUploadZone.addEventListener('dragleave', () => {
        this.resumeUploadZone.classList.remove('dragover');
      });

      this.resumeUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        this.resumeUploadZone.classList.remove('dragover');
        if (e.dataTransfer && e.dataTransfer.files.length > 0) {
          this.handleResumeFileUpload(e.dataTransfer.files[0]);
        }
      });

      this.resumeFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          this.handleResumeFileUpload(e.target.files[0]);
        }
      });
    }

    if (this.btnSaveResumeModal) {
      this.btnSaveResumeModal.addEventListener('click', () => {
        this.profile.candidateName = this.inputCandidateName.value.trim();
        this.profile.targetRole = this.inputTargetRole.value.trim();
        this.profile.resumeText = this.inputResumeText.value.trim();
        this.profile.targetJobDescription = this.inputJobDescription.value.trim();
        ProfileStore.saveProfile(this.profile);
        this.resumeModalBackdrop.classList.remove('open');
        
        if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
          window.shadowDesktop.resizeWindow(1080, 105);
        }

        if (this.subtitlesLiveText) {
          const name = this.profile.candidateName || 'Candidate';
          const role = this.profile.targetRole || 'Software Engineer';
          this.subtitlesLiveText.innerHTML = `<span style="color: #4ade80; font-weight: 700;">✅ Profile Loaded: ${name} (${role})</span> <span style="color: #94a3b8;">— Copilot ready for live interview.</span>`;
        }
      });
    }

    // API Key Modal
    if (this.btnMenuApiKey) {
      this.btnMenuApiKey.addEventListener('click', () => {
        this.openApiKeyModal();
      });
    }
    if (this.btnCloseApiKeyModal) this.btnCloseApiKeyModal.addEventListener('click', () => this.apiKeyModalBackdrop.classList.remove('open'));
    if (this.btnCancelApiKeyModal) this.btnCancelApiKeyModal.addEventListener('click', () => this.apiKeyModalBackdrop.classList.remove('open'));
    if (this.btnSaveApiKeyModal) {
      this.btnSaveApiKeyModal.addEventListener('click', () => {
        const key = this.inputGroqApiKey.value.trim();
        if (key) {
          this.apiKeys.groq = key;
          ProfileStore.saveApiKeys(this.apiKeys);
          this.apiKeyModalBackdrop.classList.remove('open');
          if (this.subtitlesLiveText) {
            this.subtitlesLiveText.innerHTML = `<span style="color: #4ade80;">✅ Groq API Key Activated! Ready for live interview.</span>`;
          }
        } else {
          alert('Please enter a valid Groq API Key (starts with gsk_). Get one free at console.groq.com/keys');
        }
      });
    }

    // Debrief Modal
    if (this.btnCloseDebriefModal) this.btnCloseDebriefModal.addEventListener('click', () => this.debriefModalBackdrop.classList.remove('open'));
    if (this.btnQuitAppSession) {
      this.btnQuitAppSession.addEventListener('click', () => {
        this.quitAndCloseApp();
      });
    }
    if (this.btnCopyDebrief) {
      this.btnCopyDebrief.addEventListener('click', () => {
        const md = this.generateDebriefMarkdown();
        navigator.clipboard.writeText(md);
        this.btnCopyDebrief.textContent = '✅ Copied!';
        setTimeout(() => { this.btnCopyDebrief.textContent = '📋 Copy Markdown'; }, 1500);
      });
    }
    if (this.btnDownloadDebrief) {
      this.btnDownloadDebrief.addEventListener('click', () => {
        const md = this.generateDebriefMarkdown();
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SonarAI_Interview_Debrief_${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  openApiKeyModal() {
    if (this.inputGroqApiKey) {
      this.inputGroqApiKey.value = this.apiKeys.groq || '';
    }
    if (this.apiKeyModalBackdrop) {
      this.apiKeyModalBackdrop.classList.add('open');
    }
    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(1080, 520);
    }
  }

  quitAndCloseApp() {
    if (this.speechEngine) this.speechEngine.stop();
    audioCapture.stop();
    if (this.timerInterval) clearInterval(this.timerInterval);

    if (window.shadowDesktop && window.shadowDesktop.endSession) {
      window.shadowDesktop.endSession();
    } else {
      window.close();
    }
  }

  async handleResumeFileUpload(file) {
    if (!file) return;

    if (this.uploadParsingStatus && this.uploadZonePrompt) {
      this.uploadZonePrompt.style.display = 'none';
      this.uploadParsingStatus.style.display = 'flex';
      if (this.uploadStatusText) {
        this.uploadStatusText.textContent = `Reading & parsing ${file.name}...`;
      }
    }

    const updateProgress = (msg) => {
      if (this.uploadStatusText) {
        this.uploadStatusText.textContent = msg;
      }
    };

    try {
      let extracted = null;
      const fileNameLower = file.name.toLowerCase();

      if (fileNameLower.endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        extracted = await parsePdfResume(arrayBuffer, this.apiKeys.groq, updateProgress);
      } else if (fileNameLower.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        extracted = await parseDocxResume(arrayBuffer, this.apiKeys.groq);
      } else if (/\.(png|jpe?g|webp)$/i.test(fileNameLower)) {
        extracted = await parseImageResume(file, this.apiKeys.groq, updateProgress);
      } else {
        const rawText = await file.text();
        extracted = await parseResumeWithAI(rawText, this.apiKeys.groq);
      }

      if (!extracted || !extracted.resumeText || extracted.resumeText.trim().length < 10) {
        throw new Error('Could not extract readable text. You can paste your resume text manually below.');
      }

      // Populate input fields
      if (this.inputCandidateName && extracted.candidateName) {
        this.inputCandidateName.value = extracted.candidateName;
        this.profile.candidateName = extracted.candidateName;
      }
      if (this.inputTargetRole && extracted.targetRole) {
        this.inputTargetRole.value = extracted.targetRole;
        this.profile.targetRole = extracted.targetRole;
      }
      if (this.inputResumeText) {
        this.inputResumeText.value = extracted.resumeText;
        this.profile.resumeText = extracted.resumeText;
      }
      if (extracted.yearsOfExperience) {
        this.profile.yearsOfExperience = extracted.yearsOfExperience;
      }
      if (Array.isArray(extracted.keyStrengths) && extracted.keyStrengths.length > 0) {
        this.profile.keyStrengths = extracted.keyStrengths;
        this.renderExtractedSkills(extracted.keyStrengths);
      }

      ProfileStore.saveProfile(this.profile);

      if (this.uploadStatusText) {
        this.uploadStatusText.innerHTML = `<span style="color: #4ade80;">✅ Extracted ${extracted.candidateName || 'Candidate'} (${file.name})!</span>`;
      }
    } catch (err) {
      console.warn('[ResumeUpload] Error parsing file:', err);
      if (this.uploadStatusText) {
        this.uploadStatusText.innerHTML = `<span style="color: #f87171;">⚠️ ${err.message}</span>`;
      }
    } finally {
      setTimeout(() => {
        if (this.uploadZonePrompt) this.uploadZonePrompt.style.display = 'flex';
        if (this.uploadParsingStatus) this.uploadParsingStatus.style.display = 'none';
      }, 3500);
    }
  }

  renderExtractedSkills(skills) {
    if (!this.extractedSkillsGroup || !this.skillsTagsContainer) return;
    if (Array.isArray(skills) && skills.length > 0) {
      this.extractedSkillsGroup.style.display = 'flex';
      this.skillsTagsContainer.innerHTML = skills.map(s => `
        <span class="skill-pill-tag">⚡ ${s}</span>
      `).join('');
    } else {
      this.extractedSkillsGroup.style.display = 'none';
    }
  }

  openResumeModal() {
    this.profile = ProfileStore.getProfile();
    if (this.inputCandidateName) this.inputCandidateName.value = this.profile.candidateName || '';
    if (this.inputTargetRole) this.inputTargetRole.value = this.profile.targetRole || '';
    if (this.inputResumeText) this.inputResumeText.value = this.profile.resumeText || '';
    if (this.inputJobDescription) this.inputJobDescription.value = this.profile.targetJobDescription || '';
    
    if (this.profile.keyStrengths && this.profile.keyStrengths.length > 0) {
      this.renderExtractedSkills(this.profile.keyStrengths);
    } else {
      if (this.extractedSkillsGroup) this.extractedSkillsGroup.style.display = 'none';
    }

    if (this.resumeModalBackdrop) this.resumeModalBackdrop.classList.add('open');
    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(1080, 600);
    }
  }

  openDebriefModal() {
    if (this.statQuestionCount) this.statQuestionCount.textContent = this.sessionHistory.length;
    if (this.statSessionDuration) {
      const m = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
      const s = (this.elapsedSeconds % 60).toString().padStart(2, '0');
      this.statSessionDuration.textContent = `${m}:${s}`;
    }

    if (this.debriefHistoryPreview) {
      if (this.sessionHistory.length === 0) {
        this.debriefHistoryPreview.innerHTML = `<div style="color: #94a3b8; font-style: italic;">No questions solved in this session yet. Speak into mic or click Answer.</div>`;
      } else {
        this.debriefHistoryPreview.innerHTML = this.sessionHistory.map((item, idx) => `
          <div class="debrief-item">
            <div style="font-weight: 700; color: #38bdf8; margin-bottom: 4px;">Q${idx + 1}: ${item.question}</div>
            <div style="color: #cbd5e1; font-size: 0.8rem; max-height: 80px; overflow: hidden; text-overflow: ellipsis;">${item.rawAnswer.slice(0, 200)}...</div>
          </div>
        `).join('');
      }
    }

    if (this.debriefModalBackdrop) this.debriefModalBackdrop.classList.add('open');
    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(1080, 600);
    }
  }

  generateDebriefMarkdown() {
    const m = Math.floor(this.elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (this.elapsedSeconds % 60).toString().padStart(2, '0');
    
    let doc = `# 🎯 Sonar AI Interview Session Debrief\n\n`;
    doc += `**Candidate:** ${this.profile.candidateName || 'Candidate'}\n`;
    doc += `**Target Role:** ${this.profile.targetRole || 'Software Engineer'}\n`;
    doc += `**Date:** ${new Date().toLocaleString()}\n`;
    doc += `**Total Session Duration:** ${m}:${s}\n`;
    doc += `**Total Questions Solved:** ${this.sessionHistory.length}\n\n`;
    doc += `---\n\n`;

    this.sessionHistory.forEach((turn, idx) => {
      doc += `### Question ${idx + 1}: ${turn.question}\n\n`;
      doc += `${turn.rawAnswer}\n\n`;
      if (turn.rawCode) {
        doc += `\`\`\`\n${turn.rawCode}\n\`\`\`\n\n`;
      }
      doc += `---\n\n`;
    });

    return doc;
  }

  toggleMic(forceState = null) {
    this.isMicMuted = forceState !== null ? !forceState : !this.isMicMuted;
    const isMicActive = !this.isMicMuted;

    audioCapture.toggleMic(isMicActive);

    const hasSystemStream = !!audioCapture.systemStream;
    if (this.speechEngine) {
      if (!isMicActive && !hasSystemStream) {
        this.speechEngine.setMute(true);
      } else {
        this.speechEngine.setMute(false);
      }
    }

    if (this.btnNotchAudioToggle) {
      this.btnNotchAudioToggle.classList.toggle('active', isMicActive);
      this.btnNotchAudioToggle.classList.toggle('muted', !isMicActive);
      this.btnNotchAudioToggle.title = isMicActive ? "Mute Mic (⌘M)" : "Unmute Mic (⌘M)";
    }

    if (this.micStatusDot) {
      this.micStatusDot.style.background = isMicActive ? '#22c55e' : '#ef4444';
      this.micStatusDot.classList.toggle('live-pulse', isMicActive);
    }

    if (this.micLabelText) {
      this.micLabelText.textContent = isMicActive ? 'Mic' : 'Muted';
    }

    if (this.togMuteMic) {
      this.togMuteMic.classList.toggle('checked', !isMicActive);
    }

    if (this.subtitlesLiveText) {
      if (!isMicActive) {
        if (hasSystemStream) {
          this.subtitlesLiveText.innerHTML = `<span style="color: #f87171; font-weight: 600;">🔇 Mic Muted.</span> <span style="color: #38bdf8; font-weight: 500;">🎧 Listening ONLY to Google Meet interviewer audio.</span>`;
        } else {
          this.subtitlesLiveText.innerHTML = `<span style="color: #f87171; font-weight: 600;">🔇 Microphone Muted.</span> <span style="color: #94a3b8;">(Press ⌘M to unmute)</span>`;
        }
      } else {
        this.subtitlesLiveText.innerHTML = `<span style="color: #22c55e; font-weight: 600;">🎙️ Mic Live.</span> <span style="color: #94a3b8;">Listening to speech...</span>`;
      }
    }
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
    if (this.teleprompterQTitle) this.teleprompterQTitle.textContent = getHinglishQuestionLabel(item.question);
    if (this.teleprompterBodyContent) this.teleprompterBodyContent.innerHTML = item.formattedHtml;
    this.currentRawCode = item.rawCode || '';

    // Render Follow-Up Chips
    this.renderFollowUpChips(item.followUps);

    if (this.btnPagerPrev) this.btnPagerPrev.style.opacity = this.currentHistoryIndex > 0 ? '1' : '0.4';
    if (this.btnPagerNext) this.btnPagerNext.style.opacity = this.currentHistoryIndex < this.sessionHistory.length - 1 ? '1' : '0.4';
  }

  renderFollowUpChips(followUps) {
    if (!this.teleprompterFollowupsContainer || !this.followupChipsRow) return;

    if (Array.isArray(followUps) && followUps.length > 0) {
      this.teleprompterFollowupsContainer.style.display = this.isEyeContactMode ? 'none' : 'flex';
      this.followupChipsRow.innerHTML = followUps.map((q, idx) => `
        <button class="followup-chip-btn" data-q="${q.replace(/"/g, '&quot;')}">
          <span>🔮 Q${idx + 1}: ${q}</span>
        </button>
      `).join('');

      this.followupChipsRow.querySelectorAll('.followup-chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetQ = btn.getAttribute('data-q');
          if (targetQ) this.triggerNotchAnswer(targetQ);
        });
      });
    } else {
      this.teleprompterFollowupsContainer.style.display = 'none';
    }
  }

  requestAiAnswer() {
    const transcript = this.speechEngine ? this.speechEngine.getAccumulatedTranscript() : '';
    const activeText = cleanTechnicalSpeech(transcript || (this.subtitlesLiveText ? this.subtitlesLiveText.textContent.replace(/LIVE:.*?|🎙️.*?|🎧.*?|Listening.*?/g, '').trim() : ''));
    
    if (activeText && activeText.length > 2) {
      // forceUnlock=true: manual button always works even if auto-lock got stuck
      this.triggerNotchAnswer(activeText, true);
      if (this.speechEngine) this.speechEngine.clearTranscript();
    } else {
      const q = prompt("Ask Sonar AI (or speak into mic/Google Meet):", "Write a Python function for two sum with hashmap");
      if (q) this.triggerNotchAnswer(q, true);
    }
  }

  closeAnswerCard() {
    this.isAnswerLocked = false;
    this.notchAnswerTeleprompter.classList.remove('visible');
    this.notchSettingsDropdown.classList.remove('open');
    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(1080, 105);
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
      window.shadowDesktop.resizeWindow(1080, this.isEyeContactMode ? 140 : 580);
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
      language: 'en-US',
      onInterimText: (wordsArray, conversationText, speaker = 'interviewer') => {
        if (this.subtitlesLiveText) {
          // Update Speaker Diarization Badge
          if (this.subtitlesBadgeText && this.subtitlesSpeakerBadge) {
            const isCand = speaker === 'candidate';
            this.subtitlesBadgeText.textContent = isCand ? '🎙️ YOU' : '🎧 INTERVIEWER';
            this.subtitlesSpeakerBadge.classList.toggle('candidate', isCand);
          }

          if (Array.isArray(wordsArray) && wordsArray.length > 0) {
            const isCand = speaker === 'candidate';
            const pillsHtml = wordsArray.map((w, idx) => {
              const isLast = idx === wordsArray.length - 1;
              return `<span class="asr-word-pill ${isCand ? 'candidate' : ''} ${isLast ? 'latest' : ''}">${w}</span>`;
            }).join(' ');
            this.subtitlesLiveText.innerHTML = `<div class="asr-words-container">${pillsHtml}</div>`;
          } else {
            this.subtitlesLiveText.textContent = conversationText || "Listening for live interviewer speech...";
          }
        }
      },
      onQuestionDetected: (framedQuestion) => {
        if (this.autoAnswerEnabled && framedQuestion && framedQuestion.length > 4) {
          const isJustNoise = /^(thank you[\.\!\?]?|thanks[\.\!\?]?|bye[\.\!\?]?)$/i.test(framedQuestion.trim());
          if (!isJustNoise) {
            if (this.subtitlesLiveText) {
              this.subtitlesLiveText.innerHTML = `<span style="color: #4ade80; font-weight: 700;">⚡ Auto-Detected: "${framedQuestion}"</span>`;
            }
            this.triggerNotchAnswer(framedQuestion);
          }
        }
      }
    });

    audioCapture.initMicStream().then(ok => {
      if (ok) {
        const mixedStream = audioCapture.getMixedStream();
        this.speechEngine.start(mixedStream);
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
      audioCapture.startVisualizer(canvas);
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

    this.openDebriefModal();
  }

  async triggerNotchAnswer(question, forceUnlock = false) {
    if (!question || question.trim().length < 3) return;

    // Guard: don't fire a new API call if one is already streaming
    // forceUnlock=true (from manual Answer button) overrides stuck locks older than 8s
    if (this.isSynthesizing) {
      const lockAge = this.synthesisSafetyTimer ? 0 : (Date.now() - (this._synthStartTime || 0));
      if (!forceUnlock && lockAge < 8000) {
        console.log('[SonarAI] Skipping — already synthesizing answer.');
        return;
      }
      // Force-release stuck lock
      this.isSynthesizing = false;
      this.isAnswerLocked = false;
      if (this.synthesisSafetyTimer) { clearTimeout(this.synthesisSafetyTimer); this.synthesisSafetyTimer = null; }
      console.warn('[SonarAI] Force-unlocked stuck synthesis lock.');
    }

    this.isSynthesizing = true;
    this.isAnswerLocked = true;
    this._synthStartTime = Date.now();

    // Safety timeout: auto-release ALL locks after 20s in case stream or error is dropped
    if (this.synthesisSafetyTimer) clearTimeout(this.synthesisSafetyTimer);
    this.synthesisSafetyTimer = setTimeout(() => {
      this.isSynthesizing = false;
      this.isAnswerLocked = false;
      if (this.teleprompterBodyContent && !this.teleprompterBodyContent.textContent.trim()) {
        this.teleprompterBodyContent.innerHTML = `<span style="color: #f87171;">⏱️ Request timed out. Check your API key or internet connection.</span>`;
      }
      console.warn('[SonarAI] Safety timer released synthesis lock (20s timeout).');
    }, 20000);

    if (this.speechEngine) {
      this.speechEngine.clearTranscript();
    }

    if (window.shadowDesktop && window.shadowDesktop.resizeWindow) {
      window.shadowDesktop.resizeWindow(1080, this.isEyeContactMode ? 140 : 580);
    }

    const cleanedQ = cleanTechnicalSpeech(question);
    const labelQ = getHinglishQuestionLabel(cleanedQ);
    if (this.teleprompterQTitle) this.teleprompterQTitle.textContent = labelQ;

    // Show stalling phrase while AI generates (helps candidate sound natural while thinking)
    const STALL_PHRASES = [
      `"That's a great question, let me think through the edge cases for a second..."`,
      `"Let me walk through my thought process on this..."`,
      `"I could use a brute force approach first, but let me see if I can optimize the complexity..."`,
      `"Interesting — let me think about the data structure that fits best here..."`,
      `"Okay so there are a few ways to approach this, let me think aloud..."`,
      `"Sure, let me break this down step by step..."`,
      `"Let me consider the trade-offs before jumping to a solution..."`,
    ];
    const stallPhrase = STALL_PHRASES[Math.floor(Math.random() * STALL_PHRASES.length)];
    const loadingHtml = this.isStallMode
      ? `<div style="margin-bottom:12px;padding:10px 14px;background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.2);border-radius:8px;">
           <div style="font-size:0.72rem;font-weight:700;color:#38bdf8;letter-spacing:0.5px;margin-bottom:4px;">💬 SAY THIS NOW</div>
           <div style="font-size:0.95rem;color:#e2e8f0;font-style:italic;">${stallPhrase}</div>
         </div>
         <span style="color:#4ade80;font-style:italic;font-size:0.82rem;">⚡ Generating answer via Groq...</span>`
      : `<span style="color:#4ade80;font-style:italic;">⚡ Analyzing & streaming solution via Groq...</span>`;
    if (this.teleprompterBodyContent) this.teleprompterBodyContent.innerHTML = loadingHtml;
    if (this.notchAnswerTeleprompter) {
      this.notchAnswerTeleprompter.classList.add('visible');
      // Ensure element is scrolled into view in browser mode (no Electron)
      this.notchAnswerTeleprompter.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const releaseLock = () => {
      this.isSynthesizing = false;
      this.isAnswerLocked = false;
      if (this.synthesisSafetyTimer) {
        clearTimeout(this.synthesisSafetyTimer);
        this.synthesisSafetyTimer = null;
      }
    };

    try {
      await this.llmEngine.generateAnswer(
        cleanedQ,
        this.sessionHistory,
        (chunk, fullText) => {
          this.renderAnswerContent(fullText, cleanedQ, false);
        },
        (fullText, latencyMs, model) => {
          if (fullText && fullText.trim().length > 0) {
            this.renderAnswerContent(fullText, cleanedQ, true);
          } else {
            // Empty response from model — show actionable error
            if (this.teleprompterBodyContent) {
              this.teleprompterBodyContent.innerHTML = `<span style="color: #f87171;">⚠️ Empty response from AI model (${model}). This usually means the model is overloaded. Try pressing <strong>Answer (⌘↩)</strong> again.</span>`;
            }
          }
          releaseLock();
        },
        (err) => {
          const errMsg = err?.message || String(err);
          console.error('[SonarAI] LLM API Error:', errMsg);
          if (this.teleprompterBodyContent) {
            this.teleprompterBodyContent.innerHTML = `<span style="color: #f87171;">❌ ${errMsg}</span>`;
          }
          releaseLock();
        }
      );
    } catch (err) {
      console.error('[SonarAI] triggerNotchAnswer caught error:', err);
      if (this.teleprompterBodyContent) {
        this.teleprompterBodyContent.innerHTML = `<span style="color: #f87171;">❌ Error: ${err.message}</span>`;
      }
      releaseLock();
    }
  }

  renderAnswerContent(text, questionTitle, isFinal = false) {
    let raw = text || '';
    
    // Auto-close unclosed markdown code blocks for safe streaming
    if ((raw.split('```').length - 1) % 2 !== 0) {
      raw += '\n```';
    }

    const codeMatch = raw.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      this.currentRawCode = codeMatch[2].trim();
    } else {
      this.currentRawCode = '';
    }

    // Extract Follow-up Questions
    const followUps = [];
    const q1Match = raw.match(/[•\-\*]?\s*Q1:\s*(.*?)(?=\n|$)/i);
    const q2Match = raw.match(/[•\-\*]?\s*Q2:\s*(.*?)(?=\n|$)/i);
    if (q1Match && q1Match[1]) followUps.push(q1Match[1].trim());
    if (q2Match && q2Match[1]) followUps.push(q2Match[1].trim());

    // Clean up "Anticipated Follow-ups" from the display text
    let displayRaw = raw
      .replace(/(\*{1,3}|_{1,3})🔮 Anticipated Follow-ups:?(\*{1,3}|_{1,3})?[\s\S]*$/gi, '')
      .replace(/🔮 Anticipated Follow-ups:?[\s\S]*$/gi, '');

    // Convert Markdown to HTML
    let rawHtml = marked.parse(displayRaw, { breaks: true, gfm: true });
    
    // Sanitize HTML
    let formattedHtml = DOMPurify.sanitize(rawHtml);

    // Keyword-Only Mode: extract bold terms and list items, show as scannable pill chips
    if (this.isKeywordMode) {
      const keywords = [];
      // Extract **bold** terms
      const boldMatches = displayRaw.matchAll(/\*\*([^*]+)\*\*/g);
      for (const m of boldMatches) keywords.push(m[1].trim());
      // Extract bullet list items (short ones, < 60 chars)
      const bulletMatches = displayRaw.matchAll(/^[•\-\*]\s+(.{3,60})$/gm);
      for (const m of bulletMatches) {
        const t = m[1].replace(/\*\*/g, '').trim();
        if (!keywords.includes(t)) keywords.push(t);
      }
      // Extract inline code tokens
      const codeMatches = displayRaw.matchAll(/`([^`\n]{2,30})`/g);
      for (const m of codeMatches) {
        if (!keywords.includes(m[1])) keywords.push(m[1].trim());
      }

      if (keywords.length > 0) {
        const colors = ['#38bdf8','#4ade80','#facc15','#a855f7','#ec4899','#fb923c'];
        const pillsHtml = keywords.slice(0, 16).map((kw, i) => {
          const color = colors[i % colors.length];
          return `<span style="display:inline-block;background:${color}22;border:1px solid ${color}66;color:${color};border-radius:999px;padding:5px 14px;font-size:0.9rem;font-weight:700;margin:4px 4px;">${kw}</span>`;
        }).join('');
        formattedHtml = `<div style="padding:4px 0;line-height:2.2;">${pillsHtml}</div>`;
      }
    }

    this.teleprompterBodyContent.innerHTML = formattedHtml;

    if (followUps.length > 0) {
      this.renderFollowUpChips(followUps);
    }

    if (isFinal) {
      this.sessionHistory.push({
        question: questionTitle,
        rawAnswer: raw,
        formattedHtml: formattedHtml,
        rawCode: this.currentRawCode,
        followUps: followUps,
        timestamp: Date.now()
      });
      this.currentHistoryIndex = this.sessionHistory.length - 1;
      if (this.pagerText) {
        this.pagerText.textContent = `${this.sessionHistory.length}/${this.sessionHistory.length}`;
      }
      if (this.btnPagerPrev) this.btnPagerPrev.style.opacity = this.sessionHistory.length > 1 ? '1' : '0.4';
      if (this.btnPagerNext) this.btnPagerNext.style.opacity = '0.4';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.sonarApp = new SonarAiApp();
});
