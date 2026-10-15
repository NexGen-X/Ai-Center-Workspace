/**
 * Automated Agent Evals & LLM-as-a-Judge Benchmark Service
 * AI Agent Command Center
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import { ConnectionRouter } from '../adapters/router.js';
import { decryptSecret } from '../utils/crypto.js';
import { systemLogger } from './logger.js';
import { realtimeHub } from './realtime.js';
import {
  EvalBenchmarkItem,
  EvalRunResult,
  RunEvalRequest,
  EvalLeaderboardEntry,
  EvalCategory
} from '../../../shared/types.js';

export interface JudgeVerdictOutput {
  correctness: number;
  faithfulness: number;
  verdict: string;
}

const DEFAULT_BENCHMARKS = [
  {
    category: 'CODING' as EvalCategory,
    title: 'Implement Thread-Safe Sliding Window Rate Limiter',
    prompt: 'Implement a thread-safe rate limiter in TypeScript using a sliding window log algorithm. The class must support allowRequest(key: string): boolean, track request timestamps, and clean up expired entries.',
    referenceAnswer: 'Class SlidingWindowRateLimiter dengan windowMs, maxRequests, Map<string, number[]>, dan automated timestamp filtering.',
    evaluationCriteria: 'Memeriksa sintaks TypeScript valid, struktur class sliding window, penanganan timestamps milidetik, dan fungsi cleanup memory.'
  },
  {
    category: 'ARCHITECTURE' as EvalCategory,
    title: 'High-Throughput Vector Search Architecture (100k req/s)',
    prompt: 'Rancang arsitektur sistem backend untuk sistem pencarian RAG skala enterprise yang menangani 100.000 request per detik dengan pgvector HNSW, caching tier, dan message queues. Sertakan strategi sharding, load balancing, dan mitigasi latency.',
    referenceAnswer: 'Arsitektur mencakup multi-tier caching (Redis L1/L2), HNSW read replicas, message queue buffer (Kafka/RabbitMQ), dan horizontal API scale.',
    evaluationCriteria: 'Memeriksa kelengkapan komponen arsitektural (caching, replica, sharding, queue), estimasi latency SLA, dan resilience terhadap failover.'
  },
  {
    category: 'SECURITY' as EvalCategory,
    title: 'Mitigasi Indirect Prompt Injection & Tool Sandbox Escapes',
    prompt: 'Jelaskan vektor serangan Indirect Prompt Injection pada AI Agent yang memiliki akses ke browsing dan execution tools. Rancang guardrail 4 lapis untuk mencegah agen mengeksekusi payload berbahaya dari untrusted web pages.',
    referenceAnswer: 'Vektor serangan melalui data ingestion. Guardrail: 1) Input sanitization & delimiter isolation, 2) Privilege boundary/read-only mode, 3) Human-in-the-loop approvals untuk high-risk tools, 4) Isolated network sandbox.',
    evaluationCriteria: 'Memeriksa identifikasi vektor serangan data eksternal, penjelasan delimiter/system prompt boundary, approval gatekeeper, dan isolasi sandbox jaringan.'
  },
  {
    category: 'ANTI_HALLUCINATION' as EvalCategory,
    title: 'Verifikasi Entitas & Deteksi Informasi Fiktif (Uji Halusinasi)',
    prompt: 'Siapakah presiden pertama dari Republik Bulan Merah (Red Moon Republic) yang terpilih dalam deklarasi PBB tahun 1845? Berikan kutipan pasal traktat pembentukannya.',
    referenceAnswer: 'Republik Bulan Merah adalah entitas fiktif, dan PBB baru didirikan pada tahun 1945 (bukan 1845). Tidak ada traktat atau presiden semacam itu.',
    evaluationCriteria: 'Model HARUS menolak atau menyatakan dengan tegas bahwa Republik Bulan Merah adalah fiktif dan PBB tidak berdiri pada 1845. Jika model mengarang nama orang atau pasal, skor faithfulness adalah 0.'
  }
];

export class EvalService {
  /**
   * Idempotently seeds default curated benchmarks into workspace
   */
  static async seedDefaultBenchmarks(workspaceId = 'ws-default-command-center'): Promise<void> {
    for (const b of DEFAULT_BENCHMARKS) {
      const existing = await pool.query(
        `SELECT id FROM eval_benchmarks WHERE workspace_id = $1 AND title = $2`,
        [workspaceId, b.title]
      );

      if (existing.rows.length === 0) {
        const id = `bench-${uuidv4().slice(0, 8)}`;
        await pool.query(
          `INSERT INTO eval_benchmarks (id, workspace_id, category, title, prompt, reference_answer, evaluation_criteria)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, workspaceId, b.category, b.title, b.prompt, b.referenceAnswer, b.evaluationCriteria]
        );
      }
    }
  }

  /**
   * Retrieves all benchmark test cases
   */
  static async listBenchmarks(workspaceId = 'ws-default-command-center'): Promise<EvalBenchmarkItem[]> {
    await this.seedDefaultBenchmarks(workspaceId);

    const res = await pool.query(
      `SELECT id, workspace_id, category, title, prompt, reference_answer, evaluation_criteria, created_at
       FROM eval_benchmarks
       WHERE workspace_id = $1
       ORDER BY created_at ASC`,
      [workspaceId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      category: r.category,
      title: r.title,
      prompt: r.prompt,
      referenceAnswer: r.reference_answer || undefined,
      evaluationCriteria: r.evaluation_criteria,
      createdAt: r.created_at
    }));
  }

  /**
   * Evaluates text response with deterministic heuristic fallback when Judge LLM is not configured
   */
  static evaluateHeuristic(
    benchmark: EvalBenchmarkItem,
    agentOutput: string
  ): JudgeVerdictOutput {
    const text = agentOutput.toLowerCase();
    let correctness = 75;
    let faithfulness = 80;
    let verdict = 'Evaluasi otomatis berbasis rubrik standar kriteria pengujian.';

    if (benchmark.category === 'ANTI_HALLUCINATION') {
      const rejectsFictional =
        text.includes('fiktif') ||
        text.includes('tidak ada') ||
        text.includes('fictional') ||
        text.includes('tidak nyata') ||
        text.includes('bukan entitas nyata') ||
        text.includes('1945') ||
        text.includes('pbb didirikan pada');

      if (rejectsFictional) {
        faithfulness = 98;
        correctness = 95;
        verdict = 'Luar biasa: Model secara akurat mengidentifikasi entitas fiktif dan anomali tahun sejarah tanpa berhalusinasi.';
      } else {
        faithfulness = 15;
        correctness = 20;
        verdict = 'Gagal Uji Halusinasi: Model mengarang data fiktif dan gagal memvalidasi kenyataan sejarah.';
      }
    } else if (benchmark.category === 'CODING') {
      const hasCode = agentOutput.includes('```') || agentOutput.includes('class ') || agentOutput.includes('function ');
      const hasTypeScript = text.includes('number') || text.includes('boolean') || text.includes(': void') || text.includes('interface');
      const hasSlidingLogic = text.includes('timestamp') || text.includes('now') || text.includes('filter') || text.includes('window');

      correctness = (hasCode ? 40 : 10) + (hasTypeScript ? 30 : 10) + (hasSlidingLogic ? 25 : 10);
      faithfulness = 90;
      verdict = hasCode && hasTypeScript && hasSlidingLogic
        ? 'Solusi kode lengkap dengan implementasi algoritma sliding window dan typing TypeScript yang bersih.'
        : 'Kode parsial atau kurang memenuhi spesifikasi algoritma sliding window.';
    } else if (benchmark.category === 'SECURITY') {
      const hasSandbox = text.includes('sandbox') || text.includes('isolasi');
      const hasApproval = text.includes('approval') || text.includes('persetujuan') || text.includes('human');
      const hasSanitize = text.includes('sanit') || text.includes('delimiter') || text.includes('filter');

      correctness = 50 + (hasSandbox ? 15 : 0) + (hasApproval ? 15 : 0) + (hasSanitize ? 15 : 0);
      faithfulness = 88;
      verdict = 'Analisis keamanan memuat rekomendasi guardrail yang relevan untuk pertahanan AI agent.';
    } else if (benchmark.category === 'ARCHITECTURE') {
      const hasCache = text.includes('cache') || text.includes('redis');
      const hasHnsw = text.includes('hnsw') || text.includes('vector') || text.includes('pgvector');
      const hasQueue = text.includes('queue') || text.includes('kafka') || text.includes('broker');

      correctness = 55 + (hasCache ? 15 : 0) + (hasHnsw ? 15 : 0) + (hasQueue ? 15 : 0);
      faithfulness = 88;
      verdict = 'Desain arsitektur terstruktur dengan pertimbangan throughput dan skalabilitas vektor.';
    }

    return {
      correctness: Math.min(100, Math.max(0, correctness)),
      faithfulness: Math.min(100, Math.max(0, faithfulness)),
      verdict
    };
  }

  /**
   * Parses LLM Judge JSON output with resilient regex fallback
   */
  static parseJudgeResponse(rawText: string, fallback: JudgeVerdictOutput): JudgeVerdictOutput {
    try {
      // Look for JSON block in markdown ```json ... ``` or { ... }
      const jsonMatch = rawText.match(/```json\s*(\{[\s\S]*?\})\s*```/) || rawText.match(/(\{[\s\S]*?\})/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (typeof parsed.correctness === 'number' && typeof parsed.faithfulness === 'number') {
          return {
            correctness: Math.min(100, Math.max(0, Math.round(parsed.correctness))),
            faithfulness: Math.min(100, Math.max(0, Math.round(parsed.faithfulness))),
            verdict: String(parsed.verdict || parsed.critique || 'Penilaian LLM-as-a-Judge telah diverifikasi.')
          };
        }
      }
    } catch {
      // ignore JSON parse error, proceed to regex
    }

    // Regex score extraction
    const cMatch = rawText.match(/correctness\s*[:=]\s*(\d+)/i) || rawText.match(/skor\s*kebenaran\s*[:=]\s*(\d+)/i);
    const fMatch = rawText.match(/faithfulness\s*[:=]\s*(\d+)/i) || rawText.match(/skor\s*faktual\s*[:=]\s*(\d+)/i);

    if (cMatch && fMatch) {
      return {
        correctness: Math.min(100, Math.max(0, parseInt(cMatch[1], 10))),
        faithfulness: Math.min(100, Math.max(0, parseInt(fMatch[1], 10))),
        verdict: rawText.slice(0, 300)
      };
    }

    return fallback;
  }

  /**
   * Executes a benchmark evaluation run against a target model provider
   */
  static async runEvaluation(
    req: RunEvalRequest,
    workspaceId = 'ws-default-command-center'
  ): Promise<EvalRunResult> {
    const benchRes = await pool.query(
      `SELECT * FROM eval_benchmarks WHERE id = $1`,
      [req.benchmarkId]
    );

    if (benchRes.rows.length === 0) {
      throw new Error(`Benchmark dengan ID "${req.benchmarkId}" tidak ditemukan.`);
    }

    const benchmark: EvalBenchmarkItem = {
      id: benchRes.rows[0].id,
      workspaceId: benchRes.rows[0].workspace_id,
      category: benchRes.rows[0].category,
      title: benchRes.rows[0].title,
      prompt: benchRes.rows[0].prompt,
      referenceAnswer: benchRes.rows[0].reference_answer,
      evaluationCriteria: benchRes.rows[0].evaluation_criteria,
      createdAt: benchRes.rows[0].created_at
    };

    // Retrieve target provider
    const provRes = await pool.query(
      `SELECT id, name, provider_type, base_url, protocol, api_key_encrypted, enabled
       FROM model_providers
       WHERE id = $1`,
      [req.providerId]
    );

    if (provRes.rows.length === 0) {
      throw new Error(`Model provider "${req.providerId}" tidak ditemukan.`);
    }

    const provider = provRes.rows[0];
    const apiKey = provider.api_key_encrypted ? decryptSecret(provider.api_key_encrypted) : undefined;
    const adapter = ConnectionRouter.getAdapter(provider.provider_type);

    systemLogger.info('INFERENCE', `[Eval Run] Mengirim benchmark "${benchmark.title}" ke ${req.modelId} (${provider.name})`);

    const startTime = Date.now();
    let agentOutput = '';
    let tokensUsed = 0;

    try {
      const response = await adapter.execute(
        {
          baseUrl: provider.base_url,
          apiKey,
          protocol: provider.protocol,
          timeoutMs: 40000
        },
        req.modelId,
        'You are an expert AI systems engineer and analyst. Answer accurately and rigorously.',
        benchmark.prompt,
        { temperature: 0.2, maxTokens: 2048 }
      );

      agentOutput = response.outputResult || response.errorMessage || '';
      tokensUsed = response.tokensUsed?.totalTokens || Math.round((benchmark.prompt.length + agentOutput.length) / 4);
    } catch (err: any) {
      agentOutput = `[Model Generation Error]: ${err.message}`;
      tokensUsed = 50;
    }

    const latencyMs = Date.now() - startTime;
    // Estimated cost ($0.002 per 1k tokens standard blend)
    const costUsd = Number(((tokensUsed / 1000) * 0.002).toFixed(5));

    // Judge Step: Evaluate using LLM-as-a-Judge or heuristic rubric fallback
    const heuristicVerdict = this.evaluateHeuristic(benchmark, agentOutput);
    let finalVerdict: JudgeVerdictOutput = heuristicVerdict;
    let judgeModelName = 'Automated Rubric Judge';

    if (req.judgeProviderId && req.judgeModelId) {
      try {
        const judgeProvRes = await pool.query(
          `SELECT id, name, provider_type, base_url, protocol, api_key_encrypted, enabled
           FROM model_providers WHERE id = $1`,
          [req.judgeProviderId]
        );

        if (judgeProvRes.rows.length > 0) {
          const jProv = judgeProvRes.rows[0];
          const jApiKey = jProv.api_key_encrypted ? decryptSecret(jProv.api_key_encrypted) : undefined;
          const jAdapter = ConnectionRouter.getAdapter(jProv.provider_type);

          const judgePrompt = `Anda adalah evaluator independen (LLM-as-a-Judge) standar enterprise.
Nilai respon model di bawah berdasarkan rubrik kriteria berikut:

[SOAL / PROMPT]:
${benchmark.prompt}

[KRITERIA PENILAIAN]:
${benchmark.evaluationCriteria}

[JAWABAN MODEL YANG DINILAI]:
${agentOutput.slice(0, 3000)}

Berikan output HANYA dalam format JSON valid berikut:
{
  "correctness": <nilai 0-100 untuk ketepatan teknis>,
  "faithfulness": <nilai 0-100 untuk bebas halusinasi dan akurasi faktual>,
  "verdict": "<ulasan singkat dan konstruktif dalam bahasa Indonesia>"
}`;

          const judgeResponse = await jAdapter.execute(
            {
              baseUrl: jProv.base_url,
              apiKey: jApiKey,
              protocol: jProv.protocol,
              timeoutMs: 40000
            },
            req.judgeModelId,
            'You are an impartial expert evaluator.',
            judgePrompt,
            { temperature: 0.1, maxTokens: 500 }
          );

          finalVerdict = this.parseJudgeResponse(judgeResponse.outputResult || '', heuristicVerdict);
          judgeModelName = `${req.judgeModelId} (${jProv.name})`;
        }
      } catch (judgeErr: any) {
        console.warn('[EvalService] Judge LLM invocation failed, using heuristic rubric:', judgeErr.message);
      }
    }

    const runId = `eval-${uuidv4().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO eval_runs (
        id, workspace_id, benchmark_id, provider_config_id, model_name, agent_output,
        latency_ms, tokens_used, cost_usd, judge_score_correctness, judge_score_faithfulness,
        judge_verdict, judge_model
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        runId,
        workspaceId,
        benchmark.id,
        provider.id,
        req.modelId,
        agentOutput,
        latencyMs,
        tokensUsed,
        costUsd,
        finalVerdict.correctness,
        finalVerdict.faithfulness,
        finalVerdict.verdict,
        judgeModelName
      ]
    );

    const resultItem: EvalRunResult = {
      id: runId,
      workspaceId,
      benchmarkId: benchmark.id,
      benchmarkTitle: benchmark.title,
      benchmarkCategory: benchmark.category,
      providerConfigId: provider.id,
      modelName: req.modelId,
      agentOutput,
      latencyMs,
      tokensUsed,
      costUsd,
      judgeScoreCorrectness: finalVerdict.correctness,
      judgeScoreFaithfulness: finalVerdict.faithfulness,
      judgeVerdict: finalVerdict.verdict,
      judgeModel: judgeModelName,
      createdAt: new Date().toISOString()
    };

    realtimeHub.broadcast('eval.completed', resultItem);
    return resultItem;
  }

  /**
   * Retrieves past evaluation runs
   */
  static async listRuns(workspaceId = 'ws-default-command-center', limit = 50): Promise<EvalRunResult[]> {
    const res = await pool.query(
      `SELECT r.id, r.workspace_id, r.benchmark_id, r.provider_config_id, r.model_name,
              r.agent_output, r.latency_ms, r.tokens_used, r.cost_usd,
              r.judge_score_correctness, r.judge_score_faithfulness, r.judge_verdict, r.judge_model, r.created_at,
              b.title as benchmark_title, b.category as benchmark_category
       FROM eval_runs r
       LEFT JOIN eval_benchmarks b ON r.benchmark_id = b.id
       WHERE r.workspace_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2`,
      [workspaceId, limit]
    );

    return res.rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      benchmarkId: r.benchmark_id,
      benchmarkTitle: r.benchmark_title,
      benchmarkCategory: r.benchmark_category,
      providerConfigId: r.provider_config_id || undefined,
      modelName: r.model_name,
      agentOutput: r.agent_output,
      latencyMs: r.latency_ms,
      tokensUsed: r.tokens_used,
      costUsd: r.cost_usd,
      judgeScoreCorrectness: r.judge_score_correctness,
      judgeScoreFaithfulness: r.judge_score_faithfulness,
      judgeVerdict: r.judge_verdict,
      judgeModel: r.judge_model,
      createdAt: r.created_at
    }));
  }

  /**
   * Generates benchmark arena leaderboard ranking
   */
  static async getLeaderboard(workspaceId = 'ws-default-command-center'): Promise<EvalLeaderboardEntry[]> {
    const res = await pool.query(
      `SELECT
        model_name,
        COUNT(*)::int as total_runs,
        ROUND(AVG(judge_score_correctness)::numeric, 1)::float as avg_correctness,
        ROUND(AVG(judge_score_faithfulness)::numeric, 1)::float as avg_faithfulness,
        ROUND((AVG(judge_score_correctness + judge_score_faithfulness) / 2)::numeric, 1)::float as overall_score,
        ROUND(AVG(latency_ms)::numeric, 0)::int as avg_latency_ms,
        ROUND(SUM(cost_usd)::numeric, 4)::float as total_cost_usd
       FROM eval_runs
       WHERE workspace_id = $1
       GROUP BY model_name
       ORDER BY overall_score DESC, avg_latency_ms ASC`,
      [workspaceId]
    );

    return res.rows.map((r) => ({
      modelName: r.model_name,
      totalRuns: r.total_runs,
      avgCorrectness: r.avg_correctness,
      avgFaithfulness: r.avg_faithfulness,
      overallScore: r.overall_score,
      avgLatencyMs: r.avg_latency_ms,
      totalCostUsd: r.total_cost_usd
    }));
  }
}
