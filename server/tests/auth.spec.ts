import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateSessionToken } from '../src/utils/auth.js';

describe('Authentication & Password Security', () => {
  it('should hash and verify passwords correctly with unique salt', () => {
    const rawPass = 'SecretAdmin#2026!';
    const hashed = hashPassword(rawPass);

    expect(hashed).toContain(':');
    expect(verifyPassword(rawPass, hashed)).toBe(true);
    expect(verifyPassword('WrongPassword', hashed)).toBe(false);
  });

  it('should generate distinct cryptographically secure session tokens', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
  });
});
