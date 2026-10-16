<div align="center">

```text
    _    ___    ____                                                _ 
   / \  |_ _|  / ___|___  _ __ ___  _ __ ___   __ _ _ __   __| |
  / _ \  | |  | |   / _ \| '_ ` _ \| '_ ` _ \ / _` | '_ \ / _` |
 / ___ \ | |  | |__| (_) | | | | | | | | | | | (_| | | | | (_| |
/_/   \_\___|  \____\___/|_| |_| |_|_| |_| |_|\__,_|_| |_|\__,_|
                                                                
     C E N T E R   •   A U T O N O M O U S   S W A R M   O S    
```

# 🪐 AI Agent Command Center

### *Next-Generation Spatial 3D/2D Orchestration Bridge & Autonomous Multi-Agent Swarm OS*

[![NPM Version](https://img.shields.io/npm/v/ai-agent-command-center.svg?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/ai-agent-command-center)
[![NPM Unpacked Size](https://img.shields.io/badge/unpacked%20size-2.2%20MB-blue?style=for-the-badge&logo=npm&logoColor=white)](https://www.npmjs.com/package/ai-agent-command-center)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/NexGen-X/Ai-Center-Workspace/ci.yml?branch=main&label=CI%20Quality%20Gate&logo=github&style=for-the-badge)](https://github.com/NexGen-X/Ai-Center-Workspace/actions)
[![Tests Passing](https://img.shields.io/badge/TESTS-209%20PASSED%20%2F%20100%25-00FF66?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/NexGen-X/Ai-Center-Workspace/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4.5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016-pgvector%20HNSW-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D%20Spatial-black?style=for-the-badge&logo=three.js&logoColor=white)](https://threejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-9945FF?style=for-the-badge)](LICENSE)

<br/>

**AI Agent Command Center** is an enterprise-grade, cyberpunk-inspired operational bridge designed to coordinate, deliberate with, and observe autonomous multi-agent teams. Built with a fullstack reactive architecture, Three.js 3D spatial simulation, PostgreSQL 16 with native pgvector HNSW indexing, and an auto-provisioning Caddy reverse proxy, it transforms disjointed LLM chats into a cohesive, self-healing, mission-driven AI workforce.

[Explore Features](#-capabilities-matrix) • [Architecture](#-system-architecture) • [Security & Hardening](#-enterprise-hardening--zero-trust) • [Quickstart](#-quickstart--local-development) • [Production Runbook](#-production-deployment)

</div>

---

## ⚡ The Paradigm Shift: Why AI Command Center?

Most developer tools approach LLMs through fragmented chat windows or opaque command-line scripts. **AI Agent Command Center** introduces an operational operating system where agents function like a battle-tested engineering division:

| Dimension | Standard Chat UIs (ChatGPT, LibreChat) | Scripting Frameworks (CrewAI, AutoGen CLI) | 🪐 AI Agent Command Center |
| :--- | :---: | :---: | :---: |
| **Spatial Observation** | Single thread | Terminal output only | **Immersive 3D Bridge (WebGL) + 2D Resilient Canvas** |
| **Consensus Engine** | ❌ None | Basic linear routing | **War Room Formal Deliberations & Synthesis** |
| **Memory Subsystem** | Ephemeral context window | Simple key-value store | **Cognitive Vector Graph (pgvector HNSW Cosine Cluster)** |
| **Execution Safety** | ❌ No native sandbox | Raw host execution | **CWD-Confined Sandbox + Anti-SSRF + Clean Env** |
| **Infrastructure SRE** | ❌ None | ❌ None | **Autonomous SRE Sentinel & Self-Healing Loop** |
| **Data Analytics** | Raw code blocks | Textual tables | **Natural SQL Engine with Dynamic Recharts Visualizer** |
| **Automated Deliverables**| Copy-paste snippets | Local folder writes | **Automated Git Branching, Commits & PR Synthesis** |
| **Edge Domain & SSL** | Manual Nginx/Certbot | ❌ None | **Hostinger & Cloudflare Auto-Provisioning (Caddy)** |
| **Zero-Regression CI** | Variable | Partial | **100% Pass Rate (209/209 Tests on PostgreSQL Service)** |

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Edge ["🌐 Edge & Ingress Layer (Caddy Reverse Proxy)"]
        CaddyIn["Ports :80, :443, :8088, :8443 (Zstandard / Brotli)"]
        DNSAuto["Automated Domain Provisioner (/etc/caddy/custom_domains.caddy)"]
        CFProxy["Cloudflare Orange Cloud & Hostinger Direct DNS Resolver"]
    end

    subgraph ClientLayer ["🖥️ Spatial Frontend Layer (React 18 + Vite + Three.js)"]
        Canvas3D["3D Virtual Command Bridge (WebGL, Particle Telemetry, Orbit Controls)"]
        Canvas2D["2D Resilient Grid Fallback (Touch-Optimized / Low-Spec Hardware)"]
        SSEStream["Real-time Server-Sent Events (SSE) Listener (:25s Heartbeat)"]
        Modals["Feature Studios (War Room, Memory Graph, SRE Sentinel, Data Analyst)"]
    end

    subgraph CoreBackend ["⚡ Backend Core (Node.js 20+ Express ESM)"]
        SecMW["HTTP Hardening (HSTS, nosniff, SAMEORIGIN, no X-Powered-By)"]
        RateLimiter["Adaptive Sliding-Window Rate Limiters (Auth: 15/m, Compute: 30/m, API: 300/m)"]
        ProxyTrust["Reverse Proxy Real-IP Trust (X-Forwarded-For)"]
        
        subgraph AutonomousEngines ["🧠 Autonomous Agent Engines"]
            Orchestrator["Nexus Prime: Swarm DAG Decomposer & Task Runner"]
            WarRoomEngine["Multi-Agent Deliberation & Counter-Argument Engine"]
            SREAgent["Atlas Sentinel: Continuous Telemetry & Incident Remediation"]
            DataAnalyst["Hypatia Engine: NL-to-SQL & Dynamic Analytical Synthesizer"]
            SkillStudio["Skill Studio & Hot-Mounted MCP Tool Registry"]
        end

        subgraph SecurityJail ["🛡️ Zero-Trust Security Jail"]
            SandboxCore["CWD Sandbox Isolation (Directory Escape Prevention)"]
            EnvSanitizer["Subshell Environment Stripper (Zero Secret Leaking)"]
            SSRFValidator["Canonical Anti-SSRF (Private Subnet & Cloud Metadata Blocker)"]
        end
    end

    subgraph StorageLayer ["🗄️ Resilient Storage & Disaster Recovery"]
        PGDB[("PostgreSQL 16 Database (Connection Pool max: 20, statement_timeout: 30s)")]
        PGV["pgvector Extension (768-dim Embeddings, HNSW Cosine Indexing)"]
        BackupDaemon["Automated Disaster Recovery (/var/backups/ai-center daily 02:30 UTC, gzip -9)"]
    end

    Edge <-->|Encrypted HTTPS / SSE Stream| ClientLayer
    Edge <-->|Internal Proxy 127.0.0.1:3000| CoreBackend
    CoreBackend --> SecurityJail
    SecurityJail -->|Safe Tool Calling: bash_exec, file_read, http_fetch| CoreBackend
    CoreBackend <-->|Optimized Relational Queries & Vector Similarities| StorageLayer
    StorageLayer -.-> BackupDaemon
```

---

## 🤖 The Autonomous AI Division (Core Agent Archetypes)

AI Command Center comes pre-configured with a specialized hierarchy of autonomous agents:

```text
 ╔═══════════════════════════════════════════════════════════════════════════════════╗
 ║                         NEXUS PRIME (Lead Orchestrator)                           ║
 ║           Decomposes high-level objectives into topological DAG pipelines        ║
 ╚═══════════════════════════════════════════════════════════════════════════════════╝
             │                                                     │
             ▼                                                     ▼
 ╔═════════════════════════════╗             ╔═════════════════════════════════════╗
 ║   ATHENA STRATOS (Planner)  ║             ║      VULCAN FORGE (Executor)        ║
 ║ Formulates dependency maps, ║             ║ Hardened tool execution, sandbox    ║
 ║ milestones, and criteria    ║             ║ file ops, and automated pipelines   ║
 ╚═════════════════════════════╝             ╚═════════════════════════════════════╝
             │                                                     │
             ▼                                                     ▼
 ╔═════════════════════════════╗             ╔═════════════════════════════════════╗
 ║  AEGIS SENTINEL (QA Review) ║             ║      ATLAS DEVOPS (SRE Sentinel)    ║
 ║ "No Evidence = No Acceptance║             ║ Continuous host telemetry auditing, ║
 ║ Independent empirical audit ║             ║ self-healing, and memory protection ║
 ╚═════════════════════════════╝             ╚═════════════════════════════════════╝
```

---

## 🔮 Capabilities Matrix

### 1. 🪐 Spatial 3D Command Bridge & 2D Fallback
- **Holographic Workspace**: Real-time Three.js WebGL canvas displaying agents stationed at active terminals with glowing activity rings, pulsating particle connections, and status halos.
- **Fail-Safe Hardware Adaptability**: Automatically measures WebGL capability; seamlessly switches to a lightweight 2D interactive grid on mobile browsers or constrained headless environments.

### 2. 🐝 Autonomous Swarm Orchestrator & DAG Execution
- **Multi-Stage Decomposition**: Breaks down broad objectives into Directed Acyclic Graphs (DAGs) executed sequentially or in parallel by role-assigned agents.
- **Automated Deliverables**: Compiles unified git diff patches, generates formatted Markdown reports, and automates Git branch creation and commits (`docs/swarm-reports/mission-{id}.md`).
- **Mission Crash Recovery**: State persistence guarantees that interrupted missions resume seamlessly upon server reboot without duplicated subtasks.

### 3. ⚔️ War Room Multi-Perspective Deliberation Engine
- **Cross-Agent Socratic Debates**: Pit specialized agents against one another (e.g., Performance vs. Strict Security vs. Usability).
- **Consensus & Trade-off Synthesis**: Generates formal decision records documenting consensus recommendations, architectural compromises, and actionable checklists.

### 4. 🧠 Cognitive Memory Graph (pgvector HNSW)
- **Semantic Vector Association**: Transforms agent thoughts, lessons learned, and execution outputs into 768-dimensional vector embeddings stored in PostgreSQL with pgvector.
- **Cosine Distance Clustering**: Connects disparate memories across projects and agents with dynamic cosine similarity thresholds (`<->`).
- **Institutional Memory Sharing**: Agents automatically retrieve relevant prior decisions before embarking on new tasks.

### 5. 🛠️ Skill Studio & Model Context Protocol (MCP)
- **Hot-Mountable Capabilities**: Create, parameterize, and test specialized agent skills on the fly without server downtime.
- **Native MCP Ecosystem**: Integrates with Model Context Protocol servers to query file outlines, database schemas, and external tool registries.

### 6. 🚨 Autonomous SRE Sentinel & Self-Healing Loop
- **Proactive Health Auditing**: Continuous host inspection monitoring CPU saturation, RAM thresholds, disk usage, and PostgreSQL query latencies.
- **Self-Healing Actions**: Automatically flushes lingering zombie processes, terminates orphaned worker sockets, and defragments storage.
- **Automated Post-Mortem Generation**: Synthesizes root-cause timelines and mitigation strategies following any system anomaly.

### 7. 📊 Data Analyst Studio & Natural SQL Visualization
- **Natural Language to Parameterized SQL**: Translates human prompts into safe analytical SQL against internal metrics and databases.
- **Dynamic Charting Engine**: Automatically selects the best visual representation (Bar, Line, Area, Pie) and renders reactive charts.
- **Automated Statistical Insights**: Synthesizes anomalies, trends, and business takeaways from query results.

### 8. 🌐 Automated Custom Domain & SSL Provisioning
- **Zero-Friction Ingress**: Support for Hostinger domains, Cloudflare Anycast CIDRs (Orange Cloud Proxy), and Direct DNS A-records.
- **Dynamic Caddy Sync**: In-app pre-flight DNS validation automates configuration of `/etc/caddy/custom_domains.caddy` with instant Let's Encrypt TLS provisioning.

---

## 🔒 Enterprise Hardening & Zero-Trust

Security is not an afterthought in AI Command Center — it is baked into every layer of execution:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        DEFENSE-IN-DEPTH MATRIX                         │
├─────────────────────────┬──────────────────────────────────────────────┤
│ Perimeter Security      │ HSTS (31536000s), nosniff, SAMEORIGIN,       │
│                         │ no X-Powered-By fingerprint, trust proxy=1   │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Abuse & DoS Defense     │ In-memory Token Sliding Window Limiter:      │
│                         │ • Auth: 15 req/min (Brute-force protection)  │
│                         │ • Compute: 30 req/min (LLM drain defense)    │
│                         │ • Global API: 300 req/min (Flood protection) │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Anti-SSRF Guardrails    │ Canonical IP resolver strictly blocks:       │
│                         │ • Cloud metadata (169.254.169.254, hex/int)  │
│                         │ • RFC 1918 Private subnets (10/8, 172.16/12) │
│                         │ • Loopback probing (127.0.0.1, ::1)          │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Sandbox Execution Jail  │ • file_read strictly confined to CWD sandbox │
│                         │ • Blocked paths: /etc/, /proc/, .env, id_rsa │
│                         │ • bash_exec env stripped of all secrets      │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Cryptographic Standards │ • API Keys encrypted with AES-256-GCM        │
│                         │ • Passwords hashed via PBKDF2 + timingSafeEq │
│                         │ • Secrets-Free Repository Guarantee (Scanned)│
└─────────────────────────┴──────────────────────────────────────────────┘
```

---

## 🚀 Quickstart

### Method 1: Instant Zero-Install Run (Recommended)
Run the complete Command Bridge in seconds without manually cloning or configuring dependencies:

```bash
# Instant launch (auto-provisions & opens browser on local machine)
npx ai-agent-command-center

# With custom port and database connection
npx ai-agent-command-center --port 8080 --db "postgres://user:pass@localhost:5432/ai_center"
```

### Method 2: Global CLI Installation
```bash
# Install globally
npm install -g ai-agent-command-center

# Launch the Command Center
ai-center start

# View all CLI options
ai-center --help
```

### 🧭 Intelligent Deployment Environment Auto-Detection
`ai-agent-command-center` features built-in environment perception to seamlessly adapt between local workstations and headless cloud servers:

| Target Environment | Detection Criteria | Startup Behavior |
| :--- | :--- | :--- |
| **Local Desktop / Laptop** | Windows, macOS, or Linux with active `$DISPLAY` / `$WAYLAND_DISPLAY` | Prints `http://localhost:3000` and **automatically opens default browser** within 1.5s. |
| **Remote Server / Headless VPS** | Headless Linux (AWS EC2, DigitalOcean, VPS, Docker container) | **Suppresses browser invocation** (prevents X11 errors), binds Express to `0.0.0.0`, and outputs LAN & Public access URLs. |

```text
✔ AI Agent Command Center aktif & siap melayani:
  ➜  Local:   http://localhost:3000
  ➜  Network: http://192.168.1.50:3000
  ➜  Mode:    Remote Server / VPS (Headless — browser lokal dinonaktifkan)
```

### CLI Command & Flags Reference
| Flag | Alias | Description | Default |
| :--- | :---: | :--- | :--- |
| `--port <num>` | `-p` | Port for the backend API and frontend static server | `3000` or `$PORT` |
| `--db <url>` | `-d` | PostgreSQL connection URL with pgvector support | `$DATABASE_URL` |
| `--no-open` | | Do not launch the browser automatically on local desktop | `false` |
| `--version` | `-v` | Print the current installed CLI version | `1.0.0` |
| `--help` | `-h` | Display help guidelines and usage examples | |

---

### Method 3: Monorepo Developer Setup (From Source)

#### Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v16.x` with `pgvector` extension
- **npm**: `v10.x` or higher

```bash
# 1. Clone repository
git clone https://github.com/NexGen-X/Ai-Center-Workspace.git
cd Ai-Center-Workspace

# 2. Install all monorepo dependencies
npm install

# 3. Setup environment configuration
cp .env.example .env

# 4. Start local development (Server & Client concurrently)
npm run dev:server
# In a separate terminal:
npm run dev:client
```
Visit `http://localhost:5173` to access the Vite HMR development server.

---

## 🚢 Production Deployment

### 1. Build Optimized Production Bundles
```bash
# Builds both TypeScript backend and Vite React frontend
npm run build
```

### 2. Systemd Service Deployment
Create `/etc/systemd/system/ai-center.service`:
```ini
[Unit]
Description=AI Agent Command Center Service
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/root/Ai-Center-Workspace
ExecStart=/usr/bin/node /root/Ai-Center-Workspace/server/dist/server/src/index.js
Restart=always
RestartSec=3

# Graceful termination management
KillSignal=SIGTERM
TimeoutStopSec=15
SendSIGKILL=yes

# Logging and identification
StandardOutput=journal
StandardError=journal
SyslogIdentifier=ai-center

Environment=PORT=3000
Environment=NODE_ENV=production
Environment=DATABASE_URL=postgres://user:password@127.0.0.1:5432/ai_center?sslmode=disable
Environment=ENCRYPTION_KEY=replace-with-your-secure-32-character-secret-key-here!
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now ai-center.service
```

### 3. Edge Reverse Proxy (Caddy)
Add the reverse proxy block in `/etc/caddy/Caddyfile`:
```caddy
:80, :443 {
    encode zstd gzip
    
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    handle {
        reverse_proxy 127.0.0.1:3000 {
            flush_interval -1
            header_up X-Real-Ip {remote_host}
            header_up X-Forwarded-Proto {scheme}
        }
    }
}

import /etc/caddy/custom_domains.caddy
```

---

## 💾 Disaster Recovery & Automated Backups

AI Center features an automated disaster recovery engine executing daily at **02:30 UTC**:
- **Script**: `/usr/local/bin/ai-center-backup.sh`
- **Archive Path**: `/var/backups/ai-center/ai_center_prod_{timestamp}.sql.gz` (`chmod 700`)
- **Integrity Validation**: Automated `gzip -t` verification upon every dump
- **Retention**: 14-day rolling rotation with automatic cleanup of expired archives
- **Cron Definition**: `/etc/cron.d/ai-center-backup`

### One-Command Manual Backup & Restore:
```bash
# Execute manual backup now:
/usr/local/bin/ai-center-backup.sh

# Instant database restore:
gunzip -c /var/backups/ai-center/ai_center_prod_YYYYMMDD_HHMMSS.sql.gz | psql -U routex -d ai_center
```

---

## 📡 REST & Telemetry API Reference

| Verb | Path | Purpose | Guardrails |
| :---: | :--- | :--- | :---: |
| `GET` | `/healthz` | System uptime & PostgreSQL query latency check | Public |
| `POST` | `/api/auth/login` | Human operator session authentication | Rate-limited (15/m) |
| `GET` | `/api/realtime` | Server-Sent Events (SSE) telemetry bus | Keep-Alive (:25s) |
| `GET` | `/api/agents` | List all active agents & status halos | Session Bearer |
| `POST` | `/api/swarm/missions` | Dispatch autonomous multi-agent swarm DAG | Rate-limited (30/m) |
| `POST` | `/api/war-rooms/:id/deliberate` | Trigger formal multi-agent deliberation round | Session Bearer |
| `GET` | `/api/memory-graph/nodes` | Retrieve cognitive semantic memory network | Session Bearer |
| `POST` | `/api/skills` | Create and hot-mount a new agent skill | Session Bearer |
| `GET` | `/api/sre/incidents` | Query autonomous SRE health audits | Session Bearer |
| `POST` | `/api/data-analyst/execute-sql` | Execute parameterized analytics query | Query Timeout (30s) |
| `POST` | `/api/system/domain/provision` | Provision custom domain with Caddy TLS | DNS Pre-flight |
| `GET` | `/api/monitoring/summary` | Live CPU, RAM, Disk, and runtime telemetry | Rate-limited (300/m) |

---

## 🧪 Verification & Quality Gate

Every release and commit is validated against a rigorous test suite covering unit contracts, integration pipelines, database resilience, and sandbox boundaries:

```bash
# Run Vitest test suite across all workspaces
npm test
```

```text
 ✓ tests/rag-memory.spec.ts (13)
 ✓ tests/actions-sandbox.spec.ts (14)
 ✓ tests/schedules.spec.ts (14)
 ✓ tests/skill-studio.spec.ts (9)
 ✓ tests/stability.spec.ts (11)
 ✓ tests/war-room.spec.ts (8)
 ✓ tests/memory-graph.spec.ts (9)
 ✓ tests/workflow-dag.spec.ts (8)
 ✓ tests/data-analyst.spec.ts (9)
 ✓ tests/sre-agent.spec.ts (8)
 ✓ tests/modal-interaction-contracts.spec.ts (6)
 ✓ tests/mcp-client.spec.ts (8)
 ✓ tests/alerting.spec.ts (6)
 ✓ tests/document-parser.spec.ts (6)
 ✓ tests/evals.spec.ts (5)
 ✓ tests/streaming.spec.ts (4)
 ✓ tests/web-research.spec.ts (7)
 ✓ tests/domain-manager.spec.ts (8)
 ✓ tests/ssrf.spec.ts (8)
 ✓ tests/orchestrator-system.spec.ts (4)
 ✓ tests/adapters.spec.ts (3)
 ✓ tests/pipeline.spec.ts (4)
 ✓ tests/playground-webhooks.spec.ts (3)
 ✓ tests/crypto.spec.ts (3)
 ✓ tests/auth.spec.ts (2)
 ✓ tests/api.spec.ts (14)
 ✓ tests/swarm.spec.ts (15)

 Test Files  27 passed (27)
      Tests  209 passed (209)
   Duration  34.40s
```

---

## 🤝 Community & Governance

- Review our [CONTRIBUTING.md](CONTRIBUTING.md) for branch strategies, coding standards, and testing expectations.
- Read our [SECURITY.md](SECURITY.md) for our vulnerability disclosure policy and security audit guarantees.

---

## 📄 License

This software is released under the **[MIT License](LICENSE)**.  
Copyright © 2026 **NexGen-X / Antigravity AI Center**. All rights reserved.
