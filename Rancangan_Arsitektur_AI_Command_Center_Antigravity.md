# Rancangan Arsitektur Lengkap — AI Command Center
## Dokumen implementasi untuk Antigravity CLI + Gemini Flash 3.8

**Status dokumen:** Rancangan awal yang harus divalidasi terhadap repository sebelum implementasi.  
**Tujuan:** Menjadi sumber instruksi utama bagi AI CLI untuk merencanakan, membangun, menguji, dan mendokumentasikan aplikasi Command Center seperti referensi visual yang diberikan.  
**Bahasa kerja:** Bahasa Indonesia untuk laporan; nama kode, API, dan simbol mengikuti konvensi proyek.  
**Prinsip utama:** Audit dahulu, rencanakan, implementasikan bertahap, uji dengan bukti, lalu review. Jangan menganggap rancangan ini sebagai izin untuk mengganti stack atau merombak proyek yang sudah ada.

---

# 1. Ringkasan Eksekutif

Bangun sebuah **AI Agent Command Center** yang menyatukan dashboard ringkasan, manajemen agent AI/LLM, tugas, proyek, kalender, dokumen, laporan, aktivitas eksekusi, notifikasi, pemantauan server, dan ruang kerja 3D interaktif. **Seluruh anggota Team pada tampilan adalah entitas AI**—model LLM, agent AI, atau instance eksekusi agent—bukan anggota tim manusia. Manusia dapat berperan sebagai pengguna/operator/admin aplikasi, tetapi bukan anggota Team yang divisualisasikan.

Tampilan referensi memiliki elemen visual berikut:

- Navigation bar utama.
- Sapaan dan ringkasan kondisi sistem.
- Kartu tugas berjalan, tugas selesai, anggota tim online, dan proyek aktif.
- Panel Team yang menampilkan agent AI/LLM, model yang digunakan, status runtime, tugas aktif, dan aktivitas eksekusi.
- Panel status server dan layanan.
- Daftar aktivitas terbaru.
- Ruang kerja virtual 3D berisi meja, komputer, furnitur, tanaman, dan karakter.
- Panel bawah untuk membuat tugas, berpindah tampilan, memilih karakter, menjalankan auto-tour, dan melihat riwayat.

Pada fitur **Tambah Anggota Team**, operator harus dapat memilih antara koneksi provider/model melalui Base URL + API key, provider preset, atau external agent runtime seperti Hermes jika integrasinya telah diverifikasi. Provider API dan runtime agent adalah tipe koneksi berbeda.

Target bukan sekadar membuat tiruan visual. Setiap elemen yang ditampilkan harus memiliki perilaku yang jelas, state yang konsisten, status loading/error/empty, dan sumber data yang dapat diverifikasi. Jika backend atau integrasi belum tersedia, tampilkan status demo yang jelas; jangan mengarang data seolah-olah data nyata.

## 1.1 Hasil yang diharapkan

1. UI yang rapi, dinamis, responsif, dan tidak terlalu ramai.
2. Modul bisnis yang terpisah dan mudah dipelihara.
3. Satu sumber kebenaran untuk data tugas, tim, proyek, dan aktivitas.
4. Real-time hanya pada bagian yang memang membutuhkannya.
5. Workspace 3D sebagai lapisan presentasi, bukan pusat logika bisnis.
6. Pengujian otomatis dan manual dengan bukti hasil.
7. Pengembangan AI CLI yang anti-halusinasi, terukur, dan tidak merusak fitur yang sudah ada.

---

# 2. Instruksi Prioritas untuk AI CLI

Bagian ini merupakan kontrak kerja yang wajib dipatuhi oleh Antigravity CLI.

## 2.1 Aturan sebelum mengubah kode

1. Periksa repository, branch, status Git, struktur folder, README, package/config files, test suite, dan cara menjalankan aplikasi.
2. Identifikasi stack, framework, pola arsitektur, sistem desain, API, database, autentikasi, dan integrasi yang sudah ada.
3. Catat fitur yang sudah berjalan sebelum mengubahnya.
4. Jangan membuat ulang aplikasi dari nol jika repository berisi aplikasi yang sedang berjalan.
5. Jangan mengganti framework, package manager, database, sistem routing, atau state management tanpa alasan teknis yang kuat dan persetujuan eksplisit.
6. Jangan menghapus, menonaktifkan, atau mengubah perilaku fitur yang ada hanya demi menyederhanakan implementasi.
7. Jangan mengasumsikan file, fungsi, endpoint, package, environment variable, atau command tersedia sebelum memeriksanya.
8. Jangan mengklaim test, build, lint, type-check, atau deployment berhasil jika command terkait belum benar-benar dijalankan.
9. Jangan menampilkan atau mencatat secret, API key, token, password, cookie, atau data pribadi dalam log, laporan, screenshot, atau commit.
10. Jika informasi penting belum diketahui, tulis sebagai `UNKNOWN` dan cari bukti dari repository. Jika tetap tidak diketahui, laporkan sebagai blocker atau ajukan pertanyaan terarah.

## 2.2 Hierarki sumber kebenaran

Jika terjadi konflik, gunakan urutan berikut:

1. Kode dan perilaku aktual repository.
2. Test, schema, migration, dan konfigurasi yang benar-benar ada.
3. Dokumentasi proyek yang masih sesuai dengan kode.
4. Dokumen rancangan ini.
5. Asumsi AI.

Jangan mengubah fakta repository agar cocok dengan dokumen. Perbarui rancangan atau usulkan keputusan baru jika bukti menunjukkan perbedaan.

## 2.3 Kebijakan perubahan

- Perubahan harus kecil, terarah, dan dapat ditinjau.
- Hindari refactor luas yang tidak diperlukan untuk tugas.
- Jangan melakukan perubahan destruktif pada database atau data pengguna.
- Jangan menjalankan migration destruktif, menghapus file, mengubah permission sensitif, atau mengirim perubahan ke production tanpa otorisasi yang sesuai.
- Jangan mengubah dependency besar tanpa menilai kompatibilitas dan dampaknya.
- Gunakan patch/commit terpisah jika workflow repository mendukungnya.
- Bila menemukan bug di luar lingkup, dokumentasikan dan jangan otomatis memperluas scope.

## 2.4 Standar anti-halusinasi

Setiap laporan teknis harus membedakan:
- **VERIFIED:** terbukti dari kode, command, atau test.
- **INFERRED:** kesimpulan yang masuk akal tetapi belum dibuktikan.
- **UNKNOWN:** belum ditemukan bukti.
- **BLOCKED:** tidak dapat dilanjutkan karena prasyarat atau akses tidak tersedia.

**NO EVIDENCE = NO ACCEPTANCE.** Fitur tidak boleh dinyatakan selesai hanya berdasarkan penjelasan AI atau kode yang tampak benar.

---

# 3. Tahap Nol — Audit Repository

Tahap ini wajib dilakukan sebelum implementasi. Pada tahap ini AI CLI hanya melakukan inspeksi dan membuat laporan; jangan mulai merombak kode.

## 3.1 Checklist audit

- [ ] Root repository dan struktur folder.
- [ ] Status Git, branch aktif, dan perubahan pengguna yang belum di-commit.
- [ ] Framework dan versi runtime.
- [ ] Package manager dan lockfile.
- [ ] Command development, build, lint, type-check, dan test.
- [ ] Halaman, route, layout, dan komponen yang sudah ada.
- [ ] Sistem desain, token warna, tipografi, spacing, dan tema.
- [ ] State management dan data-fetching.
- [ ] Backend/API dan kontrak endpoint.
- [ ] Database, schema, migration, dan seed.
- [ ] Login, session/token, role, permission, dan tenant/workspace jika ada.
- [ ] Integrasi real-time, WebSocket, SSE, atau polling.
- [ ] Monitoring dan logging.
- [ ] Test yang sudah ada dan area tanpa test.
- [ ] Accessibility dan responsive behavior.
- [ ] Risiko keamanan, dependency, dan konfigurasi environment.
- [ ] Fitur yang harus dipertahankan.

