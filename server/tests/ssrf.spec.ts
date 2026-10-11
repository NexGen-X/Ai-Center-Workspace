import { describe, it, expect } from 'vitest';
import { validateOutgoingUrl } from '../src/utils/ssrf.js';

describe('SSRF Protection Validator', () => {
  it('should reject cloud metadata service (169.254.169.254)', () => {
    const res = validateOutgoingUrl('http://169.254.169.254/latest/meta-data/');
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('metadata');
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

  it('should allow valid http and https endpoints', () => {
    const resHttps = validateOutgoingUrl('https://api.openai.com/v1');
    expect(resHttps.isValid).toBe(true);

    const resLocal = validateOutgoingUrl('http://localhost:8080/v1');
    expect(resLocal.isValid).toBe(true);
  });
});
