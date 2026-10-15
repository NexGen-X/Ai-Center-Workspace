import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AlertingService } from '../src/services/alertingService.js';
import { AlertPayload, AlertWebhookItem } from '../../shared/types.js';
import { pool } from '../src/db/index.js';

describe('AlertingService Unit & Integration Tests', () => {
  const samplePayload: AlertPayload = {
    event: 'SECURITY_ALERT',
    title: 'Terdeteksi Serangan SSRF',
    message: 'Upaya akses IP internal 169.254.169.254 diblokir oleh sandbox.',
    severity: 'CRITICAL',
    metadata: {
      blocked_ip: '169.254.169.254',
      actor: 'Agent-Zero'
    },
    timestamp: '2026-10-15T04:00:00.000Z'
  };

  it('formats Discord payload with rich embed and correct severity color', () => {
    const discordBody = AlertingService.formatDiscordPayload(samplePayload);

    expect(discordBody.username).toBe('AI Center Incident Bot');
    expect(discordBody.embeds).toBeDefined();
    expect(discordBody.embeds.length).toBe(1);

    const embed = discordBody.embeds[0];
    expect(embed.title).toContain('[CRITICAL]');
    expect(embed.title).toContain('Terdeteksi Serangan SSRF');
    expect(embed.description).toContain('Upaya akses IP internal');
    // CRITICAL color is red (15746887)
    expect(embed.color).toBe(15746887);

    const eventField = embed.fields.find((f: any) => f.name === 'Event');
    expect(eventField).toBeDefined();
    expect(eventField.value).toContain('SECURITY_ALERT');

    const ipField = embed.fields.find((f: any) => f.name === 'BLOCKED IP');
    expect(ipField).toBeDefined();
    expect(ipField.value).toBe('169.254.169.254');
  });

  it('formats Slack payload with attachments and field attachments', () => {
    const slackBody = AlertingService.formatSlackPayload(samplePayload);

    expect(slackBody.text).toContain('*[CRITICAL] Terdeteksi Serangan SSRF*');
    expect(slackBody.attachments).toBeDefined();
    expect(slackBody.attachments.length).toBe(1);

    const att = slackBody.attachments[0];
    expect(att.color).toBe('#ef4444');
    expect(att.title).toBe(samplePayload.title);
    expect(att.text).toBe(samplePayload.message);

    const eventField = att.fields.find((f: any) => f.title === 'Event');
    expect(eventField.value).toBe('SECURITY_ALERT');
  });

  it('formats Telegram payload with escaped HTML and chat_id', () => {
    const telegramBody = AlertingService.formatTelegramPayload(samplePayload, '-100987654321');

    expect(telegramBody.parse_mode).toBe('HTML');
    expect(telegramBody.chat_id).toBe('-100987654321');
    expect(telegramBody.text).toContain('🚨 <b>[CRITICAL] AI Center Notification</b>');
    expect(telegramBody.text).toContain('Terdeteksi Serangan SSRF');
    expect(telegramBody.text).toContain('<code>SECURITY_ALERT</code>');
  });

  it('escapes HTML tags properly in Telegram payload to prevent format breaking', () => {
    const payloadWithTags: AlertPayload = {
      event: 'SYSTEM_ANOMALY',
      title: 'Alert <script>alert(1)</script> & Warning',
      message: 'Found <div class="bad">tag</div> & symbols',
      severity: 'WARNING'
    };

    const telegramBody = AlertingService.formatTelegramPayload(payloadWithTags);
    expect(telegramBody.text).not.toContain('<script>');
    expect(telegramBody.text).toContain('&lt;script&gt;');
    expect(telegramBody.text).toContain('&amp;');
  });

  it('formats Generic webhook payload with standard timestamp and source', () => {
    const genericBody = AlertingService.formatGenericPayload(samplePayload);

    expect(genericBody.event).toBe('SECURITY_ALERT');
    expect(genericBody.severity).toBe('CRITICAL');
    expect(genericBody.title).toBe(samplePayload.title);
    expect(genericBody.source).toBe('AI-Center-Autonomous-Platform');
    expect(genericBody.metadata.blocked_ip).toBe('169.254.169.254');
  });

  it('dispatches to active webhooks and records delivery history', async () => {
    // Insert a test webhook in database
    const testWhId = `test-wh-${Date.now()}`;
    await pool.query(
      `INSERT INTO alert_webhooks (id, workspace_id, name, platform, webhook_url, events, is_active)
       VALUES ($1, 'ws-default-command-center', 'Test Mock Webhook', 'GENERIC', 'http://127.0.0.1:9999/mock-sink', '["SECURITY_ALERT"]'::jsonb, true)`,
      [testWhId]
    );

    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => 'OK'
    } as any);

    try {
      await AlertingService.dispatchAlert(samplePayload, 'ws-default-command-center');

      // Check delivery record in database
      const delivRes = await pool.query(
        `SELECT * FROM alert_deliveries WHERE webhook_id = $1`,
        [testWhId]
      );

      expect(delivRes.rows.length).toBeGreaterThan(0);
      const delivery = delivRes.rows[0];
      expect(delivery.event_type).toBe('SECURITY_ALERT');
      expect(delivery.success).toBe(true);
      expect(delivery.status_code).toBe(200);
    } finally {
      global.fetch = originalFetch;
      // Cleanup
      await pool.query(`DELETE FROM alert_webhooks WHERE id = $1`, [testWhId]);
    }
  });
});
