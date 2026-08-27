# 🦅 Shadow AI — Stealth Desktop Interview Assistant

**Shadow AI** is a native, real-time desktop AI interview assistant designed to run as a floating, translucent overlay on top of any video call (**Zoom, Microsoft Teams, Google Meet**) or technical coding platform (**LeetCode, HackerRank, Coderpad**) without showing up in single-application screen shares.

---

## 📸 Overview: Candidate View vs Interviewer View

- **Candidate View:** A sleek, frameless HUD floating over your IDE or meeting window, listening in real-time to interview questions and delivering concise talking points + syntax-highlighted code snippets within 1.5–3 seconds.
- **Interviewer View (Undetectable):** When you share only your application window (e.g., Sublime Text, VS Code, or Browser tab), the Shadow AI floating HUD remains completely invisible to the interviewer.

---

## ⚡ Key Features

1. **Native Frameless Floating HUD**:
   - Translucent glassmorphism design with backdrop blur.
   - Draggable from the title bar.
   - Always-on-top mode (`setAlwaysOnTop(true, 'floating')`) keeps it visible above all other apps.
   - Opacity slider (ghost mode from 20% to 100%).

2. **Real-Time Speech-to-Answer Engine**:
   - Web Speech API continuous transcription with auto-silence end detection.
   - Multi-language support (52 languages).
   - Instant 1-click generation.

3. **Multi-Model LLM Streaming**:
   - **Groq** (Llama-3.3 70B for sub-300ms ultra-low latency).
   - **Google Gemini** (Gemini 1.5/2.0 Flash).
   - **OpenAI** (GPT-4o / GPT-5).
   - **Anthropic Claude** (Claude 3.5 / 4.0 Sonnet).
   - **Offline Neural Simulator** for instant testing with zero API keys required.

4. **Screen Sniper**:
   - One-click problem capture directly from your screen for LeetCode / HackerRank problems.

5. **Keyboard Shortcuts**:
   - <kbd>Esc</kbd> : Instant Panic Hide
   - <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd> : Toggle HUD Visibility
   - <kbd>Command/Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>S</kbd> : Snipe Screen Problem
   - <kbd>Enter</kbd> : Generate answer for question in HUD

---

## 🚀 Getting Started

### 1. Run the Desktop App (Electron)
```bash
cd /Users/dhirajchaudhari/.gemini/antigravity-ide/scratch/parakeet-ai-copilot
npm run start:desktop
```

### 2. Run in Browser Mode (Optional)
```bash
npm run dev
```
Open `http://localhost:3000/` in Chrome or Brave.
