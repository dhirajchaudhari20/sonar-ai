// Storage manager for dynamic candidate profile, resume, job description & API configurations

const STORAGE_KEYS = {
  PROFILE: 'shadow_candidate_profile',
  SETTINGS: 'shadow_settings',
  API_KEYS: 'shadow_api_keys',
  SESSIONS_HISTORY: 'shadow_sessions_history'
};

const BLANK_PROFILE = {
  candidateName: '',
  targetRole: '',
  yearsOfExperience: '',
  targetCompany: '',
  resumeText: '',
  targetJobDescription: '',
  keyStrengths: []
};

const DEFAULT_SETTINGS = {
  provider: 'groq',
  model: 'qwen/qwen3.8-27b',
  language: 'en-US',
  responseStyle: 'balanced',
  autoDetectQuestion: true,
  stealthOpacity: 0.95,
  eyeContactMode: false
};

const DEFAULT_API_KEYS = {
  groq: '',
  gemini: '',
  openai: '',
  anthropic: ''
};

export const ProfileStore = {
  getProfile() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { ...BLANK_PROFILE, ...parsed };
      }
      return { ...BLANK_PROFILE };
    } catch {
      return { ...BLANK_PROFILE };
    }
  },

  isProfileConfigured() {
    const profile = this.getProfile();
    return !!(profile.candidateName && profile.candidateName.trim() && profile.resumeText && profile.resumeText.trim());
  },

  saveProfile(profile) {
    const current = this.getProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(updated));
    return updated;
  },

  updateResume(resumeText, targetJobDescription) {
    const current = this.getProfile();
    current.resumeText = resumeText;
    if (targetJobDescription !== undefined) current.targetJobDescription = targetJobDescription;
    this.saveProfile(current);
  },

  clearProfile() {
    localStorage.removeItem(STORAGE_KEYS.PROFILE);
  },

  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!stored) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(stored);
      // Migrate deprecated llama models that return 404 on Groq
      if (parsed.model && (parsed.model.includes('llama-3') || parsed.model.includes('llama3'))) {
        parsed.model = 'openai/gpt-oss-120b';
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getApiKeys() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          groq: parsed.groq || DEFAULT_API_KEYS.groq,
          gemini: parsed.gemini || DEFAULT_API_KEYS.gemini,
          openai: parsed.openai || DEFAULT_API_KEYS.openai,
          anthropic: parsed.anthropic || DEFAULT_API_KEYS.anthropic
        };
      }
      return DEFAULT_API_KEYS;
    } catch {
      return DEFAULT_API_KEYS;
    }
  },

  saveApiKeys(keys) {
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
  }
};
