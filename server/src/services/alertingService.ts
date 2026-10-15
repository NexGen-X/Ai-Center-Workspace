/**
 * Outbound Alerting & Webhook Incident Dispatcher Service
 * Dispatches real-time incident notifications to Discord, Slack, Telegram, and Generic Webhooks.
 */

import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import {
  AlertPlatform,
  AlertEventType,
  AlertWebhookItem,
  AlertPayload,
  AlertDeliveryLog
} from '../../../shared/types.js';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class AlertingService {
  /**
   * Formats payload specifically tailored for Discord webhook embeds
   */
  static formatDiscordPayload(alert: AlertPayload): any {
    const colorMap: Record<string, number> = {
      CRITICAL: 15746887, // Red #ef4444
      WARNING: 16098859,  // Amber #f59e0b
      INFO: 6514417       // Indigo #6366f1
    };

    const color = colorMap[alert.severity || 'INFO'] || 6514417;

    const fields = [
      { name: 'Event', value: `\`${alert.event}\``, inline: true },
      { name: 'Severity', value: alert.severity || 'INFO', inline: true },
      { name: 'Waktu', value: new Date(alert.timestamp || Date.now()).toLocaleTimeString('id-ID'), inline: true }
    ];

    if (alert.metadata) {
      for (const [key, val] of Object.entries(alert.metadata)) {
        if (fields.length >= 10) break;
        const valStr = typeof val === 'object' ? JSON.stringify(val).slice(0, 100) : String(val).slice(0, 100);
        fields.push({
          name: key.replace(/_/g, ' ').toUpperCase(),
          value: valStr || '-',
          inline: true
        });
      }
    }

    return {
      username: 'AI Center Incident Bot',
      avatar_url: 'https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/bot.svg',
      embeds: [
        {
          title: `[${alert.severity || 'INFO'}] ${alert.title}`,
          description: alert.message,
          color,
          fields,
          footer: {
            text: 'AI Agent Command Center • Autonomous Incident Dispatcher'
          },
          timestamp: alert.timestamp || new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Formats payload specifically tailored for Slack incoming webhooks
   */
  static formatSlackPayload(alert: AlertPayload): any {
    const colorMap: Record<string, string> = {
      CRITICAL: '#ef4444',
      WARNING: '#f59e0b',
      INFO: '#6366f1'
    };

    const color = colorMap[alert.severity || 'INFO'] || '#6366f1';

    const fields: Array<{ title: string; value: string; short: boolean }> = [
      { title: 'Event', value: String(alert.event), short: true },
      { title: 'Severity', value: String(alert.severity || 'INFO'), short: true }
    ];

    if (alert.metadata) {
      for (const [key, val] of Object.entries(alert.metadata)) {
        if (fields.length >= 8) break;
        const valStr = typeof val === 'object' ? JSON.stringify(val).slice(0, 100) : String(val).slice(0, 100);
        fields.push({
          title: key.replace(/_/g, ' ').toUpperCase(),
          value: valStr || '-',
          short: true
        });
      }
    }

    return {
      text: `*[${alert.severity || 'INFO'}] ${alert.title}*\n${alert.message}`,
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          fields,
          ts: Math.floor(Date.now() / 1000)
        }
      ]
    };
  }

  /**
   * Formats payload tailored for Telegram Bot API sendMessage
   */
  static formatTelegramPayload(alert: AlertPayload, secretToken?: string): any {
    const icon = alert.severity === 'CRITICAL' ? '🚨' : alert.severity === 'WARNING' ? '⚠️' : 'ℹ️';
    let text = `${icon} <b>[${alert.severity || 'INFO'}] AI Center Notification</b>\n`;
    text += `<b>${escapeHtml(alert.title)}</b>\n\n`;
    text += `${escapeHtml(alert.message)}\n\n`;
    text += `<b>Event:</b> <code>${escapeHtml(alert.event)}</code>\n`;
    text += `<b>Waktu:</b> ${new Date(alert.timestamp || Date.now()).toISOString()}\n`;

    if (alert.metadata && Object.keys(alert.metadata).length > 0) {
      text += `\n<b>Metadata:</b>\n`;
      for (const [k, v] of Object.entries(alert.metadata)) {
        const valStr = typeof v === 'object' ? JSON.stringify(v).slice(0, 80) : String(v).slice(0, 80);
        text += `• ${escapeHtml(k)}: <code>${escapeHtml(valStr)}</code>\n`;
      }
    }

    const payload: any = {
      text,
      parse_mode: 'HTML'
    };

    if (secretToken && secretToken.trim().length > 0) {
      // In Telegram, secretToken can store chat_id (e.g. -100123456789 or @channel)
      payload.chat_id = secretToken.trim();
    }

    return payload;
  }

  /**
   * Formats generic JSON webhook payload
   */
  static formatGenericPayload(alert: AlertPayload): any {
    return {
      event: alert.event,
      title: alert.title,
      message: alert.message,
      severity: alert.severity || 'INFO',
      metadata: alert.metadata || {},
      timestamp: alert.timestamp || new Date().toISOString(),
      source: 'AI-Center-Autonomous-Platform'
    };
  }

  /**
   * Formats body based on target platform
   */
  static formatBody(platform: AlertPlatform, alert: AlertPayload, secretToken?: string): any {
    switch (platform) {
      case 'DISCORD':
        return this.formatDiscordPayload(alert);
      case 'SLACK':
        return this.formatSlackPayload(alert);
      case 'TELEGRAM':
        return this.formatTelegramPayload(alert, secretToken);
      case 'GENERIC':
      default:
        return this.formatGenericPayload(alert);
    }
  }

  /**
   * Dispatches an alert asynchronously to all subscribed active webhooks
   */
  static async dispatchAlert(alert: AlertPayload, workspaceId = 'ws-default-command-center'): Promise<void> {
    try {
      const now = new Date().toISOString();
      const payloadWithTime: AlertPayload = {
        ...alert,
        timestamp: alert.timestamp || now
      };

      // Retrieve all active webhooks for this workspace
      const webhooksRes = await pool.query(
        `SELECT id, workspace_id, name, platform, webhook_url, secret_token, events, is_active, created_at, updated_at
         FROM alert_webhooks
         WHERE workspace_id = $1 AND is_active = true`,
        [workspaceId]
      );

      if (webhooksRes.rows.length === 0) {
        return;
      }

      const activeWebhooks: AlertWebhookItem[] = webhooksRes.rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspace_id,
        name: r.name,
        platform: r.platform,
        webhookUrl: r.webhook_url,
        secretToken: r.secret_token || undefined,
        events: Array.isArray(r.events) ? r.events : JSON.parse(r.events || '[]'),
        isActive: r.is_active,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));

      // Filter webhooks that subscribe to this specific event
      const targets = activeWebhooks.filter(
        (wh) => wh.events.includes(alert.event) || wh.events.includes('*' as any)
      );

      if (targets.length === 0) {
        return;
      }

      // Dispatch to each target concurrently
      await Promise.allSettled(
        targets.map((wh) => this.sendToWebhook(wh, payloadWithTime))
      );
    } catch (err: any) {
      console.error('[AlertingService] Failed to dispatch alerts:', err.message);
    }
  }

  /**
   * Sends alert to a single webhook destination and records delivery log
   */
  static async sendToWebhook(
    webhook: AlertWebhookItem,
    alert: AlertPayload
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const deliveryId = `deliv-${uuidv4().slice(0, 8)}`;
    const formattedBody = this.formatBody(webhook.platform, alert, webhook.secretToken);

    let statusCode: number | undefined = undefined;
    let isSuccess = false;
    let errorMessage: string | undefined = undefined;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Center-Alerting/1.0'
      };

      // If generic webhook and secretToken provided, pass as Authorization or X-Webhook-Secret
      if (webhook.platform === 'GENERIC' && webhook.secretToken) {
        headers['X-Webhook-Secret'] = webhook.secretToken;
      }

      const response = await fetch(webhook.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(formattedBody),
        signal: controller.signal
      });

      clearTimeout(timeout);
      statusCode = response.status;
      isSuccess = response.ok;

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        errorMessage = `HTTP ${response.status}: ${errorText.slice(0, 300)}`;
      }
    } catch (fetchErr: any) {
      isSuccess = false;
      errorMessage = fetchErr.name === 'AbortError' ? 'Request timed out after 7s' : fetchErr.message;
    }

    // Record delivery outcome in PostgreSQL
    try {
      await pool.query(
        `INSERT INTO alert_deliveries (id, webhook_id, workspace_id, event_type, payload, status_code, success, error_message)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          deliveryId,
          webhook.id,
          webhook.workspaceId,
          alert.event,
          JSON.stringify(alert),
          statusCode || null,
          isSuccess,
          errorMessage || null
        ]
      );
    } catch (dbErr: any) {
      console.error('[AlertingService] Failed to record delivery log:', dbErr.message);
    }

    return { success: isSuccess, statusCode, error: errorMessage };
  }

  /**
   * Tests a specific webhook with a sample ping notification
   */
  static async testWebhook(webhookId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const res = await pool.query(
      `SELECT id, workspace_id, name, platform, webhook_url, secret_token, events, is_active, created_at, updated_at
       FROM alert_webhooks
       WHERE id = $1`,
      [webhookId]
    );

    if (res.rows.length === 0) {
      throw new Error(`Webhook "${webhookId}" tidak ditemukan.`);
    }

    const row = res.rows[0];
    const webhook: AlertWebhookItem = {
      id: row.id,
      workspaceId: row.workspace_id,
      name: row.name,
      platform: row.platform,
      webhookUrl: row.webhook_url,
      secretToken: row.secret_token || undefined,
      events: Array.isArray(row.events) ? row.events : JSON.parse(row.events || '[]'),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    const testAlert: AlertPayload = {
      event: 'SYSTEM_ANOMALY',
      title: 'Uji Konektivitas Webhook AI Center',
      message: `Tes integrasi webhook ${webhook.platform} "${webhook.name}" berhasil terhubung ke AI Agent Command Center.`,
      severity: 'INFO',
      metadata: {
        platform: webhook.platform,
        status: 'ONLINE',
        node_env: process.env.NODE_ENV || 'production'
      },
      timestamp: new Date().toISOString()
    };

    return this.sendToWebhook(webhook, testAlert);
  }
}
