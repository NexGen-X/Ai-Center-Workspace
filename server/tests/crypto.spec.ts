import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, maskApiKey } from '../src/utils/crypto.js';

describe('Crypto & Secret Security Utilities', () => {
  it('should encrypt and decrypt secrets correctly via AES-256-GCM', () => {
    const rawKey = 'sk-proj-super-secret-api-key-1234567890';
    const encrypted = encryptSecret(rawKey);

    expect(encrypted).not.toBe(rawKey);
    expect(encrypted).toContain(':'); // IV:tag:ciphertext

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(rawKey);
  });

  it('should mask API keys properly so plain secrets are never exposed', () => {
    const key = 'sk-abcdefghijklmn123456';
    const masked = maskApiKey(key);

    expect(masked).toBe('sk-a••••3456');
    expect(masked).not.toContain('cdefghijklmn');
  });

  it('should handle short or empty keys gracefully', () => {
    expect(maskApiKey('')).toBe('••••••••');
    expect(maskApiKey('short')).toBe('••••••••');
  });
});
