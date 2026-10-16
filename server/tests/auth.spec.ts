import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/index.js';
import { initializeDatabase, pool } from '../src/db/index.js';
import { hashPassword, verifyPassword, generateSessionToken } from '../src/utils/auth.js';

describe('Authentication & Password Security', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

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

  it('should handle full security lifecycle: setup-hint, login, update credentials, and verify ephemeral auto-fill lockout', async () => {
    // 1. Ensure user is in initial state
    const defaultHash = hashPassword('Admin#AiCenter2026!');
    await pool.query(`
      UPDATE human_users
      SET email = 'operator@ai-center.local',
          password_hash = $1,
          must_change_password = TRUE
      WHERE id = 'usr-admin-default';
    `, [defaultHash]);

    // 2. GET /api/auth/setup-hint should report available: true
    const hintRes = await request(app).get('/api/auth/setup-hint');
    expect(hintRes.status).toBe(200);
    expect(hintRes.body.available).toBe(true);
    expect(hintRes.body.defaultEmail).toBe('operator@ai-center.local');

    // 3. POST /api/auth/login with initial credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator@ai-center.local', password: 'Admin#AiCenter2026!' });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('token');
    expect(loginRes.body.user.mustChangePassword).toBe(true);

    const sessionToken = loginRes.body.token;

    // 4. POST /api/auth/update-credentials with new email and password
    const newPersonalEmail = `commander.${Date.now()}@nexgen.ai`;
    const newPersonalPass = 'PersonalNewSecret#2026!';

    const updateRes = await request(app)
      .post('/api/auth/update-credentials')
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({
        newEmail: newPersonalEmail,
        newDisplayName: 'Master Commander',
        newPassword: newPersonalPass
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.user.mustChangePassword).toBe(false);
    expect(updateRes.body.user.email).toBe(newPersonalEmail);

    // 5. GET /api/auth/setup-hint MUST now report available: false (ephemeral locked)
    const lockedHintRes = await request(app).get('/api/auth/setup-hint');
    expect(lockedHintRes.status).toBe(200);
    expect(lockedHintRes.body.available).toBe(false);
    expect(lockedHintRes.body.defaultEmail).toBeUndefined();

    // 6. Old default password must now be rejected
    const failedOldLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'operator@ai-center.local', password: 'Admin#AiCenter2026!' });
    expect(failedOldLogin.status).toBe(401);

    // 7. Login with new credentials must succeed and require NO password change
    const newLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: newPersonalEmail, password: newPersonalPass });
    expect(newLoginRes.status).toBe(200);
    expect(newLoginRes.body.user.email).toBe(newPersonalEmail);
    expect(newLoginRes.body.user.mustChangePassword).toBe(false);
  });
});
