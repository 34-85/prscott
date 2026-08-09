import { query } from '../../db/pool.js';
import { HttpError } from '../../middleware/error.js';
import type { FullPlan } from '../../services/readiness.js';

export async function assertPlanOwner(planId: string, userId: string): Promise<void> {
  const { rows } = await query('SELECT user_id FROM plans WHERE id = $1', [planId]);
  if (!rows[0]) throw new HttpError(404, 'Plan not found');
  if (rows[0].user_id !== userId) throw new HttpError(403, 'You do not have access to this plan');
}

export async function loadFullPlan(planId: string): Promise<FullPlan> {
  const planRes = await query('SELECT * FROM plans WHERE id = $1', [planId]);
  if (!planRes.rows[0]) throw new HttpError(404, 'Plan not found');

  const [pets, caregivers, trustees, funding] = await Promise.all([
    query('SELECT * FROM pets WHERE plan_id = $1 ORDER BY created_at', [planId]),
    query('SELECT * FROM caregivers WHERE plan_id = $1 ORDER BY sort_order, created_at', [planId]),
    query('SELECT * FROM trustees WHERE plan_id = $1 ORDER BY sort_order, created_at', [planId]),
    query('SELECT * FROM funding_sources WHERE plan_id = $1 ORDER BY created_at', [planId]),
  ]);

  return {
    plan: planRes.rows[0] as FullPlan['plan'],
    pets: pets.rows,
    caregivers: caregivers.rows as FullPlan['caregivers'],
    trustees: trustees.rows as FullPlan['trustees'],
    fundingSources: funding.rows as FullPlan['fundingSources'],
  };
}
