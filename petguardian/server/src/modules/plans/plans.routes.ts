import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { HttpError } from '../../middleware/error.js';
import { asyncHandler, requireAuth } from '../../middleware/auth.js';
import { STATE_BY_CODE } from '../../data/states.js';
import { computeReadiness } from '../../services/readiness.js';
import { assertPlanOwner, loadFullPlan } from './plans.repo.js';

export const plansRouter = Router();
plansRouter.use(requireAuth);

/* ----------------------------- Plans ---------------------------------- */

const planCreateSchema = z.object({
  name: z.string().min(1),
  state: z.string().length(2),
  settlorFullName: z.string().optional(),
  settlorAddress: z.string().optional(),
  fundingTarget: z.number().nonnegative().optional(),
  fundingNotes: z.string().optional(),
  remainderBeneficiary: z.string().optional(),
  dispositionInstructions: z.string().optional(),
  incapacityInstructions: z.string().optional(),
});

const planUpdateSchema = planCreateSchema.partial();

const PLAN_COLS: Record<string, string> = {
  name: 'name',
  state: 'state',
  settlorFullName: 'settlor_full_name',
  settlorAddress: 'settlor_address',
  fundingTarget: 'funding_target',
  fundingNotes: 'funding_notes',
  remainderBeneficiary: 'remainder_beneficiary',
  dispositionInstructions: 'disposition_instructions',
  incapacityInstructions: 'incapacity_instructions',
};

// List plans with a readiness score for each.
plansRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      'SELECT id FROM plans WHERE user_id = $1 ORDER BY updated_at DESC',
      [req.user!.sub],
    );
    const plans = await Promise.all(
      rows.map(async (r) => {
        const full = await loadFullPlan(r.id);
        const readiness = computeReadiness(full, STATE_BY_CODE[full.plan.state]);
        return {
          ...full.plan,
          petCount: full.pets.length,
          readinessScore: readiness.score,
          readinessLevel: readiness.level,
        };
      }),
    );
    res.json({ plans });
  }),
);

plansRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = planCreateSchema.parse(req.body);
    if (!STATE_BY_CODE[body.state.toUpperCase()]) throw new HttpError(400, 'Unknown state code');
    const { rows } = await query(
      `INSERT INTO plans (user_id, name, state, settlor_full_name, settlor_address,
        funding_target, funding_notes, remainder_beneficiary, disposition_instructions, incapacity_instructions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        req.user!.sub,
        body.name,
        body.state.toUpperCase(),
        body.settlorFullName ?? null,
        body.settlorAddress ?? null,
        body.fundingTarget ?? null,
        body.fundingNotes ?? null,
        body.remainderBeneficiary ?? null,
        body.dispositionInstructions ?? null,
        body.incapacityInstructions ?? null,
      ],
    );
    res.status(201).json({ plan: rows[0] });
  }),
);

plansRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertPlanOwner(req.params.id, req.user!.sub);
    const full = await loadFullPlan(req.params.id);
    const law = STATE_BY_CODE[full.plan.state];
    const readiness = computeReadiness(full, law);
    res.json({ ...full, stateLaw: law ?? null, readiness });
  }),
);

plansRouter.put(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertPlanOwner(req.params.id, req.user!.sub);
    const body = planUpdateSchema.parse(req.body);
    if (body.state && !STATE_BY_CODE[body.state.toUpperCase()]) {
      throw new HttpError(400, 'Unknown state code');
    }
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, col] of Object.entries(PLAN_COLS)) {
      if (key in body && (body as Record<string, unknown>)[key] !== undefined) {
        let val = (body as Record<string, unknown>)[key];
        if (key === 'state') val = String(val).toUpperCase();
        sets.push(`${col} = $${i++}`);
        values.push(val);
      }
    }
    if (sets.length === 0) {
      const full = await loadFullPlan(req.params.id);
      res.json({ plan: full.plan });
      return;
    }
    sets.push('updated_at = now()');
    values.push(req.params.id);
    const { rows } = await query(
      `UPDATE plans SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    res.json({ plan: rows[0] });
  }),
);

plansRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertPlanOwner(req.params.id, req.user!.sub);
    await query('DELETE FROM plans WHERE id = $1', [req.params.id]);
    res.status(204).end();
  }),
);

/* ------------------------- Nested resources --------------------------- */

interface ChildConfig {
  table: string;
  cols: Record<string, string>; // apiKey -> dbColumn
  schema: z.ZodTypeAny;
}

const petSchema = z.object({
  name: z.string().min(1),
  species: z.string().optional(),
  breed: z.string().optional(),
  color: z.string().optional(),
  sex: z.string().optional(),
  birthdate: z.string().optional(),
  microchip: z.string().optional(),
  vetName: z.string().optional(),
  vetPhone: z.string().optional(),
  insurance: z.string().optional(),
  medications: z.string().optional(),
  diet: z.string().optional(),
  routine: z.string().optional(),
  behavior: z.string().optional(),
  placementPreference: z.string().optional(),
  medicalDirectives: z.string().optional(),
});

