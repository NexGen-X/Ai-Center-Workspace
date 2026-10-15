import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';

describe('Autonomous Data Analyst & Interactive Visualizer API', () => {
  let createdSessionId = '';

  afterAll(async () => {
    if (createdSessionId) {
      await pool.query('DELETE FROM data_analysis_sessions WHERE id = $1;', [createdSessionId]);
    }
    // Clean any test created sessions
    await pool.query("DELETE FROM data_analysis_sessions WHERE title LIKE '%Test Data Analyst%';");
  });

  it('POST /api/data-analyst/analyze should reject missing sourceType or empty prompt', async () => {
    const res1 = await request(app).post('/api/data-analyst/analyze').send({
      queryPrompt: 'Analisis'
    });
    expect(res1.status).toBe(400);

    const res2 = await request(app).post('/api/data-analyst/analyze').send({
      sourceType: 'CSV',
      queryPrompt: ''
    });
    expect(res2.status).toBe(400);
  });

  it('POST /api/data-analyst/analyze should parse CSV, compute statistics and generate chart config', async () => {
    const csvContent = `Bulan,Penjualan,Pengeluaran
Januari,1200,800
Februari,1500,950
Maret,1800,1100
April,2200,1250`;

    const res = await request(app).post('/api/data-analyst/analyze').send({
      datasetName: 'Test Data Analyst CSV',
      sourceType: 'CSV',
      rawData: csvContent,
      queryPrompt: 'Tren penjualan bulanan dan pengeluaran'
    });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    createdSessionId = res.body.id;

    expect(res.body.sourceType).toBe('CSV');
    expect(res.body.stats).toBeDefined();
    expect(res.body.stats.totalRows).toBe(4);
    expect(res.body.stats.columns).toContain('Bulan');
    expect(res.body.stats.columns).toContain('Penjualan');

    // Check stats calculations
    expect(res.body.stats.numericMetrics.Penjualan.min).toBe(1200);
    expect(res.body.stats.numericMetrics.Penjualan.max).toBe(2200);
    expect(res.body.stats.numericMetrics.Penjualan.sum).toBe(6700);

    // Check chart config
    expect(res.body.chartConfig).toBeDefined();
    expect(['line', 'bar', 'area']).toContain(res.body.chartConfig.type);
    expect(res.body.chartConfig.labels).toEqual(['Januari', 'Februari', 'Maret', 'April']);
    expect(res.body.chartConfig.datasets.length).toBeGreaterThanOrEqual(1);
    expect(res.body.chartConfig.datasets[0].data).toEqual([1200, 1500, 1800, 2200]);

    // Check insights and summary
    expect(Array.isArray(res.body.insights)).toBe(true);
    expect(res.body.insights.length).toBeGreaterThan(0);
    expect(res.body.summary).toContain('Bulan');
  });

  it('POST /api/data-analyst/analyze should parse JSON data and synthesize pie chart for proportions', async () => {
    const jsonContent = JSON.stringify([
      { Kategori: 'Frontend', Persentase: 35 },
      { Kategori: 'Backend', Persentase: 40 },
      { Kategori: 'DevOps', Persentase: 25 }
    ]);

    const res = await request(app).post('/api/data-analyst/analyze').send({
      datasetName: 'Test Data Analyst JSON',
      sourceType: 'JSON',
      rawData: jsonContent,
      queryPrompt: 'Proporsi alokasi pengerjaan task'
    });

    expect(res.status).toBe(200);
    expect(res.body.chartConfig.type).toBe('pie');
    expect(res.body.chartConfig.labels).toEqual(['Frontend', 'Backend', 'DevOps']);
    expect(res.body.chartConfig.datasets[0].data).toEqual([35, 40, 25]);
  });

  it('POST /api/data-analyst/quick-query should generate analytics from system task telemetry', async () => {
    const res = await request(app).post('/api/data-analyst/quick-query').send({
      type: 'TASK_SUCCESS_RATES'
    });

    expect(res.status).toBe(200);
    expect(res.body.datasetName).toContain('Tugas');
    expect(res.body.chartConfig.labels.length).toBeGreaterThan(0);
  });

  it('POST /api/data-analyst/quick-query should generate analytics for server resource trends', async () => {
    const res = await request(app).post('/api/data-analyst/quick-query').send({
      type: 'SERVER_RESOURCE_TRENDS'
    });

    expect(res.status).toBe(200);
    expect(res.body.chartConfig.labels).toContain('CPU Utilitas');
  });

  it('GET /api/data-analyst/sessions should list saved sessions', async () => {
    const res = await request(app).get('/api/data-analyst/sessions');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((s: any) => s.id === createdSessionId)).toBe(true);
  });

  it('GET /api/data-analyst/sessions/:id should return single session or 404', async () => {
    const res = await request(app).get(`/api/data-analyst/sessions/${createdSessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createdSessionId);

    const res404 = await request(app).get('/api/data-analyst/sessions/das-non-existent-999');
    expect(res404.status).toBe(404);
  });

  it('DELETE /api/data-analyst/sessions/:id should delete analysis session', async () => {
    const res = await request(app).delete(`/api/data-analyst/sessions/${createdSessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    createdSessionId = '';
  });

  it('Sandbox Tool data_analyze should execute cleanly in sandbox engine', async () => {
    const toolRes = await executeToolInSandbox('data_analyze', {
      sourceType: 'SYSTEM_METRICS',
      queryPrompt: 'Ringkasan performa server host'
    });

    expect(toolRes.success).toBe(true);
    expect(toolRes.output).toContain('[ANALISIS DATA BERHASIL]');
    expect(toolRes.output).toContain('Tipe Grafik:');
  });
});
