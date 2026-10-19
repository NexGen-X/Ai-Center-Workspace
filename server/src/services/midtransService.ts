/**
 * Midtrans Payment Gateway Integration Service
 * ID-Tech Cloud — Enterprise Subscription & Snap Checkout
 */

import crypto from 'crypto';
import { pool } from '../db/index.js';
import { SAAS_PLANS } from '../routes/billing.js';
import { realtimeHub } from './realtime.js';
import { systemLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';
import { WorkspacePlan } from '../../../shared/types.js';

export class MidtransService {
  private static get serverKey(): string {
    const key = process.env.MIDTRANS_SERVER_KEY;
    if (!key) {
      throw new Error('MIDTRANS_SERVER_KEY environment variable is not configured');
    }
    return key.trim();
  }

  public static get clientKey(): string {
    return (process.env.MIDTRANS_CLIENT_KEY || '').trim();
  }

  public static get isProduction(): boolean {
    const isProdEnv = process.env.MIDTRANS_IS_PRODUCTION;
    if (isProdEnv !== undefined) {
      return isProdEnv === 'true';
    }
    // Auto-detect from server key prefix (Mid- vs SB-Mid-)
    return !this.serverKey.startsWith('SB-');
  }

  private static get snapApiUrl(): string {
    return this.isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
  }

  /**
   * Create a Midtrans Snap Transaction Token
   */
  public static async createSnapTransaction(params: {
    invoiceNumber: string;
    amountIdr: number;
    planId: WorkspacePlan;
    interval: 'MONTHLY' | 'ANNUALLY';
    workspaceId: string;
    customerName: string;
    customerEmail: string;
  }): Promise<{ snapToken: string; redirectUrl: string }> {
    const plan = SAAS_PLANS[params.planId];
    if (!plan) {
      throw new Error(`Paket ${params.planId} tidak valid.`);
    }

    const authHeader = `Basic ${Buffer.from(`${this.serverKey}:`).toString('base64')}`;

    const payload = {
      transaction_details: {
        order_id: params.invoiceNumber,
        gross_amount: Math.round(params.amountIdr)
      },
      item_details: [
        {
          id: params.planId,
          price: Math.round(params.amountIdr),
          quantity: 1,
          name: `ID-Tech Cloud ${plan.name} (${params.interval === 'ANNUALLY' ? 'Tahunan' : 'Bulanan'})`
        }
      ],
      customer_details: {
        first_name: params.customerName || 'Pelanggan ID-Tech Cloud',
        email: params.customerEmail || 'billing@id-tech.cloud'
      },
      custom_field1: params.workspaceId,
      custom_field2: params.planId,
      custom_field3: params.interval,
      callbacks: {
        finish: 'https://app.id-tech.cloud/?payment_status=success'
      }
    };

    systemLogger.info('API', `[Midtrans] Creating Snap transaction for order ${params.invoiceNumber} (Rp ${params.amountIdr})`);

    const response = await fetch(this.snapApiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(payload)
    });

    const data: any = await response.json();

    if (!response.ok || !data.token) {
      const errMsg = data?.error_messages?.join(', ') || data?.message || 'Gagal menghubungi Midtrans Snap API.';
      systemLogger.error('API', `[Midtrans] Snap API Error: ${errMsg}`, data);
      throw new Error(`Midtrans Error: ${errMsg}`);
    }

    return {
      snapToken: data.token,
      redirectUrl: data.redirect_url
    };
  }

  /**
   * Verify Midtrans Webhook Notification Signature (SHA-512)
   */
  public static verifySignature(notification: {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key: string;
  }): boolean {
    if (!notification.order_id || !notification.status_code || !notification.gross_amount || !notification.signature_key) {
      return false;
    }

    const raw = `${notification.order_id}${notification.status_code}${notification.gross_amount}${this.serverKey}`;
    const expectedHash = crypto.createHash('sha512').update(raw).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expectedHash.toLowerCase()),
      Buffer.from(notification.signature_key.toLowerCase())
    );
  }

  /**
   * Process Midtrans Payment Notification Webhook
   */
  public static async handleWebhookNotification(notification: any): Promise<{
    processed: boolean;
    orderId: string;
    status: string;
  }> {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
      payment_type,
      transaction_id
    } = notification;

    systemLogger.info('API', `[Midtrans] Received webhook for order ${order_id}: status=${transaction_status}, fraud=${fraud_status}, type=${payment_type}`);

    // 1. Verify signature authenticity
    const isValidSignature = this.verifySignature({
      order_id,
      status_code,
      gross_amount,
      signature_key
    });

    if (!isValidSignature) {
      systemLogger.warn('SECURITY', `[Midtrans] Invalid signature for order ${order_id}! Potential forgery attempt.`);
      throw new Error('Invalid signature hash');
    }

    // 2. Determine success state
    let isSuccess = false;
    let isFailed = false;

    if (transaction_status === 'capture') {
      if (fraud_status === 'accept') {
        isSuccess = true;
      }
    } else if (transaction_status === 'settlement') {
      isSuccess = true;
    } else if (['cancel', 'deny', 'expire'].includes(transaction_status)) {
      isFailed = true;
    }

    // 3. Locate invoice
    const invRes = await pool.query(`
      SELECT id, workspace_id, plan, interval, status
      FROM workspace_invoices
      WHERE invoice_number = $1
    `, [order_id]);

    if (invRes.rows.length === 0) {
      systemLogger.warn('API', `[Midtrans] Invoice ${order_id} not found in database.`);
      return { processed: false, orderId: order_id, status: 'NOT_FOUND' };
    }

    const invoice = invRes.rows[0];

    // 4. Update status accordingly
    if (isSuccess && invoice.status !== 'PAID') {
      const plan = SAAS_PLANS[invoice.plan as WorkspacePlan];
      const isAnnual = invoice.interval === 'ANNUALLY';
      const daysToAdd = isAnnual ? 365 : 30;

      // Update invoice to PAID
      await pool.query(`
        UPDATE workspace_invoices
        SET status = 'PAID',
            payment_method = $1,
            payment_gateway_ref = $2,
            paid_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [payment_type || 'MIDTRANS', transaction_id, invoice.id]);

      // Upgrade workspace plan and quota
      await pool.query(`
        UPDATE workspaces
        SET plan = $1,
            plan_status = 'ACTIVE',
            task_quota_limit = $2,
            billing_cycle_start = CURRENT_TIMESTAMP,
            billing_cycle_end = CURRENT_TIMESTAMP + ($3 || ' days')::INTERVAL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [invoice.plan, plan.taskQuotaLimit, `${daysToAdd}`, invoice.workspace_id]);

      // Audit log
      await pool.query(`
        INSERT INTO activities (id, workspace_id, actor_type, actor_id, actor_name, event_type, summary, target_type, target_id)
        VALUES ($1, $2, 'SYSTEM', 'midtrans', 'Payment Gateway', 'subscription.payment_settled', $3, 'WORKSPACE', $4)
      `, [
        `act-${uuidv4().slice(0, 8)}`,
        invoice.workspace_id,
        `Pembayaran berhasil via ${payment_type?.toUpperCase() || 'Midtrans'}. Workspace aktif di paket ${plan.name} (${plan.taskQuotaLimit} tasks).`,
        invoice.workspace_id
      ]);

      // Broadcast real-time websocket/SSE event
      realtimeHub.broadcast('workspace.plan_updated', {
        workspaceId: invoice.workspace_id,
        plan: invoice.plan,
        taskQuotaLimit: plan.taskQuotaLimit
      });

      systemLogger.info('API', `[Midtrans] Order ${order_id} successfully settled! Workspace ${invoice.workspace_id} upgraded to ${invoice.plan}.`);
      return { processed: true, orderId: order_id, status: 'PAID' };
    } else if (isFailed) {
      await pool.query(`
        UPDATE workspace_invoices
        SET status = 'EXPIRED',
            payment_gateway_ref = $1
        WHERE id = $2
      `, [transaction_id, invoice.id]);

      systemLogger.info('API', `[Midtrans] Order ${order_id} marked as failed/expired.`);
      return { processed: true, orderId: order_id, status: 'FAILED' };
    }

    return { processed: true, orderId: order_id, status: transaction_status };
  }
}
