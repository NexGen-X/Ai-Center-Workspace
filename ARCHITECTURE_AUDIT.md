# Architecture Audit Report — AI Agent Command Center
**Dokumen Audit Arsitektur Awal**  
**Repositori:** `/root/Ai-Center-Workspace`  
**Git Branch:** `main` (commit: `2b9a7de`)  
**Waktu Audit:** 2026-10-11T04:05:00Z  
**Auditor:** Senior Software Architect, Security Engineer, QA Engineer, AI Agent Engineer  

---

## 1. Ringkasan Eksekutif

Audit ini dilakukan secara empiris terhadap repositori `/root/Ai-Center-Workspace` dan lingkungan sistem host (Linux x86_64) sebelum perancangan dan penulisan kode fungsional. 

### Temuan Utama:
1. **Status Repositori Aktual:** Repositori saat ini berada pada tahap **Greenfield** (repositori baru diinisialisasi). Hanya terdapat 2 berkas utama:
   - `README.md` (deskripsi singkat: "Center AI 3D Workspace via Web UI")
   - `Rancangan_Arsitektur_AI_Command_Center_Antigravity.md` (spesifikasi arsitektur komprehensif 1.528 baris).
   - Tidak ada implementasi frontend, backend, ORM, atau testing yang sudah ada sebelumnya di repositori ini.
2. **Infrastruktur Host yang Tersedia (VERIFIED):**
   - **Node.js:** v20.20.2 (`/usr/bin/node`)
   - **npm:** 10.8.2 (`/usr/bin/npm`)
   - **Go:** go1.26.0 (`/usr/bin/go`)
   - **Python:** 3.14.4 (`/usr/bin/python3`)
   - **PostgreSQL 16:** Aktif di `127.0.0.1:5432`. Telah disiapkan database terisolasi `ai_center` dengan otentikasi siap pakai.
   - **Redis 7:** Aktif di `127.0.0.1:6379`.
   - **Route-X Local AI Gateway:** Aktif pada PID 271813 di `http://localhost:8080` (kompatibel dual-protokol: OpenAI `/v1` dan Anthropic).
3. **Status Integrasi Hermes External Runtime (VERIFIED / BLOCKED):**
   - Perintah `hermes` **TIDAK DITEMUKAN** di sistem (`which hermes` nihil, paket APT nihil, Docker daemon tidak aktif).
   - Referensi kata "hermes" di lingkungan host hanya terdapat pada:
     - Role PostgreSQL terisolasi di database Route-X (`hermes_reader`, `hermes_tester`).
     - Token tema visual pada Route-X (`#0B0F17` palette aesthetic).
   - **Kesimpulan Status Hermes:** Implementasi runtime Hermes langsung dikategorikan sebagai **BLOCKED / NOT AVAILABLE**. Kita akan menyediakan kontrak adapter extensible `HermesRuntimeAdapter` dengan mode simulasi/status diagnostik jujur (`UNAVAILABLE / RUNTIME_NOT_INSTALLED`), tanpa membuat eksekusi tiruan (no fake claims).

---

## 2. Inventaris & Audit Sistem

| Komponen | Status | Versi / Detail | Verifikasi |
|---|---|---|---|
| **Repository Root** | Greenfield | `/root/Ai-Center-Workspace` | Git clean, branch `main` |
| **Frontend Framework** | Belum Terpasang | Direncanakan: React 18 + Vite + TypeScript + Tailwind CSS | Sesuai spec doc Bab 7 & 17 |
| **3D Rendering Engine** | Belum Terpasang | Direncanakan: Three.js (@react-three/fiber atau Three.js modular) | Sesuai spec doc Bab 9 |
| **Backend Framework** | Belum Terpasang | Direncanakan: Node.js 20 + Express/Fastify (TypeScript) + REST + SSE/WS | Sesuai spec doc Bab 10 & 13 |
| **Database & ORM** | Tersedia di Host | PostgreSQL 16 (DB: `ai_center` port 5432) | Teruji koneksi via `psql` |
| **Cache & Realtime** | Tersedia di Host | Redis 7 (`127.0.0.1:6379`) | Teruji port aktif |
| **AI Gateway Lokal** | Berjalan di Host | Route-X AI Gateway (`http://localhost:8080`) | Teruji HTTP endpoint 8080 |
| **Hermes Agent Runtime** | Tidak Tersedia | Binary/service tidak ada di host | Diidentifikasi sebagai BLOCKED |
| **Testing Suite** | Belum Terpasang | Direncanakan: Vitest / Jest + Supertest | Wajib diintegrasikan |

---

## 3. Audit Model Entitas & Konsep "AI Team"

