# 🪐 AI Agent Command Center

<p align="center">
  <img src="client/public/icon-512.png" alt="AI Agent Command Center Logo" width="128" height="128" style="border-radius: 24px;" />
</p>

<p align="center">
  <strong>An enterprise-grade, immersive 3D/2D orchestration command center and autonomous execution platform for multi-agent AI teams.</strong>
</p>

<p align="center">
  <a href="#test-suite--quality-gate"><img src="https://img.shields.io/badge/tests-209%20passed%20%2F%20100%25-brightgreen.svg?style=flat-square" alt="Tests" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/typescript-%5E5.4.5-blue.svg?style=flat-square" alt="TypeScript" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node.js-%3E%3D20.0.0-green.svg?style=flat-square" alt="Node.js" /></a>
  <a href="https://www.postgresql.org/"><img src="https://img.shields.io/badge/postgresql-16%20%2B%20pgvector-336791.svg?style=flat-square" alt="PostgreSQL" /></a>
  <a href="https://threejs.org/"><img src="https://img.shields.io/badge/three.js-3D%20WebGL-black.svg?style=flat-square" alt="Three.js" /></a>
  <a href="https://caddyserver.com/"><img src="https://img.shields.io/badge/caddy-auto%20https-00ADD8.svg?style=flat-square" alt="Caddy" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-purple.svg?style=flat-square" alt="License" /></a>
</p>

---

