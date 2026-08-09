import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, auth, registerUser, resetDb } from './helpers.js';
import { closePool } from '../src/db/pool.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closePool();
});

describe('auth', () => {
  it('registers a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@example.com', password: 'password123', fullName: 'Ada', state: 'CA' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('a@example.com');
    expect(res.body.user.state).toBe('CA');
  });

  it('rejects a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'b@example.com', password: 'short', fullName: 'Bob' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    await registerUser({ email: 'dup@example.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123', fullName: 'X' });
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    const { email, password } = await registerUser({ email: 'login@example.com' });
    const ok = await request(app).post('/api/auth/login').send({ email, password });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeTruthy();

    const bad = await request(app).post('/api/auth/login').send({ email, password: 'wrongpass' });
    expect(bad.status).toBe(401);
  });

  it('returns the current user from /me and blocks unauthenticated access', async () => {
    const { token } = await registerUser();
    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('OWNER');

    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);
  });
});
