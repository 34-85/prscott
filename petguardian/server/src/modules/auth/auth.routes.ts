import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { hashPassword, signToken, verifyPassword } from '../../utils/auth.js';
import { HttpError } from '../../middleware/error.js';
import { asyncHandler, requireAuth } from '../../middleware/auth.js';
import { STATE_BY_CODE } from '../../data/states.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(1),
  role: z.enum(['OWNER', 'ATTORNEY']).optional(),
  state: z.string().length(2).optional(),
});

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: string;
  state: string | null;
}

function publicUser(u: UserRow) {
  return { id: u.id, email: u.email, fullName: u.full_name, role: u.role, state: u.state };
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    if (body.state && !STATE_BY_CODE[body.state.toUpperCase()]) {
      throw new HttpError(400, 'Unknown state code');
    }
    const passwordHash = await hashPassword(body.password);
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, password_hash, full_name, role, state)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password_hash, full_name, role, state`,
      [
        body.email.toLowerCase(),
        passwordHash,
        body.fullName,
        body.role ?? 'OWNER',
        body.state ? body.state.toUpperCase() : null,
      ],
    );
    const user = rows[0];
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.status(201).json({ token, user: publicUser(user) });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const { rows } = await query<UserRow>(
      'SELECT id, email, password_hash, full_name, role, state FROM users WHERE email = $1',
      [body.email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password');
    }
    const token = signToken({ sub: user.id, email: user.email, role: user.role });
    res.json({ token, user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await query<UserRow>(
      'SELECT id, email, password_hash, full_name, role, state FROM users WHERE id = $1',
      [req.user!.sub],
    );
    if (!rows[0]) throw new HttpError(404, 'User not found');
    res.json({ user: publicUser(rows[0]) });
  }),
);

// Permanently delete the signed-in user's account and all their data.
// Required by App Store Guideline 5.1.1(v): account deletion must be initiated
// and completed in-app. Plans, pets, caregivers, trustees, and funding rows are
// removed by ON DELETE CASCADE on the users foreign keys.
const deleteAccountSchema = z.object({ password: z.string().min(1) });

authRouter.delete(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = deleteAccountSchema.parse(req.body);
    const { rows } = await query<UserRow>(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user!.sub],
    );
    if (!rows[0]) throw new HttpError(404, 'User not found');
    if (!(await verifyPassword(body.password, rows[0].password_hash))) {
      throw new HttpError(401, 'Password is incorrect');
    }
    await query('DELETE FROM users WHERE id = $1', [req.user!.sub]);
    res.status(204).end();
  }),
);
