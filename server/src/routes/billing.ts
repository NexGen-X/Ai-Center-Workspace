/**
 * Billing & Subscription API Routes — AI Agent Command Center
 */

import { Router, Request, Response } from 'express';
import { pool } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { QuotaService } from '../services/quotaService.js';
import { realtimeHub } from '../services/realtime.js';
import { WorkspacePlanDetails, WorkspacePlan } from '../../../shared/types.js';

export const billingRouter = Router();

// Standard SaaS Pricing Plans
export const SAAS_PLANS: Record<WorkspacePlan, WorkspacePlanDetails> = {
  FREE: {
    id: 'FREE',
    name: 'Free Trial',
    tagline: 'Eksplorasi tim AI otonom untuk individu & tim kecil',
    priceIdr: 0,
    priceUsd: 0,
    taskQuotaLimit: 50,
    agentLimit: 3,
    memberLimit: 1,
    workspaceLimit: 1,
    features: [
      '50 tugas AI per bulan',
      'Hingga 3 agen AI otonom',
      'Akses 3D Cybernetic Workspace Twin',
      'RAG Knowledge Base episodik dasar',
      'Dukungan komunitas Discord'
    ]
  },
  STARTER: {
    id: 'STARTER',
    name: 'Starter Tim',
    tagline: 'Otomatisasi alur kerja harian untuk startup & software house',
    priceIdr: 499000,
    priceUsd: 35,
    taskQuotaLimit: 500,
    agentLimit: 10,
    memberLimit: 5,
    workspaceLimit: 1,
    isPopular: true,
    features: [
      '500 tugas AI per bulan',
      'Hingga 10 agen AI terkoordinasi',
      'Multi-Provider Failover Matrix (Anti-Downtime)',
      '✨ AI Prompt Polish Formulator',
      '5 kursi anggota tim (Human Operators)',
      'Ekspor deliverable 1-klik (.md & clipboard)',
      'Dukungan email prioritas (24 jam)'
    ]
  },
  BUSINESS: {
    id: 'BUSINESS',
    name: 'Business Scale',
    tagline: 'Kekuatan penuh AI Swarm & QA Self-Correction untuk skala bisnis',
    priceIdr: 1999000,
    priceUsd: 130,
    taskQuotaLimit: 2500,
    agentLimit: 999,
    memberLimit: 20,
    workspaceLimit: 3,
    features: [
      '2.500 tugas AI per bulan',
      'Unlimited agen AI & kustomisasi peran',
      'Autonomous Swarm dengan QA Self-Correction Loop',
      '3 Workspace organisasi terisolasi',
      '20 kursi anggota tim & RBAC bertingkat',
      'Log Audit Kepatuhan Regulasi (CSV & JSON)',
      'Sandbox eksekusi kode terisolasi (30s limit)',
      'Dukungan prioritas WhatsApp / Slack langsung'
    ]
  },
  ENTERPRISE: {
    id: 'ENTERPRISE',
    name: 'Enterprise Custom',
    tagline: 'Infrastruktur privat berdedikasi & kepatuhan tingkat korporasi',
    priceIdr: 9999000,
    priceUsd: 650,
    taskQuotaLimit: 15000,
    agentLimit: 999,
    memberLimit: 999,
    workspaceLimit: 999,
    features: [
      '15.000+ tugas AI per bulan (fleksibel)',
      'Unlimited agen, anggota tim, & workspace',
      'Dedicated private database & pgvector index',
      'Integrasi Custom Model Context Protocol (MCP)',
      'SLA Ketersediaan 99.9% dengan jaminan failover',
      'Dukungan implementasi on-premise / private cloud',
      'Dedicated Technical Account Manager'
    ]
  }
};

// GET /api/billing/plans — Get all available subscription plans
billingRouter.get('/plans', (_req: Request, res: Response) => {
  res.json(Object.values(SAAS_PLANS));
});

