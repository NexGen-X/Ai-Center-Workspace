# Implementation Plan — AI Agent Command Center
**Dokumen Rencana Aksi Bertahap**  
**Repositori:** `/root/Ai-Center-Workspace`  
**Target:** AI Agent Command Center dengan 3D Workspace, AI Team Registry, Multi-Provider & Runtime Adapter, Task Orchestrator, dan Real-time Monitoring.

---

## 1. Ikhtisar Arsitektur & Struktur Proyek

Struktur modular yang akan dibangun di `/root/Ai-Center-Workspace`:

```text
/root/Ai-Center-Workspace/
├── package.json               # Root scripts untuk dev, build, test
├── tsconfig.json              # Base TypeScript configuration
├── ARCHITECTURE_AUDIT.md      # Laporan audit empiris
├── IMPLEMENTATION_PLAN.md     # Rencana implementasi ini
├── shared/                    # Kontrak DTO dan tipe bersama
│   ├── types.ts               # Agent, Provider, Run, Task, Project, Metric types
│   └── constants.ts           # Status enums, default presets
├── server/                    # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── config/            # Env, database DSN, secret configs
│   │   ├── db/                # PostgreSQL pool, skrip migrasi, schema SQL
│   │   ├── adapters/          # Connection Adapters (Router, Custom API, Presets, Hermes)
│   │   ├── routes/            # REST API endpoints (/api/agents, /api/tasks, /api/monitoring, dll)
│   │   ├── services/          # Task Orchestrator, Monitoring Collector, Metrics
│   │   ├── middleware/        # SSRF validator, Secret masker, Error handler
│   │   └── index.ts           # Server entry point + SSE/WebSocket hub
│   └── tests/                 # Unit & integration tests
├── client/                    # React 18 + Vite + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/        # Layout, Navbar, Modal, Dashboard Cards, Activity Feed
│   │   ├── features/
│   │   │   ├── team/          # AI Team List, "Tambah Anggota" Modal (Custom/Preset/Hermes)
│   │   │   ├── tasks/         # Task List, Create Task, Status Board
│   │   │   ├── monitoring/    # CPU, RAM, Disk, Uptime live widget
│   │   │   └── workspace3d/   # Three.js 3D Virtual Workspace & 2D Fallback View
│   │   ├── hooks/             # useAgents, useTasks, useRealtime, useMonitoring
│   │   ├── services/          # API Client dengan Axios / Fetch
│   │   └── App.tsx            # Main shell & routing
│   ├── index.html
│   └── vite.config.ts
```

---

## 2. Fase Implementasi Bertahap

### Phase A — Foundation & Database Infrastructure
- **Lingkup:**
  - Setup `package.json`, konfigurasi TypeScript, Vite, Tailwind CSS, Express, dan driver database `pg`.
  - Definisi shared DTOs & status enums (`shared/types.ts`).
  - Pembuatan skema database PostgreSQL di database `ai_center` (`schema.sql`):
    - Tabel `workspaces`, `human_users`, `projects`, `tasks`, `task_history`
    - Tabel `model_providers`, `ai_agents`, `agent_runs`, `activities`, `server_metrics`
  - Inisialisasi migration runner aman (idempotent: `CREATE TABLE IF NOT EXISTS`).
  - Utilitas keamanan: enkripsi kredensial (AES-256), proteksi SSRF validator URL, dan masking secret.
- **Kriteria Penerimaan (Gate A):**
  - Schema database berhasil dimigrasikan ke PostgreSQL tanpa error.
  - Skrip build dan TypeScript compiler berjalan tanpa kesalahan.

---

### Phase B — AI Team Registry & Connection Adapters
- **Lingkup:**
  - **Connection Router & Adapter Interface:**
    - `BaseConnectionAdapter` interface (`testConnection()`, `discoverModels()`, `executeRun()`).
    - `CustomApiAdapter`: Mendukung protokol OpenAI-compatible (`/v1/chat/completions`, `/v1/models`) dan Anthropic-compatible (`/v1/messages`).
    - `PresetProviderAdapter`: Preset teruji untuk Route-X Local Gateway (`http://localhost:8080/v1`), OpenAI, Anthropic, Gemini, Groq, Ollama.
    - `HermesRuntimeAdapter`: Adapter eksplisit untuk external runtime Hermes. Mengimplementasikan healthcheck verifikasi, pelaporan status diagnostik jujur (`UNAVAILABLE / RUNTIME_NOT_INSTALLED`), dan deteksi ketiadaan binary.
  - **REST API Endpoints:**
    - `GET /api/agents` (daftar seluruh anggota AI Team, tanpa membocorkan API key).
    - `POST /api/agents` (pendaftaran agent baru dengan koneksi provider/runtime).
    - `GET /api/agents/:id` & `PATCH /api/agents/:id` (edit prompt, aktifkan/nonaktifkan).
    - `POST /api/providers/test-connection` (pengujian koneksi live dengan proteksi SSRF).
    - `POST /api/providers/discover-models` (model discovery upstream jika didukung).
- **Kriteria Penerimaan (Gate B):**
  - Penambahan agent Custom API dan Preset berhasil disimpan.
  - Test connection ke Route-X lokal (`localhost:8080`) atau upstream mengembalikan status terverifikasi.
  - API key tersimpan terenkripsi dan respon GET hanya menampilkan format masked (`sk-...****`).
  - Runtime Hermes mengembalikan status diagnostik tidak aktif yang jujur tanpa mock palsu.

---

