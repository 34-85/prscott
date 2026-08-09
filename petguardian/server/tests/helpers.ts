import request from 'supertest';
import { createApp } from '../src/app.js';
import { migrate } from '../src/db/migrate.js';
import { pool } from '../src/db/pool.js';

export const app = createApp();

let migrated = false;

export async function ensureSchema(): Promise<void> {
  if (migrated) return;
  await migrate();
  migrated = true;
}

export async function resetDb(): Promise<void> {
  await ensureSchema();
  // Cascades clear pets/caregivers/trustees/funding/plans.
  await pool.query('TRUNCATE users RESTART IDENTITY CASCADE');
}

let counter = 0;

/** Register a fresh user and return an authenticated supertest agent + token. */
export async function registerUser(overrides: Partial<{ email: string; password: string; fullName: string; state: string; role: string }> = {}) {
  counter += 1;
  const email = overrides.email ?? `user${counter}-${Date.now()}@example.com`;
  const password = overrides.password ?? 'password123';
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email,
      password,
      fullName: overrides.fullName ?? 'Test Owner',
      state: overrides.state ?? 'GA',
      role: overrides.role ?? 'OWNER',
    });
  return { email, password, token: res.body.token as string, user: res.body.user, res };
}

export function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}