## 📑 Table of Contents
- [Overview](#-overview)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
  - [1. 3D Virtual Workspace & 2D Fallback](#1-3d-virtual-workspace--2d-fallback)
  - [2. Autonomous Swarm Orchestrator & DAG Execution](#2-autonomous-swarm-orchestrator--dag-execution)
  - [3. War Room Multi-Perspective Deliberation](#3-war-room-multi-perspective-deliberation)
  - [4. Cognitive Memory Graph & Semantic Vector Links](#4-cognitive-memory-graph--semantic-vector-links)
  - [5. Skill Studio & Dynamic MCP Integration](#5-skill-studio--dynamic-mcp-integration)
  - [6. Autonomous SRE & Incident Self-Healing](#6-autonomous-sre--incident-self-healing)
  - [7. Data Analyst Studio & Interactive SQL Visualization](#7-data-analyst-studio--interactive-sql-visualization)
  - [8. Automated Custom Domain & SSL Provisioning](#8-automated-custom-domain--ssl-provisioning)
  - [9. Enterprise Hardening & Defense-in-Depth](#9-enterprise-hardening--defense-in-depth)
- [Getting Started & Local Development](#-getting-started--local-development)
- [Production Deployment](#-production-deployment)
- [Disaster Recovery & Automated Backup](#-disaster-recovery--automated-backup)
- [API Reference](#-api-reference)
- [Test Suite & Quality Gate](#-test-suite--quality-gate)
- [Contributing & Security](#-contributing--security)
- [License](#-license)

---

## 🌟 Overview

**AI Agent Command Center** is a complete, production-ready operations hub for orchestrating, observing, and collaborating with autonomous multi-agent systems. Built with modern fullstack TypeScript, Three.js, PostgreSQL with pgvector, and Caddy, it bridges the gap between raw LLM capabilities and reliable enterprise mission delivery.

Instead of managing agents through disjointed chat interfaces, AI Command Center treats your AI team like a high-performance software organization: agents hold distinct roles (*Orchestrator, Planner, Executor, QA Auditor, DevOps, SRE, Data Analyst*), form consensus in deliberative War Rooms, execute complex DAG pipelines, maintain cognitive vector memories, and safely interact with your infrastructure inside hardened sandboxes.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients ["Client Layer (Browser & Mobile)"]
        UI_3D["3D Virtual Workspace (Three.js WebGL)"]
        UI_2D["2D Resilient Canvas (Mobile/Low-Spec Fallback)"]
        SSE_Client["Real-time SSE Telemetry Receiver"]
    end

    subgraph Edge ["Edge & Reverse Proxy Layer"]
        Caddy["Caddy Server (Ports 80, 443, 8088, 8443)"]
        SSL_Auto["Automated Let's Encrypt / Cloudflare Proxy SSL"]
        CaddyDomains["/etc/caddy/custom_domains.caddy"]
    end

    subgraph Backend ["Application Layer (Node.js 20+ / Express)"]
        MW_Sec["Security Headers & Rate Limiters (Auth, Compute, Flood)"]
        SSE_Hub["Realtime SSE Hub (:25s Heartbeat, Auto-drain)"]
        
        subgraph Engines ["Autonomous Execution Engines"]
            Orchestrator["Task Runner & Swarm DAG Engine"]
            WarRoom["Multi-Agent Deliberation & Consensus Engine"]
            SRE["Autonomous SRE Sentinel & Self-Healing Loop"]
            Analyst["Data Analyst SQL & Chart Synthesis Engine"]
            SkillStudio["Skill Studio & MCP Tool Invoker"]
        end

        subgraph SecurityIsolation ["Isolation & Guardrails"]
            Sandbox["Isolated Sandbox (CWD Confinement & Env Sanitization)"]
            SSRF["Anti-SSRF Validator (Private Subnets & Cloud Metadata Guard)"]
        end
    end

    subgraph DataLayer ["Data & Storage Layer"]
        PG[("PostgreSQL 16 Database (ai_center)")]
        PGV["pgvector Extension (HNSW Indexes)"]
        FS["Encrypted Backups (/var/backups/ai-center)"]
    end

    Clients <-->|HTTP/HTTPS & SSE| Caddy
    Caddy <-->|Reverse Proxy 127.0.0.1:3000| MW_Sec
    MW_Sec --> SSE_Hub
    MW_Sec --> Engines
    Engines --> SecurityIsolation
    SecurityIsolation -->|bash_exec / file_read / http_fetch| Sandbox
    Engines <-->|PostgreSQL Pool (max 20, 30s timeout)| PG
    PG --- PGV
    PG -.->|Daily 02:30 UTC Cron| FS
    SSL_Auto -.-> CaddyDomains
```

---

## 🚀 Key Features

### 1. 🪐 3D Virtual Workspace & 2D Fallback
- **Immersive Command Bridge**: Real-time Three.js 3D visualization depicting agents at their desks, active holographic status rings, and live particle streams signaling inter-agent communication.
- **Fail-safe 2D Fallback**: Automatic hardware detection gracefully falls back to a clean, lightweight 2D grid representation on mobile devices or environments without WebGL acceleration.

### 2. 🐝 Autonomous Swarm Orchestrator & DAG Execution
- **Multi-Stage Pipelines**: Decomposes high-level objectives into sequential or parallel Directed Acyclic Graphs (DAGs) executed by specialized agents.
- **Automated Deliverables**: Packages swarm artifacts, generates markdown summary reports, and automates Git commit/branch generation (`docs/swarm-reports/`).
- **Crash Recovery**: Automatically recovers interrupted missions upon server restart without duplicate work.

### 3. ⚔️ War Room Multi-Perspective Deliberation
- **Multi-Agent Debates**: Orchestrates formal rounds of cross-agent debate between contradictory perspectives (e.g., Performance vs. Strict Security).
- **Consensus Synthesis**: Produces structured decision records, identifying agreed architecture choices, residual trade-offs, and actionable next steps.

### 4. 🧠 Cognitive Memory Graph & Semantic Vector Links
- **Interconnected Memory Graph**: Graph-based visualization of agent knowledge nodes, decisions, and lessons learned.
- **pgvector Similarity Clustering**: Generates 768-dimensional embeddings to cluster semantically related memories using cosine similarity (`<->`) with HNSW indexing.
- **Cross-Agent Knowledge Sharing**: Allows agents to query the shared institutional memory of the entire workspace during task execution.

### 5. 🛠️ Skill Studio & Dynamic MCP Integration
- **Custom Skill Authoring**: Create, test, and hot-reload specialized agent skills with parameter schemas, execution sandboxes, and verification test cases.
- **Model Context Protocol (MCP)**: Connects natively to MCP servers to dynamically expose external tools, file outlines, and system capabilities to your agents.

### 6. 🚨 Autonomous SRE & Incident Self-Healing
- **Continuous System Auditing**: Watches CPU, RAM, disk thresholds, and database query latencies.
- **Automated Remediation**: Triggers self-healing actions (e.g., zombie process cleanup, database connection draining, emergency disk defragmentation).
- **Automated Post-Mortem Reports**: Automatically writes comprehensive post-mortems documenting root causes, timeline, and mitigation steps.

### 7. 📊 Data Analyst Studio & Interactive SQL Visualization
- **Natural Language to SQL**: Translates human prompts into safe, parameterized analytical queries.
- **Dynamic Visualizations**: Automatically formats tabular query results into interactive charts (Bar, Line, Area, Pie).
- **Analytical Insights**: Generates automated narrative summaries detailing statistical anomalies, trends, and business recommendations.

### 8. 🌐 Automated Custom Domain & SSL Provisioning
- **Zero-Config DNS Management**: Direct UI integration for mapping custom domains from providers like **Hostinger**, **Cloudflare (Orange Cloud Proxy)**, and direct A-records.
- **Caddy Integration**: Automatically validates DNS propagation and mounts reverse-proxy blocks in `/etc/caddy/custom_domains.caddy` with automatic Let's Encrypt TLS certificate provisioning.

### 9. 🔒 Enterprise Hardening & Defense-in-Depth
- **Rate Limiting**: In-memory token sliding window rate limiters for authentication (15/min), compute endpoints (30/min), and global flood defense (300/min).
- **Anti-SSRF Protection**: Strictly blocks access to internal cloud metadata (`169.254.169.254`, integer/hex encodings) and isolates public web research from RFC 1918 private subnets.
- **Sandbox Confinement**: Constrains agent file reading strictly within the workspace directory, blocking path traversal and sensitive files (`.env`, `id_rsa`, `/etc/`). Child subshell environments are sanitized to prevent secret leaking.
- **True Graceful Shutdown**: Drains in-flight HTTP requests and cleanly shuts down schedulers and database pools on `SIGTERM`.

---

## 💻 Getting Started & Local Development

### Prerequisites
- **Node.js**: `v20.x` or higher
- **PostgreSQL**: `v16.x` with `pgvector` extension enabled
- **npm**: `v10.x` or higher

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/NexGen-X/Ai-Center-Workspace.git
cd Ai-Center-Workspace

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables
Create `/root/Ai-Center-Workspace/server/.env` (or set environment variables):
```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgres://routex:your_password@127.0.0.1:5432/ai_center?sslmode=disable
ENCRYPTION_KEY=your-32-character-secret-key-2026!
```

### 3. Initialize Database & Run Migrations
Migrations are applied idempotently on server boot:
```bash
cd server
npm run dev
```

### 4. Run Frontend Development Server
In a separate terminal:
```bash
cd client
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🚢 Production Deployment

AI Agent Command Center is designed to run stably as a dedicated systemd service behind Caddy.

### 1. Build Production Assets
```bash
# Build server TypeScript
cd server && npm run build

# Build client React application
cd ../client && npm run build
```

### 2. Systemd Service Configuration
File: `/etc/systemd/system/ai-center.service`
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
Environment=DATABASE_URL=postgres://routex:your_password@127.0.0.1:5432/ai_center?sslmode=disable
Environment=ENCRYPTION_KEY=your-32-character-secret-key-2026!
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
systemctl daemon-reload
systemctl enable --now ai-center.service
```

### 3. Caddy Reverse Proxy Configuration
Sample block in `/etc/caddy/Caddyfile`:
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

## 💾 Disaster Recovery & Automated Backup

AI Center features an automated database backup routine that executes daily at **02:30 UTC**:
- **Script**: `/usr/local/bin/ai-center-backup.sh`
- **Backup Directory**: `/var/backups/ai-center/` (Permissions: `0700`)
- **Compression**: `gzip -9` with automated integrity verification (`gzip -t`)
- **Retention**: 14 days with automated pruning of older snapshots
- **Cron Definition**: `/etc/cron.d/ai-center-backup`

### Manual Backup & Restoration
```bash
# Run manual backup
/usr/local/bin/ai-center-backup.sh

# Restore database from backup
gunzip -c /var/backups/ai-center/ai_center_prod_YYYYMMDD_HHMMSS.sql.gz | psql -U routex -d ai_center
```

---

## 📡 API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/healthz` | System health, uptime, and database latency check |
| `POST`| `/api/auth/login` | Authenticate human operator (rate-limited) |
| `GET` | `/api/realtime` | Server-Sent Events (SSE) telemetry stream |
| `GET` | `/api/agents` | List all registered AI team agents |
| `POST`| `/api/swarm/missions` | Create and execute an autonomous multi-agent swarm mission |
| `POST`| `/api/war-rooms/:id/deliberate` | Trigger a multi-agent debate and consensus round |
| `GET` | `/api/memory-graph/nodes` | Retrieve semantic cognitive memory nodes and connections |
| `POST`| `/api/skills` | Create and hot-mount a new agent capability |
| `GET` | `/api/sre/incidents` | Query autonomous SRE health incidents and audit logs |
| `POST`| `/api/data-analyst/execute-sql` | Execute parameterized SQL analysis query |
| `POST`| `/api/system/domain/provision` | Provision custom domain with automatic Caddy TLS |
| `GET` | `/api/monitoring/summary` | Real-time CPU, RAM, disk, and process telemetry |

---

## 🧪 Test Suite & Quality Gate

The project enforces a strict **Zero-Regression Policy** across all functional areas. 

```bash
cd server
npm test
```

### Current Verification Metrics:
```text
 Test Files  27 passed (27)
      Tests  209 passed (209)
   Duration  42.36s
```
*Coverage includes Unit Tests, Integration Contracts, SSRF Protection, Database Resilience, Concurrency Recovery, and Sandbox Isolation.*

---

## 🤝 Contributing & Security

- For contributions, please review [CONTRIBUTING.md](CONTRIBUTING.md).
- To report security vulnerabilities, please refer to [SECURITY.md](SECURITY.md).

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