### Phase C — Task Orchestration & Projects
- **Lingkup:**
  - REST API Task CRUD: `GET /api/tasks`, `POST /api/tasks`, `PATCH /api/tasks/:id`, `POST /api/tasks/:id/transitions`.
  - Validasi transisi status task: `TODO` -> `IN_PROGRESS` -> `IN_REVIEW` -> `DONE` (atau `CANCELLED`).
  - Penugasan Task ke AI Agent (penjadwalan `AgentRun`).
  - Eksekutor Agent Run: Panggilan ke Connection Adapter yang ditugaskan, pencatatan durasi, status run (`QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`), ringkasan input/output, dan penanganan error terstruktur.
  - Pencatatan otomatis ke tabel `activities` dan `task_history` setiap terjadi mutasi.
- **Kriteria Penerimaan (Gate C):**
  - Transisi task divalidasi ketat (transisi ilegal ditolak).
  - AgentRun mencatat status dan hasil eksekusi nyata.

---

### Phase D — Monitoring Collector & Real-time Stream
- **Lingkup:**
  - Native Host Monitoring Collector di backend:
    - Pengambilan CPU usage (via `os.cpus()`), RAM (via `os.totalmem()` & `os.freemem()`), Disk space (via `fs.statfs`), Load average, dan Uptime sistem.
  - Real-time Server-Sent Events (SSE) di `/api/realtime`:
    - Mengirim event stream: `task.updated`, `agent.status_changed`, `monitoring.sample`, `activity.created`.
- **Kriteria Penerimaan (Gate D):**
  - Endpoint `/api/monitoring/summary` menyajikan metrik sistem nyata dengan timestamp valid.
  - Klien web menerima live update metrik dan perubahan task via SSE.

---

### Phase E — Web UI & AI Team Frontend
- **Lingkup:**
  - **App Shell & Theme:** Tampilan dark modern profesional (#0B0F17, Slate-900, aksen Biru & Emerald) selaras dengan referensi visual Command Center.
  - **Navbar & Metric Cards:** Ringkasan tugas berjalan, tugas selesai, anggota tim aktif, proyek aktif, dan kondisi server.
  - **Panel AI Team:** Daftar kartu agen AI lengkap dengan badge model, status runtime (`READY`, `BUSY`, `UNAVAILABLE`), dan tombol aksi.
  - **Modal "Tambah Anggota AI Team":**
    - Tab 1: **Custom API Provider** (Base URL, API Key masked, Protokol, Model selector, tombol Test Connection & Discover Models).
    - Tab 2: **Provider Preset** (Route-X Local Gateway, OpenAI, Anthropic, Gemini, Groq, Ollama).
    - Tab 3: **External Runtime (Hermes)** (Penjelasan koneksi runtime, tombol diagnostik verifikasi lingkungan host, peringatan ketersediaan binary).
  - **Panel Tasks & Activity Feed:** Interaksi pembuatan task, filter status, dan linimasa aktivitas terbaru.
- **Kriteria Penerimaan (Gate E):**
  - UI responsif (desktop, tablet, mobile), zero-clash styling, tidak ada toast ganda, form validasi ramah pengguna.

---

### Phase F — 3D Virtual Workspace & Accessible 2D Fallback
- **Lingkup:**
  - Three.js Interactive Canvas: Meja kerja virtual, stasiun komputer, furnitur, dan representasi visual karakter agen AI.
  - Pemetaan status visual karakter secara dinamis dari status aktual agen (Idle, Running, Error).
  - Kontrol interaktif: Rotasi kamera (OrbitControls), klik karakter untuk membuka detail agen di side panel, dan auto-tour mode.
  - **Accessible 2D Fallback Mode:** Tombol toggle instan untuk beralih antara tampilan 3D dan tampilan grid/list 2D jika browser/perangkat pengguna membutuhkan aksesibilitas tinggi atau WebGL dinonaktifkan.
- **Kriteria Penerimaan (Gate F):**
  - Render 3D berjalan mulus, pembersihan resource (dispose geometry/material/listener) saat unmount, dan fallback 2D berfungsi 100%.

---

### Phase G — Quality Assurance, Testing & Hardening
- **Lingkup:**
  - Suite pengujian otomatis (Unit tests & Integration tests):
    1. Konfigurasi valid tersimpan & terenkripsi.
    2. API key salah menghasilkan error terstruktur.
    3. Base URL tidak valid / SSRF dicegah (misal `http://169.254.169.254`).
    4. Model ID tidak ditemukan dilaporkan dengan tepat.
    5. Test Connection timeout & offline handling.
    6. Runtime Hermes melaporkan status unavailable secara jujur.
    7. Masking kredensial terbukti tidak bocor ke frontend.
    8. Transisi status task dan pembuatan riwayat terverifikasi.
  - Build verification (`npm run build`) untuk backend & frontend.
  - Pembuatan laporan akhir QA dengan bukti empiris nyata.
- **Kriteria Penerimaan (Gate G):**
  - 100% test lulus dengan output command tercatat, zero lint/type errors.

---

## 3. Matriks Manajemen Risiko & Mitigasi

| Risiko | Dampak | Strategi Mitigasi |
|---|---|---|
| Kebocoran API Key di Frontend / Log | Kritis | Enkripsi AES-256 di database; transform DTO selalu memask kredensial; log filter regex. |
| Serangan SSRF via Custom Base URL | Tinggi | URL parser & hostname validator; blokir metadata cloud IP (`169.254.169.254`); allowlist protokol `http/https`. |
| Beban Berat Rendering 3D di Perangkat Rendah | Sedang | Geometri Three.js yang dioptimasi; bayangan terbatas; toggle instan ke mode 2D Fallback. |
| Ekspektasi Runtime Hermes Palsu | Sedang | Pelaporan jujur status binary/koneksi; tidak mengarang eksekusi fiktif; petunjuk instalasi jelas. |
| Putusnya Sambungan Real-time SSE | Rendah | Auto-reconnect client dengan exponential backoff dan fallback periodic polling (15s). |
