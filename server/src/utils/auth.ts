import crypto from 'crypto';

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

/**
 * Hash a password using PBKDF2 with a random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a salt:hash string
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(':');
    if (!salt || !originalHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash, 'hex'), Buffer.from(originalHash, 'hex'));
  } catch {
    return false;
  }
}

const DUMMY_HASH = 'e7828599f7ec9a35a504c769023161ee:ef92c0b98d4d738144266fbd9b6731f458eddaa37756f56e8430214c520bf8db8eec02218e90c0e2ef72a71be7f597fe22f1f385dc7c1d4b3c12429f688c7e48';

/**
 * Execute constant-time hash verification on non-existent accounts to eliminate timing attack vectors
 */
export function executeDummyHashVerification(dummyPassword: string = 'DummyPassword123!') {
  try {
    verifyPassword(dummyPassword, DUMMY_HASH);
  } catch {}
}

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
