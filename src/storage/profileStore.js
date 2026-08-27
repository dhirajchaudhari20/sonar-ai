// Storage manager for candidate profile, resume, job description & API configurations

const STORAGE_KEYS = {
  PROFILE: 'shadow_candidate_profile',
  SETTINGS: 'shadow_settings',
  API_KEYS: 'shadow_api_keys'
};

const DEFAULT_PROFILE = {
  candidateName: 'Dhiraj Kishor CHAUDHARI',
  targetRole: 'Senior GenAI & Python Engineer',
  yearsOfExperience: '5+',
  targetCompany: 'Top Tech / FAANG',
  resumeText: `Dhiraj Kishor CHAUDHARI
Senior Software Engineer | Python, GenAI, AWS, RAG Architectures
Summary:
5+ years building high-scale real-time systems, RAG vector pipelines, and LLM integrations. Deep expertise in Python, FastAPI, LangChain, AWS Cloud, PostgreSQL, and Docker.

Work Experience:
Senior Python GenAI Engineer (2022 - Present)
- Architected enterprise RAG retrieval systems handling 50k+ daily queries with sub-second p99 latency.
- Implemented semantic caching with Redis and hybrid sparse/dense embeddings, reducing token expenses by 42%.
- Built automated CI/CD microservice pipelines on AWS ECS & Kubernetes.

Software Engineer (2019 - 2022)
- Engineered scalable distributed APIs in Python and SQL handling high-throughput telemetry pipelines.
- Reduced API database latency by 45% using query optimization and connection pooling.`,
  jobDescription: `Senior GenAI Python Developer
Responsibilities:
- Build and scale real-time AI-powered web applications and RAG systems.
- Design resilient microservices with FastAPI and AWS cloud infrastructure.
- Lead AI integration, prompt engineering, and database optimizations.`,
  keyStrengths: [
    'Python & FastAPI Microservices',
    'LangChain & RAG Vector Architectures',
    'AWS Cloud & Kubernetes (ECS, EKS)',
    'Distributed Systems & PostgreSQL Optimization'
  ]
};

const DEFAULT_SETTINGS = {
  provider: 'groq',
  model: 'openai/gpt-oss-120b',
  language: 'en-US',
  responseStyle: 'balanced',
  autoDetectQuestion: true,
  stealthOpacity: 0.95
};

const DEFAULT_API_KEYS = {
  groq: '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',
  gemini: '',
  openai: '',
  anthropic: ''
};

export const ProfileStore = {
  getProfile() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PROFILE);
      return stored ? JSON.parse(stored) : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile) {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },

  getSettings() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getApiKeys() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.API_KEYS);
      const parsed = stored ? JSON.parse(stored) : DEFAULT_API_KEYS;
      // Ensure groq key has the default fallback if empty
      if (!parsed.groq) parsed.groq = DEFAULT_API_KEYS.groq;
      return parsed;
    } catch {
      return DEFAULT_API_KEYS;
    }
  },

  saveApiKeys(keys) {
    localStorage.setItem(STORAGE_KEYS.API_KEYS, JSON.stringify(keys));
  }
};
