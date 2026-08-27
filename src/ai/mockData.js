// Realistic mock QA dataset for instantaneous offline / demo testing

export const MOCK_INTERVIEW_DATA = [
  {
    keywords: ['conflict', 'disagreement', 'team', 'differ'],
    question: "Tell me about a time you had a technical disagreement with a team member and how you resolved it.",
    category: "Behavioral (STAR)",
    quickBullets: [
      "Disagreed on WebSockets vs gRPC for telemetry streaming at Nexus Tech.",
      "Conducted a 2-day benchmark measuring mobile client overhead and battery impact.",
      "Agreed on hybrid approach: WebSockets for web dashboards, lightweight Protobuf over HTTP/2 for edge."
    ],
    starAnswer: `**Situation:** At Nexus Tech, our team was divided on whether to use raw WebSockets or gRPC for our new real-time telemetry streaming service serving 1.2M daily users.

**Task:** As the senior engineer, I needed to resolve the technical deadlock quickly without hurting team morale and ensure we met our Q3 delivery deadline.

**Action:**
1. I proposed an objective 2-day spike measuring network latency, payload size, and client-side CPU consumption across browser and mobile targets.
2. I gathered the team for an architecture walkthrough with the benchmark data, demonstrating that while gRPC offered 20% smaller payloads, browser client compatibility required extra proxy overhead.
3. We agreed on a pragmatic hybrid pattern: standard WebSockets for web client dashboards and gRPC for backend service-to-service communication.

**Result:** Delivered the pipeline 1 week ahead of schedule, achieved p99 latency under 45ms, and documented the decision rubric as an RFC template adopted team-wide.`,
    tags: ["Leadership", "Conflict Resolution", "Architecture"]
  },
  {
    keywords: ['scale', 'high traffic', 'performance', 'latency', 'bottleneck', '10x'],
    question: "How do you approach optimizing a slow API endpoint experiencing 10x traffic spikes?",
    category: "Technical / System Design",
    quickBullets: [
      "Identify the bottleneck with profiling/APM (DB queries, N+1, CPU serialization).",
      "Implement multi-layer caching (Redis, HTTP Cache-Control, CDN).",
      "Offload compute to asynchronous background workers with message queues (RabbitMQ/Kafka)."
    ],
    starAnswer: `**Step 1: Measurement & Root Cause Analysis**
- Inspect distributed traces (OpenTelemetry / Datadog) to isolate whether delay stems from database locks, slow 3rd-party APIs, or CPU-bound JSON serialization.
- Check database query plans (\`EXPLAIN ANALYZE\`) to detect missing indexes or N+1 query patterns.

**Step 2: Immediate Mitigation (Caching & Throttling)**
- Apply Redis cache-aside with TTL jitter to eliminate cache stampedes on hot keys.
- Enforce token-bucket rate limiting at the API Gateway to prevent cascading upstream failures.

**Step 3: Architectural Decoupling (Scaling & Async)**
- Convert synchronous heavy writes into async jobs via SQS/Kafka and return HTTP 202 Accepted with a status polling/WebSocket callback.
- Horizontally scale stateless worker pods using Kubernetes HPA based on CPU and request queue depth.`,
    tags: ["System Design", "Scalability", "Backend"]
  },
  {
    keywords: ['two sum', 'array', 'target', 'hash map', 'indices', 'code'],
    question: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    category: "Live Coding",
    quickBullets: [
      "Use a Single-pass Hash Map storing (complement -> index).",
      "Time Complexity: O(N), Space Complexity: O(N).",
      "Handles negative numbers and duplicates cleanly."
    ],
    starAnswer: `### Optimal Solution: One-Pass Hash Map

\`\`\`typescript
function twoSum(nums: number[], target: number): number[] {
    const seen = new Map<number, number>(); // Value -> Index

    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (seen.has(complement)) {
            return [seen.get(complement)!, i];
        }
        seen.set(nums[i], i);
    }
    
    return [];
}
\`\`\`

- **Time Complexity:** $O(N)$ — Single iteration through the array with $O(1)$ average hash map lookups.
- **Space Complexity:** $O(N)$ — Stores up to $N$ elements in the worst case.
- **Key Edge Cases:** Empty array, no matching pair, negative numbers, large integers.`,
    tags: ["Algorithms", "Data Structures", "LeetCode Easy/Medium"]
  },
  {
    keywords: ['lru', 'cache', 'least recently used', 'get', 'put', 'o(1)'],
    question: "Design a data structure for Least Recently Used (LRU) Cache with O(1) get and put operations.",
    category: "Live Coding / System Design",
    quickBullets: [
      "Combine a Doubly Linked List (for $O(1)$ node eviction/insertion) with a Hash Map (for $O(1)$ key lookup).",
      "Most recently used node placed at Head, least recently used evicted from Tail.",
      "Thread safety: Use read-write mutex or synchronized locks for concurrent environments."
    ],
    starAnswer: `### Optimal Solution: Hash Map + Doubly Linked List

\`\`\`typescript
class DNode {
  key: number;
  val: number;
  prev: DNode | null = null;
  next: DNode | null = null;
  constructor(key: number, val: number) {
    this.key = key;
    this.val = val;
  }
}

class LRUCache {
  private capacity: number;
  private map: Map<number, DNode> = new Map();
  private head: DNode = new DNode(0, 0); // Dummy Head
  private tail: DNode = new DNode(0, 0); // Dummy Tail

  constructor(capacity: number) {
    this.capacity = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get(key: number): number {
    const node = this.map.get(key);
    if (!node) return -1;
    this.moveToHead(node);
    return node.val;
  }

  put(key: number, value: number): void {
    let node = this.map.get(key);
    if (node) {
      node.val = value;
      this.moveToHead(node);
    } else {
      if (this.map.size >= this.capacity) {
        const lru = this.tail.prev!;
        this.removeNode(lru);
        this.map.delete(lru.key);
      }
      const newNode = new DNode(key, value);
      this.map.set(key, newNode);
      this.addNode(newNode);
    }
  }

  private addNode(node: DNode) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: DNode) {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToHead(node: DNode) {
    this.removeNode(node);
    this.addNode(node);
  }
}
\`\`\`

- **Time Complexity:** $O(1)$ for both \`get\` and \`put\`.
- **Space Complexity:** $O(\\text{capacity})$ for hash map and nodes.`,
    tags: ["Data Structures", "System Design", "O(1)"]
  },
  {
    keywords: ['strength', 'weakness', 'yourself', 'introduce', 'background'],
    question: "Tell me about yourself and why you're interested in this role.",
    category: "Introduction & Pitch",
    quickBullets: [
      "Present: Senior Full Stack Engineer with 6+ years specializing in distributed real-time systems and AI.",
      "Past: Scaled Nexus Tech WebSocket infrastructure to 1.2M DAU and reduced p99 latency by 45%.",
      "Future: Excited to combine deep full-stack architecture with production AI to build high-impact user experiences."
    ],
    starAnswer: `**Present:** I'm a Senior Full-Stack Engineer with over 6 years of experience building high-scale real-time web applications, distributed APIs, and intelligent AI features.

**Past:** At Nexus Tech, I led the core platform team scaling our WebSocket and event streaming infrastructure to support 1.2M daily active users with 99.99% uptime. I also integrated semantic vector search which directly boosted user query engagement by 35%. Prior to that, I built high-throughput telemetry pipelines in Go and Python ingesting over 50TB daily.

**Future:** What excites me about your team is the focus on building high-performance, real-time products at the intersection of web and modern AI. Given my background in resilient systems and frontend architecture, I can hit the ground running and contribute immediately to your product roadmap.`,
    tags: ["Elevator Pitch", "Introduction", "Culture Fit"]
  }
];

export function findMockMatch(query) {
  const q = query.toLowerCase();
  for (const item of MOCK_INTERVIEW_DATA) {
    if (item.keywords.some(k => q.includes(k))) {
      return item;
    }
  }
  return null;
}
