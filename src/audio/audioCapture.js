// Sonar AI Core Audio Capture Architecture (Google Meet / Zoom Tab Audio + Candidate Mic Digital Mixer + Speaker Diarization)

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
    this.micGainNode = null;
    this.systemGainNode = null;
    this.compressorNode = null;
    this.processorNode = null;
    this.safetyGainNode = null;
    this.dataArray = null;
    this.animationFrameId = null;
    this.isSystemAudioOn = true;
    this.isMicAudioOn = true;
    this.isListening = false;
    this.currentSpeaker = 'interviewer'; // 'interviewer' | 'candidate'
    this.onVolumeChange = null;
    this.onStatusChange = null;
    this.onPcmData = null; // (samples, sampleRate, speaker)

    const resumeAudio = () => {
      if (this.audioContext && this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', resumeAudio);
      window.addEventListener('keydown', resumeAudio);
    }
  }

  ensureAudioContext() {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    if (!this.destinationNode) {
      this.destinationNode = this.audioContext.createMediaStreamDestination();
    }
    return this.audioContext;
  }

  // 1. Candidate Microphone Audio Stream
  async initMicStream() {
    try {
      this.ensureAudioContext();

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        },
        video: false
      });

      this.micStream.getAudioTracks().forEach(track => {
        track.onended = () => {
          this.micStream = null;
          this.rebuildAudioGraph();
        };
      });

      this.rebuildAudioGraph();
      this.isListening = true;
      return true;
    } catch (err) {
      console.error('[SonarAudio] Mic access error:', err);
      return false;
    }
  }

  // 2. Google Meet, Zoom, MS Teams & System Tab Audio Loopback
  async initSystemStream() {
    try {
      this.ensureAudioContext();

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser'
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2
        },
        systemAudio: 'include',
        selfBrowserSurface: 'exclude'
      });

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks || audioTracks.length === 0) {
        console.warn('[SonarAudio] No audio track was shared by the user.');
        stream.getVideoTracks().forEach(t => t.stop());
        return {
          success: false,
          reason: 'no_audio_track',
          message: 'No tab audio shared. Make sure to check "Also share tab audio" in the picker.'
        };
      }

      this.systemStream = stream;

      // Disable video tracks to save CPU without stopping the audio stream
      const videoTracks = this.systemStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = false;
      }

      audioTracks.forEach(track => {
        track.onended = () => {
          console.log('[SonarAudio] System audio track ended');
          this.systemStream = null;
          this.rebuildAudioGraph();
        };
      });

      this.rebuildAudioGraph();
      this.isListening = true;
      return { success: true };
    } catch (err) {
      console.warn('[SonarAudio] System Loopback audio share rejected or cancelled:', err);
      return { success: false, reason: 'cancelled', message: err.message };
    }
  }

  // Rebuilds and connects mic and Google Meet system audio sources to digital mixer with dynamics compressor
  rebuildAudioGraph() {
    const ctx = this.ensureAudioContext();

    if (this.micSourceNode) {
      try { this.micSourceNode.disconnect(); } catch {}
      this.micSourceNode = null;
    }
    if (this.systemSourceNode) {
      try { this.systemSourceNode.disconnect(); } catch {}
      this.systemSourceNode = null;
    }
    if (this.micGainNode) {
      try { this.micGainNode.disconnect(); } catch {}
      this.micGainNode = null;
    }
    if (this.systemGainNode) {
      try { this.systemGainNode.disconnect(); } catch {}
      this.systemGainNode = null;
    }
    if (this.compressorNode) {
      try { this.compressorNode.disconnect(); } catch {}
      this.compressorNode = null;
    }
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch {}
      this.processorNode = null;
    }
    if (this.safetyGainNode) {
      try { this.safetyGainNode.disconnect(); } catch {}
      this.safetyGainNode = null;
    }

    // High-fidelity Dynamics Compressor / Limiter
    this.compressorNode = ctx.createDynamicsCompressor();
    this.compressorNode.threshold.setValueAtTime(-24, ctx.currentTime);
    this.compressorNode.knee.setValueAtTime(30, ctx.currentTime);
    this.compressorNode.ratio.setValueAtTime(12, ctx.currentTime);
    this.compressorNode.attack.setValueAtTime(0.003, ctx.currentTime);
    this.compressorNode.release.setValueAtTime(0.25, ctx.currentTime);

    this.compressorNode.connect(this.destinationNode);

    // 1. Connect Mic Stream ONLY if mic is unmuted
    if (this.micStream && this.isMicAudioOn) {
      try {
        this.micSourceNode = ctx.createMediaStreamSource(this.micStream);
        this.micGainNode = ctx.createGain();
        this.micGainNode.gain.setValueAtTime(1.5, ctx.currentTime);
        this.micSourceNode.connect(this.micGainNode);
        this.micGainNode.connect(this.compressorNode);
      } catch (e) {
        console.warn('[SonarAudio] Mic connect error:', e);
      }
    }

    // 2. Connect Google Meet / System Audio Stream with 2.8x gain boost for crystal-clear interviewer speech
    if (this.systemStream && this.isSystemAudioOn) {
      try {
        this.systemSourceNode = ctx.createMediaStreamSource(this.systemStream);
        this.systemGainNode = ctx.createGain();
        this.systemGainNode.gain.setValueAtTime(2.8, ctx.currentTime);
        this.systemSourceNode.connect(this.systemGainNode);
        this.systemGainNode.connect(this.compressorNode);
      } catch (e) {
        console.warn('[SonarAudio] System loopback connect error:', e);
      }
    }

    // 3. Connect unified PCM processor node directly from compressorNode with Speaker Diarization
    this.processorNode = ctx.createScriptProcessor(4096, 1, 1);
    this.safetyGainNode = ctx.createGain();
    this.safetyGainNode.gain.setValueAtTime(0, ctx.currentTime);

    this.processorNode.onaudioprocess = (e) => {
      if (!this.isListening) return;
      const inputData = e.inputBuffer.getChannelData(0);

      // Determine speaker source
      const isSystemActive = !!this.systemStream && this.isSystemAudioOn;
      const isMicActive = !!this.micStream && this.isMicAudioOn;
      
      let speaker = 'interviewer';
      if (isSystemActive && !isMicActive) {
        speaker = 'interviewer';
      } else if (!isSystemActive && isMicActive) {
        speaker = 'candidate';
      } else {
        speaker = this.systemStream ? 'interviewer' : 'candidate';
      }
      this.currentSpeaker = speaker;

      // Always invoke the latest onPcmData callback (re-reads from singleton each time)
      const cb = this.onPcmData;
      if (cb) {
        cb(inputData, ctx.sampleRate, speaker);
      }
    };

    this.compressorNode.connect(this.processorNode);
    this.processorNode.connect(this.safetyGainNode);
    this.safetyGainNode.connect(ctx.destination);

    this.mixedStream = this.destinationNode.stream;
    this.setupVisualizerNode();
  }

  getMixedStream() {
    if (this.mixedStream) return this.mixedStream;
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

  setupVisualizerNode() {
    const ctx = this.ensureAudioContext();
    try {
      if (this.analyser) {
        try { this.analyser.disconnect(); } catch {}
      }
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      if (this.compressorNode) {
        this.compressorNode.connect(this.analyser);
      }
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (e) {
      console.warn('[SonarAudio] Visualizer setup error:', e);
    }
  }

  startVisualizer(canvasElement) {
    if (!canvasElement) return;
    const ctx = canvasElement.getContext('2d');

    const draw = () => {
      this.animationFrameId = requestAnimationFrame(draw);
      const width = canvasElement.width;
      const height = canvasElement.height;

      ctx.clearRect(0, 0, width, height);

      // If muted and no system audio, draw a flat muted line
      if (!this.analyser || !this.dataArray || !this.isListening || (!this.isMicAudioOn && !this.systemStream)) {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(2, height / 2);
        ctx.lineTo(width - 2, height / 2);
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

      const barCount = 5;
      const spacing = 2;
      const totalSpacing = spacing * (barCount - 1);
      const barWidth = (width - totalSpacing) / barCount;

      for (let i = 0; i < barCount; i++) {
        const val = this.dataArray[i % this.dataArray.length] / 255;
        const minHeight = 3;
        const barHeight = Math.max(minHeight, val * height * 0.9);
        const x = i * (barWidth + spacing);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = val > 0.08 ? (this.currentSpeaker === 'interviewer' ? '#38bdf8' : '#22c55e') : '#38bdf8';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
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
    if (this.processorNode) {
      try { this.processorNode.disconnect(); } catch {}
      this.processorNode = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
  }
}

export const audioCapture = new AudioCaptureManager();
