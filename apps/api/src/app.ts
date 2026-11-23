import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { prisma } from './db.js';
import { optionalAuth } from './lib/auth.js';
import { errorHandler } from './lib/http.js';
import { authRouter } from './routes/auth.js';
import { fantasyRouter } from './routes/fantasy.js';
import { ingestRouter } from './routes/ingest.js';
import { leaguesRouter } from './routes/leagues.js';
import { notificationsRouter } from './routes/notifications.js';
import { fantasyAdminRouter } from './routes/ops/fantasyAdmin.js';
import { footballRouter } from './routes/ops/football.js';
import { matchesRouter } from './routes/ops/matches.js';
import { systemRouter } from './routes/ops/system.js';
import { publicRouter } from './routes/public.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.use('/api/ingest', ingestRouter);
  app.use('/api', optionalAuth);
  app.use('/api/auth', authRouter);
  app.use('/api', publicRouter);
  app.use('/api/fantasy', fantasyRouter);
  app.use('/api/leagues', leaguesRouter);
  app.use('/api/notifications', notificationsRouter);
  // Data operations platform (role-restricted)
  app.use('/api/ops/football', footballRouter);
  app.use('/api/ops/matches', matchesRouter);
  app.use('/api/ops/fantasy', fantasyAdminRouter);
  app.use('/api/ops', systemRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such endpoint' } }));
  app.use(errorHandler);
  return app;
}
