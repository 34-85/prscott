import { Router } from 'express';
import { STATES, STATE_BY_CODE, LEGAL_DISCLAIMER } from '../../data/states.js';
import { HttpError } from '../../middleware/error.js';

export const statesRouter = Router();

// Public: browse the state law knowledge base (education feature).
statesRouter.get('/', (_req, res) => {
  res.json({
    disclaimer: LEGAL_DISCLAIMER,
    count: STATES.length,
    states: STATES.map((s) => ({ code: s.code, name: s.name, statuteCitation: s.statuteCitation })),
  });
});

statesRouter.get('/:code', (req, res) => {
  const law = STATE_BY_CODE[req.params.code.toUpperCase()];
  if (!law) throw new HttpError(404, 'Unknown state code');
  res.json({ disclaimer: LEGAL_DISCLAIMER, state: law });
});