const caregiverSchema = z.object({
  role: z.enum(['PRIMARY', 'ALTERNATE']),
  fullName: z.string().min(1),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  confirmed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const trusteeSchema = z.object({
  role: z.enum(['TRUSTEE', 'SUCCESSOR_TRUSTEE', 'ENFORCER']),
  fullName: z.string().min(1),
  relationship: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  confirmed: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const fundingSchema = z.object({
  type: z.enum(['LIFE_INSURANCE', 'BANK', 'BROKERAGE', 'RETIREMENT', 'TRUST', 'WILL_BEQUEST', 'CASH', 'OTHER']),
  description: z.string().optional(),
  amount: z.number().nonnegative().optional(),
  beneficiaryDesignation: z.string().optional(),
});

const CHILDREN: Record<string, ChildConfig> = {
  pets: {
    table: 'pets',
    schema: petSchema,
    cols: {
      name: 'name', species: 'species', breed: 'breed', color: 'color', sex: 'sex',
      birthdate: 'birthdate', microchip: 'microchip', vetName: 'vet_name', vetPhone: 'vet_phone',
      insurance: 'insurance', medications: 'medications', diet: 'diet', routine: 'routine',
      behavior: 'behavior', placementPreference: 'placement_preference', medicalDirectives: 'medical_directives',
    },
  },
  caregivers: {
    table: 'caregivers',
    schema: caregiverSchema,
    cols: {
      role: 'role', fullName: 'full_name', relationship: 'relationship', phone: 'phone',
      email: 'email', address: 'address', confirmed: 'confirmed', sortOrder: 'sort_order',
    },
  },
  trustees: {
    table: 'trustees',
    schema: trusteeSchema,
    cols: {
      role: 'role', fullName: 'full_name', relationship: 'relationship', phone: 'phone',
      email: 'email', address: 'address', confirmed: 'confirmed', sortOrder: 'sort_order',
    },
  },
  funding: {
    table: 'funding_sources',
    schema: fundingSchema,
    cols: {
      type: 'type', description: 'description', amount: 'amount',
      beneficiaryDesignation: 'beneficiary_designation',
    },
  },
};

function buildInsert(planId: string, cfg: ChildConfig, body: Record<string, unknown>) {
  const columns = ['plan_id'];
  const placeholders = ['$1'];
  const values: unknown[] = [planId];
  let i = 2;
  for (const [key, col] of Object.entries(cfg.cols)) {
    if (key in body && body[key] !== undefined) {
      columns.push(col);
      placeholders.push(`$${i++}`);
      values.push(body[key]);
    }
  }
  return {
    text: `INSERT INTO ${cfg.table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`,
    values,
  };
}

function buildUpdate(id: string, cfg: ChildConfig, body: Record<string, unknown>) {
  const sets: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  for (const [key, col] of Object.entries(cfg.cols)) {
    if (key in body && body[key] !== undefined) {
      sets.push(`${col} = $${i++}`);
      values.push(body[key]);
    }
  }
  values.push(id);
  return {
    text: `UPDATE ${cfg.table} SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    values,
    empty: sets.length === 0,
  };
}

for (const [resource, cfg] of Object.entries(CHILDREN)) {
  // Create child
  plansRouter.post(
    `/:id/${resource}`,
    asyncHandler(async (req, res) => {
      await assertPlanOwner(req.params.id, req.user!.sub);
      const body = cfg.schema.parse(req.body) as Record<string, unknown>;
      const { text, values } = buildInsert(req.params.id, cfg, body);
      const { rows } = await query(text, values);
      res.status(201).json({ item: rows[0] });
    }),
  );

  // Update child
  plansRouter.put(
    `/:id/${resource}/:childId`,
    asyncHandler(async (req, res) => {
      await assertPlanOwner(req.params.id, req.user!.sub);
      const partial = (cfg.schema as z.ZodObject<z.ZodRawShape>).partial();
      const body = partial.parse(req.body) as Record<string, unknown>;
      const belongs = await query(
        `SELECT 1 FROM ${cfg.table} WHERE id = $1 AND plan_id = $2`,
        [req.params.childId, req.params.id],
      );
      if (!belongs.rows[0]) throw new HttpError(404, 'Item not found');
      const upd = buildUpdate(req.params.childId, cfg, body);
      if (upd.empty) {
        const { rows } = await query(`SELECT * FROM ${cfg.table} WHERE id = $1`, [req.params.childId]);
        res.json({ item: rows[0] });
        return;
      }
      const { rows } = await query(upd.text, upd.values);
      res.json({ item: rows[0] });
    }),
  );

  // Delete child
  plansRouter.delete(
    `/:id/${resource}/:childId`,
    asyncHandler(async (req, res) => {
      await assertPlanOwner(req.params.id, req.user!.sub);
      const result = await query(
        `DELETE FROM ${cfg.table} WHERE id = $1 AND plan_id = $2`,
        [req.params.childId, req.params.id],
      );
      if (result.rowCount === 0) throw new HttpError(404, 'Item not found');
      res.status(204).end();
    }),
  );
}
