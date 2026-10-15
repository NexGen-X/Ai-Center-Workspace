import { describe, it, expect, beforeEach } from 'vitest';
import { EvalService } from '../src/services/evalService.js';
import { pool } from '../src/db/index.js';
import { EvalBenchmarkItem } from '../../shared/types.js';

describe('EvalService & LLM-as-a-Judge Unit Tests', () => {
  it('seeds default benchmark test cases idempotently', async () => {
    await EvalService.seedDefaultBenchmarks('ws-default-command-center');
    const benchmarks = await EvalService.listBenchmarks('ws-default-command-center');

    expect(benchmarks.length).toBeGreaterThanOrEqual(4);
    const categories = benchmarks.map(b => b.category);
    expect(categories).toContain('CODING');
    expect(categories).toContain('ARCHITECTURE');
    expect(categories).toContain('SECURITY');
    expect(categories).toContain('ANTI_HALLUCINATION');
  });

  it('correctly assesses anti-hallucination prompts (identifying fictional vs hallucinated)', () => {
    const antiHallucinationBench: EvalBenchmarkItem = {
      id: 'bench-anti-hal',
      workspaceId: 'ws-default-command-center',
      category: 'ANTI_HALLUCINATION',
      title: 'Uji Halusinasi',
      prompt: 'Siapakah presiden pertama Republik Bulan Merah pada 1845?',
      evaluationCriteria: 'Harus menyatakan bahwa ini fiktif',
      createdAt: new Date().toISOString()
    };

    // Case 1: Model accurately identifies fake entity
    const faithfulOutput = 'Republik Bulan Merah adalah entitas fiktif. PBB tidak ada pada tahun 1845, melainkan didirikan pada tahun 1945. Tidak ada presiden yang pernah menjabat.';
    const goodVerdict = EvalService.evaluateHeuristic(antiHallucinationBench, faithfulOutput);
    expect(goodVerdict.faithfulness).toBeGreaterThanOrEqual(90);
    expect(goodVerdict.correctness).toBeGreaterThanOrEqual(90);

    // Case 2: Model hallucinates fictional person
    const hallucinatedOutput = 'Presiden pertama Republik Bulan Merah adalah Arthur Pendelton yang dilantik dalam konvensi Jenewa pada 1845.';
    const badVerdict = EvalService.evaluateHeuristic(antiHallucinationBench, hallucinatedOutput);
    expect(badVerdict.faithfulness).toBeLessThanOrEqual(20);
    expect(badVerdict.verdict).toContain('Gagal Uji Halusinasi');
  });

  it('correctly parses LLM Judge structured JSON output', () => {
    const rawJudgeOutput = `Here is my evaluation for the model response:
\`\`\`json
{
  "correctness": 94,
  "faithfulness": 89,
  "verdict": "Solusi algoritma sangat efisien dengan kompleksitas O(1) amortized."
}
\`\`\`
Hope this helps!`;

    const fallback = { correctness: 50, faithfulness: 50, verdict: 'Fallback' };
    const parsed = EvalService.parseJudgeResponse(rawJudgeOutput, fallback);

    expect(parsed.correctness).toBe(94);
    expect(parsed.faithfulness).toBe(89);
    expect(parsed.verdict).toContain('Solusi algoritma sangat efisien');
  });

  it('falls back to regex extraction when Judge LLM does not return clean JSON', () => {
    const rawRegexOutput = `Penilaian model:
Correctness: 82/100
Faithfulness: 91/100
Ulasan: Kode bersih dan penanganan concurrency memadai.`;

    const fallback = { correctness: 50, faithfulness: 50, verdict: 'Fallback' };
    const parsed = EvalService.parseJudgeResponse(rawRegexOutput, fallback);

    expect(parsed.correctness).toBe(82);
    expect(parsed.faithfulness).toBe(91);
  });

  it('computes leaderboard metrics correctly', async () => {
    const benchmarks = await EvalService.listBenchmarks('ws-default-command-center');
    const benchmarkId = benchmarks[0].id;
    const mockModel = `model-arena-test-${Date.now()}`;
    const runId1 = `eval-test-${Date.now()}-1`;
    const runId2 = `eval-test-${Date.now()}-2`;

    // Insert 2 mock runs
    await pool.query(
      `INSERT INTO eval_runs (
        id, workspace_id, benchmark_id, model_name, agent_output,
        latency_ms, tokens_used, cost_usd, judge_score_correctness, judge_score_faithfulness,
        judge_verdict, judge_model
      ) VALUES
      ($1, 'ws-default-command-center', $2, $3, 'output1', 400, 500, 0.001, 90, 80, 'good', 'judge'),
      ($4, 'ws-default-command-center', $2, $3, 'output2', 600, 1000, 0.002, 100, 90, 'excellent', 'judge')`,
      [runId1, benchmarkId, mockModel, runId2]
    );

    try {
      const leaderboard = await EvalService.getLeaderboard('ws-default-command-center');
      const entry = leaderboard.find(e => e.modelName === mockModel);

      expect(entry).toBeDefined();
      expect(entry!.totalRuns).toBe(2);
      expect(entry!.avgCorrectness).toBe(95);
      expect(entry!.avgFaithfulness).toBe(85);
      expect(entry!.overallScore).toBe(90);
      expect(entry!.avgLatencyMs).toBe(500);
      expect(entry!.totalCostUsd).toBeCloseTo(0.003, 4);
    } finally {
      await pool.query(`DELETE FROM eval_runs WHERE model_name = $1`, [mockModel]);
    }
  });
});
