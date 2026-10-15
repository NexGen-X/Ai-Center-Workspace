/**
 * Agent Action Sandbox & Execution Engine — AI Agent Command Center
 * Provides isolated, secure tool execution for autonomous AI agents with guardrails.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { ToolDefinition, ToolRiskLevel } from '../../../shared/types.js';
import { validateOutgoingUrl } from '../utils/ssrf.js';
import { systemLogger } from './logger.js';
import { RagService } from './ragService.js';
import { McpClientService } from './mcpClientService.js';

const execAsync = promisify(exec);

// Dedicated Sandbox directory within the workspace
export const SANDBOX_DIR = path.resolve(process.cwd(), 'sandbox');

// Ensure sandbox directory exists on initialization
if (!fs.existsSync(SANDBOX_DIR)) {
  try {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
  } catch (err: any) {
    console.error('[Sandbox] Failed to create sandbox directory:', err.message);
  }
}

// Blocklist for dangerous bash operations
const DANGEROUS_PATTERNS = [
  /rm\s+(-[rfRF]+\s+)?\/(?!\S)/,
  /rm\s+(-[rfRF]+\s+)?\/root(?!\S)/,
  /rm\s+(-[rfRF]+\s+)?\/etc/,
  /mkfs/,
  />\s*\/dev\/sd/,
  /dd\s+if=/,
  /:{\s*:\|:&\s*};:/,
  /chmod\s+(-R\s+)?777\s+\//,
  /shutdown/,
  /reboot/,
  /init\s+0/,
  /killall\s+-9/,
  /passwd/,
  /sudoers/
];

// Commands considered safe for read-only auto-approval
const SAFE_READONLY_COMMANDS = [
  /^ls(\s+-[a-zA-Z0-9]+)?(\s+[\w.-]+)?$/,
  /^pwd$/,
  /^date$/,
  /^echo\s+/,
  /^cat\s+[\w.-]+$/,
  /^git\s+(status|log|branch|diff)(\s+.*)?$/,
  /^node\s+-(v|-version)$/,
  /^npm\s+(test|-v|--version)$/,
  /^uname(\s+-a)?$/
];

export const AVAILABLE_TOOLS: Record<string, ToolDefinition> = {
  bash_exec: {
    name: 'bash_exec',
    description: 'Menjalankan perintah terminal Linux di direktori sandbox terisolasi dengan timeout 30 detik.',
    category: 'RUNTIME',
    riskLevel: 'HIGH',
    requiresApproval: true,
    parameters: {
      command: { type: 'string', description: 'Perintah shell yang akan dieksekusi', required: true },
      timeoutMs: { type: 'number', description: 'Timeout dalam milidetik (maks 30000ms)' }
    }
  },
  file_read: {
    name: 'file_read',
    description: 'Membaca konten file teks dari direktori proyek atau sandbox.',
    category: 'FILESYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      filePath: { type: 'string', description: 'Jalur relatif file dari root workspace atau sandbox', required: true }
    }
  },
  file_write: {
    name: 'file_write',
    description: 'Menulis atau membuat file teks baru di dalam folder sandbox.',
    category: 'FILESYSTEM',
    riskLevel: 'MEDIUM',
    requiresApproval: true,
    parameters: {
      filePath: { type: 'string', description: 'Nama file atau jalur relatif di folder sandbox', required: true },
      content: { type: 'string', description: 'Isi teks yang akan ditulis', required: true },
      append: { type: 'boolean', description: 'Jika true, menambahkan ke akhir file' }
    }
  },
  http_fetch: {
    name: 'http_fetch',
    description: 'Mengambil data dari URL publik HTTP/HTTPS dengan proteksi anti-SSRF.',
    category: 'NETWORK',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      url: { type: 'string', description: 'URL target publik (mis. API eksternal)', required: true },
      method: { type: 'string', description: 'Metode HTTP (GET/POST/PUT)' },
      headers: { type: 'object', description: 'Header HTTP kustom' },
      body: { type: 'string', description: 'Body request untuk POST/PUT' }
    }
  },
  system_inspect: {
    name: 'system_inspect',
    description: 'Memeriksa diagnostik telemetri server (CPU, RAM, Disk, Uptime) secara read-only.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      query: { type: 'string', description: 'Tipe diagnostik: metrics | uptime | memory' }
    }
  },
  knowledge_search: {
    name: 'knowledge_search',
    description: 'Mencari dokumen SOP, arsitektur, dan panduan teknis yang relevan menggunakan pencarian semantik vektor pgvector.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      query: { type: 'string', description: 'Konsep atau pertanyaan yang ingin dicari', required: true },
      limit: { type: 'number', description: 'Batas jumlah hasil (default 3)' }
    }
  },
  memory_store: {
    name: 'memory_store',
    description: 'Menyimpan wawasan, temuan fakta, atau preferensi ke memori jangka panjang agen.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      keyPoint: { type: 'string', description: 'Intisari informasi penting yang ingin disimpan', required: true },
      memoryType: { type: 'string', description: 'Tipe: EPISODIC | FACTUAL | PREFERENCE | GOAL' },
      importanceScore: { type: 'number', description: 'Tingkat kepentingan 0.1 hingga 1.0' }
    }
  },
  memory_search: {
    name: 'memory_search',
    description: 'Mencari memori jangka panjang masa lalu yang tersimpan terkait topik tertentu.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      query: { type: 'string', description: 'Topik memori yang dicari', required: true },
      limit: { type: 'number', description: 'Jumlah hasil maksimal (default 3)' }
    }
  },
  mcp_call: {
    name: 'mcp_call',
    description: 'Menjalankan tool eksternal dari server Model Context Protocol (MCP) yang terhubung.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      serverId: { type: 'string', description: 'ID MCP server tujuan', required: true },
      toolName: { type: 'string', description: 'Nama tool MCP yang akan dijalankan', required: true },
      arguments: { type: 'object', description: 'Argumen JSON untuk tool MCP' }
    }
  },
  web_search: {
    name: 'web_search',
    description: 'Mencari informasi, dokumentasi teknis, atau API publik secara langsung dari web.',
    category: 'NETWORK',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      query: { type: 'string', description: 'Kata kunci pencarian web', required: true },
      limit: { type: 'number', description: 'Jumlah hasil (maksimal 10)' }
    }
  },
  web_browse: {
    name: 'web_browse',
    description: 'Mengunjungi halaman web, membersihkan konten HTML dan mengubahnya menjadi Markdown.',
    category: 'NETWORK',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      url: { type: 'string', description: 'URL halaman web yang ingin dibaca', required: true },
      maxLength: { type: 'number', description: 'Batas panjang karakter teks Markdown' }
    }
  },
  web_research_and_ingest: {
    name: 'web_research_and_ingest',
    description: 'Melakukan riset mendalam di web dan otomatis menyimpan serta mengindeks hasilnya ke pgvector RAG.',
    category: 'NETWORK',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      query: { type: 'string', description: 'Topik riset web yang ingin diindeks ke RAG', required: true },
      documentTitle: { type: 'string', description: 'Judul dokumen hasil riset' }
    }
  },
  sre_scan: {
    name: 'sre_scan',
    description: 'Memindai metrik kesehatan server, konektivitas database, dan mendeteksi anomali insiden secara otonom.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      workspaceId: { type: 'string', description: 'ID workspace opsional' }
    }
  },
  sre_remediate: {
    name: 'sre_remediate',
    description: 'Mengeksekusi playbook pemulihan mandiri (self-healing) untuk memulihkan insiden SRE.',
    category: 'SYSTEM',
    riskLevel: 'HIGH',
    requiresApproval: true,
    parameters: {
      incidentId: { type: 'string', description: 'ID insiden SRE yang akan dipulihkan', required: true },
      operatorApproved: { type: 'boolean', description: 'Konfirmasi otorisasi operator' }
    }
  },
  data_analyze: {
    name: 'data_analyze',
    description: 'Menganalisis dataset (CSV, JSON, metrik sistem) secara otonom, menghitung statistik, dan menyusun spesifikasi visualisasi grafik.',
    category: 'SYSTEM',
    riskLevel: 'LOW',
    requiresApproval: false,
    parameters: {
      sourceType: { type: 'string', description: 'Tipe: CSV | JSON | TASK_ANALYTICS | SYSTEM_METRICS', required: true },
      queryPrompt: { type: 'string', description: 'Tujuan atau pertanyaan analisis data', required: true },
      rawData: { type: 'string', description: 'Data mentah CSV atau JSON (jika sourceType CSV/JSON)' },
      datasetName: { type: 'string', description: 'Nama dataset opsional' }
    }
  }
};

/**
 * Menentukan apakah perintah atau aksi memerlukan approval manusia
 */
