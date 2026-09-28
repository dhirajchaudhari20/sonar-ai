import { ProfileStore } from '../storage/profileStore.js';

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
    const apiKeys = ProfileStore.getApiKeys();
    const apiKey = apiKeys.groq;
    
    if (!apiKey) {
      return {
        title: "API Key Missing",
        extractedPrompt: "Please configure your Groq API Key in the settings to use the screenshot feature."
      };
    }

    try {
      const prompt = `You are an OCR and code problem extraction assistant. Look at the provided screenshot.
If there is a coding problem, technical question, or interview prompt visible on the screen, extract its exact text.
If there is NO coding problem visible on the screen, do not hallucinate or make one up. Just return "No problem detected" for both fields.
Return ONLY a valid JSON object with the following format:
{
  "title": "A short, concise title for the question (or 'No problem detected')",
  "extractedPrompt": "The full text of the question, or 'No problem detected if none is visible'."
}`;

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.2-11b-vision-preview',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: imageDataUrl }
                }
              ]
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        })
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          return JSON.parse(content);
        }
      }
    } catch (err) {
      console.error('[ScreenCapture] Vision API error:', err);
    }
    
    return {
      title: "Error Extracting Text",
      extractedPrompt: "Failed to extract text from the screenshot. Please try again."
    };
  }
}
