import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../lib/auth.js';
import { ah } from '../lib/http.js';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  ah(async (req, res) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      prisma.notification.count({ where: { userId: req.user!.id, readAt: null } }),
    ]);
    res.json({ items, unread });
  }),
);

notificationsRouter.post(
  '/read-all',
  ah(async (req, res) => {
    await prisma.notification.updateMany({ where: { userId: req.user!.id, readAt: null }, data: { readAt: new Date() } });
    res.json({ ok: true });
  }),
);
