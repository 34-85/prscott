import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';
import { closePool } from '../src/db/pool.js';
import { STATES } from '../src/data/states.js';

afterAll(async () => {
  await closePool();
});

describe('states knowledge base', () => {
  it('covers all 50 states + DC (51 jurisdictions)', () => {
    expect(STATES.length).toBe(51);
    const codes = new Set(STATES.map((s) => s.code));
    expect(codes.has('DC')).toBe(true);
    expect(codes.size).toBe(51);
  });

  it('lists states with a disclaimer', async () => {
    const res = await request(app).get('/api/states');
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(51);
    expect(res.body.disclaimer).toContain('not a law firm');
  });

  it('returns Georgia detail with the correct statute', async () => {
    const res = await request(app).get('/api/states/ga');
    expect(res.status).toBe(200);
    expect(res.body.state.statuteCitation).toContain('53-12-28');
  });

  it('404s for an unknown state', async () => {
    const res = await request(app).get('/api/states/ZZ');
    expect(res.status).toBe(404);
  });
});
