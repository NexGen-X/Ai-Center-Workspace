/**
 * Automated Domain & SSL Provisioning Test Suite — AI Agent Command Center
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { DomainManagerService } from '../src/services/domainManagerService.js';

describe('Domain Manager & Automated SSL Provisioning', () => {
  it('DomainManagerService.cleanDomainName should normalize input domains', () => {
    expect(DomainManagerService.cleanDomainName('https://AI.MyCompany.COM/')).toBe('ai.mycompany.com');
    expect(DomainManagerService.cleanDomainName('http://sub.domain.org:8080/path')).toBe('sub.domain.org');
    expect(DomainManagerService.cleanDomainName('   my-app.id   ')).toBe('my-app.id');
  });

  it('DomainManagerService.isValidDomain should validate domain strings', () => {
    expect(DomainManagerService.isValidDomain('ai.company.com')).toBe(true);
    expect(DomainManagerService.isValidDomain('command-center.id')).toBe(true);
    expect(DomainManagerService.isValidDomain('my-sub.domain.co.id')).toBe(true);

    expect(DomainManagerService.isValidDomain('')).toBe(false);
    expect(DomainManagerService.isValidDomain('invalid..domain')).toBe(false);
    expect(DomainManagerService.isValidDomain('http://ai.com')).toBe(false);
  });

  it('DomainManagerService.isCloudflareIp should detect Cloudflare Anycast CDN IPs', () => {
    expect(DomainManagerService.isCloudflareIp('104.21.45.12')).toBe(true);
    expect(DomainManagerService.isCloudflareIp('172.67.182.90')).toBe(true);
    expect(DomainManagerService.isCloudflareIp('162.159.34.5')).toBe(true);

    expect(DomainManagerService.isCloudflareIp('8.8.8.8')).toBe(false);
    expect(DomainManagerService.isCloudflareIp('1.1.1.1')).toBe(false);
    expect(DomainManagerService.isCloudflareIp('13.212.164.108')).toBe(false);
  });

  it('GET /api/system/domain/info should return server public IP and domain list', async () => {
    const res = await request(app)
      .get('/api/system/domain/info')
      .expect(200);

    expect(res.body).toHaveProperty('serverPublicIp');
    expect(res.body.serverPublicIp).toBe('13.212.164.108');
    expect(res.body).toHaveProperty('domains');
    expect(Array.isArray(res.body.domains)).toBe(true);
  });

  it('POST /api/system/domain/check-dns should reject empty or invalid domains', async () => {
    await request(app)
      .post('/api/system/domain/check-dns')
      .send({})
      .expect(400);

    const res = await request(app)
      .post('/api/system/domain/check-dns')
      .send({ domainName: 'invalid..domain' })
      .expect(500);

    expect(res.body.error?.message).toContain('Format domain');
  });

  it('POST /api/system/domain/check-dns should return DNS inspection results for valid domain format', async () => {
    const res = await request(app)
      .post('/api/system/domain/check-dns')
      .send({ domainName: 'example.com' })
      .expect(200);

    expect(res.body).toHaveProperty('domainName');
    expect(res.body.domainName).toBe('example.com');
    expect(res.body).toHaveProperty('detectedIps');
    expect(res.body).toHaveProperty('isMatch');
    expect(res.body).toHaveProperty('dnsMode');
    expect(res.body).toHaveProperty('guidance');
    expect(res.body.guidance.targetIp).toBe('13.212.164.108');
  });

  it('POST /api/system/domain/provision should reject missing domainName with 400', async () => {
    await request(app)
      .post('/api/system/domain/provision')
      .send({})
      .expect(400);
  });

  it('POST /api/system/domain/provision should reject unresolved or mismatched domains before touching Caddy', async () => {
    const res = await request(app)
      .post('/api/system/domain/provision')
      .send({ domainName: 'unresolved-test-domain-123456789.com' })
      .expect(500);

    expect(res.body.error?.message).toContain('DNS belum mengarah ke server ini');
  });
});
