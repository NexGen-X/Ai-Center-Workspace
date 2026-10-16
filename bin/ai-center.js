#!/usr/bin/env node

/**
 * AI Agent Command Center — Executable CLI Controller
 * Autonomous Swarm OS & 3D Spatial Command Bridge
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import readline from 'readline/promises';
import dotenv from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Load package metadata
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));

// Resolve system/user configuration directories
const SYSTEM_CONFIG_DIR = '/etc/ai-center';
const SYSTEMD_SERVICE_FILE = '/etc/systemd/system/ai-center.service';
const USER_CONFIG_DIR = path.join(os.homedir(), '.ai-center');
const DAEMON_PID_FILE = path.join(USER_CONFIG_DIR, 'ai-center.pid');
const DAEMON_LOG_FILE = path.join(USER_CONFIG_DIR, 'ai-center.log');

// Try loading environment files in order of precedence:
// 1. Process environment (already set)
// 2. Local .env in CWD
// 3. /etc/ai-center/ai-center.env
// 4. ~/.ai-center/.env
if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}
if (fs.existsSync(path.join(SYSTEM_CONFIG_DIR, 'ai-center.env'))) {
  dotenv.config({ path: path.join(SYSTEM_CONFIG_DIR, 'ai-center.env') });
}
if (fs.existsSync(path.join(USER_CONFIG_DIR, '.env'))) {
  dotenv.config({ path: path.join(USER_CONFIG_DIR, '.env') });
}

// Arguments parsing
const rawArgs = process.argv.slice(2);

// Extract options
const portIndex = rawArgs.findIndex(a => a === '-p' || a === '--port');
let overridePort = portIndex !== -1 && rawArgs[portIndex + 1] ? rawArgs[portIndex + 1] : null;

const dbIndex = rawArgs.findIndex(a => a === '-d' || a === '--db');
let overrideDb = dbIndex !== -1 && rawArgs[dbIndex + 1] ? rawArgs[dbIndex + 1] : null;

const targetPort = parseInt(overridePort || process.env.PORT || '3000', 10);
const targetDbUrl = overrideDb || process.env.DATABASE_URL || 'postgres://routex:a8ad6064dad32fc6ec79f0378d6b8c1e@127.0.0.1:5432/ai_center?sslmode=disable';

// Filter non-flag command word
const command = rawArgs.find(a => !a.startsWith('-')) || null;

// Helpers
function printBanner() {
  console.log(`
\x1b[36m    _    ___    ____                      _           
   / \\  |_ _|  / ___|___  _ __ ___  _ __ | | ___ _ __ 
  / _ \\  | |  | |   / _ \\| '_ \` _ \\| '_ \\| |/ _ \\ '__|
 / ___ \\ | |  | |__| (_) | | | | | | |_) | |  __/ |   
/_/   \\_\\___|  \\____\\___/|_| |_| |_| .__/|_|\\___|_|   
                                   |_|                \x1b[0m
  \x1b[1m\x1b[35mAI Agent Command Center\x1b[0m • \x1b[32mv${pkg.version}\x1b[0m
  \x1b[90mAutonomous Multi-Agent Swarm OS & 3D Spatial Command Bridge\x1b[0m
`);
}

function printHelp() {
  printBanner();
  console.log(`\x1b[1mPENGGUNAAN:\x1b[0m
  ai-center [command] [options]
  npx ai-agent-command-center [command] [options]

\x1b[1mPERINTAH UTAMA:\x1b[0m
  \x1b[36mstart\x1b[0m         Jalankan server di latar belakang (daemon & autostart saat VPS reboot)
  \x1b[36mstop\x1b[0m          Hentikan AI Agent Command Center
  \x1b[36mrestart\x1b[0m       Muat ulang server AI Agent Command Center
  \x1b[36mstatus\x1b[0m        Cek status server, port, PID, database, dan health check
  \x1b[36mlogs\x1b[0m          Streaming log server secara real-time
  \x1b[36mreset-admin\x1b[0m   Reset kredensial email & password darurat via terminal
  \x1b[36mrun-server\x1b[0m    Jalankan server langsung di foreground (digunakan oleh daemon)

\x1b[1mOPSI:\x1b[0m
  -p, --port <number>   Menentukan port server (default: 3000 atau env PORT)
  -d, --db <url>        PostgreSQL connection string (env DATABASE_URL)
  -v, --version         Tampilkan versi aplikasi
  -h, --help            Tampilkan panduan bantuan ini

\x1b[1mCONTOH PENGGUNAAN:\x1b[0m
  $ ai-center start
  $ ai-center status
  $ ai-center logs
  $ ai-center reset-admin
  $ ai-center stop
`);
}

async function getPublicIp() {
  try {
    const res = await fetch('https://api.ipify.org?format=json', {
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      return data.ip;
    }
  } catch {}
  return null;
}

function checkPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function checkHealth(port, timeoutMs = 1500) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/healthz`, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
}

function isSystemdSupported() {
  if (process.platform !== 'linux') return false;
  try {
    execSync('systemctl is-system-running 2>/dev/null', { stdio: 'ignore' });
    return true;
  } catch {
    return fs.existsSync('/run/systemd/system');
  }
}

function canWriteSystemd() {
  try {
    fs.accessSync('/etc/systemd/system', fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

// -------------------------------------------------------------
// Subcommand Implementations
// -------------------------------------------------------------

async function handleStart() {
  printBanner();
  console.log(`\x1b[36m[AI Center]\x1b[0m Memeriksa kesiapan lingkungan...`);

  // 1. Check if already running
  const isPortActive = await checkPortOpen(targetPort);
  if (isPortActive) {
    const health = await checkHealth(targetPort);
    if (health) {
      console.log(`\x1b[32m✔ AI Agent Command Center sudah aktif berjalan di latar belakang pada port ${targetPort}!\x1b[0m`);
      const publicIp = await getPublicIp();
      console.log(`  \x1b[36m➜ Local:\x1b[0m   http://localhost:${targetPort}`);
      if (publicIp) {
        console.log(`  \x1b[36m➜ Public:\x1b[0m  http://${publicIp}:${targetPort}`);
      }
      console.log(`\nGunakan \x1b[1mai-center status\x1b[0m untuk info lengkap atau \x1b[1mai-center logs\x1b[0m untuk streaming log.`);
      return;
    }
  }

  // 2. Prepare Config & Service
  const useSystemd = isSystemdSupported() && canWriteSystemd();

  if (useSystemd) {
    console.log(`\x1b[36m[AI Center]\x1b[0m Mengonfigurasi systemd background service & autostart saat reboot...`);
    try {
      if (!fs.existsSync(SYSTEM_CONFIG_DIR)) {
        fs.mkdirSync(SYSTEM_CONFIG_DIR, { recursive: true });
      }

      const envContent = `PORT=${targetPort}\nDATABASE_URL=${targetDbUrl}\nNODE_ENV=production\n`;
      fs.writeFileSync(path.join(SYSTEM_CONFIG_DIR, 'ai-center.env'), envContent, 'utf-8');

      const serviceContent = `[Unit]
Description=AI Agent Command Center - Autonomous Swarm OS
After=network.target postgresql.service
Wants=network.target

[Service]
Type=simple
User=${os.userInfo().username || 'root'}
WorkingDirectory=${packageRoot}
ExecStart=${process.execPath} ${path.resolve(packageRoot, 'bin/ai-center.js')} run-server
Restart=always
RestartSec=5
EnvironmentFile=-${SYSTEM_CONFIG_DIR}/ai-center.env
Environment=PORT=${targetPort}
Environment=DATABASE_URL=${targetDbUrl}
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
`;
      fs.writeFileSync(SYSTEMD_SERVICE_FILE, serviceContent, 'utf-8');

      execSync('systemctl daemon-reload');
      execSync('systemctl enable ai-center.service');
      execSync('systemctl restart ai-center.service');
      console.log(`\x1b[32m✔ Service ai-center.service berhasil didaftarkan dan diaktifkan (Autostart enabled).\x1b[0m`);
    } catch (err) {
      console.warn(`\x1b[33m[AI Center]\x1b[0m Konfigurasi systemd gagal (${err.message}). Beralih ke background daemon mode...`);
      launchBackgroundProcess();
    }
  } else {
    launchBackgroundProcess();
  }

  // 3. Wait for health check to confirm server is UP
  process.stdout.write(`\x1b[90mMembuka jalur komputasi server... \x1b[0m`);
  let isUp = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const health = await checkHealth(targetPort);
    if (health) {
      isUp = true;
      break;
    }
    process.stdout.write('.');
  }
  console.log('\n');

  if (isUp) {
    const publicIp = await getPublicIp();
    console.log(`\x1b[1m\x1b[32m===================================================================\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m✔ AI AGENT COMMAND CENTER BERJALAN DI LATAR BELAKANG (DAEMON)\x1b[0m`);
    console.log(`\x1b[1m\x1b[32m===================================================================\x1b[0m`);
    console.log(`  \x1b[1mStatus:\x1b[0m     \x1b[32m● ONLINE (Background Daemon)\x1b[0m`);
    console.log(`  \x1b[1mAutostart:\x1b[0m  \x1b[32m✔ ENABLED (Otomatis berjalan kembali saat VPS reboot)\x1b[0m`);
    console.log(`  \x1b[1mPort:\x1b[0m       \x1b[33m${targetPort}\x1b[0m`);
    console.log(`  \x1b[1mLocal:\x1b[0m      \x1b[36mhttp://localhost:${targetPort}\x1b[0m`);
    if (publicIp) {
      console.log(`  \x1b[1mPublic:\x1b[0m     \x1b[36m\x1b[4mhttp://${publicIp}:${targetPort}\x1b[0m \x1b[90m(Akses Browser Anda)\x1b[0m`);
    }
    console.log(`\n\x1b[1mPerintah Kontrol Cepat:\x1b[0m`);
    console.log(`  \x1b[36mai-center status\x1b[0m       Lihat status sistem & penggunaan sumber daya`);
    console.log(`  \x1b[36mai-center logs\x1b[0m         Streaming live logs`);
    console.log(`  \x1b[36mai-center stop\x1b[0m         Hentikan sistem`);
    console.log(`  \x1b[36mai-center reset-admin\x1b[0m  Reset kredensial login darurat`);
    console.log(`\x1b[90mTerminal Anda kini bebas digunakan untuk perintah lain.\x1b[0m\n`);
  } else {
    console.error(`\x1b[31m[AI Center] Server tidak merespons dalam 10 detik.\x1b[0m`);
    console.error(`Periksa log dengan: \x1b[1mai-center logs\x1b[0m`);
  }
}

function launchBackgroundProcess() {
  if (!fs.existsSync(USER_CONFIG_DIR)) {
    fs.mkdirSync(USER_CONFIG_DIR, { recursive: true });
  }

  const logFd = fs.openSync(DAEMON_LOG_FILE, 'a');
  const child = spawn(
    process.execPath,
    [path.resolve(packageRoot, 'bin/ai-center.js'), 'run-server'],
    {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: {
        ...process.env,
        PORT: String(targetPort),
        DATABASE_URL: targetDbUrl,
        NODE_ENV: 'production'
      }
    }
  );

  fs.writeFileSync(DAEMON_PID_FILE, String(child.pid), 'utf-8');
  child.unref();
  console.log(`\x1b[32m✔ Server diluncurkan sebagai proses latar belakang terpisah (PID: ${child.pid}).\x1b[0m`);
}

async function handleStop() {
  printBanner();
  console.log(`\x1b[36m[AI Center]\x1b[0m Menghentikan AI Agent Command Center...`);

  let stoppedAny = false;

  // 1. Stop systemd if present
  if (isSystemdSupported() && canWriteSystemd()) {
    try {
      execSync('systemctl stop ai-center.service 2>/dev/null', { stdio: 'ignore' });
      stoppedAny = true;
    } catch {}
  }

  // 2. Stop detached PID if present
  if (fs.existsSync(DAEMON_PID_FILE)) {
    try {
      const pid = parseInt(fs.readFileSync(DAEMON_PID_FILE, 'utf-8').trim(), 10);
      if (pid && !isNaN(pid)) {
        process.kill(pid, 'SIGTERM');
        stoppedAny = true;
      }
    } catch {}
    try {
      fs.unlinkSync(DAEMON_PID_FILE);
    } catch {}
  }

  // 3. Check if any process is still bound to targetPort and gracefully terminate
  try {
    const lsofOutput = execSync(`lsof -ti :${targetPort} 2>/dev/null || true`).toString().trim();
    if (lsofOutput) {
      const pids = lsofOutput.split('\n').map(p => p.trim()).filter(Boolean);
      for (const p of pids) {
        const pidNum = parseInt(p, 10);
        if (pidNum && pidNum !== process.pid) {
          try {
            process.kill(pidNum, 'SIGTERM');
            stoppedAny = true;
          } catch {}
        }
      }
    }
  } catch {}

  // Wait a moment to ensure port releases
  await new Promise(r => setTimeout(r, 600));

  const stillOpen = await checkPortOpen(targetPort);
  if (stillOpen) {
    try {
      execSync(`fuser -k -n tcp ${targetPort} 2>/dev/null || true`, { stdio: 'ignore' });
    } catch {}
  }

  console.log(`\x1b[32m✔ AI Agent Command Center berhasil dihentikan.\x1b[0m Port ${targetPort} telah dilepaskan.\n`);
}

async function handleRestart() {
  printBanner();
  console.log(`\x1b[36m[AI Center]\x1b[0m Memulai ulang sistem...`);

  if (isSystemdSupported() && canWriteSystemd() && fs.existsSync(SYSTEMD_SERVICE_FILE)) {
    try {
      execSync('systemctl restart ai-center.service');
      console.log(`\x1b[32m✔ Perintah restart systemd dikirim.\x1b[0m`);
    } catch (err) {
      console.warn(`Gagal me-restart via systemd: ${err.message}. Melakukan siklus manual stop/start...`);
      await handleStop();
      await handleStart();
      return;
    }
  } else {
    await handleStop();
    await handleStart();
    return;
  }

  process.stdout.write(`\x1b[90mMemvalidasi pemulihan sistem... \x1b[0m`);
  let isUp = false;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const health = await checkHealth(targetPort);
    if (health) {
      isUp = true;
      break;
    }
    process.stdout.write('.');
  }
  console.log('\n');

  if (isUp) {
    const publicIp = await getPublicIp();
    console.log(`\x1b[32m✔ AI Agent Command Center berhasil dimuat ulang!\x1b[0m`);
    console.log(`  \x1b[36m➜ Local:\x1b[0m   http://localhost:${targetPort}`);
    if (publicIp) {
      console.log(`  \x1b[36m➜ Public:\x1b[0m  http://${publicIp}:${targetPort}`);
    }
    console.log('');
  } else {
    console.error(`\x1b[31m[AI Center] Gagal memverifikasi pemulihan server. Periksa status dengan: ai-center status\x1b[0m`);
  }
}

async function handleStatus() {
  printBanner();

  let serviceStatus = 'INACTIVE';
  let isAutostart = false;

  if (isSystemdSupported() && canWriteSystemd()) {
    try {
      const activeState = execSync('systemctl is-active ai-center.service 2>/dev/null').toString().trim();
      serviceStatus = activeState === 'active' ? 'ACTIVE' : activeState.toUpperCase();
    } catch {
      serviceStatus = 'STOPPED';
    }

    try {
      const enabledState = execSync('systemctl is-enabled ai-center.service 2>/dev/null').toString().trim();
      isAutostart = enabledState === 'enabled';
    } catch {
      isAutostart = false;
    }
  }

  const portActive = await checkPortOpen(targetPort);
  const health = await checkHealth(targetPort);
  const publicIp = await getPublicIp();

  console.log(`\x1b[1mSTATUS TELEMETRI SISTEM:\x1b[0m`);
  console.log(`-------------------------------------------------------------------`);
  console.log(`  \x1b[1mService State:\x1b[0m         ${health || portActive ? '\x1b[32m● ONLINE (Berjalan di latar belakang)\x1b[0m' : '\x1b[31m○ OFFLINE (Berhenti)\x1b[0m'}`);
  console.log(`  \x1b[1mAutostart on Reboot:\x1b[0m   ${isAutostart ? '\x1b[32m✔ AKTIF (systemd autostart enabled)\x1b[0m' : '\x1b[33m○ NONAKTIF\x1b[0m'}`);
  console.log(`  \x1b[1mBinding Port:\x1b[0m          \x1b[33m0.0.0.0:${targetPort}\x1b[0m (${portActive ? '\x1b[32mLISTENING\x1b[0m' : '\x1b[31mFREE\x1b[0m'})`);

  if (health) {
    console.log(`  \x1b[1mDatabase Connectivity:\x1b[0m \x1b[32m✔ ${health.database?.toUpperCase() || 'CONNECTED'} (Latency: ${health.dbLatencyMs ?? 0}ms)\x1b[0m`);
    console.log(`  \x1b[1mServer Uptime:\x1b[0m         ${health.uptimeSeconds || 0} detik`);
  }

  console.log(`-------------------------------------------------------------------`);
  console.log(`  \x1b[1mLocal URL:\x1b[0m             \x1b[36mhttp://localhost:${targetPort}\x1b[0m`);
  if (publicIp) {
    console.log(`  \x1b[1mPublic URL:\x1b[0m            \x1b[36m\x1b[4mhttp://${publicIp}:${targetPort}\x1b[0m \x1b[90m(Cloud VPS)\x1b[0m`);
  }
  console.log(`-------------------------------------------------------------------`);

  if (health || portActive) {
    console.log(`\x1b[90mUntuk melihat live log server, jalankan: \x1b[1m\x1b[36mai-center logs\x1b[0m\n`);
  } else {
    console.log(`\x1b[90mUntuk menyalakan server di latar belakang, jalankan: \x1b[1m\x1b[32mai-center start\x1b[0m\n`);
  }
}

async function handleLogs() {
  if (isSystemdSupported() && canWriteSystemd() && fs.existsSync(SYSTEMD_SERVICE_FILE)) {
    console.log(`\x1b[36m[AI Center]\x1b[0m Membuka streaming live journal logs (Tekan \x1b[1mCtrl+C\x1b[0m untuk keluar):\n`);
    const logProcess = spawn('journalctl', ['-u', 'ai-center.service', '-f', '-n', '50'], {
      stdio: 'inherit'
    });
    logProcess.on('exit', () => process.exit(0));
  } else if (fs.existsSync(DAEMON_LOG_FILE)) {
    console.log(`\x1b[36m[AI Center]\x1b[0m Streaming log dari ${DAEMON_LOG_FILE} (Tekan \x1b[1mCtrl+C\x1b[0m untuk keluar):\n`);
    const logProcess = spawn('tail', ['-f', '-n', '50', DAEMON_LOG_FILE], {
      stdio: 'inherit'
    });
    logProcess.on('exit', () => process.exit(0));
  } else {
    console.log(`\x1b[33mBelum ada berkas log yang ditemukan.\x1b[0m Jalankan \x1b[1mai-center start\x1b[0m terlebih dahulu.`);
  }
}

async function handleResetAdmin() {
  printBanner();
  console.log(`\x1b[1m\x1b[33m[RESET KREDENSIAL DARURAT VIA CLI]\x1b[0m`);
  console.log(`Fitur ini digunakan jika Anda lupa email atau password akun administrator.`);
  console.log(`Kredensial akan langsung diinjeksi secara aman ke database lokal.\n`);

  let email = null;
  let password = null;
  let displayName = null;

  const emailIdx = rawArgs.findIndex(a => a === '--email');
  if (emailIdx !== -1 && rawArgs[emailIdx + 1]) email = rawArgs[emailIdx + 1].trim();

  const passIdx = rawArgs.findIndex(a => a === '--password' || a === '--pass');
  if (passIdx !== -1 && rawArgs[passIdx + 1]) password = rawArgs[passIdx + 1];

  const nameIdx = rawArgs.findIndex(a => a === '--name');
  if (nameIdx !== -1 && rawArgs[nameIdx + 1]) displayName = rawArgs[nameIdx + 1].trim();

  // If interactive terminal and missing args, prompt user
  if (!email || !password) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    try {
      if (!email) {
        email = (await rl.question('\x1b[36m➜ Masukkan Email Administrator Baru: \x1b[0m')).trim();
      }
      if (!displayName) {
        displayName = (await rl.question('\x1b[36m➜ Masukkan Nama Tampilan (default: Command Operator): \x1b[0m')).trim() || 'Command Operator';
      }
      if (!password) {
        password = (await rl.question('\x1b[36m➜ Masukkan Password Baru (min. 8 karakter): \x1b[0m')).trim();
      }
    } finally {
      rl.close();
    }
  }

  if (!email || !email.includes('@')) {
    console.error(`\x1b[31m[Error] Format email tidak valid.\x1b[0m`);
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error(`\x1b[31m[Error] Password minimal 8 karakter demi keamanan.\x1b[0m`);
    process.exit(1);
  }
  if (!displayName) {
    displayName = 'Command Operator';
  }

  console.log(`\n\x1b[90mMengkoneksikan ke database PostgreSQL... \x1b[0m`);
  const pool = new pg.Pool({ connectionString: targetDbUrl });

  try {
    const passHash = hashPassword(password);
    const lowerEmail = email.toLowerCase();

    // 1. Ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS human_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(128) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'OPERATOR',
        session_token VARCHAR(255),
        must_change_password BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Update existing admin or insert new
    const updateRes = await pool.query(`
      UPDATE human_users
      SET email = $1,
          display_name = $2,
          password_hash = $3,
          must_change_password = FALSE,
          session_token = NULL
      WHERE role = 'ADMIN' OR id = 'user-admin' OR id = 'usr-admin-default';
    `, [lowerEmail, displayName, passHash]);

    if (updateRes.rowCount === 0) {
      await pool.query(`
        INSERT INTO human_users (id, email, display_name, role, password_hash, must_change_password)
        VALUES ('user-admin', $1, $2, 'ADMIN', $3, FALSE)
        ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            must_change_password = FALSE,
            session_token = NULL;
      `, [lowerEmail, displayName, passHash]);
    }

    console.log(`\n\x1b[1m\x1b[32m✔ KREDENSIAL ADMINISTRATOR BERHASIL DIRESET!\x1b[0m`);
    console.log(`-------------------------------------------------------------------`);
    console.log(`  \x1b[1mEmail Login:\x1b[0m    \x1b[33m${lowerEmail}\x1b[0m`);
    console.log(`  \x1b[1mNama Operator:\x1b[0m  ${displayName}`);
    console.log(`  \x1b[1mStatus:\x1b[0m         \x1b[32mKredensial Baru Terverifikasi & Auto-Fill Terkunci Permanen\x1b[0m`);
    console.log(`-------------------------------------------------------------------`);
    console.log(`Silakan buka browser Anda dan login dengan email dan password baru tersebut.\n`);
  } catch (err) {
    console.error(`\x1b[31m[AI Center Error] Gagal mereset kredensial:\x1b[0m ${err.message}`);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// -------------------------------------------------------------
// Internal Foreground Server Runner (used by daemon/systemd)
// -------------------------------------------------------------
async function handleRunServer() {
  const serverModulePath = path.resolve(packageRoot, 'server/dist/server/src/index.js');
  if (!fs.existsSync(serverModulePath)) {
    console.error(`\x1b[31m[AI Center Error] Berkas server tidak ditemukan pada: ${serverModulePath}\x1b[0m`);
    console.error(`Jalankan 'npm run build' terlebih dahulu.`);
    process.exit(1);
  }

  process.env.PORT = String(targetPort);
  process.env.DATABASE_URL = targetDbUrl;

  try {
    await import(serverModulePath);
    console.log(`\x1b[32m✔ [AI Center Engine] Core Server siap melayani pada port ${targetPort} (0.0.0.0).\x1b[0m`);
  } catch (err) {
    console.error(`\x1b[31m[AI Center Startup Error]\x1b[0m`, err);
    process.exit(1);
  }
}

// -------------------------------------------------------------
// Interactive Menu Launcher (when typing just 'ai-center')
// -------------------------------------------------------------
async function showInteractiveMenu() {
  printBanner();
  console.log(`\x1b[1mPILIHAN KONTROL AI AGENT COMMAND CENTER:\x1b[0m`);
  console.log(`-------------------------------------------------------------------`);
  console.log(`  \x1b[36m1.\x1b[0m \x1b[1mai-center start\x1b[0m        Jalankan di latar belakang (daemon & reboot autostart)`);
  console.log(`  \x1b[36m2.\x1b[0m \x1b[1mai-center stop\x1b[0m         Hentikan AI Agent Command Center`);
  console.log(`  \x1b[36m3.\x1b[0m \x1b[1mai-center restart\x1b[0m      Muat ulang sistem`);
  console.log(`  \x1b[36m4.\x1b[0m \x1b[1mai-center status\x1b[0m       Cek status server, port, PID & database`);
  console.log(`  \x1b[36m5.\x1b[0m \x1b[1mai-center logs\x1b[0m         Streaming live logs`);
  console.log(`  \x1b[36m6.\x1b[0m \x1b[1mai-center reset-admin\x1b[0m  Reset email/password admin darurat`);
  console.log(`  \x1b[36m7.\x1b[0m \x1b[1mai-center --help\x1b[0m       Panduan lengkap perintah`);
  console.log(`  \x1b[33m0.\x1b[0m Keluar`);
  console.log(`-------------------------------------------------------------------`);

  if (!process.stdin.isTTY) {
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const choice = (await rl.question('\x1b[1mPilih opsi [0-7]: \x1b[0m')).trim();
  rl.close();

  switch (choice) {
    case '1':
    case 'start':
      await handleStart();
      break;
    case '2':
    case 'stop':
      await handleStop();
      break;
    case '3':
    case 'restart':
      await handleRestart();
      break;
    case '4':
    case 'status':
      await handleStatus();
      break;
    case '5':
    case 'logs':
      await handleLogs();
      break;
    case '6':
    case 'reset-admin':
      await handleResetAdmin();
      break;
    case '7':
    case 'help':
      printHelp();
      break;
    case '0':
    case 'exit':
      console.log(`Keluar.`);
      process.exit(0);
    default:
      console.log(`\x1b[31mOpsi tidak dikenal: "${choice}".\x1b[0m`);
      process.exit(1);
  }
}

// -------------------------------------------------------------
// Main Dispatcher
// -------------------------------------------------------------
async function main() {
  if (rawArgs.includes('-v') || rawArgs.includes('--version')) {
    console.log(`ai-agent-command-center v${pkg.version}`);
    process.exit(0);
  }

  if (rawArgs.includes('-h') || rawArgs.includes('--help')) {
    printHelp();
    process.exit(0);
  }

  switch (command) {
    case 'start':
      await handleStart();
      break;
    case 'stop':
      await handleStop();
      break;
    case 'restart':
      await handleRestart();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'logs':
      await handleLogs();
      break;
    case 'reset-admin':
      await handleResetAdmin();
      break;
    case 'run-server':
      await handleRunServer();
      break;
    case null:
    case undefined:
      await showInteractiveMenu();
      break;
    default:
      console.error(`\x1b[31mPerintah tidak dikenal: "${command}"\x1b[0m\n`);
      printHelp();
      process.exit(1);
  }
}

main().catch(err => {
  console.error(`\x1b[31m[AI Center Fatal Error]\x1b[0m`, err);
  process.exit(1);
});
