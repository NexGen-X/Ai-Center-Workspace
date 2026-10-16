import { describe, it, expect } from 'vitest';
import { validateOutgoingUrl } from '../src/utils/ssrf.js';

describe('SSRF Protection Validator', () => {
  it('should reject cloud metadata service (169.254.169.254)', () => {
    const res = validateOutgoingUrl('http://169.254.169.254/latest/meta-data/');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('metadata');
  });

  it('should reject integer/hex/decimal representations of cloud metadata IP', () => {
    const resInt = validateOutgoingUrl('http://2852039166/latest/meta-data/');
    expect(resInt.isValid).toBe(false);

    const resHex = validateOutgoingUrl('http://0xa9fea9fe/latest/meta-data/');
    expect(resHex.isValid).toBe(false);
  });

  it('should reject cloud metadata hostnames', () => {
    const resGcp = validateOutgoingUrl('http://metadata.google.internal/computeMetadata/v1/');
    expect(resGcp.isValid).toBe(false);

    const resAws = validateOutgoingUrl('http://instance-data/latest/meta-data/');
    expect(resAws.isValid).toBe(false);
  });

  it('should reject dangerous bind addresses', () => {
    const res = validateOutgoingUrl('http://0.0.0.0:8080/v1');
    expect(res.isValid).toBe(false);
  });

  it('should reject non-http/https protocols like file: or ftp:', () => {
    const resFile = validateOutgoingUrl('file:///etc/passwd');
    expect(resFile.isValid).toBe(false);

    const resFtp = validateOutgoingUrl('ftp://ftp.example.com');
    expect(resFtp.isValid).toBe(false);
  });

  it('should allow valid http and https endpoints for model providers by default', () => {
    const resHttps = validateOutgoingUrl('https://api.openai.com/v1');
    expect(resHttps.isValid).toBe(true);

    const resLocal = validateOutgoingUrl('http://localhost:8080/v1');
    expect(resLocal.isValid).toBe(true);
  });

  it('should strictly reject localhost and loopback when allowLocalhost is false', () => {
    const resLocal = validateOutgoingUrl('http://localhost:3000/api/system', { allowLocalhost: false });
    expect(resLocal.isValid).toBe(false);
    expect(resLocal.error).toContain('localhost');

    const resIp = validateOutgoingUrl('http://127.0.0.1:5432', { allowLocalhost: false });
    expect(resIp.isValid).toBe(false);
    expect(resIp.error).toContain('loopback');
  });

  it('should strictly reject private subnets when allowPrivateIps is false', () => {
    const res10 = validateOutgoingUrl('http://10.0.0.1:8080/api', { allowPrivateIps: false });
    expect(res10.isValid).toBe(false);
    expect(res10.error).toContain('privat');

    const res192 = validateOutgoingUrl('http://192.168.1.1:80', { allowPrivateIps: false });
    expect(res192.isValid).toBe(false);
    expect(res192.error).toContain('privat');

    const res172 = validateOutgoingUrl('http://172.16.0.5:8000', { allowPrivateIps: false });
    expect(res172.isValid).toBe(false);
    expect(res172.error).toContain('privat');
  });
});