## 3.2 Artefak hasil audit

Buat atau perbarui dokumentasi hanya setelah memeriksa pola dokumentasi yang sudah ada. Minimal hasil audit harus berisi:

- `CURRENT_STATE.md` — gambaran sistem yang benar-benar ada.
- `ARCHITECTURE_DECISIONS.md` — keputusan teknis, bukti, dan alasan.
- `IMPLEMENTATION_PLAN.md` — urutan pekerjaan, dependensi, risiko, dan kriteria penerimaan.
- `REGRESSION_BASELINE.md` — fitur dan test yang harus tetap berjalan.

Jangan membuat file duplikat jika repository sudah memiliki dokumen ekuivalen. Dalam kasus itu, perbarui dokumen yang sudah ada.

---

# 4. Tujuan Produk dan Ruang Lingkup

## 4.1 Modul utama

1. **Dashboard:** ringkasan tugas, progres, anggota online, proyek aktif, dan kesehatan layanan.
2. **Tasks:** daftar tugas, detail, status, prioritas, assignee, deadline, label, komentar, dan riwayat.
3. **AI Team / Agent Registry:** daftar agent AI, tujuan/peran, model LLM, provider, kemampuan, status runtime, dan aktivitas.
4. **Projects:** proyek, status, progres, anggota, dan hubungan ke tugas.
5. **Calendar:** tampilan jadwal/deadline yang terkait dengan tugas dan proyek.
6. **Documents:** daftar dokumen, metadata, akses, dan hubungan ke proyek; upload hanya jika kebutuhan dan penyimpanan sudah ditentukan.
7. **Reports:** ringkasan dan metrik berdasarkan data nyata.
8. **Activity Feed:** kronologi peristiwa bisnis yang relevan.
9. **Notifications:** notifikasi yang dapat dibaca, ditandai, dan dikelola.
10. **Server Monitoring:** CPU, RAM, disk, load, uptime, serta status pengumpulan metrik.
11. **3D Workspace:** visualisasi ruang dan karakter yang memantulkan data dari modul inti.
12. **Settings:** preferensi tampilan, pengaturan workspace, dan konfigurasi yang diizinkan.

## 4.2 Bukan tujuan awal

Jangan menambahkan fitur berikut kecuali repository atau pemilik produk secara eksplisit membutuhkannya:

- Microservices.
- Sistem billing.
- Marketplace plugin.
- Chat lengkap.
- Kolaborasi dokumen real-time.
- AI agent runtime yang mengeksekusi tugas secara otomatis.
- Integrasi layanan eksternal yang belum ditentukan.
- Sistem multi-tenant kompleks jika aplikasi hanya memerlukan satu workspace.

Fitur tambahan memerlukan keputusan arsitektur terpisah.

---

# 5. Prinsip Arsitektur

1. **Preserve before improve:** pertahankan fungsi yang ada sebelum menyempurnakan UI.
2. **Modular monolith by default:** satu aplikasi backend dengan batas modul yang jelas, kecuali repository yang ada menggunakan arsitektur lain yang terbukti tepat.
3. **Single source of truth:** data bisnis memiliki sumber kebenaran yang ditetapkan.
4. **Presentation separated from business logic:** UI dan 3D tidak menjadi penyimpan utama aturan bisnis.
5. **Explicit contracts:** tipe data, API, event, dan error memiliki kontrak jelas.
6. **Progressive enhancement:** fungsi penting tetap bisa digunakan ketika 3D atau koneksi real-time gagal.
7. **Observable behavior:** error dan status layanan terlihat, tetapi detail sensitif tidak bocor.
8. **Security by default:** validasi server, autentikasi, otorisasi, dan secret management.
9. **Testable design:** logika bisnis dapat diuji tanpa merender scene 3D.
10. **Performance budgets:** animasi dan efek visual tidak boleh mengorbankan aksesibilitas atau interaksi utama.
11. **Graceful degradation:** kegagalan satu panel tidak membuat seluruh dashboard blank.
12. **No fake success:** jangan menunjukkan status sukses jika operasi belum terkonfirmasi.

---

# 6. Gambaran Arsitektur Logis

Gunakan gambaran ini sebagai target konseptual. Sesuaikan dengan struktur repository aktual.

```text
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT UI                            │
│ App Shell · Navigation · Pages · Shared UI · Responsive      │
├─────────────────────────────────────────────────────────────┤
│                      PRESENTATION FEATURES                   │
│ Dashboard · Tasks · Team · Projects · Calendar · Reports     │
│ Documents · Activity · Notifications · Monitoring · Settings │
├─────────────────────────────────────────────────────────────┤
│                    WORKSPACE PRESENTATION                    │
│ 3D Scene · Character View Models · Camera · Interactions      │
│ Fallback 2D/Accessible View · Lazy Loading                    │
├─────────────────────────────────────────────────────────────┤
│                     APPLICATION SERVICES                     │
│ Use Cases · Validation · Authorization · DTO Mapping         │
├─────────────────────────────────────────────────────────────┤
│                         DOMAIN                               │
│ Task · Project · Team · Activity · Notification · Workspace  │
│ Business Rules · State Transitions · Domain Events           │
├─────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE                          │
│ Database · API · Realtime · Cache (if needed) · Metrics      │
│ Logging · Auth Provider · File Storage (if needed)            │
└─────────────────────────────────────────────────────────────┘
```

Jangan membuat semua lapisan menjadi abstraksi berlebihan. Tambahkan interface atau adapter ketika memang diperlukan untuk memisahkan ketergantungan, menguji perilaku, atau mendukung integrasi.

---

# 7. Arsitektur Frontend

## 7.1 Application Shell

Tanggung jawab:

- Layout global dan navigasi.
- Route dan route guard.
- Theme provider dan design tokens.
- Global error boundary.
- Toast/notification host tunggal.
- Pengelolaan panel dan modal.
- Responsive layout.
- Aksesibilitas dasar.
- Status koneksi jika diperlukan.

**Penting:** satu aksi sebaiknya menghasilkan satu notifikasi yang relevan. Hindari toast ganda dari handler, mutation hook, dan global interceptor untuk peristiwa yang sama. Tetapkan satu pemilik notifikasi per alur.

## 7.2 Feature module

Setiap feature idealnya memiliki, sesuai kompleksitasnya:

- `components/`
- `hooks/` atau state logic
- `services/` atau API functions
- `types/`
- `utils/`
- `tests/`

Jangan memaksakan seluruh folder pada fitur kecil. Ikuti konvensi repository dan hindari duplikasi utilitas.

## 7.3 State management

Pisahkan jenis state:

- **Server state:** data yang berasal dari API/database; gunakan data-fetching/cache yang sudah dipakai proyek.
- **UI state:** tab aktif, panel terbuka, mode tampilan, dan filter sementara.
- **URL state:** filter atau tab yang perlu dapat di-bookmark atau dibagikan.
- **Realtime state:** status koneksi dan event terbaru; sinkronkan dengan server state.
- **3D transient state:** posisi kamera, hover, animasi, dan pilihan objek yang tidak perlu disimpan sebagai data bisnis.

Jangan menyalin seluruh data server ke global store tanpa alasan. Hindari dua sumber state yang dapat saling berbeda.

## 7.4 Data fetching dan error handling

- Gunakan satu API client standar.
- Terapkan timeout dan pembatalan request bila sesuai.
- Bedakan error jaringan, autentikasi, otorisasi, validasi, konflik, dan server.
- Jangan mengulang mutation secara otomatis jika operasi tidak idempotent.
- Tampilkan loading, empty, error, dan success state secara eksplisit.
- Gunakan optimistic update hanya jika rollback dapat dilakukan dengan benar.
- Jangan menampilkan stack trace atau detail backend kepada pengguna.

