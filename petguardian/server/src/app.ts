import express from 'express';
import cors from 'cors';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

  // In production, serve the built client and let the SPA handle routing.
  if (config.clientDist && existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(join(config.clientDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
