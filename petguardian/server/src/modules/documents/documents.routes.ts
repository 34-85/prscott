import { Router } from 'express';
import { asyncHandler, requireAuth } from '../../middleware/auth.js';
import { HttpError } from '../../middleware/error.js';
import { STATE_BY_CODE } from '../../data/states.js';
import { assertPlanOwner, loadFullPlan } from '../plans/plans.repo.js';
import { renderToBuffer, documentBuilder, type DocumentType } from '../../services/pdf.js';

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const VALID: DocumentType[] = ['trust-directive', 'care-memorandum', 'emergency-card'];

const FILENAMES: Record<DocumentType, string> = {
  'trust-directive': 'PetGuardian-Trust-Directive.pdf',
  'care-memorandum': 'PetGuardian-Care-Memorandum.pdf',
  'emergency-card': 'PetGuardian-Emergency-Card.pdf',
};

// GET /api/plans/:id/documents  -> list available documents
documentsRouter.get(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    await assertPlanOwner(req.params.id, req.user!.sub);
    res.json({
      documents: VALID.map((type) => ({
        type,
        filename: FILENAMES[type],
        url: `/api/plans/${req.params.id}/documents/${type}`,
      })),
    });
  }),
);

// GET /api/plans/:id/documents/:type  -> stream the PDF
documentsRouter.get(
  '/:id/documents/:type',
  asyncHandler(async (req, res) => {
    const type = req.params.type as DocumentType;
    if (!VALID.includes(type)) throw new HttpError(404, 'Unknown document type');
    await assertPlanOwner(req.params.id, req.user!.sub);

    const data = await loadFullPlan(req.params.id);
    const law = STATE_BY_CODE[data.plan.state];
    const build = documentBuilder(type);
    const buffer = await renderToBuffer((doc) => build(doc, data, law));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${FILENAMES[type]}"`);
    res.send(buffer);
  }),
);