## 7.5 Design system

Gunakan token terpusat untuk:

- Warna dan kontras.
- Font family, size, weight, line-height.
- Spacing.
- Radius.
- Elevation/shadow.
- Border.
- Z-index.
- Motion duration/easing.
- Breakpoint.

Hindari nilai CSS arbitrer yang berulang. Jangan menambahkan garis, border, glow, panel, atau dekorasi yang tidak membantu hierarki informasi.

---

# 9. Arsitektur Workspace 3D

## 8.1 Peran 3D

Workspace 3D merupakan representasi visual keadaan aplikasi, bukan database atau mesin bisnis.

Scene 3D boleh menampilkan:

- Ruangan dan furnitur.
- Komputer/stasiun kerja.
- Karakter visual agent AI/LLM yang dipetakan ke identitas agent atau instance eksekusi.
- Status karakter, jika data presence tersedia.
- Interaksi untuk membuka halaman atau panel yang relevan.
- Auto-tour.
- Pengaturan kamera dan mode tampilan.

## 8.2 Batas modul

Pisahkan setidaknya tanggung jawab berikut, dengan nama yang menyesuaikan stack:

- Scene/bootstrap.
- Asset loading.
- Lighting dan environment.
- Camera/navigation.
- Workspace objects.
- Character rendering.
- Interaction/picking.
- Animation.
- View-model mapping.
- Performance monitoring.
- Fallback mode.

## 8.3 Aturan integrasi data

Contoh alur:

```text
API / Realtime Event
        ↓
Validated Application State
        ↓
Workspace View Model
        ↓
3D Components
```

Jangan menulis langsung ke database dari komponen 3D. Klik karakter atau komputer harus memanggil aksi aplikasi yang sudah ditetapkan, bukan menjalankan query atau aturan bisnis di dalam scene.

## 8.4 Performa dan aksesibilitas

- Lazy-load scene dan aset besar.
- Tampilkan fallback/loading state selama aset dimuat.
- Tangani kegagalan WebGL atau perangkat yang tidak mendukung.
- Sediakan alternatif 2D/list untuk informasi penting.
- Hormati `prefers-reduced-motion`.
- Batasi jumlah lampu, material berat, bayangan, dan draw calls.
- Hindari render loop tambahan yang tidak diperlukan.
- Lepaskan resource GPU, event listener, dan animation frame ketika scene di-unmount.
- Jangan memuat ulang seluruh scene untuk perubahan data kecil.
- Uji perangkat seluler dan ukuran layar kecil.
- Ukur performa nyata sebelum melakukan optimasi spekulatif.

## 8.5 Aset

Utamakan aset yang lisensinya jelas. Jangan menyalin aset komersial atau identitas merek tanpa izin. Dokumentasikan sumber dan lisensi aset. Jika aset belum tersedia, gunakan placeholder yang jelas dan mudah diganti.

---

# 10. Arsitektur Backend dan Domain

Jika backend sudah ada, pertahankan stack dan pola yang sesuai. Jika aplikasi benar-benar baru dan tidak ada kendala stack, modular monolith merupakan default yang masuk akal.

## 9.1 Modul domain

### Identity & Access
- User identity.
- Authentication/session.
- Roles dan permissions.
- Workspace membership jika dibutuhkan.

### Workspace
- Metadata workspace.
- Preferensi tampilan.
- Konfigurasi workspace.

### Tasks
- Task CRUD.
- Assignment.
- Status transition.
- Priority dan due date.
- Label/comment jika dibutuhkan.
- Task history.

### AI Agents / Team Registry
- Registrasi agent AI dan identitas stabil.
- Peran/tujuan agent, misalnya Planner, Executor, QA/Reviewer, DevOps, atau agent domain.
- Model LLM, provider, model ID, dan konfigurasi kemampuan yang diizinkan.
- Status runtime dan heartbeat instance.
- Tugas aktif, riwayat run, dan hasil kerja.
- Presence agent harus berarti status runtime yang terukur, bukan status online manusia.

### Human Users / Access Control
- Pengguna/operator/admin yang mengakses aplikasi.
- Authentication, workspace membership, roles, dan permissions.
- Pengguna manusia dipisahkan dari daftar AI Team.

### Projects
- Project CRUD.
- Status.
- Anggota.
- Hubungan task-project.
- Perhitungan progres berdasarkan aturan eksplisit.

### Activities
- Peristiwa bisnis yang dapat ditampilkan dalam timeline.
- Referensi actor dan target.
- Timestamp server.
- Metadata minimal yang aman.

### Notifications
- Pembuatan notifikasi.
- Penerima.
- Read/unread.
- Delivery state jika ada beberapa channel.

### Monitoring
- Pengambilan metrik host/container/service.
- Timestamp dan sumber metrik.
- Status collector.
- Batas akses ke data infrastruktur.

### Documents
- Metadata dan relasi dokumen.
- Storage adapter hanya bila upload benar-benar diperlukan.
- Pemeriksaan tipe file, ukuran, dan izin akses.

### Reports
- Query/read model berdasarkan data yang tersedia.
- Perhitungan metrik terdefinisi.
- Tidak boleh mengarang angka saat data kosong.

## 9.2 Aturan domain

- Status task hanya berubah melalui transisi yang diizinkan.
- Perubahan status dan pencatatan activity harus konsisten.
- Progres proyek harus dihitung dari definisi yang terdokumentasi.
- Waktu disimpan dalam format yang konsisten (umumnya UTC) dan ditampilkan menurut zona waktu pengguna.
- Permission diperiksa di server untuk setiap operasi yang dilindungi.
- Jangan percaya `userId`, `role`, atau `workspaceId` dari client tanpa validasi akses.
- Terapkan pagination dan batas query pada daftar besar.
- Gunakan transaksi untuk perubahan multi-record yang harus konsisten.
- Tetapkan kebijakan delete/archive sebelum menghapus data bisnis.

---

# 11. Model Data Konseptual

Ini model awal, bukan instruksi untuk membuat migration tanpa audit. Sesuaikan dengan database, ORM, dan schema yang sudah ada.

## 10.1 Entitas

### HumanUser
- `id`
- `display_name`
- `email` atau identifier login yang diperlukan
- `avatar_url` nullable
- `created_at`
- `updated_at`

Entitas ini hanya untuk pengguna/operator/admin yang masuk ke aplikasi, bukan anggota AI Team.

### Workspace
- `id`
- `name`
- `settings_json` atau kolom bertipe yang sesuai
- `created_at`
- `updated_at`

### WorkspaceMember
- `workspace_id`
- `human_user_id`
- `role`
- `joined_at`

Gunakan entitas ini untuk akses manusia ke workspace. Jangan gunakan tabel ini untuk merepresentasikan agent AI.

### Project
- `id`
- `workspace_id`
- `name`
- `description` nullable
- `status`
- `start_date` nullable
- `due_date` nullable
- `created_by`
- `created_at`
- `updated_at`
- `archived_at` nullable jika soft archive dipilih

### Task
- `id`
- `workspace_id`
- `project_id` nullable
- `title`
- `description` nullable
- `status`
- `priority`
- `assignee_id` nullable
- `created_by`
- `due_at` nullable
- `created_at`
- `updated_at`
- `completed_at` nullable

### TaskHistory
- `id`
- `task_id`
- `actor_id` nullable jika event sistem
- `event_type`
- `old_value` nullable
- `new_value` nullable
- `created_at`

### Activity
- `id`
- `workspace_id`
- `actor_id` nullable
- `event_type`
- `target_type`
- `target_id`
- `summary` atau metadata terstruktur
- `created_at`

### Notification
- `id`
- `workspace_id`
- `recipient_id`
- `event_type`
- `payload` yang tervalidasi dan tidak memuat secret
- `read_at` nullable
- `created_at`

