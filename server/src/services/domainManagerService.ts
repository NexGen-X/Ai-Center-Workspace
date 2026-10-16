/**
 * Automated Custom Domain & SSL Provisioning Service — AI Agent Command Center
 * Supports Hostinger, Cloudflare (DNS-Only & Proxied Orange Cloud), and Direct DNS.
 * Safely generates and validates Caddy reverse-proxy blocks with zero manual cert management.
 */

import dns from 'dns';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/index.js';
import {
  CustomDomain,
  CheckDomainDnsResponse,
  ProvisionDomainResponse,
  DomainManagerInfoResponse
} from '../../../shared/types.js';
import { systemLogger } from './logger.js';

const execAsync = promisify(exec);

export class DomainManagerService {
  public static readonly SERVER_PUBLIC_IP = '13.212.164.108';
  private static readonly CADDY_DOMAINS_FILE = '/etc/caddy/custom_domains.caddy';
  private static readonly CADDY_MAIN_FILE = '/etc/caddy/Caddyfile';

  // Known Cloudflare Anycast IPv4 CIDR Prefixes
  private static readonly CLOUDFLARE_PREFIXES = [
    '104.16.', '104.17.', '104.18.', '104.19.', '104.20.', '104.21.', '104.22.', '104.23.',
    '104.24.', '104.25.', '104.26.', '104.27.', '172.64.', '172.65.', '172.66.', '172.67.',
    '162.158.', '162.159.', '108.162.', '173.245.', '103.21.', '103.22.', '103.31.',
    '141.101.', '190.93.', '188.114.', '197.234.', '198.41.', '131.0.'
  ];

