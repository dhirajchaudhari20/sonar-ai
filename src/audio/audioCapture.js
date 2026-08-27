// Parakeet AI Core Audio Capture Architecture (OS System Loopback + Candidate Mic Digital Mixer)

export class AudioCaptureManager {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.micStream = null;
    this.systemStream = null;
    this.mixedStream = null;
    this.destinationNode = null;
    this.micSourceNode = null;
    this.systemSourceNode = null;
    this.dataArray = null;
    this.animationFrameId = null;
    this.isSystemAudioOn = true;
    this.isMicAudioOn = true;
    this.isListening = false;
    this.onVolumeChange = null;
  }

  ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    if (!this.destinationNode) {
      this.destinationNode = this.audioContext.createMediaStreamDestination();
    }
    return this.audioContext;
  }

  // 1. Microphone Audio Stream
  async initMicStream() {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.rebuildAudioGraph();
      this.isListening = true;
      return true;
    } catch (err) {
      console.error('[ParakeetAudio] Mic access error:', err);
      return false;
    }
  }

  // 2. OS-Level / Browser System Audio Loopback (Zoom, Google Meet, Teams, YouTube)
  async initSystemStream() {
    try {
      this.systemStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2
        }
      });

      // Stop unused video track immediately to save CPU/GPU resources
      const videoTracks = this.systemStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].stop();
      }

      this.systemStream.getAudioTracks().forEach(track => {
        track.onended = () => {
          this.systemStream = null;
          this.rebuildAudioGraph();
        };
      });

      this.rebuildAudioGraph();
      this.isListening = true;
      return true;
    } catch (err) {
      console.warn('[ParakeetAudio] System Loopback audio share rejected or unavailable:', err);
      return false;
    }
  }

  // Reconnects mic and system audio sources to the unified digital mixer
  rebuildAudioGraph() {
    this.ensureAudioContext();

    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect(); } catch {}
      this.micSourceNode = null;
    }
    if (this.systemSourceNode) {
      try { this.systemSourceNode.disconnect(); } catch {}
      this.systemSourceNode = null;
    }

    if (this.micStream && this.isMicAudioOn) {
      try {
        this.micSourceNode = this.audioContext.createMediaStreamSource(this.micStream);
        this.micSourceNode.connect(this.destinationNode);
      } catch (e) {
        console.warn('[ParakeetAudio] Mic connect error:', e);
      }
    }

    if (this.systemStream && this.isSystemAudioOn) {
      try {
        this.systemSourceNode = this.audioContext.createMediaStreamSource(this.systemStream);
        this.systemSourceNode.connect(this.destinationNode);
      } catch (e) {
        console.warn('[ParakeetAudio] System loopback connect error:', e);
      }
    }

    this.mixedStream = this.destinationNode.stream;
    this.setupVisualizerNode(this.mixedStream);
  }

  getMixedStream() {
    this.rebuildAudioGraph();
    return this.mixedStream || this.micStream || this.systemStream;
  }

  toggleMic(enabled) {
    this.isMicAudioOn = enabled;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(t => { t.enabled = enabled; });
    }
    this.rebuildAudioGraph();
  }

  toggleSystemAudio(enabled) {
    this.isSystemAudioOn = enabled;
    if (this.systemStream) {
      this.systemStream.getAudioTracks().forEach(t => { t.enabled = enabled; });
    }
    this.rebuildAudioGraph();
  }

  setupVisualizerNode(stream) {
    if (!stream) return;
    this.ensureAudioContext();
    try {
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      source.connect(this.analyser);
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {}
  }

  startVisualizer(canvasElement) {
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');

    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);
      const width = canvasElement.width;
      const height = canvasElement.height;

      ctx.clearRect(0, 0, width, height);

      if (!this.analyser || !this.dataArray || !this.isListening) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      this.analyser.getByteFrequencyData(this.dataArray);

      let totalVolume = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        totalVolume += this.dataArray[i];
      }
      const avgVolume = totalVolume / this.dataArray.length;
      if (this.onVolumeChange) this.onVolumeChange(avgVolume);

      const barCount = 18;
      const totalSpacing = width * 0.15;
      const barWidth = (width - totalSpacing) / barCount;
      const gap = totalSpacing / (barCount - 1);

      for (let i = 0; i < barCount; i++) {
        const val = this.dataArray[i % this.dataArray.length] / 255;
        const minHeight = 4;
        const barHeight = Math.max(minHeight, val * height * 0.85);
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, '#38bdf8');
        gradient.addColorStop(1, '#22c55e');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }
    };

    draw();
  }

  stop() {
    this.isListening = false;
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.systemStream) {
      this.systemStream.getTracks().forEach(t => t.stop());
      this.systemStream = null;
    }
  }
}

export const audioCapture = new AudioCaptureManager();