### Agent
- `id` — identitas stabil agent, bukan ID run.
- `workspace_id`
- `name`
- `role` — misalnya orchestrator, planner, executor, qa_reviewer, devops, atau peran domain.
- `description` / `objective`
- `provider_id` nullable jika agent menggunakan routing dinamis.
- `model_id` nullable jika model dipilih per run.
- `capabilities` — daftar kemampuan yang diizinkan, bukan klaim kemampuan bebas.
- `configuration_ref` — referensi konfigurasi aman; jangan simpan secret langsung.
- `enabled`
- `created_at`
- `updated_at`

### ModelProvider
- `id`
- `name`
- `provider_type`
- `base_url` jika relevan
- `auth_secret_ref` — referensi ke secret manager/environment, bukan API key plaintext.
- `enabled`
- `created_at`

### ModelDefinition
- `id`
- `provider_id`
- `model_key` — ID model aktual dari provider.
- `display_name`
- `capabilities` yang telah diverifikasi.
- `context_limit` nullable jika diketahui dan diverifikasi.
- `enabled`

Nama model dan kapabilitas harus berasal dari konfigurasi/provider yang terverifikasi; jangan mengarang model atau kemampuan.

### AgentRun
- `id`
- `agent_id`
- `task_id` nullable
- `model_id` nullable
- `status` — queued, running, succeeded, failed, cancelled, atau status lain yang ditetapkan.
- `started_at` nullable
- `finished_at` nullable
- `input_summary` yang telah disanitasi
- `output_summary` yang telah disanitasi
- `error_code` nullable
- `usage_metadata` nullable, jika provider menyediakan data yang dapat diverifikasi
- `created_at`

Satu agent dapat memiliki banyak run. Identitas agent tidak boleh dicampur dengan identitas run.

### AgentPresence / RuntimeStatus
- `agent_id` atau `agent_run_id`
- `workspace_id`
- `status` — idle, queued, running, waiting, succeeded, failed, unavailable, atau status terdefinisi lainnya.
- `last_heartbeat_at` nullable
- `updated_at`

Status agent harus bersumber dari runtime/orchestrator/heartbeat yang nyata. Jangan menandai agent online hanya karena record-nya ada di database.

### MetricSample
- `id`
- `source_id`
- `metric_name`
- `value`
- `unit`
- `observed_at`
- `labels` yang dibatasi

Untuk volume metrik tinggi, jangan otomatis menyimpan setiap sampel ke tabel relasional biasa tanpa retensi, agregasi, dan evaluasi beban.

### Document (opsional)
- `id`
- `workspace_id`
- `project_id` nullable
- `owner_id`
- `name`
- `mime_type`
- `size_bytes`
- `storage_key`
- `created_at`

Jangan menyimpan file biner besar di kolom biasa kecuali ada alasan dan dukungan teknis yang jelas.

## 10.2 Relasi utama

- Workspace memiliki human users dengan akses, agent AI, proyek, tugas, aktivitas, dan notifikasi.
- Project memiliki banyak task.
- Task dapat ditugaskan kepada satu agent AI, satu human user jika memang didukung, atau tidak ditugaskan; jenis assignee harus eksplisit dan tidak ambigu.
- Task memiliki banyak TaskHistory.
- Agent memiliki banyak AgentRun.
- AgentRun dapat terkait dengan task dan model yang benar-benar digunakan.
- Activity dapat menunjuk actor berupa human user, agent, atau system; jenis actor harus jelas.
- Notification memiliki penerima dan target yang terdefinisi.
- MetricSample berasal dari sumber monitoring.

Tentukan foreign key, unique constraint, index, cascade policy, dan retention policy berdasarkan database aktual.

---

# 13. Arsitektur AI Agent Runtime dan LLM

Bagian ini khusus untuk membedakan **agent**, **model LLM**, dan **run**. Ketiganya tidak boleh diperlakukan sebagai hal yang sama.

## 11.1 Perbedaan konsep

- **Agent:** unit kerja dengan identitas, peran, instruksi, batas kemampuan, dan aturan penggunaan tool. Contoh peran: Orchestrator, Planner, Executor, QA/Reviewer, DevOps.
- **LLM/Model:** model yang menghasilkan respons atau penalaran. Model dapat dipilih tetap untuk suatu agent atau dirutekan secara dinamis.
- **Provider:** layanan/API yang menyediakan model. Satu provider dapat menyediakan banyak model.
- **AgentRun:** satu eksekusi konkret dari sebuah agent untuk menyelesaikan task atau langkah kerja.
- **Tool:** kemampuan eksternal yang dapat dipanggil agent, misalnya membaca file, menjalankan test, atau mengakses API. Tool harus diberi izin minimum.
- **Task:** pekerjaan yang ingin diselesaikan. Task dapat memerlukan beberapa agent run dan beberapa tahap verifikasi.

Satu agent dapat menggunakan model berbeda pada run yang berbeda jika routing dinamis memang dikonfigurasi. Sebaliknya, satu model dapat digunakan oleh beberapa agent dengan instruksi dan permission berbeda.

## 11.2 Alur runtime konseptual

```text
Task / Trigger
     ↓
Orchestrator
     ↓
Planner: membuat rencana dan acceptance criteria
     ↓
Policy / Permission Check
     ↓
Executor Agent → Model Provider → LLM
     ↓
Tool Calls (hanya tool yang diizinkan)
     ↓
Run Result + Logs + Usage Metadata
     ↓
QA / Reviewer Agent
     ├── PASS → Orchestrator menerima hasil
     ├── FAIL → Temuan terstruktur dikembalikan untuk perbaikan
     └── BLOCKED → Menunggu keputusan atau dependensi
```

Jangan menganggap gambar ini sebagai jaminan bahwa Antigravity menyediakan API runtime untuk mengelola agent dari aplikasi. Runtime yang benar-benar digunakan harus ditemukan dan diverifikasi terlebih dahulu.

## 11.3 Model routing

Jika satu agent bisa menggunakan banyak model, sediakan lapisan pemilihan model dengan aturan eksplisit, misalnya:
- Peran agent.
- Kemampuan model yang telah diverifikasi.
- Ketersediaan provider.
- Batas konteks yang diketahui.
- Batas biaya/usage jika tersedia.
- Kebijakan privasi dan data.
- Fallback yang diizinkan.

Jangan memilih model hanya dari nama tampilan. Gunakan `provider_id` dan `model_key` aktual. Jika provider gagal, tandai kegagalan dan gunakan fallback hanya jika kebijakan routing secara eksplisit mengizinkannya.

## 11.4 Siklus hidup AgentRun

Status run harus mengikuti state transition yang tervalidasi. Contoh konseptual:

```text
QUEUED → RUNNING → SUCCEEDED
                  ├→ FAILED
                  └→ CANCELLED

QUEUED → CANCELLED
```

Status `WAITING` atau `RETRYING` boleh ditambahkan jika memang didukung oleh runtime. Jangan membuat status yang tidak memiliki makna operasional.

Simpan waktu mulai/selesai, agent, model yang benar-benar digunakan, task terkait, hasil ringkas, error terstruktur, dan metadata usage jika provider menyediakannya. Jangan menyimpan chain-of-thought privat; simpan ringkasan operasional, keputusan, tool calls yang aman, dan bukti hasil yang dibutuhkan untuk audit.

## 11.5 Status yang ditampilkan pada karakter 3D

Karakter adalah representasi visual dari agent atau run, bukan sumber status. Definisikan pemetaan yang stabil, misalnya:
- `IDLE` → agent siap, tidak ada run aktif.
- `QUEUED` → menunggu slot eksekusi.
- `RUNNING` → ada run aktif.
- `WAITING` → menunggu tool, approval, atau dependency.
- `SUCCEEDED` → run terakhir berhasil; agent dapat kembali menjadi idle.
- `FAILED` → run gagal; tampilkan status kegagalan dan waktu.
- `UNAVAILABLE` → runtime/provider tidak dapat diverifikasi atau tidak merespons.

