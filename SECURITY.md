# Security Policy & Vulnerability Reporting

The AI Agent Command Center team is committed to ensuring the security, isolation, and privacy of our autonomous agent systems and the infrastructure they interact with.

---

## 🛡️ Supported Versions

We provide security patches and updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## 🔒 Built-in Security Architecture

AI Agent Command Center incorporates defense-in-depth mechanisms across its entire stack:

1. **Hardened Execution Sandbox**:
   - `file_read` and file operations are strictly confined within the workspace and sandbox boundaries.
   - Access to host system configurations (`/etc/`, `/proc/`, `/sys/`, `.env`, SSH private keys) is explicitly rejected.
   - Child subshell processes in `bash_exec` run with sanitized environments, preventing leakage of `DATABASE_URL`, encryption keys, and internal secrets.

2. **Strict Anti-SSRF (Server-Side Request Forgery) Guardrails**:
   - Outgoing HTTP calls for web research, sandboxed fetch, and alert webhooks enforce canonical IP normalization.
   - Cloud metadata IP addresses (`169.254.169.254`, integer/hex encodings) and RFC 1918 private subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) are blocked for public web capabilities.

3. **Rate Limiting & Abuse Prevention**:
   - Adaptive in-memory token sliding window limits protect authentication routes (15 attempts/min), heavy LLM execution endpoints (30 req/min), and global API traffic (300 req/min).

4. **HTTP Security Headers**:
   - Strict Content Security, HSTS (`max-age=31536000`), `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.
   - Fingerprinting header `X-Powered-By` is completely disabled.

5. **Secrets & Password Storage**:
   - Operator credentials use PBKDF2 hashing with random 16-byte salts and `crypto.timingSafeEqual`.
   - Third-party model provider API keys are encrypted at rest using AES-256-GCM.

---

## 🚨 Reporting a Vulnerability

If you discover a security vulnerability within this project, **please do not disclose it publicly** via GitHub Issues or discussions.

Instead, please send a responsible disclosure report to the maintainers:
- **Email**: `security@ai-center.local` (or file a private GitHub Security Advisory)
- **Required Details**:
  - Description of the vulnerability and attack vector.
  - Steps to reproduce or proof-of-concept (PoC).
  - Assessment of potential impact.

### Response Timeline
- **Acknowledgement**: Within 48 hours.
- **Triage & Assessment**: Within 5 business days.
- **Patch Release**: Critical vulnerabilities will be patched and published as soon as an verified fix is available.
