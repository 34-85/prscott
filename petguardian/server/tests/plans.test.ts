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

async function newPlan(token: string, state = 'GA') {
  const res = await request(app)
    .post('/api/plans')
    .set(auth(token))
    .send({ name: 'Household pets', state });
  return res.body.plan;
}

describe('plans', () => {
  it('creates and lists a plan with a readiness score', async () => {
    const { token } = await registerUser();
    const plan = await newPlan(token);
    expect(plan.id).toBeTruthy();

    const list = await request(app).get('/api/plans').set(auth(token));
    expect(list.status).toBe(200);
    expect(list.body.plans).toHaveLength(1);
    expect(list.body.plans[0]).toHaveProperty('readinessScore');
    expect(list.body.plans[0].readinessScore).toBe(0);
  });

  it('rejects an unknown state on creation', async () => {
    const { token } = await registerUser();
    const res = await request(app).post('/api/plans').set(auth(token)).send({ name: 'X', state: 'ZZ' });
    expect(res.status).toBe(400);
  });

  it('adds nested entities and raises the readiness score', async () => {
    const { token } = await registerUser();
    const plan = await newPlan(token);

    await request(app).put(`/api/plans/${plan.id}`).set(auth(token)).send({
      settlorFullName: 'Jane Doe',
      remainderBeneficiary: 'Humane Society',
      dispositionInstructions: 'Rehome to family first.',
      incapacityInstructions: 'Agent under POA pays vet bills.',
    });
    await request(app).post(`/api/plans/${plan.id}/pets`).set(auth(token)).send({ name: 'Rex', species: 'Dog' });
    await request(app).post(`/api/plans/${plan.id}/caregivers`).set(auth(token)).send({ role: 'PRIMARY', fullName: 'Amy Carer', confirmed: true });
    await request(app).post(`/api/plans/${plan.id}/caregivers`).set(auth(token)).send({ role: 'ALTERNATE', fullName: 'Ben Backup' });
    await request(app).post(`/api/plans/${plan.id}/trustees`).set(auth(token)).send({ role: 'TRUSTEE', fullName: 'Tom Trustee' });
    await request(app).post(`/api/plans/${plan.id}/funding`).set(auth(token)).send({ type: 'LIFE_INSURANCE', amount: 25000 });

    const full = await request(app).get(`/api/plans/${plan.id}`).set(auth(token));
    expect(full.status).toBe(200);
    expect(full.body.pets).toHaveLength(1);
    expect(full.body.caregivers).toHaveLength(2);
    expect(full.body.trustees).toHaveLength(1);
    expect(full.body.fundingSources).toHaveLength(1);
    expect(full.body.readiness.score).toBe(100);
    expect(full.body.readiness.level).toBe('Complete');
    expect(full.body.stateLaw.statuteCitation).toContain('53-12-28');
  });

  it('detects when the trustee is the same person as the caregiver', async () => {
    const { token } = await registerUser();
    const plan = await newPlan(token);
    await request(app).post(`/api/plans/${plan.id}/caregivers`).set(auth(token)).send({ role: 'PRIMARY', fullName: 'Same Person' });
    await request(app).post(`/api/plans/${plan.id}/trustees`).set(auth(token)).send({ role: 'TRUSTEE', fullName: 'Same Person' });

    const full = await request(app).get(`/api/plans/${plan.id}`).set(auth(token));
    const sep = full.body.readiness.items.find((i: { key: string }) => i.key === 'separation');
    expect(sep.done).toBe(false);
  });

  it('updates and deletes nested entities', async () => {
    const { token } = await registerUser();
    const plan = await newPlan(token);
    const add = await request(app).post(`/api/plans/${plan.id}/pets`).set(auth(token)).send({ name: 'Old' });
    const petId = add.body.item.id;

    const upd = await request(app).put(`/api/plans/${plan.id}/pets/${petId}`).set(auth(token)).send({ name: 'New', diet: 'Kibble' });
    expect(upd.body.item.name).toBe('New');
    expect(upd.body.item.diet).toBe('Kibble');

    const del = await request(app).delete(`/api/plans/${plan.id}/pets/${petId}`).set(auth(token));
    expect(del.status).toBe(204);

    const full = await request(app).get(`/api/plans/${plan.id}`).set(auth(token));
    expect(full.body.pets).toHaveLength(0);
  });

  it('prevents one user from accessing another user’s plan', async () => {
    const owner = await registerUser();
    const plan = await newPlan(owner.token);
    const intruder = await registerUser();

    const res = await request(app).get(`/api/plans/${plan.id}`).set(auth(intruder.token));
    expect(res.status).toBe(403);

    const list = await request(app).get('/api/plans').set(auth(intruder.token));
    expect(list.body.plans).toHaveLength(0);
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/plans');
    expect(res.status).toBe(401);
  });
});