Jangan menyamakan `SUCCEEDED` dari run terakhir dengan agent yang sedang aktif. UI sebaiknya memisahkan **status agent saat ini** dari **hasil run terakhir**.

## 11.6 Observability dan batas keamanan

- Catat run ID dan correlation ID.
- Simpan status dan timestamp dari runtime yang sebenarnya.
- Redaksi API key, token, credential, dan payload sensitif.
- Batasi akses ke prompt konfigurasi, log, dan output agent.
- Validasi setiap tool call berdasarkan allowlist/permission.
- Tool berisiko tinggi memerlukan approval atau guardrail yang sesuai.
- Jangan memberikan akses shell, file system, database, atau production secara default.
- Terapkan timeout, batas retry, pembatasan concurrency, dan cancellation jika runtime mendukungnya.
- Jangan menyatakan agent “online” hanya karena record konfigurasi aktif.
- Jangan mengarang token usage, biaya, durasi, atau status provider jika data itu tidak tersedia.

---

# 13. API dan Kontrak Komunikasi

Jangan menganggap endpoint berikut sudah ada. Ini adalah kontrak konseptual untuk divalidasi dan disesuaikan.

## 11.1 REST API konseptual

```text
GET    /api/dashboard/summary
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
POST   /api/tasks/:id/transitions
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PATCH  /api/projects/:id
GET    /api/agents
POST   /api/agents
GET    /api/agents/:id
PATCH  /api/agents/:id
GET    /api/agents/:id/runs
GET    /api/agents/runtime-status
GET    /api/models
GET    /api/providers
GET    /api/team/presence
GET    /api/activities
GET    /api/notifications
PATCH  /api/notifications/:id
GET    /api/monitoring/summary
GET    /api/monitoring/history
GET    /api/documents
GET    /api/reports/summary
```

Hanya implementasikan endpoint yang diperlukan. Jangan membuat route placeholder yang memberikan kesan fitur sudah berfungsi.

## 11.2 Standar API

- Gunakan skema request/response yang tervalidasi.
- Dokumentasikan status HTTP dan format error.
- Terapkan pagination, filter, sorting, dan batas maksimum.
- Gunakan validasi server sebagai otoritas.
- Periksa authentication dan authorization pada setiap endpoint privat.
- Gunakan idempotency key untuk operasi yang berpotensi diulang bila memang diperlukan.
- Tetapkan aturan concurrency untuk perubahan yang berisiko konflik.
- Jangan mengembalikan field internal atau secret ke client.
- Jika menggunakan REST, pertahankan pola naming dan response yang konsisten dengan proyek.

Contoh bentuk error konseptual:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Permintaan tidak valid.",
    "details": []
  }
}
```

Jangan bocorkan stack trace, query database, atau secret dalam error response production.

---

# 14. Real-Time, Event, dan Presence

## 12.1 Kapan real-time diperlukan

Gunakan real-time untuk perubahan yang bernilai bagi pengguna, seperti:

- Task status berubah.
- Agent run queued/started/succeeded/failed/cancelled.
- Aktivitas agent baru.
- Notifikasi baru.
- Runtime status/heartbeat agent.
- Perubahan proyek yang perlu terlihat segera.

Gunakan polling terjadwal untuk metrik server jika kebutuhan, infrastruktur, atau sumber metrik lebih sesuai. Jangan membuat semua data bergantung pada satu koneksi WebSocket.

## 12.2 Event konseptual

```text
task.created
task.updated
task.status_changed
project.updated
agent.registered
agent_run.queued
agent_run.started
agent_run.succeeded
agent_run.failed
agent_run.cancelled
agent.heartbeat
agent.runtime_status_changed
activity.created
notification.created
monitoring.sample_received
```

Setiap event perlu memiliki versi/schema yang jelas, timestamp, ID event bila diperlukan, dan payload minimum. Hindari menyebarkan data rahasia atau objek database lengkap.

## 12.3 Ketahanan real-time

- Tangani disconnect dan reconnect.
- Terapkan backoff pada reconnect.
- Sinkronkan ulang data setelah koneksi pulih.
- Jangan menganggap event selalu terkirim tepat satu kali.
- Antisipasi event duplikat dan urutan event yang tidak sempurna.
- Otorisasi channel dan subscription.
- Jangan menerima identitas pengguna hanya dari payload client.
- Tampilkan status koneksi tanpa mengganggu interaksi utama.

## 12.4 Konsistensi activity

Untuk aksi penting, perubahan bisnis dan pencatatan event harus konsisten. Jika dibutuhkan dan didukung arsitektur, evaluasi transactional outbox. Jangan memperkenalkan outbox atau message broker tanpa kebutuhan yang terbukti.

---

# 15. Monitoring Server

## 13.1 Metrik

Dashboard pada referensi menunjukkan:

- CPU.
- RAM.
- Disk.
- Load.
- Uptime.

Setiap metrik harus menampilkan:
- Nilai.
- Unit.
- Timestamp terakhir.
- Sumber atau host yang diukur jika relevan.
- Status data (normal, stale, unavailable, error).
- Batas/warning jika ada konfigurasi yang dapat dipertanggungjawabkan.

## 13.2 Arsitektur collector

```text
Host / Container / Service
          ↓
Trusted Metrics Collector
          ↓
Validation + Timestamp
          ↓
Metrics Storage / Aggregation
          ↓
Monitoring API
          ↓