export function evaluateActionRisk(toolName: string, input: Record<string, any>): {
  riskLevel: ToolRiskLevel;
  requiresApproval: boolean;
  reason?: string;
} {
  if (toolName.startsWith('mcp:') || toolName === 'mcp_call') {
    return {
      riskLevel: 'LOW',
      requiresApproval: false
    };
  }

  const tool = AVAILABLE_TOOLS[toolName];
  if (!tool) {
    return { riskLevel: 'HIGH', requiresApproval: true, reason: 'Tool tidak dikenal' };
  }

  // Khusus bash_exec: cek apakah perintah masuk daftar aman read-only
  if (toolName === 'bash_exec') {
    const cmd = String(input.command || '').trim();
    
    // Cek bahaya kritis
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(cmd)) {
        return {
          riskLevel: 'CRITICAL',
          requiresApproval: true,
          reason: 'Perintah terdeteksi mengandung pola berbahaya/destruktif bagi sistem.'
        };
      }
    }

    // Cek apakah perintah mengandung redirection file (>, <) atau chaining/piping (| , ;, &&)
    const hasModifyingOperators = /[><|;&]/.test(cmd);
    const isSafe = !hasModifyingOperators && SAFE_READONLY_COMMANDS.some(rx => rx.test(cmd));
    if (isSafe) {
      return {
        riskLevel: 'LOW',
        requiresApproval: false,
        reason: 'Perintah read-only yang diverifikasi aman.'
      };
    }

    return {
      riskLevel: 'HIGH',
      requiresApproval: true,
      reason: 'Eksekusi terminal shell dapat memodifikasi lingkungan host/sandbox.'
    };
  }

  // Khusus file_write: selalu butuh approval
  if (toolName === 'file_write') {
    return {
      riskLevel: 'MEDIUM',
      requiresApproval: true,
      reason: 'Operasi penulisan atau manipulasi file di sistem.'
    };
  }

  // http_fetch: jika method bukan GET, minta approval
  if (toolName === 'http_fetch') {
    const method = String(input.method || 'GET').toUpperCase();
    if (method !== 'GET') {
      return {
        riskLevel: 'MEDIUM',
        requiresApproval: true,
        reason: `Request HTTP ${method} berpotensi mengubah state server target.`
      };
    }
  }

  return {
    riskLevel: tool.riskLevel,
    requiresApproval: tool.requiresApproval
  };
}

