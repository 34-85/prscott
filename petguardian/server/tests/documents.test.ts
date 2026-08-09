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

async function seededPlan(token: string) {
  const plan = (await request(app).post('/api/plans').set(auth(token)).send({ name: 'P', state: 'GA' })).body.plan;
  await request(app).put(`/api/plans/${plan.id}`).set(auth(token)).send({ settlorFullName: 'Jane Doe' });
  await request(app).post(`/api/plans/${plan.id}/pets`).set(auth(token)).send({ name: 'Rex', species: 'Dog', microchip: '985' });
  await request(app).post(`/api/plans/${plan.id}/caregivers`).set(auth(token)).send({ role: 'PRIMARY', fullName: 'Amy', phone: '555-1000' });
  await request(app).post(`/api/plans/${plan.id}/trustees`).set(auth(token)).send({ role: 'TRUSTEE', fullName: 'Tom' });
  await request(app).post(`/api/plans/${plan.id}/funding`).set(auth(token)).send({ type: 'LIFE_INSURANCE', amount: 20000 });
  return plan;
}

describe('documents', () => {
  it('lists the available documents', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const res = await request(app).get(`/api/plans/${plan.id}/documents`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.documents.map((d: { type: string }) => d.type)).toEqual([
      'trust-directive',
      'care-memorandum',
      'emergency-card',
    ]);
  });

  it.each(['trust-directive', 'care-memorandum', 'emergency-card'])(
    'generates a valid PDF for %s',
    async (type) => {
      const { token } = await registerUser();
      const plan = await seededPlan(token);
      const res = await request(app)
        .get(`/api/plans/${plan.id}/documents/${type}`)
        .set(auth(token))
        .buffer(true)
        .parse((res, cb) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      const body = res.body as Buffer;
      // A PDF file starts with the magic bytes %PDF-
      expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(body.length).toBeGreaterThan(500);
    },
  );

  it('rejects an unknown document type', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const res = await request(app).get(`/api/plans/${plan.id}/documents/bogus`).set(auth(token));
    expect(res.status).toBe(404);
  });

  it('does not let another user download the document', async () => {
    const owner = await registerUser();
    const plan = await seededPlan(owner.token);
    const intruder = await registerUser();
    const res = await request(app)
      .get(`/api/plans/${plan.id}/documents/trust-directive`)
      .set(auth(intruder.token));
    expect(res.status).toBe(403);
  });
});