Dashboard Widget
```

**Keamanan penting:** frontend tidak boleh memiliki akses langsung ke host shell, Docker socket, endpoint administrasi, atau kredensial monitoring. Pengambilan metrik dilakukan oleh komponen server/collector dengan permission minimum.

Jangan menyebut metrik sebagai real-time jika sumbernya terlambat. Tampilkan waktu pengambilan terakhir dan status stale.

---

# 16. Keamanan dan Privasi

Wajib divalidasi sesuai stack:

- Authentication yang sesuai dengan sistem yang ada.
- Server-side authorization untuk setiap operasi.
- Proteksi CSRF jika menggunakan cookie-based session dan konteksnya memerlukan.
- Secure, HttpOnly, dan SameSite cookie bila relevan.
- Rate limiting pada endpoint sensitif.
- Input validation dan output encoding.
- Pencegahan SQL injection melalui query terparameterisasi/ORM yang aman.
- Kebijakan CORS yang ketat.
- CSP dan security headers sesuai aplikasi.
- Secret disimpan melalui environment/secret manager, bukan source code.
- Redaksi secret dan data sensitif pada log.
- Upload validation dan malware scanning bila dokumen upload didukung.
- Audit trail untuk operasi penting.
- Dependency scanning bila tooling tersedia.
- Least privilege pada database, collector, dan deployment.
- Backup/restore dan retention policy yang jelas.
- Jangan menampilkan detail infrastruktur kepada pengguna yang tidak berwenang.

Jangan membuat sistem autentikasi buatan sendiri jika proyek telah memakai penyedia atau mekanisme yang layak.

---

# 17. UI/UX dan Design Quality

## 15.1 Hierarki informasi

Prioritaskan:
1. Navigasi dan konteks halaman.
2. Status sistem dan ringkasan yang paling berguna.
3. Tugas dan aktivitas yang membutuhkan tindakan.
4. Panel pendukung.
5. Dekorasi visual.

Ruang 3D tidak boleh menghalangi kontrol penting. Panel mengambang harus dapat ditutup, dipindahkan atau disusun secara responsif bila sesuai, serta tidak menutupi area interaksi utama.

## 15.2 Konsistensi komponen

- Gunakan design tokens.
- Satu komponen toast host atau satu mekanisme notifikasi terkoordinasi.
- Hindari toast ganda untuk satu operasi.
- Gunakan dialog konfirmasi untuk tindakan destruktif.
- Berikan feedback untuk aksi asynchronous.
- Sediakan empty state yang membantu pengguna.
- Hindari informasi yang sama ditampilkan berkali-kali tanpa manfaat.
- Pastikan font, padding, alignment, dan ukuran panel presisi.
- Periksa overflow, clipping, dan layering.
- Gunakan label yang jelas, bukan ikon saja untuk aksi yang tidak umum.

## 15.3 Accessibility

- Navigasi keyboard.
- Focus state yang terlihat.
- Kontras warna yang cukup.
- Label yang dapat dibaca screen reader.
- Target interaksi yang memadai untuk layar sentuh.
- Pengurangan motion sesuai preferensi sistem.
- Informasi penting tidak hanya dibedakan melalui warna.
- Konten penting tetap tersedia tanpa 3D.

## 15.4 Responsive

Uji minimal pada:
- Desktop lebar.
- Laptop.
- Tablet.
- Ponsel portrait dan landscape.

Jangan sekadar mengecilkan layout desktop. Tentukan panel mana yang menjadi drawer, stack, tab, atau disembunyikan pada layar kecil tanpa menghilangkan akses ke fungsi penting.

---

# 18. Testing dan Quality Assurance

## 16.1 Tingkatan test

### Unit test
Untuk:
- Domain rules.
- Task status transitions.
- Perhitungan progres.
- Validasi input.
- Transformasi data.
- Format metrik dan status stale.

### Integration test
Untuk:
- API dan database.
- Permission.
- Transaksi perubahan task dan activity.
- Notification creation.
- Realtime authorization.
- Monitoring endpoint.

### End-to-end test
Untuk alur penting:
1. Membuka dashboard.
2. Membuat tugas.
3. Mengubah status tugas.
4. Memverifikasi aktivitas.
5. Mengaitkan tugas dengan proyek.
6. Memastikan panel loading/error/empty bekerja.
7. Menguji login dan akses yang ditolak bila autentikasi tersedia.
8. Memeriksa layout pada viewport berbeda.
9. Menguji fallback saat scene 3D gagal.
10. Memastikan satu aksi tidak menghasilkan toast ganda.

## 16.2 Regression testing

Sebelum dan sesudah setiap perubahan:
- Jalankan test terkait.
- Jalankan type-check/lint/build jika tersedia dan relevan.
- Uji alur fitur yang terdampak.
- Periksa console error.
- Periksa network failure.
- Periksa layout pada ukuran layar yang relevan.
- Bandingkan dengan baseline.

Jangan mengubah atau menghapus test hanya agar build hijau. Jika test memang usang, jelaskan bukti, perubahan perilaku yang diharapkan, dan dampaknya.

## 16.3 Format laporan QA

```text
QA REPORT
- Scope:
- Environment:
- Commit/working tree:
- Commands executed:
- Unit tests: PASS / FAIL / BLOCKED / NOT RUN
- Integration tests: PASS / FAIL / BLOCKED / NOT RUN
- E2E tests: PASS / FAIL / BLOCKED / NOT RUN
- Build/type-check/lint:
- Regression findings:
- Security findings:
- Evidence:
- Known limitations:
- Recommendation: ACCEPT / REJECT / BLOCKED
```

Setiap `PASS` harus memiliki command atau bukti yang dapat diperiksa. `NOT RUN` bukan `PASS`.

---

# 19. Observability dan Logging

- Gunakan log terstruktur jika sesuai dengan stack.
- Sertakan correlation/request ID bila memungkinkan.
- Pisahkan log aplikasi dari metrik teknis.
- Redaksi credential, token, cookie, dan data pribadi.
- Tangani error terpusat tanpa menghilangkan konteks yang dibutuhkan untuk diagnosis.
- Catat operasi penting dengan actor, target, waktu, dan hasil, sesuai kebutuhan audit.
- Hindari logging berlebihan dari render loop 3D.
- Tentukan retensi log dan metrik.
- Dashboard harus dapat membedakan `0`, `unknown`, `stale`, dan `unavailable`.

---

# 20. Deployment dan Operasional

Sesuaikan dengan infrastruktur repository yang sudah digunakan.

## 18.1 Lingkungan

- Development.
- Test/CI.
- Staging jika tersedia.
- Production.

## 18.2 Persyaratan operasional

- Konfigurasi per lingkungan.
- Secret tidak masuk repository.
- Health/readiness check jika backend mendukung.
- Migration memiliki prosedur dan rollback/mitigasi.
- Backup database dan uji pemulihan bila data penting.
- Error monitoring sesuai infrastruktur.
- Cache headers untuk aset statis.
- Kompresi aset dan optimasi bundle.
- Versi aset 3D yang terkontrol.
- Rencana rollback deployment.
- Dokumentasi setup lokal dan troubleshooting.

Jangan melakukan deploy atau mengubah production hanya karena perintah tersedia. Dapatkan otorisasi eksplisit dan verifikasi target lingkungan terlebih dahulu.

---

# 21. Strategi Implementasi Bertahap

Jangan implementasikan semua modul dalam satu prompt atau satu perubahan besar.

## Phase 0 — Audit dan baseline

**Hasil:**
- Peta repository.
- Inventaris fitur.
- Baseline test/build.
- Risiko dan dependensi.
- Keputusan arsitektur yang sudah diverifikasi.

**Gate:** tidak ada implementasi besar sebelum audit selesai dan blocker utama dipahami.

## Phase 1 — Architecture and design system

**Hasil:**
- Batas modul.
- Design tokens.
- App shell.
- Navigasi dan layout responsif.
- Komponen bersama yang benar-benar diperlukan.

**Gate:** aplikasi tetap berjalan dan route/fitur lama tidak rusak.

## Phase 2 — Core domain modules

Urutan yang disarankan:
1. Task.
2. Project.
3. Team.
4. Activity.
5. Notification.

Urutan final harus mengikuti dependensi nyata repository.

**Gate:** CRUD, validasi, authorization, empty/error/loading state, dan test dasar berfungsi.

## Phase 3 — Dashboard integration

**Hasil:**
- Summary berdasarkan data nyata.
- Kartu metrik.
- Activity feed.
- Team/presence panel.
- Error isolation per widget.

**Gate:** angka ringkasan konsisten dengan sumber data.

## Phase 4 — Real-time and monitoring

**Hasil:**
- Event penting.
- Reconnect dan resync.
- Presence.
- Server metrics collector yang aman.
- Timestamp dan status stale.

**Gate:** koneksi putus tidak membuat dashboard macet; akses metrik terotorisasi.

## Phase 5 — 3D workspace

**Hasil:**
- Scene dasar.
- Asset loading.
- Karakter dan objek.
- View-model mapping.
- Interaksi yang memanggil aksi aplikasi.
- Auto-tour.
- Fallback 2D.

**Gate:** fungsi bisnis tetap berjalan ketika 3D gagal atau dinonaktifkan.

## Phase 6 — Hardening and release readiness

**Hasil:**
- Regression suite.
- Accessibility/responsive checks.
- Performance profiling.
- Security review.
- Dokumentasi.
- Deployment plan.

**Gate:** tidak ada blocker kritis; sisa risiko dilaporkan secara eksplisit.

---

# 22. Arsitektur Workflow Multi-Agent AI CLI

Gunakan model multi-agent hanya jika runtime Antigravity yang tersedia benar-benar mendukung mekanisme agent tersebut. Jangan mengarang konfigurasi, nama file, atau kemampuan CLI. Verifikasi dokumentasi lokal/CLI dan repository sebelum menyiapkan konfigurasi.

## 20.1 Peran

### Orchestrator
- Membaca tujuan dan konteks.
- Memecah pekerjaan.
- Menetapkan dependensi dan acceptance criteria.
- Menjaga shared task state.
- Mengarahkan kegagalan ke agent yang tepat.
- Menentukan apakah pekerjaan diterima.

### Planner
- Memeriksa repository dan scope.
- Membuat rencana perubahan kecil.
- Mengidentifikasi file dan dependensi yang terdampak.
- Menentukan test dan risiko sebelum implementasi.
- Tidak menyatakan implementasi selesai.

### Executor
- Mengimplementasikan satu scope yang disetujui.
- Mematuhi pola kode dan kontrak yang ada.
- Tidak melakukan refactor tidak terkait.
- Menjalankan pemeriksaan lokal yang relevan.
- Melaporkan file yang berubah dan hasil command.

### QA/Reviewer
- Memeriksa acceptance criteria secara independen.
- Menjalankan test yang tersedia.
- Memeriksa regresi, error, keamanan, dan konsistensi UI.
- Tidak menganggap klaim Executor sebagai bukti.
- Memberikan PASS, FAIL, atau BLOCKED dengan alasan.

### DevOps
- Memeriksa konfigurasi build, environment, CI, deployment, dan observability.
- Tidak mengubah production tanpa otorisasi.
- Tidak menampilkan secret.
- Menguji prosedur operasional yang berada dalam scope.

## 20.2 Alur wajib

```text
Request
  ↓