// GET /api/billing/usage — Get current workspace's usage & quota
billingRouter.get('/usage', async (req: Request, res: Response) => {
  try {
    const wsId = (req.headers['x-workspace-id'] || req.query.workspaceId || 'ws-default-command-center').toString().trim();
    const stats = await QuotaService.getUsageStats(wsId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// POST /api/billing/upgrade — Process subscription upgrade
billingRouter.post('/upgrade', async (req: Request, res: Response) => {
  try {
    const { targetPlan, interval = 'MONTHLY', paymentMethod = 'SIMULATED_INSTANT_PAY' } = req.body;
    const wsId = (req.headers['x-workspace-id'] || req.body?.workspaceId || 'ws-default-command-center').toString().trim();

    if (!targetPlan || !SAAS_PLANS[targetPlan as WorkspacePlan]) {
      return res.status(400).json({
        error: { message: `Paket "${targetPlan}" tidak valid. Pilihan: STARTER, BUSINESS, ENTERPRISE.` }
      });
    }

    const selectedPlan = SAAS_PLANS[targetPlan as WorkspacePlan];
    const isAnnual = interval === 'ANNUALLY';
    const amount = isAnnual ? Math.round(selectedPlan.priceIdr * 12 * 0.8) : selectedPlan.priceIdr;
    const daysToAdd = isAnnual ? 365 : 30;

    // Update workspace record
    await pool.query(`
      UPDATE workspaces
      SET plan = $1,
          plan_status = 'ACTIVE',
          task_quota_limit = $2,
          billing_cycle_start = CURRENT_TIMESTAMP,
          billing_cycle_end = CURRENT_TIMESTAMP + ($3 || ' days')::INTERVAL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [targetPlan, selectedPlan.taskQuotaLimit, `${daysToAdd}`, wsId]);

    // Record invoice
    const invoiceId = `inv-${uuidv4().slice(0, 8)}`;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${targetPlan}`;

    await pool.query(`
      INSERT INTO workspace_invoices (
        id, workspace_id, invoice_number, amount_idr, plan, interval, status, payment_method, paid_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'PAID', $7, CURRENT_TIMESTAMP)
    `, [invoiceId, wsId, invoiceNumber, amount, targetPlan, interval, paymentMethod]);

    // Record audit activity
    await pool.query(`
      INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
      VALUES ($1, $2, 'USER', 'operator', 'Billing System', 'subscription.upgraded', $3, 'WORKSPACE', $4)
    `, [`act-${uuidv4().slice(0, 8)}`, wsId, `Paket workspace berhasil di-upgrade ke ${selectedPlan.name} (${selectedPlan.taskQuotaLimit} tugas/bln)`, wsId]);

    realtimeHub.broadcast('workspace.plan_updated', {
      workspaceId: wsId,
      plan: targetPlan,
      taskQuotaLimit: selectedPlan.taskQuotaLimit
    });

    const updatedStats = await QuotaService.getUsageStats(wsId);

    res.json({
      success: true,
      message: `Selamat! Workspace berhasil ditingkatkan ke paket ${selectedPlan.name}. Kuota Anda kini menjadi ${selectedPlan.taskQuotaLimit} tugas.`,
      invoice: {
        invoiceNumber,
        amountIdr: amount,
        plan: targetPlan,
        interval,
        status: 'PAID'
      },
      usage: updatedStats
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// GET /api/billing/invoices — Get payment and invoice history
billingRouter.get('/invoices', async (req: Request, res: Response) => {
  try {
    const wsId = (req.headers['x-workspace-id'] || req.query.workspaceId || 'ws-default-command-center').toString().trim();
    const result = await pool.query(`
      SELECT id, workspace_id, invoice_number, amount_idr, plan, interval, status, payment_method, paid_at, created_at
      FROM workspace_invoices
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 50;
    `, [wsId]);

    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: { message: err.message } });
  }
});
