import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { plansRouter } from './modules/plans/plans.routes.js';
import { statesRouter } from './modules/states/states.routes.js';
import { documentsRouter } from './modules/documents/documents.routes.js';
import { errorHandler, notFound } from './middleware/error.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: config.clientOrigin }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/api/auth', authRouter);
  app.use('/api/states', statesRouter);
  app.use('/api/plans', plansRouter);
  app.use('/api/plans', documentsRouter); // /api/plans/:id/documents/*

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