Orchestrator: define scope and acceptance criteria
  ↓
Planner: inspect evidence and prepare plan
  ↓
Orchestrator: approve plan
  ↓
Executor: implement scoped change
  ↓
QA/Reviewer: independently verify
  ├── PASS → Orchestrator decides ACCEPTED
  ├── FAIL → Return findings to Planner/Executor
  └── BLOCKED → Identify missing dependency/decision
  ↓
Regression check
  ↓
Final report with evidence
```

## 20.3 Aturan koordinasi

- Simpan status tugas pada artefak yang disepakati, bukan hanya dalam percakapan.
- Setiap task memiliki ID, scope, owner, status, acceptance criteria, bukti, dan risiko.
- Jangan izinkan dua agent mengedit file yang sama secara paralel tanpa pembagian yang aman.
- Batasi retry; setiap retry harus berdasarkan temuan konkret.
- Jika kegagalan berulang, hentikan dan laporkan blocker, jangan mengulang secara membabi buta.
- QA harus memeriksa hasil aktual.
- Hanya Orchestrator yang dapat menetapkan status akhir `ACCEPTED`.
- Agent tidak boleh mengklaim tool atau test berhasil tanpa output yang relevan.

## 20.4 Status tugas standar

- `PROPOSED`
- `PLANNING`
- `READY`
- `IN_PROGRESS`
- `IN_REVIEW`
- `CHANGES_REQUESTED`
- `BLOCKED`
- `ACCEPTED`

`ACCEPTED` memerlukan acceptance criteria terpenuhi dan bukti tersedia. Jika tidak, status harus tetap lain yang sesuai.

## 20.5 Task record

```yaml
id: CC-001
title: "Deskripsi singkat"
status: PROPOSED
owner: Planner
scope:
  - "Bagian yang boleh diubah"
out_of_scope:
  - "Bagian yang tidak boleh diubah"
dependencies: []
acceptance_criteria:
  - "Kriteria yang bisa diuji"
tests:
  - "Command atau skenario pengujian"
evidence: []
risks: []
decision: null
```

Gunakan YAML/Markdown/format yang memang cocok dengan workflow proyek. Jangan menambahkan database task baru hanya untuk mencatat pekerjaan AI jika file sederhana sudah cukup.

---

# 23. Definition of Ready dan Definition of Done

## 21.1 Definition of Ready

Pekerjaan boleh mulai jika:
- Scope jelas.
- File/area terkait sudah diidentifikasi.
- Dependensi diketahui.
- Acceptance criteria dapat diuji.
- Risiko dan hal di luar scope dicatat.
- Tidak ada konflik yang belum terselesaikan dengan perubahan pengguna.

## 21.2 Definition of Done

Pekerjaan baru dapat direkomendasikan untuk diterima jika:
- Implementasi sesuai acceptance criteria.
- Tidak ada perubahan tidak terkait yang tidak dijelaskan.
- Test relevan telah dijalankan.
- Build/type-check/lint dijalankan jika tersedia dan relevan.
- Regresi pada fungsi terdampak diperiksa.
- Error/loading/empty state ditangani.
- Keamanan dan akses diperiksa jika relevan.
- Dokumentasi diperbarui bila perilaku atau setup berubah.
- Bukti tersedia.
- Keterbatasan dan test yang belum dijalankan dicatat.
- Orchestrator menetapkan status akhir.

---

# 24. Risiko Utama dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| AI mengganti stack tanpa alasan | Kerusakan dan pekerjaan ulang | Audit-first dan approval arsitektur |
| Semua modul dibangun sekaligus | Sulit dilacak dan diuji | Fase kecil dengan gate |
| 3D terlalu berat | UI lambat, terutama di ponsel | Lazy loading, profiling, fallback 2D |
| Data dashboard tidak konsisten | Angka menyesatkan | Satu sumber kebenaran dan kontrak API |
| Toast ganda | UX mengganggu | Satu pemilik notifikasi per aksi |
| Status online palsu | Informasi tim tidak akurat | Heartbeat, expiry, dan timestamp |
| Metrik stale dianggap aktual | Keputusan keliru | Timestamp dan status stale/unavailable |
| WebSocket putus | UI tidak sinkron | Reconnect, backoff, resync |
| Agent mengedit file yang sama | Konflik kode | Scope file dan koordinasi eksplisit |
| Klaim test tanpa bukti | Bug masuk ke hasil akhir | Evidence-based QA |
| Refactor terlalu luas | Regresi fitur | Minimal diff dan regression baseline |
| Secret masuk log/source | Insiden keamanan | Redaksi, secret manager, review |
| Aset 3D berlisensi tidak jelas | Risiko legal | Catat sumber dan lisensi |

---

# 25. Daftar Acceptance Criteria Produk

## Dashboard
- [ ] Menampilkan ringkasan berdasarkan data aktual.
- [ ] Loading, empty, error, dan stale state dapat dibedakan.
- [ ] Kegagalan satu widget tidak merusak seluruh halaman.
- [ ] Angka ringkasan konsisten dengan modul sumber.

## Tasks
- [ ] Create/read/update berjalan sesuai permission.
- [ ] Status transition divalidasi.
- [ ] Perubahan penting tercatat.
- [ ] Error API terlihat dengan jelas.
- [ ] Operasi gagal tidak memberi feedback sukses palsu.

## AI Team / Agents
- [ ] Semua anggota Team yang divisualisasikan adalah agent AI/LLM atau instance eksekusinya, bukan manusia.
- [ ] Identitas agent stabil dan dipisahkan dari AgentRun.
- [ ] Model/provider yang ditampilkan cocok dengan konfigurasi atau run aktual.
- [ ] Runtime status berasal dari orchestrator/heartbeat yang nyata.
- [ ] Status idle, queued, running, failed, dan unavailable dibedakan dengan jelas.
- [ ] Riwayat run dan hasil/error dapat ditelusuri tanpa membocorkan prompt rahasia atau secret.
- [ ] Akses ke agent, konfigurasi, dan riwayat run dibatasi menurut authorization.
- [ ] Human users/operator disimpan dan ditampilkan terpisah dari AI Team.

## Projects
- [ ] Task-project relation konsisten.
- [ ] Progres mengikuti rumus yang terdokumentasi.
- [ ] Deadline dan status ditampilkan konsisten.

## Activity dan notifications
- [ ] Event tidak dibuat dua kali oleh satu aksi normal.
- [ ] Timestamp konsisten.
- [ ] Notifikasi dapat ditandai dibaca jika fitur tersebut diimplementasikan.
- [ ] Payload tidak mengandung secret.

## Monitoring
- [ ] Metrik berasal dari collector tepercaya.
- [ ] Unit dan waktu pengukuran terlihat.
- [ ] Status stale/unavailable dibedakan dari nilai nol.
- [ ] Frontend tidak mengakses host secara langsung.

## 3D workspace
- [ ] Scene dapat dimuat secara terpisah.
- [ ] Aset gagal dimuat tidak membuat aplikasi blank.
- [ ] Data karakter berasal dari application state.
- [ ] Interaksi menjalankan aksi aplikasi yang terdefinisi.
- [ ] Ada fallback 2D untuk informasi penting.
- [ ] Resource dibersihkan ketika scene dilepas.

## UI/UX
- [ ] Responsive pada viewport utama.
- [ ] Keyboard focus dan label aksesibel.
- [ ] Tidak ada toast ganda untuk satu aksi.
- [ ] Tidak ada overflow/clipping yang menghalangi fungsi.
- [ ] Tema dan design tokens konsisten.

## Operasional dan keamanan
- [ ] Tidak ada secret di source/log.
- [ ] Permission diperiksa di server.
- [ ] Test dan build dilaporkan dengan bukti.
- [ ] Setup dan konfigurasi terdokumentasi.
- [ ] Risiko yang belum selesai ditulis.

---

# 26. Dokumen Turunan yang Disarankan

Setelah audit dan setelah keputusan disetujui, AI CLI dapat membuat atau memperbarui dokumen berikut. Hindari duplikasi jika proyek sudah punya padanannya.

```text
docs/
├── architecture/
│   ├── CURRENT_STATE.md
│   ├── SYSTEM_ARCHITECTURE.md
│   ├── ARCHITECTURE_DECISIONS.md
│   ├── DATA_MODEL.md
│   └── API_CONTRACTS.md
├── development/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── AGENT_WORKFLOW.md
│   └── TEST_STRATEGY.md
├── operations/
│   ├── ENVIRONMENT.md
│   ├── DEPLOYMENT.md
│   ├── MONITORING.md
│   └── SECURITY.md
└── quality/
    ├── REGRESSION_BASELINE.md
    └── QA_REPORT_TEMPLATE.md