Sesuai dokumen spesifikasi Bab 3 dan Bab 11, aplikasi menegaskan pemisahan konsep mutlak antara **Human Users** dan **AI Team**:
1. **Human User / Operator:** Pengguna aplikasi, pengelola workspace, dan administrator sistem. Tidak pernah dirender sebagai karakter di workspace 3D atau anggota AI Team.
2. **Agent:** Identitas logis entitas AI (Nama, Peran/Role, Instruksi Sistem, Batasan Kemampuan, Status).
3. **Model LLM:** Model inferensi yang dipanggil (misal `gpt-4o`, `claude-3-7-sonnet`, `gemini-1.5-pro`, `coding-fast`).
4. **Provider:** Sumber layanan model (Custom API, OpenAI, Anthropic, Gemini, Groq, Ollama, Route-X).
5. **Agent Runtime:** Lingkungan yang mengesekusi instruksi (Direct API Orchestrator, Hermes Runtime jika tersedia, Antigravity CLI).
6. **Agent Run:** Satu eksekusi konkret dengan status siklus hidup (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELLED`).
7. **Task:** Pekerjaan bisnis yang didelegasikan kepada Agent.

---

## 4. Audit Fitur "Tambah Anggota AI Team"

### A. Custom API Provider
- **Kebutuhan:** Base URL, API Key, Protokol (OpenAI-compatible / Anthropic-compatible), Model ID, Parameter (temperature, max_tokens).
- **Fitur Wajib:**
  - Validasi konfigurasi & URL (mitigasi SSRF).
  - Tombol **Test Connection** (live ping / model check).
  - **Model Discovery** (`GET /v1/models` jika didukung oleh provider upstream).
  - Penyimpanan kredensial terenkripsi (hanya di backend/secret store, dimasking ke frontend).
  - Aktivasi & Penonaktifan (`enabled: boolean`).

### B. Provider Preset
- **Dukungan Preset:**
  - **Route-X Local Gateway:** `http://localhost:8080/v1` (terhubung ke AI Gateway lokal host).
  - **OpenAI:** `https://api.openai.com/v1`.
  - **Anthropic:** `https://api.anthropic.com`.
  - **Google Gemini:** `https://generativelanguage.googleapis.com/v1beta`.
  - **Groq:** `https://api.groq.com/openai/v1`.
  - **Ollama (Self-Hosted):** `http://localhost:11434/v1`.

### C. External Agent Runtime — Hermes
- **Status Empiris:** Tidak terpasang di sistem.
- **Strategi Penanganan:**
  - Sediakan UI form khusus untuk runtime Hermes.
  - Tampilkan peringatan diagnostik jujur: *"Hermes Agent Runtime binary is not detected on the host system"*.
  - Sediakan tombol *"Periksa Runtime"* yang melakukan healthcheck ke environment lokal atau endpoint konfigurasi.
  - Cegah peluncuran tugas aktif ke Hermes jika status koneksi `UNAVAILABLE` / `NOT_INSTALLED`.

---

## 5. Audit Keamanan & Proteksi SSRF

1. **Secret Leakage Prevention:**
   - Kredensial API Key disimpan di database dengan enkripsi simetris (AES-256-GCM) atau secret reference.
   - Endpoint GET `/api/agents` dan GET `/api/providers` **DILARANG** mengembalikan plain API key. Nilai dimasking (`sk-...xxxx`).
   - Logging terstruktur menyaring token dan key menggunakan regex masking.
2. **SSRF Mitigation pada Test Connection & Custom Base URL:**
   - Validasi URL hanya menerima protokol `http:` dan `https:`.
   - Blokir alamat metadata cloud AWS/GCP/Azure (`169.254.169.254`).
   - Private IP blocklist (RFC 1918) diterapkan secara ketat kecuali untuk endpoint lokal yang secara eksplisit diizinkan oleh admin (misal `localhost:8080` untuk Route-X lokal atau `localhost:11434` untuk Ollama).
3. **Timeout & Concurrency Guard:**
   - Setiap panggilan upstream dibatasi timeout 10 detik untuk koneksi dan 60 detik untuk eksekusi.
   - Exponential backoff dengan batasan retry maksimal 2 kali.

---

## 6. Anti-Hallucination Evidence Matrix

| Aspek | Klasifikasi | Bukti / Catatan |
|---|---|---|
| Repositori Git | **VERIFIED** | Clean branch `main`, 2 commit awal |
| Node.js & npm | **VERIFIED** | Node 20.20.2 & npm 10.8.2 terpasang |
| PostgreSQL | **VERIFIED** | Aktif di port 5432, database `ai_center` dibuat & diuji |
| Redis | **VERIFIED** | Aktif di port 6379 |
| Route-X AI Gateway | **VERIFIED** | Berjalan di port 8080, merespons error auth saat tanpa API key |
| Hermes Runtime | **BLOCKED** | Binary/service tidak ada di mesin host |
| Antarmuka 3D Three.js | **INFERRED** | Membutuhkan Three.js + WebGL canvas dengan fallback 2D |

---

## 7. Rekomendasi Arsitektur Stack

Berdasarkan lingkungan aktual dan ketiadaan dependensi frontend/backend sebelumnya, stack terpilih yang optimal, modular, dan paling stabil adalah:

1. **Backend:**
   - Node.js 20 + Express + TypeScript (`server/`).
   - Database Client: `pg` (PostgreSQL connection pool ke database `ai_center`).
   - Real-time: Server-Sent Events (SSE) & WebSocket untuk task status & runtime heartbeat.
   - System Collector: Native Node.js `os` metrics + disk space (`statfs`) untuk Server Monitoring widget.
2. **Frontend:**
   - React 18 + Vite + TypeScript (`client/`).
   - Styling: Tailwind CSS dengan design tokens gelap (#0B0F17, Slate-900, aksen Biru/Emerald).
   - Icons: `lucide-react`.
   - 3D Workspace: Three.js Canvas modular dengan fallback tampilan 2D otomatis.
3. **Shared Contracts:**
   - TypeScript definitions terpadu untuk DTO, Agent, Provider, Run, dan Task (`shared/types.ts`).
