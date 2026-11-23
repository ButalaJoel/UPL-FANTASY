import { createHash } from 'node:crypto';
import { Router } from 'express';
import { metricIngestSchema } from '@kiwanja/core';
import { prisma } from '../db.js';
import { HttpError, ah, parse } from '../lib/http.js';

/**
 * Machine ingest API for future data sources (wearable GPS/IMU prototypes, video analytics).
 * Authenticated with a per-data-source API key (header x-api-key). Metrics are stored with
 * their source and confidence, separate from analyst events and fantasy scoring.
 */
export const ingestRouter = Router();

ingestRouter.post(
  '/metrics',
  ah(async (req, res) => {
    const key = req.headers['x-api-key'];
    if (typeof key !== 'string') throw new HttpError(401, 'Missing x-api-key', 'UNAUTHENTICATED');
    const source = await prisma.dataSource.findFirst({ where: { apiKeyHash: createHash('sha256').update(key).digest('hex'), active: true } });
    if (!source) throw new HttpError(401, 'Invalid API key', 'UNAUTHENTICATED');
    const body = parse(metricIngestSchema, req.body);
    const fixture = await prisma.fixture.findUnique({ where: { id: body.fixtureId }, include: { squad: { select: { playerId: true } } } });
    if (!fixture) throw new HttpError(404, 'Fixture not found', 'NOT_FOUND');
    const squad = new Set(fixture.squad.map((s) => s.playerId));
    const valid = body.samples.filter((s) => squad.has(s.playerId));
    await prisma.playerMetric.createMany({ data: valid.map((s) => ({ fixtureId: fixture.id, playerId: s.playerId, metric: s.metric, value: s.value, confidence: s.confidence, recordedAt: s.recordedAt ?? new Date(), sourceId: source.id })) });
    res.status(202).json({ accepted: valid.length, rejected: body.samples.length - valid.length });
  }),
);