```

Jangan membuat semua dokumen di atas sekaligus jika sebagian besar informasinya masih belum diketahui. Buat dokumen berdasarkan bukti dan tahap pekerjaan.

---

# 27. Prompt Utama untuk Antigravity CLI

Gunakan teks berikut sebagai instruksi awal setelah file ini ditempatkan di repository atau diberikan sebagai konteks kepada CLI.

```text
Baca seluruh dokumen rancangan AI Command Center ini terlebih dahulu.

MODE KERJA: AUDIT FIRST. Jangan langsung mengimplementasikan semua fitur.

TUJUAN:
Membangun atau menyempurnakan Command Center berdasarkan rancangan ini, dengan mempertahankan fungsionalitas repository yang sudah ada.

ATURAN WAJIB:
1. Audit repository dan identifikasi stack aktual sebelum mengubah file.
2. Periksa status Git dan jangan menimpa perubahan pengguna.
3. Jangan mengasumsikan endpoint, database, dependency, file, atau command yang belum diverifikasi.
4. Jangan mengganti stack atau melakukan rewrite besar tanpa bukti dan persetujuan.
5. Buat baseline fitur dan pengujian sebelum perubahan.
6. Pisahkan fakta VERIFIED, INFERRED, UNKNOWN, dan BLOCKED.
7. Rencanakan implementasi bertahap dengan acceptance criteria yang dapat diuji.
8. Jangan mengimplementasikan semua fase sekaligus.
9. Gunakan agent Planner, Executor, QA/Reviewer, dan DevOps hanya jika benar-benar didukung oleh runtime yang tersedia. Verifikasi konfigurasi dan kemampuan Antigravity sebelum membuat agent config.
10. QA harus memverifikasi hasil secara independen. NO EVIDENCE = NO ACCEPTANCE.
11. Jangan mengklaim test/build/lint/type-check berhasil kecuali command telah dijalankan dan hasilnya diperiksa.
12. Jangan mengubah production, menghapus data, melakukan migration destruktif, atau mengirim perubahan eksternal tanpa otorisasi yang diperlukan.
13. Jangan mengekspos secret atau data pribadi.
14. Hindari refactor di luar scope dan pertahankan fitur lama.
15. Hanya Orchestrator yang boleh menetapkan status akhir ACCEPTED.

LANGKAH PERTAMA:
A. Inspeksi repository secara read-only.
B. Identifikasi framework, package manager, command, route, modul, database, auth, test, dan integrasi yang sudah ada.
C. Jalankan baseline checks yang aman dan tersedia; jangan mengubah data.
D. Buat laporan audit dengan fakta dan bukti.
E. Buat daftar fitur yang wajib dipertahankan dan risiko regresi.
F. Buat IMPLEMENTATION_PLAN.md yang berisi fase, dependensi, scope, file/area terdampak, acceptance criteria, test, risiko, dan rollback/mitigasi.
G. Laporkan temuan dan rencana sebelum melakukan perubahan arsitektur besar.

JANGAN MULAI IMPLEMENTASI BESAR SEBELUM TAHAP AUDIT SELESAI.
Jika ada keputusan penting yang tidak dapat disimpulkan dari repository, ajukan pertanyaan yang spesifik. Jangan menutupi ketidakpastian dengan asumsi.
```

---

# 28. Format Laporan Setiap Tahap

Minta AI CLI selalu melaporkan hasil dengan format:

```text
PHASE REPORT
- Phase:
- Status: PASS / FAIL / BLOCKED / NOT STARTED
- Scope:
- Repository/branch:
- Files inspected:
- Files changed:
- Decisions and evidence:
- Commands executed:
- Test results:
- Regression checks:
- Security considerations:
- Known limitations:
- Unresolved questions:
- Rollback/mitigation:
- Next recommended step:
```

Jangan menerima laporan yang hanya berbunyi “selesai” atau “semua berjalan baik” tanpa daftar perubahan dan bukti.

---

# 29. Keputusan yang Masih Harus Divalidasi

Dokumen ini sengaja tidak mengunci teknologi yang belum diketahui. Setelah audit, validasi:

1. Apakah ini repository baru atau proyek yang sudah berjalan?
2. Stack frontend/backend yang benar-benar digunakan.
3. Database dan pola migration.
4. Sistem autentikasi dan role.
5. Apakah data agent/model/provider/task/project sudah tersedia.
6. Apakah monitoring server harus membaca host, container, atau layanan eksternal.
7. Runtime/orchestrator mana yang menjalankan agent, bagaimana agent dipanggil, dan bagaimana status run diverifikasi.
7. Apakah real-time diperlukan untuk semua modul atau hanya bagian tertentu.
8. Teknologi 3D dan target perangkat.
9. Sumber dan lisensi aset 3D.
10. Apakah dokumen perlu upload file atau hanya metadata.
11. Apakah multi-workspace diperlukan.
12. Kemampuan agent orchestration yang benar-benar tersedia pada runtime Antigravity.

Setiap keputusan harus mencatat opsi, bukti, konsekuensi, dan alasan pemilihan. Jangan membuat keputusan permanen hanya karena satu opsi lebih familiar bagi model.

---

# 30. Prinsip Penutup

Bangun sistem dari fondasi yang dapat diuji, bukan dari tampilan yang paling mencolok.

Urutan prioritas:

1. Kebenaran data dan perilaku bisnis.
2. Stabilitas dan perlindungan fitur yang sudah ada.
3. Arsitektur modular dan kontrak yang jelas.
4. UI/UX yang konsisten serta mudah digunakan.
5. Real-time dan monitoring yang dapat dipercaya.
6. Workspace 3D yang responsif dan dapat gagal secara graceful.
7. Otomasi pengujian, observability, keamanan, dan dokumentasi.

**Target akhir:** aplikasi Command Center yang bukan hanya menyerupai referensi visual, tetapi memiliki fondasi teknis yang terukur, dapat dipelihara, aman, dan bisa dikembangkan oleh AI CLI tanpa mengorbankan fungsionalitas yang telah ada.
