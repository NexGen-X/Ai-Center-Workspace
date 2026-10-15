import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { pool } from '../src/db/index.js';
import { SreAgentService } from '../src/services/sreAgentService.js';
import { executeToolInSandbox } from '../src/services/sandbox.js';

describe('Autonomous SRE & Self-Healing Incident Agent API', () => {
  const testIncidentId = `inc-test-${Date.now().toString().slice(-6)}`;
  const testApprovalIncidentId = `inc-appr-${Date.now().toString().slice(-6)}`;

  beforeAll(async () => {
    // Insert test incidents to exercise investigation, approval gates, and remediation
    await pool.query(
      `
      INSERT INTO sre_incidents (
        id, workspace_id, incident_type, severity, status, title, description,
        diagnostics, remediation_plan, requires_approval, is_approved
      ) VALUES 
      ($1, 'ws-default-command-center', 'HIGH_MEMORY', 'HIGH', 'OPEN', 'Test RAM Spike', 'RAM usage reached 89%', '{"mem":89}', '{"playbook":"CLEAR_MEMORY_CACHE","description":"Clean page cache","isDestructive":false,"estimatedRecoverySec":5}', FALSE, FALSE),
      ($2, 'ws-default-command-center', 'HIGH_CPU', 'CRITICAL', 'OPEN', 'Test CPU Spike Requiring Approval', 'CPU load at 95%', '{"cpu":95}', '{"playbook":"RESTART_SERVICE","description":"Graceful service restart","isDestructive":true,"estimatedRecoverySec":15}', TRUE, FALSE);
    `,
      [testIncidentId, testApprovalIncidentId]
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM sre_incidents WHERE id IN ($1, $2);', [
      testIncidentId,
      testApprovalIncidentId
    ]);
  });

  it('POST /api/sre/scan should scan host telemetry and return structured health status', async () => {
    const res = await request(app).post('/api/sre/scan').send({});
    expect(res.status).toBe(200);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.metrics).toBeDefined();
    expect(typeof res.body.metrics.cpuPercent).toBe('number');
    expect(typeof res.body.metrics.memoryPercent).toBe('number');
    expect(typeof res.body.metrics.diskPercent).toBe('number');
    expect(typeof res.body.metrics.activeConnections).toBe('number');
    expect(Array.isArray(res.body.detectedIncidents)).toBe(true);
  });

  it('GET /api/sre/incidents should return list of incidents with status filtering', async () => {
    const resAll = await request(app).get('/api/sre/incidents');
    expect(resAll.status).toBe(200);
    expect(Array.isArray(resAll.body)).toBe(true);
    expect(resAll.body.some((i: any) => i.id === testIncidentId)).toBe(true);

    const resOpen = await request(app).get('/api/sre/incidents?status=OPEN');
    expect(resOpen.status).toBe(200);
    expect(resOpen.body.every((i: any) => i.status === 'OPEN')).toBe(true);
  });

  it('GET /api/sre/incidents/:id should retrieve single incident details or 404', async () => {
    const res = await request(app).get(`/api/sre/incidents/${testIncidentId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testIncidentId);
    expect(res.body.incidentType).toBe('HIGH_MEMORY');

    const res404 = await request(app).get('/api/sre/incidents/inc-non-existent-999');
    expect(res404.status).toBe(404);
  });

  it('POST /api/sre/incidents/:id/investigate should perform deep diagnostics and root cause analysis', async () => {
    const res = await request(app).post(`/api/sre/incidents/${testIncidentId}/investigate`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('INVESTIGATING');
    expect(res.body.diagnostics.investigatedAt).toBeDefined();
    expect(res.body.diagnostics.rootCauseAnalysis).toBeDefined();
    expect(res.body.diagnostics.rootCauseAnalysis.probableCause).toBeDefined();
  });

  it('POST /api/sre/incidents/:id/remediate should block destructive playbooks when approval is missing', async () => {
    const res = await request(app).post(`/api/sre/incidents/${testApprovalIncidentId}/remediate`).send({
      operatorApproved: false
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('persetujuan operator');
  });

  it('POST /api/sre/incidents/:id/approve should authorize and execute remediation with post-mortem', async () => {
    const res = await request(app).post(`/api/sre/incidents/${testApprovalIncidentId}/approve`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.isApproved).toBe(true);
    expect(res.body.actionTaken).toBeDefined();
    expect(res.body.postMortem).toContain('POST-MORTEM REPORT');
    expect(res.body.postMortem).toContain('Tindakan Pencegahan Jangka Panjang');
    expect(res.body.resolvedAt).toBeDefined();
  });

  it('POST /api/sre/incidents/:id/remediate should self-heal non-destructive incidents autonomously', async () => {
    const res = await request(app).post(`/api/sre/incidents/${testIncidentId}/remediate`).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.actionTaken).toContain('pembersihan');
    expect(res.body.postMortem).toContain(testIncidentId);
  });

  it('Sandbox Tool sre_scan should execute through executeToolInSandbox', async () => {
    const toolRes = await executeToolInSandbox('sre_scan', {
      workspaceId: 'ws-default-command-center'
    });
    expect(toolRes.success).toBe(true);
    expect(toolRes.output).toContain('[SRE HEALTH SCAN]');
    expect(toolRes.output).toContain('CPU:');
  });
});
