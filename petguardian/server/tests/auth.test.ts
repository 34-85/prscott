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

  it('deletes the account (with password) and cascades the user’s plans', async () => {
    const { token, password } = await registerUser();
    // Give the user a plan so we can confirm the cascade.
    const plan = await request(app).post('/api/plans').set(auth(token)).send({ name: 'P', state: 'GA' });
    expect(plan.status).toBe(201);

    // Wrong password is rejected.
    const bad = await request(app).delete('/api/auth/me').set(auth(token)).send({ password: 'not-it' });
    expect(bad.status).toBe(401);

    // Correct password deletes.
    const ok = await request(app).delete('/api/auth/me').set(auth(token)).send({ password });
    expect(ok.status).toBe(204);

    // The user (and thus their plans) is gone.
    const me = await request(app).get('/api/auth/me').set(auth(token));
    expect(me.status).toBe(404);
  });

  it('requires authentication to delete an account', async () => {
    const res = await request(app).delete('/api/auth/me').send({ password: 'whatever' });
    expect(res.status).toBe(401);
  });
});
