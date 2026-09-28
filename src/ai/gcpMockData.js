// GCP Interview Mock Data — Offline / Instant answers for GCP topics
// Project: FinServ Banking Cloud Migration

export const GCP_MOCK_DATA = [
  {
    keywords: ['landing zone', 'foundation', 'org policy', 'bootstrap', 'folder', 'hierarchy'],
    category: 'GCP Landing Zone',
    quickBullets: [
      'Built multi-folder org hierarchy: Prod/, Non-Prod/, Shared-Services/ under finservbank.com.',
      'Used Terraform + Google Cloud Foundation Blueprint for all provisioning.',
      'Org Policies: restricted resources to asia-south1, disabled external IPs on all VMs.'
    ],
    answer: `✅ Direct Answer:
• Yes, I designed and implemented the complete GCP Landing Zone for FinServ Banking Migration.

🏗️ In My Project (FinServ Banking Migration):
• Project: FinServ Banking Cloud Migration — Migrated 200+ microservices from on-prem to GCP
• What I built:
  — Folder hierarchy: Production/, Non-Production/, Shared-Services/ under finservbank.com org node
  — Org Policies: restricted resource location to asia-south1, disabled external IPs on VMs, enforced uniform bucket-level access on GCS
  — Shared VPC: host project owned the network, 4 service projects (payments, banking, analytics, platform) shared it
  — Billing budget alerts at 80% and 100%, Data Access audit logs exported to BigQuery via log sinks
• Impact: Every new project auto-inherited security policies — zero manual configuration drift, PCI-DSS compliance achieved out of the box

🔑 Key Technical Points:
• Landing Zone = pre-configured, secure, scalable GCP foundation — built before any workloads
• Why Terraform: idempotent, version-controlled, drift detection via terraform plan in CI/CD
• Org Policy constraint/gcp.resourceLocations prevents teams from accidentally spinning up resources in wrong regions

💥 Challenge & Fix:
• Issue: Teams kept manually creating projects outside the folder hierarchy → policy drift
• Fix: Added Org Policy to restrict project creation to designated folders + automated project factory via Terraform module
• Result: 100% of projects now follow the Landing Zone pattern, zero policy exceptions

🔮 Anticipated Follow-ups:
• Q1: How did you handle IAM role bindings at scale — did you use groups or individual bindings?
• Q2: What org policies did you find most critical for a banking/regulated environment?`
  },
  {
    keywords: ['vpc', 'virtual private cloud', 'subnet', 'custom mode', 'auto mode', 'private google access', 'network'],
    category: 'GCP Networking & VPC',
    quickBullets: [
      'Hub-and-spoke topology: hub VPC (10.0.0.0/16) for shared services, spoke VPCs per team.',
      'All custom mode VPCs — never auto mode (auto creates subnets in every region, security risk).',
      'Private Google Access on all subnets so VMs without public IPs can reach GCP APIs.'
    ],
    answer: `✅ Direct Answer:
• Yes, I designed the full VPC architecture for FinServ — hub-and-spoke with custom mode VPCs.

🏗️ In My Project (FinServ Banking Migration):
• What I built:
  — Hub VPC (10.0.0.0/16): bastion hosts, Cloud NAT, centralized DNS
  — Spoke VPCs: payments-vpc (10.1.0.0/16), banking-vpc (10.2.0.0/16), analytics-vpc (10.3.0.0/16)
  — Private Google Access on all subnets: VMs reach GCS, BigQuery, Pub/Sub without external IPs
  — Cloud NAT on hub: all private VM internet egress routed through NAT — no VM had a public IP
• Impact: Zero VM had an external IP — full compliance with banking security policy, no public attack surface

🔑 Key Technical Points:
• Custom mode VPC: you define subnets explicitly — full control over CIDR, region, purpose
• Auto mode: creates 1 subnet per region automatically — bad for compliance, wastes IP space in unwanted regions
• Shared VPC: host project owns the VPC, service projects use it — one network team manages all network resources
• Private Google Access: VMs in private subnets can still call GCP APIs without internet traversal

💥 Challenge & Fix:
• Issue: Analytics team needed to access GCS bucket for reporting but their VM had no external IP
• Fix: Enabled Private Google Access on their subnet + added a firewall rule allowing egress to 199.36.153.8/30 (restricted.googleapis.com)
• Result: Secure GCS access without any public IP exposure

🔮 Anticipated Follow-ups:
• Q1: How did you handle DNS resolution across multiple VPCs?
• Q2: What CIDR planning strategy did you use to avoid IP exhaustion over time?`
  },
  {
    keywords: ['peering', 'vpc peering', 'peer', 'transitive', 'non-transitive'],
    category: 'VPC Peering',
    quickBullets: [
      'Peered payments-vpc ↔ analytics-vpc for data pipeline team to pull transactions privately.',
      'VPC Peering is non-transitive — solved with hub-and-spoke + selective VPN for transit cases.',
      'Pre-planned CIDR blocks in IPAM doc to prevent overlapping ranges (peering fails if CIDRs overlap).'
    ],
    answer: `✅ Direct Answer:
• Yes, I implemented VPC Peering across 4 VPCs in the FinServ project and solved the transitivity challenge.

🏗️ In My Project (FinServ Banking Migration):
• What I set up:
  — payments-vpc ↔ analytics-vpc: data pipeline team pulls transaction data without internet traversal
  — hub-vpc ↔ all spoke VPCs: centralized DNS resolution for all teams
  — Pre-planned IPAM doc in Confluence before peering — reserved /16 blocks per team to prevent overlap
• Impact: Cross-team data transfer fully private, zero internet exposure, no latency from public routing

🔑 Key Technical Points:
• VPC Peering = private Google network connection, no encryption overhead, no bandwidth limits
• Non-transitive: A↔B and B↔C does NOT allow A↔C — each pair needs its own peering
• Peering fails if CIDRs overlap — this is why upfront IP planning is critical
• Routes auto-exchanged — no manual static route entries needed between peered VPCs

💥 Challenge & Fix:
• Issue: Payments team needed to reach Analytics AND Banking VPC — transitivity problem
• Fix: Payments VPC peered directly with both Analytics and Banking VPCs (3 separate peerings)
• For future transitivity at scale: proposed moving to Shared VPC or Network Connectivity Center

🔮 Anticipated Follow-ups:
• Q1: When would you choose Shared VPC over VPC Peering?
• Q2: How many peerings can a single VPC have, and did you approach that limit?`
  },
  {
    keywords: ['interconnect', 'dedicated interconnect', 'partner interconnect', 'cloud vpn', 'bgp', 'cloud router', 'hybrid', 'on-prem', 'on-premises'],
    category: 'Interconnect & Hybrid Connectivity',
    quickBullets: [
      'Dedicated Interconnect: 2×10 Gbps links (asia-south1-a and asia-south1-b) for HA to Mumbai DC.',
      'BGP via Cloud Router between on-prem router (AS 65001) and GCP. VLAN attachments to Transit VPC.',
      'BGP timers tuned: hold-time 20s → 10s, failover reduced from ~40s to ~20s.'
    ],
    answer: `✅ Direct Answer:
• Yes, I architected and configured the Dedicated Interconnect setup connecting our Mumbai on-premises data center to GCP.

🏗️ In My Project (FinServ Banking Migration):
• What I built:
  — 2×10 Gbps Dedicated Interconnect links: one to asia-south1-a, one to asia-south1-b (HA)
  — VLAN attachments on each link connecting to Transit VPC
  — Cloud Router with BGP sessions: on-prem AS 65001 ↔ Cloud Router
  — Interconnect primary route metric 100, VPN backup metric 200 (auto-failover)
• Impact: 10 Gbps consistent throughput, 99.99% SLA, nightly 50-100 GB EOD batch files transferred reliably

🔑 Key Technical Points:
• Dedicated Interconnect: physical cross-connect at Google colocation facility — 10/100 Gbps, not internet
• Partner Interconnect: through a telecom provider, lower bandwidth, lower entry cost (50 Mbps–10 Gbps)
• Cloud VPN: encrypted, internet-based, up to 3 Gbps — fine for dev/test, not for 10 Gbps production banking
• Cloud Router: managed BGP router — dynamically advertises GCP subnets to on-prem, no static routes needed

💥 Challenge & Fix:
• Issue: Packet drops on Interconnect — discovered MTU mismatch. On-prem sending 1500-byte frames, Interconnect needs 1440 (VLAN overhead)
• Fix: Set MTU to 1440 on on-prem interface for Interconnect traffic
• Result: Zero packet loss. Added MTU validation to network change checklist.

🔮 Anticipated Follow-ups:
• Q1: How did you test Interconnect failover without causing a production outage?
• Q2: How does Cloud Router handle route propagation when the primary Interconnect goes down?`
  },
  {
    keywords: ['firewall', 'firewall rule', 'allow', 'deny', 'ingress', 'egress', 'port', 'tag', 'priority', 'zero trust', 'network tag'],
    category: 'Firewall Rules',
    quickBullets: [
      'Zero-trust model: default deny-all ingress. Explicit allow rules only. No IP-range rules for east-west.',
      'All rules network-tag-based: app-server, db-server, bastion, allow-lb.',
      'Production DB: service account-based rules (not tags) to prevent privilege escalation.'
    ],
    answer: `✅ Direct Answer:
• Yes, I designed and implemented the complete zero-trust firewall model for the FinServ GCP environment.

🏗️ In My Project (FinServ Banking Migration):
• What I built:
  — Priority 1000: Allow HTTPS (443) from Load Balancer to VMs tagged allow-lb
  — Priority 1100: Allow MySQL (3306) from app-server tagged VMs to db-server tagged VMs
  — Priority 2000: Allow SSH (22) from bastion host only (tag: allow-bastion)
  — Priority 65534: Deny All Ingress (explicit — never relied on default)
  — Production DB: service account-based firewall rules instead of network tags
• Impact: Zero unauthorized lateral movement, PCI-DSS network segmentation compliance achieved

🔑 Key Technical Points:
• Priority range 0–65535: lower number = higher priority. 0 is highest, 65535 is lowest.
• Network tags: dynamic — any VM gets the tag, it inherits the rule instantly. No IP management.
• Service account vs network tags: SA-based is more secure — cannot attach SA you don't have IAM permission for
• Firewall Insights: shows which rules are actually being hit — great for cleanup and incident investigation

💥 Challenge & Fix:
• Issue: Production payment VM became unreachable — SSH blocked. 
• Root cause: Engineer added a Priority 500 DENY rule targeting the app-server tag during routine change
• Fix: Found the rogue rule via Firewall Insights (showed DENY rule hitting). Removed it. Added PR approval for all firewall changes.

🔮 Anticipated Follow-ups:
• Q1: How do you handle firewall rules for GKE pods — VMs vs pod-level controls?
• Q2: How did you audit existing firewall rules to remove unused or overly permissive ones?`
  },
  {
    keywords: ['tag', 'label', 'tagging', 'labeling', 'cost allocation', 'cost center', 'metadata', 'billing', 'resource management'],
    category: 'Tagging & Labels',
    quickBullets: [
      'Mandatory labels enforced via Org Policy: env, team, cost-center, app, owner.',
      'BigQuery billing export filtered by cost-center label → team-wise monthly cost reports.',
      'Cloud Functions nightly auto-shutdown VMs where env=dev and auto-shutdown=true.'
    ],
    answer: `✅ Direct Answer:
• Yes, I implemented the full resource labeling strategy and governance for the FinServ GCP project.

🏗️ In My Project (FinServ Banking Migration):
• Label schema enforced on ALL resources:
  — env: prod | staging | dev
  — team: payments | core-banking | analytics | platform
  — cost-center: cc-001 | cc-002 | cc-003
  — app: txn-service | auth-service | reporting
  — owner: email of resource owner
• Use cases:
  — Cost: BigQuery billing export → team-wise monthly cost breakdowns by cost-center label
  — Automation: Cloud Functions ran nightly, stopped all VMs with env=dev + auto-shutdown=true (saved ~$3K/month)
  — Compliance: Cloud Asset Inventory found all resources missing mandatory labels → auto-Jira tickets created

🔑 Key Technical Points:
• Labels vs Network Tags: Labels = metadata for cost/automation. Network tags = control firewall rules/routes.
• Org Policy constraint: gcp.labelPolicy can enforce mandatory labels on resource creation
• Cloud Asset Inventory: query all GCP resources across org for label compliance
• Billing Export → BigQuery: enables SQL queries on costs by any label dimension

💥 Challenge & Fix:
• Issue: Teams were creating resources without labels — cost allocation was impossible
• Fix: Added a custom Org Policy via terraform that rejected resource creation without mandatory labels. Also built a Cloud Function to auto-label existing resources based on project metadata.
• Result: 100% label compliance within 2 sprints

🔮 Anticipated Follow-ups:
• Q1: How did you handle resources that were created before the labeling policy was enforced?
• Q2: Can you query label-based costs in real-time, or only in billing exports?`
  },
  {
    keywords: ['vm troubleshoot', 'ssh', 'vm unreachable', 'compute engine', 'serial port', 'iap', 'os login', 'vm not responding', 'instance', 'debug vm'],
    category: 'VM Troubleshooting',
    quickBullets: [
      '8-step runbook: VM status → Serial logs → Cloud Logging → Firewall → Connectivity Tests → SSH/IAP → Disk → Metrics.',
      'Use Connectivity Tests tool to pinpoint exactly which hop is blocking traffic.',
      'Use IAP (Identity-Aware Proxy) for SSH without external IP — gcloud compute ssh --tunnel-through-iap.'
    ],
    answer: `✅ Direct Answer:
• Yes, I have a structured 8-step runbook for VM troubleshooting — built and battle-tested in production incidents on FinServ.

🏗️ In My Project (FinServ Banking Migration):
• My Troubleshooting Runbook:
  1. Check VM Status: Running / Terminated / Staging in GCP Console
  2. Serial Console: Check for kernel panic, OOM killer, disk errors — first clue for unresponsive VMs
  3. Cloud Logging: resource.type="gce_instance" + filter severity=ERROR|CRITICAL
  4. Firewall Rules: Run Connectivity Tests (VPC > Network Intelligence > Connectivity Tests)
  5. SSH via IAP: gcloud compute ssh INSTANCE --tunnel-through-iap (no external IP needed)
  6. OS Login: verify roles/compute.osLogin or roles/compute.osAdminLogin is assigned
  7. Disk issues: detach disk, attach to rescue VM, fsck /dev/sdb1
  8. Resource usage: Cloud Monitoring — CPU, Memory, Disk I/O — check for saturation or OOM

💥 Real Incident:
• Payment VM was RUNNING but SSH failing. Connectivity Tests showed BLOCKED.
• Checked Firewall Insights: a Priority-500 DENY rule targeting the app-server tag was added by mistake.
• Removed the rule. SSH restored in 2 minutes.
• Added mandatory PR review + approval for all firewall changes going forward.

🔑 Key Technical Points:
• Serial port output = most reliable for OS-level crashes (before SSH even starts)
• IAP SSH: tunnels SSH over HTTPS via Google's infrastructure — works even with deny-all ingress firewall
• Connectivity Tests: simulates traffic flow and shows which firewall rule/route is the blocker
• OOM: check Cloud Monitoring for memory pressure spike + serial log for "oom_kill_process"

🔮 Anticipated Follow-ups:
• Q1: How do you SSH into a VM that has no OS Login set up and no external IP?
• Q2: A VM is TERMINATED and won't start — how do you recover data from its boot disk?`
  },
  {
    keywords: ['snapshot', 'backup', 'restore', 'machine image', 'disk', 'persistent disk', 'snapshot policy', 'retention'],
    category: 'Snapshots & Backups',
    quickBullets: [
      'Daily snapshots retained 7 days, weekly retained 30 days for all prod VMs.',
      'DB VMs: application-consistent snapshots — script flushes MySQL before triggering snapshot.',
      'Snapshot vs Machine Image: snapshot = single disk. Machine image = full VM config + all disks.'
    ],
    answer: `✅ Direct Answer:
• Yes, I designed and managed the complete snapshot and backup strategy for all production VMs in FinServ.

🏗️ In My Project (FinServ Banking Migration):
• Snapshot Policy:
  — Daily snapshots: retained 7 days (all prod VMs)
  — Weekly snapshots: retained 30 days (prod VMs)
  — DB VMs: application-consistent snapshots — custom shell script flushes MySQL (FLUSH TABLES WITH READ LOCK) before gcloud compute disks snapshot
• Machine Images: Used for golden AMI-equivalent — captured full VM config, all disks, metadata for fast re-deployment
• Storage: Snapshots stored in Cloud Storage multi-regional bucket in asia (auto-managed by GCP)

🔑 Key Technical Points:
• Snapshots are incremental after first — only changed blocks stored — cost-efficient for daily backups
• Snapshot schedule = a policy attached to a disk: automatic, no cron job needed
• Restore workflow: gcloud compute disks create DISK_NAME --source-snapshot=SNAPSHOT_NAME → attach to VM
• Snapshot vs Machine Image: Machine image captures entire VM (all disks + network + metadata) — better for full VM DR

💥 Challenge & Fix:
• Issue: DB snapshots were crash-consistent — if taken mid-transaction, DB could be inconsistent on restore
• Fix: Wrote a pre-snapshot script that freezes MySQL writes, triggers snapshot, then unfreezes. Tested restore in staging monthly.
• Result: All DB snapshots are now application-consistent and verified restorable

🔮 Anticipated Follow-ups:
• Q1: How do you verify that a snapshot is actually restorable before you need it in a crisis?
• Q2: What is the difference between a snapshot and a Custom Image in GCP?`
  },
  {
    keywords: ['routing', 'route', 'static route', 'dynamic route', 'bgp', 'ecmp', 'metric', 'next hop', 'route priority', 'default route'],
    category: 'GCP Routing',
    quickBullets: [
      'Route types: system-generated, custom static, dynamic BGP (Cloud Router), peering routes.',
      'Interconnect primary metric 100, VPN backup metric 200 — auto-failover on Interconnect maintenance.',
      'BGP timer tuning: hold-time 20s → 10s reduced failover from ~40s to ~20s.'
    ],
    answer: `✅ Direct Answer:
• Yes, I managed both static and dynamic BGP routing for the FinServ GCP environment including on-prem failover tuning.

🏗️ In My Project (FinServ Banking Migration):
• Route Architecture:
  — System-generated: auto subnet routes (10.0.0.0/16, 10.1.0.0/16, etc.)
  — BGP dynamic routes: Cloud Router learns on-prem routes, advertises GCP subnets to on-prem router
  — Custom static: 0.0.0.0/0 → Cloud NAT for all private VM internet egress
  — Priority: Interconnect routes at metric 100, VPN backup at metric 200
• Failover tuning: reduced BGP hold-time from 20s to 10s → failover from Interconnect to VPN reduced from ~40s to ~20s

🔑 Key Technical Points:
• Route priority: lower number = higher priority. GCP picks the lowest-metric route to destination.
• ECMP (Equal-Cost Multi-Path): if two static routes have the same priority, GCP load-balances across both
• Cloud Router: must be used for dynamic BGP routing — required for both Interconnect and VPN
• Route advertisement: Cloud Router auto-advertises all subnet CIDRs in the VPC to on-prem by default. Can customize with custom learned routes.

💥 Challenge & Fix:
• Issue: During an Interconnect maintenance window, traffic wasn't failing over to VPN quickly enough (~40s gap)
• Fix: Reduced BGP hold-time on Cloud Router from default 20s to 10s. Also set keepalive interval to 3s.
• Result: Failover time reduced to ~20s — acceptable for banking batch operations

🔮 Anticipated Follow-ups:
• Q1: How does Cloud Router handle route flapping — does it cause instability in production?
• Q2: Can you block specific on-prem routes from being advertised into GCP?`
  },
  {
    keywords: ['website down', '502', '503', '504', 'load balancer', 'backend', 'health check', 'dns', 'outage', 'site down', 'not loading', 'http error'],
    category: 'Website Down Troubleshooting',
    quickBullets: [
      '6-layer debug: DNS → LB Backend Health → Firewall (LB health check IPs) → VM/App → DB → Application.',
      'LB health check source IPs: 130.211.0.0/22 and 35.191.0.0/16 — must be allowed on port 80/443.',
      'Real incident: deployment changed /health → /api/health but LB still checked /health → all backends UNHEALTHY.'
    ],
    answer: `✅ Direct Answer:
• Yes, I've triaged multiple website-down incidents for the FinServ customer portal. Here is my exact framework.

🏗️ In My Project (FinServ Banking Migration):
• 6-Layer Debug Framework:
  1. DNS: nslookup portal.finservbank.com → verify A record points to correct LB IP. Check Cloud DNS zone.
  2. Load Balancer: Check Backend Service health in Console. Check LB logs: resource.type="http_load_balancer"
  3. Firewall: LB health check IPs (130.211.0.0/22, 35.191.0.0/16) must be allowed to port 80/443 on VMs
  4. VM/App: SSH in, check systemctl status nginx/app-service, check /var/log/nginx/error.log, netstat -tlnp
  5. Database: Can app reach DB? Check connection pool exhaustion. DB logs for errors.
  6. Application: Cloud Trace (slow requests), Error Reporting (exception spikes), Cloud Profiler (CPU/memory)

💥 Real Incident:
• Customer portal went down during peak hours. LB dashboard showed all backends UNHEALTHY (red).
• Root cause: New deployment changed health check path from /health → /api/health, but LB backend service still configured to check /health.
• All backends returned 404 on /health → marked UNHEALTHY → LB stopped routing traffic.
• Fix: Updated LB backend service health check path to /api/health. Traffic restored in 3 minutes.
• Prevention: Added post-deployment step in CI/CD to verify all LB backend instances show HEALTHY before marking deployment complete.

🔑 Key Technical Points:
• LB health check source IPs are fixed: 130.211.0.0/22 and 35.191.0.0/16 — if blocked by firewall, all backends go UNHEALTHY
• VPC Flow Logs: capture src/dst IP, port, bytes — essential for diagnosing dropped traffic
• Cloud Monitoring: LB request count, error rate, backend latency — set alerts on 5xx error rate > 1%

🔮 Anticipated Follow-ups:
• Q1: How do you set up alerting so you catch website-down incidents before users report them?
• Q2: How does Cloud Armor interact with the Load Balancer — could a WAF rule cause a false-positive outage?`
  }
];

export function findGCPMockMatch(query) {
  const q = query.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const item of GCP_MOCK_DATA) {
    const score = item.keywords.filter(k => q.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore > 0 ? bestMatch : null;
}
