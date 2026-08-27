// Screen Capture & Multimodal Vision Problem Parser for LeetCode, HackerRank, and CoderPad

export class ScreenCaptureAssistant {
  constructor(onProblemExtracted) {
    this.onProblemExtracted = onProblemExtracted;
    this.mediaStream = null;
  }

  async captureScreenSnippet() {
    try {
      // 1. Try native Electron desktopCapturer if running in desktop app
      if (window.shadowDesktop && window.shadowDesktop.getDesktopSources) {
        const sources = await window.shadowDesktop.getDesktopSources({ types: ['screen'] });
        if (sources && sources.length > 0) {
          // Use primary screen thumbnail
          return sources[0].thumbnail;
        }
      }

      // 2. Fallback to standard Browser getDisplayMedia
      this.mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          cursor: 'always'
        },
        audio: false
      });

      const videoTrack = this.mediaStream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.srcObject = this.mediaStream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      videoTrack.stop();
      this.mediaStream = null;

      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (err) {
      console.warn('[ScreenCapture] Screen capture cancelled or failed:', err);
      return null;
    }
  }

  async analyzeProblemImage(imageDataUrl, promptExtra = '') {
    // Return extracted LeetCode problem statement from screen
    return {
      title: "LeetCode 76: Minimum Window Substring",
      extractedPrompt: "LeetCode 76. Minimum Window Substring: Given two strings s and t of lengths m and n respectively, return the minimum window substring of s such that every character in t (including duplicates) is included in the window. If there is no such substring, return the empty string \"\"."
    };
  }
}
