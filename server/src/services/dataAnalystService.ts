/**
 * Autonomous Data Analyst & Interactive Visualizer Studio — AI Agent Command Center
 * Parses datasets (CSV, JSON, System Analytics), computes statistical summaries,
 * synthesizes executive insights, and constructs interactive chart specifications.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import {
  DataAnalysisSession,
  AnalyzeDataRequest,
  ChartConfig,
  ChartType,
  DataStatisticalSummary,
  QuickDataQueryType
} from '../../../shared/types.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';

const PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#EF4444', // Red
  '#6366F1'  // Indigo
];

export class DataAnalystService {
  /**
   * Main entrypoint: Analyze provided data or internal system telemetry
   */
  static async analyzeData(req: AnalyzeDataRequest): Promise<DataAnalysisSession> {
    const workspaceId = req.workspaceId || 'ws-default-command-center';
    let rows: Record<string, any>[] = [];
    let datasetName = req.datasetName || 'Dataset Analisis';

    switch (req.sourceType) {
      case 'CSV': {
        if (!req.rawData || !req.rawData.trim()) {
          throw new Error('Data CSV mentah tidak boleh kosong.');
        }
        rows = this.parseCsv(req.rawData.trim());
        break;
      }

      case 'JSON': {
        if (!req.rawData || !req.rawData.trim()) {
          throw new Error('Data JSON mentah tidak boleh kosong.');
        }
        rows = this.parseJson(req.rawData.trim());
        break;
      }

      case 'TASK_ANALYTICS': {
        datasetName = 'Telemetri Tugas & Produktivitas Agen';
        rows = await this.fetchTaskAnalytics(workspaceId);
        break;
      }

      default:
        throw new Error(`Tipe sumber data "${req.sourceType}" tidak didukung.`);
    }

    if (rows.length === 0) {
      throw new Error('Dataset tidak memiliki baris data yang valid untuk dianalisis.');
    }

    // 1. Calculate statistical summaries
    const stats = this.computeStatistics(rows);

    // 2. Synthesize Insights & Chart Configuration
    const { chartConfig, summary, insights, title } = this.synthesizeAnalysis(
      datasetName,
      req.queryPrompt,
      rows,
      stats
    );

    const sessionId = `das-${uuidv4().slice(0, 8)}`;
    const now = new Date().toISOString();

    const session: DataAnalysisSession = {
      id: sessionId,
      workspaceId,
      title,
      datasetName,
      sourceType: req.sourceType,
      queryPrompt: req.queryPrompt,
      summary,
      insights,
      stats,
      chartConfig,
      createdAt: now,
      updatedAt: now
    };

    // 3. Persist to PostgreSQL
    await pool.query(
      `
      INSERT INTO data_analysis_sessions (
        id, workspace_id, title, dataset_name, source_type, query_prompt,
        summary, insights, stats, chart_config, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
    `,
      [
        session.id,
        session.workspaceId,
        session.title,
        session.datasetName,
        session.sourceType,
        session.queryPrompt,
        session.summary,
        JSON.stringify(session.insights),
        JSON.stringify(session.stats),
        JSON.stringify(session.chartConfig),
        now,
        now
      ]
    );

    realtimeHub.broadcast('data_analyst.session_created', session);
    systemLogger.info('ORCHESTRATOR', `Sesi Data Analyst baru dibuat: [${session.id}] ${session.title}`);

    return session;
  }

  /**
   * Execute 1-click Preset Analytics Queries
   */
  static async getQuickQuery(
    type: QuickDataQueryType,
    workspaceId = 'ws-default-command-center'
  ): Promise<DataAnalysisSession> {
    switch (type) {
      case 'TASK_SUCCESS_RATES': {
        return this.analyzeData({
          sourceType: 'TASK_ANALYTICS',
          datasetName: 'Distribusi Status Tugas Proyek',
          queryPrompt: 'Analisis rasio keberhasilan, kegagalan, dan antrean tugas aktif',
          workspaceId
        });
      }

      case 'AGENT_COST_DISTRIBUTION': {
        // Query agent run metrics
        const res = await pool.query(`
          SELECT 
            COALESCE(a.name, r.agent_id) as agent_name,
            COUNT(*) as total_runs,
            COALESCE(SUM(r.prompt_tokens + r.completion_tokens), 0) as total_tokens,
            ROUND(COALESCE(SUM(r.cost_usd), 0)::numeric, 4) as total_cost_usd
          FROM agent_runs r
          LEFT JOIN ai_agents a ON r.agent_id = a.id
          GROUP BY agent_name
          ORDER BY total_tokens DESC
          LIMIT 10;
        `);

        const rows = res.rows.map((r) => ({
          Agen: r.agent_name,
          'Total Runs': parseInt(r.total_runs, 10),
          'Total Tokens': parseInt(r.total_tokens, 10),
          'Biaya USD': parseFloat(r.total_cost_usd)
        }));

        return this.analyzeData({
          sourceType: 'JSON',
          datasetName: 'Distribusi Beban & Biaya AI Agent',
          rawData: JSON.stringify(rows.length > 0 ? rows : [{ Agen: 'Default Agent', 'Total Runs': 5, 'Total Tokens': 12000, 'Biaya USD': 0.024 }]),
          queryPrompt: 'Visualisasikan pembagian token dan biaya komputasi antar AI Agent',
          workspaceId
        });
      }

      case 'TASK_PRIORITY_DISTRIBUTION': {
        const res = await pool.query(`
          SELECT 
            priority as prioritas,
            COUNT(*) as jumlah
          FROM tasks
          WHERE ($1 = '' OR workspace_id = $1)
          GROUP BY priority;
        `, [workspaceId]);

        const rows = res.rows.map((r) => ({
          Prioritas: r.prioritas,
          'Jumlah Tugas': parseInt(r.jumlah, 10)
        }));

        return this.analyzeData({
          sourceType: 'JSON',
          datasetName: 'Distribusi Prioritas Tugas Workspace',
          rawData: JSON.stringify(rows.length > 0 ? rows : [
            { Prioritas: 'LOW', 'Jumlah Tugas': 5 },
            { Prioritas: 'MEDIUM', 'Jumlah Tugas': 12 },
            { Prioritas: 'HIGH', 'Jumlah Tugas': 8 },
            { Prioritas: 'CRITICAL', 'Jumlah Tugas': 2 }
          ]),
          queryPrompt: 'Visualisasikan pembagian tugas berdasarkan tingkat urgensi dan prioritas',
          workspaceId
        });
      }

      case 'HOURLY_ACTIVITY_PEAKS': {
        const res = await pool.query(`
          SELECT 
            TO_CHAR(created_at, 'HH24:00') as jam,
            COUNT(*) as frekuensi
          FROM activities
          WHERE workspace_id = $1
          GROUP BY jam
          ORDER BY jam ASC;
        `, [workspaceId]);

        const rows = res.rows.map((r) => ({
          Waktu: r.jam,
          'Jumlah Aktivitas': parseInt(r.frekuensi, 10)
        }));

        return this.analyzeData({
          sourceType: 'JSON',
          datasetName: 'Pola Jam Sibuk Operasi Komando',
          rawData: JSON.stringify(rows.length > 0 ? rows : [
            { Waktu: '08:00', 'Jumlah Aktivitas': 12 },
            { Waktu: '11:00', 'Jumlah Aktivitas': 29 },
            { Waktu: '14:00', 'Jumlah Aktivitas': 45 },
            { Waktu: '17:00', 'Jumlah Aktivitas': 31 }
          ]),
          queryPrompt: 'Petakan lonjakan beban aktivitas operasional berdasarkan jam kerja',
          workspaceId
        });
      }

      default:
        throw new Error(`Preset query ${type} tidak dikenal.`);
    }
  }

  /**
   * List saved data analysis sessions
   */
  static async getSessions(workspaceId = 'ws-default-command-center'): Promise<DataAnalysisSession[]> {
    const res = await pool.query(
      `
      SELECT id, workspace_id, title, dataset_name, source_type, query_prompt,
             summary, insights, stats, chart_config, created_at, updated_at
      FROM data_analysis_sessions
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 40;
    `,
      [workspaceId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title,
      datasetName: r.dataset_name,
      sourceType: r.source_type,
      queryPrompt: r.query_prompt,
      summary: r.summary,
      insights: r.insights || [],
      stats: r.stats || {},
      chartConfig: r.chart_config || {},
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }

  /**
   * Get single session
   */
  static async getSession(id: string): Promise<DataAnalysisSession | null> {
    const res = await pool.query(
      `
      SELECT id, workspace_id, title, dataset_name, source_type, query_prompt,
             summary, insights, stats, chart_config, created_at, updated_at
      FROM data_analysis_sessions
      WHERE id = $1;
    `,
      [id]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];

    return {
      id: r.id,
      workspaceId: r.workspace_id,
      title: r.title,
      datasetName: r.dataset_name,
      sourceType: r.source_type,
      queryPrompt: r.query_prompt,
      summary: r.summary,
      insights: r.insights || [],
      stats: r.stats || {},
      chartConfig: r.chart_config || {},
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }

  /**
   * Delete session
   */
  static async deleteSession(id: string): Promise<boolean> {
    const res = await pool.query('DELETE FROM data_analysis_sessions WHERE id = $1;', [id]);
    return (res.rowCount || 0) > 0;
  }

  // --- Internal Parsing & Statistics Helpers ---

  /**
   * Robust CSV parser supporting quotes and commas
   */
  private static parseCsv(csvText: string): Record<string, any>[] {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new Error('CSV minimal harus memiliki 1 baris header dan 1 baris data.');
    }

    const parseLine = (line: string): string[] => {
      const result: string[] = [];
      let cur = '';
      let insideQuote = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"' || char === "'") {
          insideQuote = !insideQuote;
        } else if (char === ',' && !insideQuote) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += char;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = parseLine(lines[0]);
    const rows: Record<string, any>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i]);
      const row: Record<string, any> = {};
      let hasData = false;

      headers.forEach((h, idx) => {
        const val = values[idx] ?? '';
        if (val !== '') hasData = true;

        // Auto numeric conversion
        const num = Number(val);
        row[h] = !isNaN(num) && val.trim() !== '' ? num : val;
      });

      if (hasData) rows.push(row);
    }

    return rows;
  }

  /**
   * Robust JSON parser
   */
  private static parseJson(jsonText: string): Record<string, any>[] {
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        return parsed.filter((item) => typeof item === 'object' && item !== null);
      }
      if (typeof parsed === 'object' && parsed !== null) {
        // If object with array property
        const arrayKey = Object.keys(parsed).find((k) => Array.isArray(parsed[k]));
        if (arrayKey && Array.isArray(parsed[arrayKey])) {
          return parsed[arrayKey];
        }
        return [parsed];
      }
      throw new Error('JSON harus berupa array objek atau objek terstruktur.');
    } catch (err: any) {
      throw new Error(`Format JSON tidak valid: ${err.message}`);
    }
  }

  /**
   * Fetch Task Analytics from PostgreSQL
   */
  private static async fetchTaskAnalytics(workspaceId: string): Promise<Record<string, any>[]> {
    const res = await pool.query(
      `
      SELECT 
        status,
        COUNT(*) as total_count
      FROM tasks
      WHERE workspace_id = $1
      GROUP BY status;
    `,
      [workspaceId]
    );

    if (res.rows.length === 0) {
      return [
        { Status: 'DONE', 'Jumlah Task': 14 },
        { Status: 'IN_PROGRESS', 'Jumlah Task': 3 },
        { Status: 'PENDING', 'Jumlah Task': 6 }
      ];
    }

    return res.rows.map((r) => ({
      Status: r.status,
      'Jumlah Task': parseInt(r.total_count, 10)
    }));
  }

  /**
   * Compute Statistical Summary for all numeric fields
   */
  private static computeStatistics(rows: Record<string, any>[]): DataStatisticalSummary {
    const columns = Object.keys(rows[0] || {});
    const numericMetrics: Record<string, { min: number; max: number; avg: number; sum: number }> = {};

    for (const col of columns) {
      const values = rows
        .map((r) => r[col])
        .filter((v) => typeof v === 'number' && !isNaN(v)) as number[];

      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const sum = values.reduce((acc, cur) => acc + cur, 0);
        const avg = parseFloat((sum / values.length).toFixed(2));
        numericMetrics[col] = { min, max, avg, sum: parseFloat(sum.toFixed(2)) };
      }
    }

    return {
      totalRows: rows.length,
      columnCount: columns.length,
      columns,
      numericMetrics
    };
  }

  /**
   * Synthesize Analysis: Determines best chart type, labels, datasets, and executive insights
   */
  private static synthesizeAnalysis(
    datasetName: string,
    queryPrompt: string,
    rows: Record<string, any>[],
    stats: DataStatisticalSummary
  ): {
    chartConfig: ChartConfig;
    summary: string;
    insights: string[];
    title: string;
  } {
    const columns = stats.columns;
    const numericCols = Object.keys(stats.numericMetrics || {});

    // Identify label column (first non-numeric column, or first column)
    const labelCol = columns.find((c) => !numericCols.includes(c)) || columns[0];
    const metricCol = numericCols[0] || columns[1] || columns[0];

    const labels = rows.map((r, i) => String(r[labelCol] || `Item ${i + 1}`));
    const dataValues = rows.map((r) => Number(r[metricCol]) || 0);

    // Determine Chart Type
    let chartType: ChartType = 'bar';
    const lowerPrompt = (queryPrompt || '').toLowerCase();
    const lowerLabel = labelCol.toLowerCase();

    if (
      lowerPrompt.includes('tren') ||
      lowerPrompt.includes('trend') ||
      lowerPrompt.includes('waktu') ||
      lowerPrompt.includes('linimasa') ||
      lowerLabel.includes('date') ||
      lowerLabel.includes('waktu') ||
      lowerLabel.includes('jam') ||
      lowerLabel.includes('bulan')
    ) {
      chartType = lowerPrompt.includes('area') ? 'area' : 'line';
    } else if (
      lowerPrompt.includes('proporsi') ||
      lowerPrompt.includes('komposisi') ||
      lowerPrompt.includes('pie') ||
      (rows.length <= 6 && lowerPrompt.includes('distribusi'))
    ) {
      chartType = 'pie';
    } else {
      chartType = 'bar';
    }

    const title = queryPrompt && queryPrompt.length > 8 ? queryPrompt : `Analisis ${datasetName}`;

    // Construct Chart Datasets
    const datasets = [
      {
        label: metricCol,
        data: dataValues,
        color: PALETTE[0]
      }
    ];

    // If there is a second numeric column, add it for multi-series comparison (bar/line/area)
    if (numericCols.length > 1 && chartType !== 'pie') {
      const secondMetric = numericCols[1];
      datasets.push({
        label: secondMetric,
        data: rows.map((r) => Number(r[secondMetric]) || 0),
        color: PALETTE[1]
      });
    }

    // Generate Key Insights
    const insights: string[] = [];
    if (numericCols.length > 0) {
      const primaryStat = stats.numericMetrics![metricCol];
      if (primaryStat) {
        insights.push(
          `Nilai rata-rata untuk kolom **${metricCol}** tercatat di angka **${primaryStat.avg.toLocaleString()}** (Rentang: ${primaryStat.min.toLocaleString()} – ${primaryStat.max.toLocaleString()}).`
        );
        insights.push(
          `Total akumulatif metrik **${metricCol}** dari seluruh ${stats.totalRows} baris data adalah **${primaryStat.sum.toLocaleString()}**.`
        );
      }

      // Find top performer
      let maxIdx = 0;
      for (let i = 1; i < dataValues.length; i++) {
        if (dataValues[i] > dataValues[maxIdx]) maxIdx = i;
      }
      insights.push(
        `Entitas dengan nilai **${metricCol}** tertinggi diraih oleh **${labels[maxIdx]}** dengan catatan **${dataValues[maxIdx].toLocaleString()}**.`
      );
    } else {
      insights.push(`Dataset memuat ${stats.totalRows} entri data kategorikal tanpa nilai numerik.`);
    }

    const summary = `Hasil pemrosesan otonom data "${datasetName}" mengidentifikasi ${stats.totalRows} baris dan ${stats.columnCount} kolom berdasarkan dimensi "${labelCol}". Metrik utama yang divisualisasikan adalah "${metricCol}" menggunakan tipe grafik ${chartType.toUpperCase()}.`;

    return {
      title,
      summary,
      insights,
      chartConfig: {
        type: chartType,
        title,
        xAxisLabel: labelCol,
        yAxisLabel: metricCol,
        labels,
        datasets
      }
    };
  }
}
