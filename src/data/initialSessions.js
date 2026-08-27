// Preloaded realistic sessions matching the user's dashboard

export const INITIAL_SESSIONS = [
  {
    id: "sess_tata_01",
    company: "tata communications",
    role: "Network Security Engineer",
    date: "10 AUG 2026",
    duration: "29m 58s",
    creditCost: "0.5 Credit",
    status: "Ended",
    isFree: false,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# tata communications — Network Security Engineer Interview
**Date:** 10 AUG 2026 | **Duration:** 29m 58s

### Q1: How do you configure Zero Trust Network Architecture across multi-cloud VPCs?
**Answer Provided:**
- Implemented micro-segmentation using software-defined perimeters (SDP) and mutual TLS (mTLS) authentication.
- Enforced role-based access control (RBAC) via centralized identity provider (IdP) with automated policy enforcement.
- Integrated Cloudflare Access and AWS Security Hub to monitor egress telemetry and detect anomalies.`
  },
  {
    id: "sess_ishan_02",
    company: "ISHAN TECHNOLIGES",
    role: "GCP DevOps Engineer",
    date: "3 JUL 2026",
    duration: "32m 13s",
    creditCost: "1 Credit",
    status: "Ended",
    isFree: false,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# ISHAN TECHNOLIGES — GCP DevOps Engineer Interview
**Date:** 3 JUL 2026 | **Duration:** 32m 13s

### Q1: How do you design an automated CI/CD pipeline for multi-region GKE clusters with zero downtime?
**Answer Provided:**
- Leveraged Cloud Build and Terraform to provision infrastructure as code (IaC) with immutable state locking.
- Configured Anthos Config Management to synchronize GitOps repositories across multi-region GKE clusters.
- Utilized Canary deployment strategies via Istio service mesh with automated Prometheus metrics rollbacks.`
  },
  {
    id: "sess_blank_03",
    company: "blank ai",
    role: "magment trainner",
    date: "1 JUL 2026",
    duration: "10m 0s",
    creditCost: "Free Session",
    status: "Ended",
    isFree: true,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# blank ai — Management Trainer Session
**Date:** 1 JUL 2026 | **Duration:** 10m 0s (Trial Session)

### Q1: Describe your methodology for upskilling engineering leads in prompt engineering.
**Answer Provided:**
- Designed structured workshops covering few-shot prompting, chain-of-thought, and RAG retrieval optimization.
- Conducted live benchmark evaluations comparing open-source models with proprietary APIs for developer workflows.`
  },
  {
    id: "sess_tcs_04",
    company: "TCS",
    role: "GenAI Python Developer",
    date: "19 JUN 2026",
    duration: "40m 7s",
    creditCost: "1 Credit",
    status: "Ended",
    isFree: false,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# TCS — GenAI Python Developer Interview
**Date:** 19 JUN 2026 | **Duration:** 40m 7s

### Q1: How would you design a high-throughput RAG pipeline with hybrid search in Python?
**Answer Provided:**
- Used LangChain / LlamaIndex with FastAPI async streaming endpoints.
- Combined dense vector search (Qdrant / pgvector) with sparse BM25 keyword matching via Reciprocal Rank Fusion (RRF).
- Implemented semantic caching with Redis to reduce LLM token costs by 42%.`
  },
  {
    id: "sess_tcs_05",
    company: "TCS",
    role: "Python GenAI Developer",
    date: "19 JUN 2026",
    duration: "10m 0s",
    creditCost: "Free Session",
    status: "Ended",
    isFree: true,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# TCS — Python GenAI Developer (Mock Practice)
**Date:** 19 JUN 2026 | **Duration:** 10m 0s`
  },
  {
    id: "sess_tcs_06",
    company: "tcs",
    role: "Python GenAI Developer",
    date: "19 JUN 2026",
    duration: "10m 0s",
    creditCost: "Free Session",
    status: "Ended",
    isFree: true,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# TCS — Practice Session
**Date:** 19 JUN 2026 | **Duration:** 10m 0s`
  },
  {
    id: "sess_tcs_07",
    company: "tcs",
    role: "Python Developer",
    date: "18 JUN 2026",
    duration: "10m 0s",
    creditCost: "Free Session",
    status: "Ended",
    isFree: true,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# TCS — Python Technical Screen
**Date:** 18 JUN 2026 | **Duration:** 10m 0s`
  },
  {
    id: "sess_tcs_08",
    company: "TCS",
    role: "**GenAI Python Developer**",
    date: "18 JUN 2026",
    duration: "10m 0s",
    creditCost: "Free Session",
    status: "Ended",
    isFree: true,
    sessionType: "Interview",
    hasTranscript: true,
    transcript: `# TCS — GenAI Python Developer Mock
**Date:** 18 JUN 2026 | **Duration:** 10m 0s`
  }
];

export const INITIAL_USER = {
  name: "Dhiraj Kishor CHAUDHARI",
  email: "dhirajvva14@gmail.com",
  plan: "Free Plan",
  trialRemaining: "10 min",
  credits: 0,
  activeResume: "Dhiraj_Software_Engineer_Resume.pdf"
};
