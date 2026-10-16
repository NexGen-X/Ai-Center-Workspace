#!/usr/bin/env node

/**
 * AI Agent Command Center — Executable CLI Launcher
 * Autonomous Swarm OS & 3D Spatial Command Bridge
 */

import path from 'path';
import fs from 'fs';
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

// Database URL verification & fallback guidance
if (!process.env.DATABASE_URL) {
  console.warn(`\x1b[33m[AI Center] PERINGATAN: Variabel DATABASE_URL belum dikonfigurasi.\x1b[0m`);
  console.log(`\x1b[90mSistem membutuhkan PostgreSQL 16 dengan ekstensi pgvector.`);
  console.log(`Anda dapat menyediakannya melalui file .env atau parameter --db:`);
  console.log(`  npx ai-agent-command-center --db "postgres://user:pass@localhost:5432/ai_center"\x1b[0m\n`);
}

// Function to auto-open browser
function openBrowser(targetUrl) {
  if (noOpen) return;
  const startCmd =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
      ? 'start'
      : 'xdg-open';

  exec(`${startCmd} ${targetUrl}`, (err) => {
    // Silently ignore if running on headless server without graphical display
  });
}

// Launch backend server
const port = process.env.PORT || 3000;
const serverUrl = `http://localhost:${port}`;

async function launch() {
  try {
    const serverModulePath = path.resolve(packageRoot, 'server/dist/server/src/index.js');
    if (!fs.existsSync(serverModulePath)) {
      console.error(`\x1b[31m[AI Center Error] Berkas kompilasi server tidak ditemukan pada: ${serverModulePath}\x1b[0m`);
      console.error(`Silakan jalankan "npm run build" terlebih dahulu.`);
      process.exit(1);
    }

    // Import compiled server
    await import(serverModulePath);

    console.log(`\x1b[32m[AI Center] Command Bridge siap diakses: \x1b[1m\x1b[4m${serverUrl}\x1b[0m`);
    
    // Slight delay before opening browser to ensure socket is bound
    setTimeout(() => {
      openBrowser(serverUrl);
    }, 1500);
  } catch (err) {
    console.error(`\x1b[31m[AI Center Startup Error]\x1b[0m`, err);
    process.exit(1);
  }
}

launch();