/**
 * Eksekutor Tool Sandbox
 */
export async function executeToolInSandbox(
  toolName: string,
  input: Record<string, any>,
  context?: { agentId?: string; taskId?: string }
): Promise<{ success: boolean; output: string; durationMs: number; error?: string }> {
  const startTime = Date.now();

  try {
    if (toolName.startsWith('mcp:')) {
      const parts = toolName.split(':');
      const serverId = parts[1];
      const actualToolName = parts.slice(2).join(':');

      const mcpResult = await McpClientService.callTool(serverId, actualToolName, input);
      const textParts = mcpResult.content.map(c => c.text || JSON.stringify(c)).join('\n');
      return {
        success: !mcpResult.isError,
        output: textParts || '(Eksekusi tool MCP selesai tanpa output)',
        durationMs: Date.now() - startTime
      };
    }

    switch (toolName) {
      case 'mcp_call': {
        const serverId = String(input.serverId || '');
        const targetTool = String(input.toolName || '');
        const toolArgs = input.arguments || {};
        if (!serverId || !targetTool) {
          throw new Error('Parameter "serverId" dan "toolName" wajib diisi.');
        }

        const mcpResult = await McpClientService.callTool(serverId, targetTool, toolArgs);
        const textParts = mcpResult.content.map(c => c.text || JSON.stringify(c)).join('\n');
        return {
          success: !mcpResult.isError,
          output: textParts || '(Eksekusi tool MCP selesai tanpa output)',
          durationMs: Date.now() - startTime
        };
      }

      case 'bash_exec': {
        const cmd = String(input.command || '').trim();
        if (!cmd) throw new Error('Parameter "command" wajib diisi.');

        // Validasi pola bahaya
        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(cmd)) {
            throw new Error(`Eksekusi ditolak: perintah mengandung pola berbahaya (${pattern.toString()}).`);
          }
        }

        const timeout = Math.min(30000, Number(input.timeoutMs) || 15000);
        const cwd = SANDBOX_DIR;

        const { stdout, stderr } = await execAsync(cmd, {
          timeout,
          cwd,
          maxBuffer: 1024 * 1024 * 2, // 2MB output buffer
          env: {
            ...process.env,
            NODE_ENV: 'test',
            SANDBOX: '1'
          }
        });

        const output = (stdout || '') + (stderr ? `\n[STDERR]\n${stderr}` : '');
        return {
          success: true,
          output: output.trim() || '(Perintah selesai tanpa output teks)',
          durationMs: Date.now() - startTime
        };
      }

      case 'file_read': {
        const rawPath = String(input.filePath || '').trim();
        if (!rawPath) throw new Error('Parameter "filePath" wajib diisi.');

        // Proteksi path traversal & file sensitif
        const resolved = path.resolve(process.cwd(), rawPath);
        const forbiddenFiles = ['.env', 'id_rsa', 'id_ed25519', '/etc/shadow', '/etc/passwd'];
        if (forbiddenFiles.some(f => resolved.includes(f))) {
          throw new Error('Akses ditolak: File terproteksi atau sensitif tidak diizinkan dibaca.');
        }

        if (!fs.existsSync(resolved)) {
          throw new Error(`File tidak ditemukan pada path: ${rawPath}`);
        }

        const stat = fs.statSync(resolved);
        if (stat.size > 1024 * 1024 * 5) {
          throw new Error('Ukuran file melebihi batas 5MB.');
        }

        const content = fs.readFileSync(resolved, 'utf-8');
        return {
          success: true,
          output: content,
          durationMs: Date.now() - startTime
        };
      }

      case 'file_write': {
        const rawPath = String(input.filePath || '').trim();
        const content = String(input.content ?? '');
        const append = Boolean(input.append);

        if (!rawPath) throw new Error('Parameter "filePath" wajib diisi.');

        // Simpan selalu di dalam SANDBOX_DIR untuk keamanan isolasi
        const targetPath = path.resolve(SANDBOX_DIR, path.basename(rawPath));

        if (append) {
          fs.appendFileSync(targetPath, content, 'utf-8');
        } else {
          fs.writeFileSync(targetPath, content, 'utf-8');
        }

        return {
          success: true,
          output: `Berhasil menulis file: ${path.basename(targetPath)} (${content.length} karakter)`,
          durationMs: Date.now() - startTime
        };
      }

      case 'http_fetch': {
        const rawUrl = String(input.url || '').trim();
        if (!rawUrl) throw new Error('Parameter "url" wajib diisi.');

        // SSRF protection
        const urlValidation = validateOutgoingUrl(rawUrl);
        if (!urlValidation.isValid) {
          throw new Error(`SSRF Blocked: ${urlValidation.error}`);
        }

        const method = String(input.method || 'GET').toUpperCase();
        const headers = input.headers || {};
        const body = input.body ? String(input.body) : undefined;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
          const res = await fetch(rawUrl, {
            method,
            headers,
            body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
            signal: controller.signal
          });

          const text = await res.text();
          return {
            success: res.ok,
            output: `[HTTP ${res.status} ${res.statusText}]\n${text.slice(0, 10000)}`,
            durationMs: Date.now() - startTime
          };
        } finally {
          clearTimeout(timeout);
        }
      }

      case 'system_inspect': {
        const memory = process.memoryUsage();
        const uptime = process.uptime();
        const info = {
          uptimeSeconds: Math.floor(uptime),
          nodeVersion: process.version,
          platform: process.platform,
          memory: {
            rssMB: (memory.rss / (1024 * 1024)).toFixed(1),
            heapTotalMB: (memory.heapTotal / (1024 * 1024)).toFixed(1),
            heapUsedMB: (memory.heapUsed / (1024 * 1024)).toFixed(1)
          },
          sandboxDir: SANDBOX_DIR
        };

        return {
          success: true,
          output: JSON.stringify(info, null, 2),
          durationMs: Date.now() - startTime
        };
      }

      case 'knowledge_search': {
        const query = String(input.query || '').trim();
        if (!query) throw new Error('Parameter "query" wajib diisi.');
        const limit = Math.min(10, Number(input.limit) || 3);
        const matches = await RagService.searchSimilarChunks('ws-default-command-center', query, { limit });
        if (matches.length === 0) {
          return {
            success: true,
            output: 'Tidak ditemukan dokumen pengetahuan yang relevan dengan query tersebut.',
            durationMs: Date.now() - startTime
          };
        }
        const formatted = matches.map((m, idx) => 
          `[HASIL ${idx + 1}] Dokumen: "${m.documentTitle}" (${m.category}) | Skor Relevansi: ${(m.similarity * 100).toFixed(1)}%\n${m.content}`
        ).join('\n\n---\n\n');
        return {
          success: true,
          output: `Ditemukan ${matches.length} referensi pengetahuan semantik:\n\n${formatted}`,
          durationMs: Date.now() - startTime
        };
      }

      case 'memory_store': {
        const keyPoint = String(input.keyPoint || '').trim();
        if (!keyPoint) throw new Error('Parameter "keyPoint" wajib diisi.');
        const agentId = String(input.agentId || context?.agentId || '').trim();
        if (!agentId) throw new Error('Parameter "agentId" diperlukan untuk menyimpan memori agen.');
        const memory = await RagService.storeAgentMemory({
          agentId,
          taskId: context?.taskId || input.taskId,
          memoryType: input.memoryType || 'EPISODIC',
          keyPoint,
          context: input.context,
          importanceScore: input.importanceScore
        });
        return {
          success: true,
          output: `[MEMORI TERSIMPAN] ID: ${memory.id} | Tipe: ${memory.memoryType} | Poin: "${memory.keyPoint}"`,
          durationMs: Date.now() - startTime
        };
      }

      case 'memory_search': {
        const query = String(input.query || '').trim();
        if (!query) throw new Error('Parameter "query" wajib diisi.');
        const agentId = String(input.agentId || context?.agentId || '').trim();
        if (!agentId) throw new Error('Parameter "agentId" diperlukan untuk mencari memori agen.');
        const limit = Math.min(10, Number(input.limit) || 3);
        const memories = await RagService.searchAgentMemories(agentId, query, { limit });
        if (memories.length === 0) {
          return {
            success: true,
            output: 'Tidak ditemukan memori masa lalu agen yang relevan.',
            durationMs: Date.now() - startTime
          };
        }
        const formatted = memories.map((m, idx) =>
          `[MEMORI ${idx + 1}] (${m.memoryType}) Poin: "${m.keyPoint}" | Relevansi: ${((m.similarity || 0) * 100).toFixed(1)}% (Penting: ${m.importanceScore})`
        ).join('\n');
        return {
          success: true,
          output: `Ditemukan ${memories.length} memori masa lalu:\n${formatted}`,
          durationMs: Date.now() - startTime
        };
      }

      case 'web_search': {
        const query = String(input.query || '').trim();
        if (!query) throw new Error('Parameter "query" wajib diisi untuk web_search.');
        const limit = Number(input.limit) || 5;
        const { WebResearchService } = await import('./webResearchService.js');
        const searchRes = await WebResearchService.search(query, limit);
        const formatted = searchRes.results
          .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nIkhtisar: ${r.snippet}`)
          .join('\n\n');
        return {
          success: true,
          output: `Hasil pencarian web untuk "${query}":\n\n${formatted}`,
          durationMs: Date.now() - startTime
        };
      }

      case 'web_browse': {
        const url = String(input.url || '').trim();
        if (!url) throw new Error('Parameter "url" wajib diisi untuk web_browse.');
        const maxLength = Number(input.maxLength) || 6000;
        const { WebResearchService } = await import('./webResearchService.js');
        const browsed = await WebResearchService.browse(url, maxLength);
        return {
          success: true,
          output: `=== [KONTEN WEB: ${browsed.title}] ===\nURL: ${browsed.url}\n\n${browsed.markdownContent}`,
          durationMs: Date.now() - startTime
        };
      }

      case 'web_research_and_ingest': {
        const query = String(input.query || '').trim();
        if (!query) throw new Error('Parameter "query" wajib diisi untuk web_research_and_ingest.');
        const { WebResearchService } = await import('./webResearchService.js');
        const result = await WebResearchService.researchAndIngest({
          query,
          documentTitle: input.documentTitle ? String(input.documentTitle).trim() : undefined,
          workspaceId: (context as any)?.workspaceId || input.workspaceId
        });
        return {
          success: true,
          output: `[RISET WEB BERHASIL DIINDEKS KE RAG]\nDokumen ID: ${result.documentId}\nJudul: "${result.title}"\nKategori: ${result.category}\nJumlah Chunks: ${result.chunksIndexed}\nSumber:\n${result.sources.map(s => `- ${s.title} (${s.url})`).join('\n')}`,
          durationMs: Date.now() - startTime
        };
      }

      case 'sre_scan': {
        const workspaceId = input.workspaceId || (context as any)?.workspaceId || 'ws-default-command-center';
        const { SreAgentService } = await import('./sreAgentService.js');
        const scanRes = await SreAgentService.scanSystemHealth(workspaceId);
        return {
          success: true,
          output: `[SRE HEALTH SCAN]\nStatus: ${scanRes.healthy ? 'HEALTHY' : 'ANOMALY DETECTED'}\nCPU: ${scanRes.metrics.cpuPercent}%\nRAM: ${scanRes.metrics.memoryPercent}%\nDisk: ${scanRes.metrics.diskPercent}%\nInsiden Aktif Ditemukan: ${scanRes.detectedIncidents.length}`,
          durationMs: Date.now() - startTime
        };
      }

      case 'sre_remediate': {
        const incidentId = String(input.incidentId || '').trim();
        if (!incidentId) throw new Error('Parameter "incidentId" wajib diisi.');
        const operatorApproved = Boolean(input.operatorApproved);
        const { SreAgentService } = await import('./sreAgentService.js');
        const remediated = await SreAgentService.remediateIncident(incidentId, operatorApproved);
        return {
          success: true,
          output: `[SRE PEMULIHAN BERHASIL]\nID Insiden: ${remediated.id}\nStatus: ${remediated.status}\nTindakan: ${remediated.actionTaken}\nPost-Mortem: ${remediated.postMortem?.slice(0, 150)}...`,
          durationMs: Date.now() - startTime
        };
      }

      case 'data_analyze': {
        const sourceType = String(input.sourceType || 'TASK_ANALYTICS') as any;
        const queryPrompt = String(input.queryPrompt || 'Analisis data').trim();
        const { DataAnalystService } = await import('./dataAnalystService.js');
        const session = await DataAnalystService.analyzeData({
          sourceType,
          queryPrompt,
          rawData: input.rawData,
          datasetName: input.datasetName,
          workspaceId: (context as any)?.workspaceId || input.workspaceId
        });
        return {
          success: true,
          output: `[ANALISIS DATA BERHASIL]\nID Sesi: ${session.id}\nJudul: "${session.title}"\nTipe Grafik: ${session.chartConfig.type.toUpperCase()}\nRingkasan: ${session.summary}\nWawasan Utama:\n${session.insights.map((ins, i) => `${i + 1}. ${ins}`).join('\n')}`,
          durationMs: Date.now() - startTime
        };
      }

      default:
        throw new Error(`Tool "${toolName}" tidak didukung oleh sandbox engine.`);
    }
  } catch (err: any) {
    systemLogger.warn('SECURITY', `Kegagalan eksekusi sandbox tool [${toolName}]: ${err.message}`);
    return {
      success: false,
      output: '',
      error: err.message,
      durationMs: Date.now() - startTime
    };
  }
}
