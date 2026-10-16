#!/usr/bin/env node

/**
 * AI Agent Command Center — Executable CLI Launcher
 * Autonomous Swarm OS & 3D Spatial Command Bridge
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

// Load package metadata
const pkg = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf-8'));

// CLI Arguments Parser
const args = process.argv.slice(2);

if (args.includes('-h') || args.includes('--help')) {
  console.log(`
\x1b[36m    _    ___    ____                      _           
   / \\  |_ _|  / ___|___  _ __ ___  _ __ | | ___ _ __ 
  / _ \\  | |  | |   / _ \\| '_ \` _ \\| '_ \\| |/ _ \\ '__|
 / ___ \\ | |  | |__| (_) | | | | | | |_) | |  __/ |   
/_/   \\_\\___|  \\____\\___/|_| |_| |_| .__/|_|\\___|_|   
                                   |_|                \x1b[0m
  \x1b[1m\x1b[35mAI Agent Command Center\x1b[0m • \x1b[32mv${pkg.version}\x1b[0m
  Autonomous Multi-Agent Swarm OS & 3D Spatial Command Bridge

\x1b[1mPENGGUNAAN:\x1b[0m
  npx ai-agent-command-center [command] [options]
  ai-center [command] [options]

\x1b[1mPERINTAH:\x1b[0m
  start               Menjalankan AI Agent Command Center (default)

\x1b[1mOPSI:\x1b[0m
  -p, --port <number> Menentukan port server (default: 3000 atau env PORT)
  -d, --db <url>      PostgreSQL connection string (env DATABASE_URL)
  --no-open           Jangan buka browser secara otomatis setelah server aktif
  -v, --version       Tampilkan versi aplikasi
  -h, --help          Tampilkan panduan bantuan ini

\x1b[1mCONTOH:\x1b[0m
  $ npx ai-agent-command-center start
  $ npx ai-agent-command-center --port 8080 --db "postgres://user:pass@localhost:5432/ai_center"
  $ DATABASE_URL="postgres://user:pass@localhost:5432/ai_center" npx ai-agent-command-center
`);
  process.exit(0);
}

if (args.includes('-v') || args.includes('--version')) {
  console.log(`ai-agent-command-center v${pkg.version}`);
  process.exit(0);
}

// Banner display
console.log(`
\x1b[36m    _    ___    ____                      _           
   / \\  |_ _|  / ___|___  _ __ ___  _ __ | | ___ _ __ 
  / _ \\  | |  | |   / _ \\| '_ \` _ \\| '_ \\| |/ _ \\ '__|
 / ___ \\ | |  | |__| (_) | | | | | | |_) | |  __/ |   
/_/   \\_\\___|  \\____\\___/|_| |_| |_| .__/|_|\\___|_|   
                                   |_|                \x1b[0m
  \x1b[1m\x1b[35mAI Agent Command Center\x1b[0m • \x1b[32mv${pkg.version}\x1b[0m
  \x1b[90mhttps://github.com/NexGen-X/Ai-Center-Workspace\x1b[0m
`);

// Parse options
const portIndex = args.findIndex(a => a === '-p' || a === '--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  process.env.PORT = args[portIndex + 1];
}

const dbIndex = args.findIndex(a => a === '-d' || a === '--db');
if (dbIndex !== -1 && args[dbIndex + 1]) {
  process.env.DATABASE_URL = args[dbIndex + 1];
}

const noOpen = args.includes('--no-open');

// Auto-load .env if present in CWD
const cwdEnvPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath });
}

// Environment Detection: Local Machine (Laptop/PC) vs Remote Server (VPS/Cloud)
function detectDeploymentEnvironment() {
  const isWindows = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const hasDisplay = Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);
  const isLocalDesktop = isWindows || isMac || hasDisplay;

  const interfaces = os.networkInterfaces();
  const networkIps = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        networkIps.push(iface.address);
      }
    }
  }

  return {
    isLocalDesktop,
    isRemoteVPS: !isLocalDesktop,
    networkIps
  };
}

const envInfo = detectDeploymentEnvironment();

// Database URL verification & fallback guidance
if (!process.env.DATABASE_URL) {
  console.warn(`\x1b[33m[AI Center] PERINGATAN: Variabel DATABASE_URL belum dikonfigurasi.\x1b[0m`);
  console.log(`\x1b[90mSistem membutuhkan PostgreSQL 16 dengan ekstensi pgvector.`);
  console.log(`Anda dapat menyediakannya melalui file .env atau parameter --db:`);
  console.log(`  npx ai-agent-command-center --db "postgres://user:pass@localhost:5432/ai_center"\x1b[0m\n`);
}

// Function to auto-open browser (strictly on local desktop with GUI display)
function openBrowser(targetUrl) {
  if (noOpen || envInfo.isRemoteVPS) return;
  const startCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

  exec(`${startCmd} ${targetUrl}`, () => {
    // Silently ignore failures on headless environments
  });
}

// Launch backend server
const port = process.env.PORT || 3000;
const localUrl = `http://localhost:${port}`;

async function launch() {
  try {
    const serverModulePath = path.resolve(packageRoot, 'server/dist/server/src/index.js');
    if (!fs.existsSync(serverModulePath)) {
      console.error(`\x1b[31m[AI Center Error] Berkas kompilasi server tidak ditemukan pada: ${serverModulePath}\x1b[0m`);
      console.error(`Silakan jalankan "npm run build" terlebih dahulu.`);
      process.exit(1);
    }

    // Import compiled server (auto binds to 0.0.0.0)
    await import(serverModulePath);

    console.log(`\n\x1b[1m\x1b[32m✔ AI Agent Command Center aktif & siap melayani:\x1b[0m`);
    console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mLocal:\x1b[0m   \x1b[4m${localUrl}\x1b[0m`);
    
    if (envInfo.networkIps.length > 0) {
      envInfo.networkIps.forEach(ip => {
        console.log(`  \x1b[36m➜\x1b[0m  \x1b[1mNetwork:\x1b[0m \x1b[4mhttp://${ip}:${port}\x1b[0m`);
      });
    }

    if (envInfo.isRemoteVPS) {
      console.log(`  \x1b[33m➜\x1b[0m  \x1b[1mMode:\x1b[0m    Remote Server / VPS (Headless — browser lokal dinonaktifkan)`);
    } else {
      console.log(`  \x1b[35m➜\x1b[0m  \x1b[1mMode:\x1b[0m    Local Desktop (Membuka browser otomatis...)`);
      setTimeout(() => {
        openBrowser(localUrl);
      }, 1500);
    }
    console.log('');
  } catch (err) {
    console.error(`\x1b[31m[AI Center Startup Error]\x1b[0m`, err);
    process.exit(1);
  }
}

launch();