  /**
   * Sanitizes domain string
   */
  static cleanDomainName(raw: string): string {
    if (!raw) return '';
    return raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '')
      .replace(/^[.\s]+|[.\s]+$/g, '');
  }

  /**
   * Validates domain regex according to RFC 1035
   */
  static isValidDomain(domain: string): boolean {
    if (!domain || domain.length > 253) return false;
    const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]{1,63}\.)+[a-zA-Z]{2,63}$/;
    return domainRegex.test(domain);
  }

  /**
   * Checks whether an IP belongs to Cloudflare Anycast CDN
   */
  static isCloudflareIp(ip: string): boolean {
    return this.CLOUDFLARE_PREFIXES.some(prefix => ip.startsWith(prefix));
  }

  /**
   * Resolves DNS A-records and validates against server public IP or Cloudflare proxy
   */
  static async checkDomainDns(rawDomain: string): Promise<CheckDomainDnsResponse> {
    const domain = this.cleanDomainName(rawDomain);
    if (!this.isValidDomain(domain)) {
      throw new Error(`Format domain "${rawDomain}" tidak valid. Contoh yang benar: ai.domainanda.com atau domainanda.com`);
    }

    let detectedIps: string[] = [];
    try {
      detectedIps = await dns.promises.resolve4(domain);
    } catch (err: any) {
      systemLogger.warn('SYSTEM', `DNS resolve failed for domain ${domain}: ${err?.message}`);
      detectedIps = [];
    }

    // Check if domain is already configured in DB
    const dbRes = await pool.query(`SELECT id FROM custom_domains WHERE domain_name = $1`, [domain]);
    const isConfigured = dbRes.rows.length > 0;

    const hasDirectMatch = detectedIps.includes(this.SERVER_PUBLIC_IP);
    const hasCloudflareProxy = detectedIps.some(ip => this.isCloudflareIp(ip));

    let isMatch = false;
    let dnsMode: 'DIRECT' | 'CLOUDFLARE_PROXY' | 'UNRESOLVED' | 'MISMATCH' = 'UNRESOLVED';
    let message = '';

    if (detectedIps.length === 0) {
      dnsMode = 'UNRESOLVED';
      isMatch = false;
      message = `DNS domain "${domain}" belum terdeteksi. Silakan tambahkan DNS A Record di Cloudflare / Hostinger mengarah ke ${this.SERVER_PUBLIC_IP}.`;
    } else if (hasDirectMatch) {
      dnsMode = 'DIRECT';
      isMatch = true;
      message = `DNS Cocok Sempurna! Domain "${domain}" terhubung langsung ke IP server (${this.SERVER_PUBLIC_IP}) (Mode DNS-Only / Direct A Record).`;
    } else if (hasCloudflareProxy) {
      dnsMode = 'CLOUDFLARE_PROXY';
      isMatch = true;
      message = `Terdeteksi Cloudflare Proxy (Orange Cloud) aktif untuk "${domain}". Traffic akan otomatis terproteksi oleh Cloudflare CDN/WAF dan diteruskan ke AI Center.`;
    } else {
      dnsMode = 'MISMATCH';
      isMatch = false;
      message = `DNS domain "${domain}" terdeteksi mengarah ke IP [${detectedIps.join(', ')}], belum ke IP server (${this.SERVER_PUBLIC_IP}).`;
    }

    return {
      domainName: domain,
      isConfigured,
      detectedIps,
      serverPublicIp: this.SERVER_PUBLIC_IP,
      isMatch,
      isCloudflareProxy: hasCloudflareProxy,
      dnsMode,
      message,
      guidance: {
        type: 'A',
        name: domain.includes('.') ? domain.split('.')[0] : '@',
        targetIp: this.SERVER_PUBLIC_IP,
        cloudflareProxyRecommended: true
      }
    };
  }

  /**
   * Generates Caddyfile reverse-proxy block for the domain
   */
  private static generateCaddyBlock(domain: string): string {
    return `
# Managed by AI Center Domain Studio - ${domain}
http://${domain}, https://${domain} {
    encode zstd gzip {
        minimum_length 512
    }

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        -Server
    }

    handle {
        reverse_proxy 127.0.0.1:3000 {
            flush_interval -1
            header_up X-Real-Ip {remote_host}
            header_up X-Forwarded-Proto {scheme}
            transport http {
                dial_timeout 5s
                keepalive 90s
                keepalive_idle_conns 250
            }
        }
    }
}
`;
  }

  /**
   * Provisions a custom domain, writes Caddy configuration, validates, and reloads
   */
  static async provisionDomain(
    rawDomain: string,
    workspaceId: string = 'ws-default-command-center'
  ): Promise<ProvisionDomainResponse> {
    const domain = this.cleanDomainName(rawDomain);
    if (!this.isValidDomain(domain)) {
      throw new Error(`Format domain "${rawDomain}" tidak valid.`);
    }

    // Pre-flight DNS inspection
    const dnsStatus = await this.checkDomainDns(domain);
    if (!dnsStatus.isMatch) {
      throw new Error(
        `DNS belum mengarah ke server ini. ${dnsStatus.message} Silakan ubah A Record di Cloudflare/Hostinger terlebih dahulu.`
      );
    }

    // Backup existing custom_domains.caddy
    let originalConfig = '';
    if (fs.existsSync(this.CADDY_DOMAINS_FILE)) {
      originalConfig = fs.readFileSync(this.CADDY_DOMAINS_FILE, 'utf-8');
    }

    const newBlock = this.generateCaddyBlock(domain);

    // Filter out previous block for this domain if exists
    const domainRegex = new RegExp(`#[^\n]*${domain}[\\s\\S]*?\\n}\\n`, 'gi');
    const cleanedConfig = originalConfig.replace(domainRegex, '').trim();
    const updatedConfig = `${cleanedConfig}\n${newBlock}`.trim() + '\n';

    try {
      // 1. Write new config
      fs.writeFileSync(this.CADDY_DOMAINS_FILE, updatedConfig, 'utf-8');

      // 2. Validate configuration
      await execAsync('caddy validate --config /etc/caddy/Caddyfile');

      // 3. Reload Caddy web server
      await execAsync('systemctl reload caddy');
      systemLogger.info('SYSTEM', `Caddy reloaded successfully with domain ${domain}.`);
    } catch (caddyErr: any) {
      // Rollback configuration on error
      if (originalConfig) {
        fs.writeFileSync(this.CADDY_DOMAINS_FILE, originalConfig, 'utf-8');
      }
      systemLogger.error('SYSTEM', `Caddy configuration error for domain ${domain}: ${caddyErr?.message}`);
      throw new Error(`Gagal memvalidasi Caddy webserver: ${caddyErr?.stderr || caddyErr?.message}`);
    }

    // Persist into database
    const domainId = `dom-${uuidv4().slice(0, 8)}`;
    const sslStatus = dnsStatus.isCloudflareProxy ? 'CLOUDFLARE_MANAGED' : 'PROVISIONED';
    const detectedIp = dnsStatus.detectedIps[0] || this.SERVER_PUBLIC_IP;

    // Reset other domains as non-primary
    await pool.query(
      `UPDATE custom_domains SET is_primary = false WHERE workspace_id = $1`,
      [workspaceId]
    );

    const upsertRes = await pool.query(
      `INSERT INTO custom_domains (
        id, workspace_id, domain_name, status, ssl_status, is_primary, dns_mode, detected_ip, target_ip, last_checked_at, updated_at
      ) VALUES ($1, $2, $3, 'ACTIVE', $4, true, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (domain_name) DO UPDATE SET
        status = 'ACTIVE',
        ssl_status = EXCLUDED.ssl_status,
        is_primary = true,
        dns_mode = EXCLUDED.dns_mode,
        detected_ip = EXCLUDED.detected_ip,
        last_checked_at = NOW(),
        updated_at = NOW()
      RETURNING *`,
      [domainId, workspaceId, domain, sslStatus, dnsStatus.dnsMode, detectedIp, this.SERVER_PUBLIC_IP]
    );

    const row = upsertRes.rows[0];
    const savedDomain: CustomDomain = {
      id: row.id,
      workspaceId: row.workspace_id,
      domainName: row.domain_name,
      status: row.status,
      sslStatus: row.ssl_status,
      isPrimary: row.is_primary,
      dnsMode: row.dns_mode,
      detectedIp: row.detected_ip,
      targetIp: row.target_ip,
      lastCheckedAt: row.last_checked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return {
      success: true,
      domain: savedDomain,
      caddyReloaded: true,
      accessUrl: `https://${domain}`,
      message: `Domain ${domain} berhasil dikonfigurasi & HTTPS aktif!`
    };
  }

  /**
   * Retrieves active custom domains and server info
   */
  static async getDomainInfo(workspaceId: string = 'ws-default-command-center'): Promise<DomainManagerInfoResponse> {
    const res = await pool.query(
      `SELECT * FROM custom_domains WHERE workspace_id = $1 ORDER BY is_primary DESC, created_at DESC`,
      [workspaceId]
    );

    const domains: CustomDomain[] = res.rows.map(row => ({
      id: row.id,
      workspaceId: row.workspace_id,
      domainName: row.domain_name,
      status: row.status,
      sslStatus: row.ssl_status,
      isPrimary: row.is_primary,
      dnsMode: row.dns_mode,
      detectedIp: row.detected_ip,
      targetIp: row.target_ip,
      lastCheckedAt: row.last_checked_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const primaryDomain = domains.find(d => d.isPrimary) || (domains.length > 0 ? domains[0] : null);

    return {
      serverPublicIp: this.SERVER_PUBLIC_IP,
      domains,
      primaryDomain,
      defaultAccessUrl: `http://${this.SERVER_PUBLIC_IP}`
    };
  }

  /**
   * Removes custom domain configuration and reloads Caddy
   */
  static async removeDomain(
    domainId: string,
    workspaceId: string = 'ws-default-command-center'
  ): Promise<{ success: boolean; message: string }> {
    const findRes = await pool.query(
      `SELECT * FROM custom_domains WHERE id = $1 AND workspace_id = $2`,
      [domainId, workspaceId]
    );

    if (findRes.rows.length === 0) {
      throw new Error(`Domain dengan ID "${domainId}" tidak ditemukan.`);
    }

    const domain = findRes.rows[0].domain_name;

    // Remove block from custom_domains.caddy
    if (fs.existsSync(this.CADDY_DOMAINS_FILE)) {
      const config = fs.readFileSync(this.CADDY_DOMAINS_FILE, 'utf-8');
      const domainRegex = new RegExp(`#[^\n]*${domain}[\\s\\S]*?\\n}\\n`, 'gi');
      const updatedConfig = config.replace(domainRegex, '').trim() + '\n';
      fs.writeFileSync(this.CADDY_DOMAINS_FILE, updatedConfig, 'utf-8');

      try {
        await execAsync('caddy validate --config /etc/caddy/Caddyfile');
        await execAsync('systemctl reload caddy');
      } catch (err: any) {
        systemLogger.warn('SYSTEM', `Warning during Caddy reload after domain removal: ${err?.message}`);
      }
    }

    await pool.query(`DELETE FROM custom_domains WHERE id = $1`, [domainId]);

    return {
      success: true,
      message: `Domain ${domain} berhasil dicopot. Sistem kembali menggunakan default IP.`
    };
  }
}
