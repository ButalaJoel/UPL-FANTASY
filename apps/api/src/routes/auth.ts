import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { changePasswordSchema, forgotSchema, loginSchema, profileSchema, registerSchema, can } from '@kiwanja/core';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { audit } from '../lib/audit.js';
import { requireAuth, signToken } from '../lib/auth.js';
import { HttpError, ah, badRequest, conflict, parse } from '../lib/http.js';
import { resetSchema } from '@kiwanja/core';

export const authRouter = Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.isTest ? 10_000 : 50, standardHeaders: true, legacyHeaders: false });

const publicUser = (u: { id: string; email: string; displayName: string; role: string; avatarColor: string; avatarUrl: string | null; favouriteClubId: string | null; notifyGoals: boolean; notifyDeadlines: boolean; createdAt: Date }) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  avatarColor: u.avatarColor,
  avatarUrl: u.avatarUrl,
  favouriteClubId: u.favouriteClubId,
  notifyGoals: u.notifyGoals,
  notifyDeadlines: u.notifyDeadlines,
  createdAt: u.createdAt,
  canAccessOps: can(u.role as never, 'ops.access'),
});

authRouter.post(
  '/register',
  limiter,
  ah(async (req, res) => {
    const body = parse(registerSchema, req.body);
    const email = body.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) throw conflict('An account with this email already exists', 'EMAIL_TAKEN');
    const user = await prisma.user.create({ data: { email, displayName: body.displayName, passwordHash: await bcrypt.hash(body.password, 10) } });
    await audit(user.id, 'user.register', 'user', user.id);
    res.status(201).json({ token: signToken({ id: user.id, role: user.role as never }), user: publicUser(user) });
  }),
);

authRouter.post(
  '/login',
  limiter,
  ah(async (req, res) => {
    const body = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect', 'BAD_CREDENTIALS');
    if (!user.active) throw new HttpError(403, 'This account has been deactivated', 'INACTIVE');
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    res.json({ token: signToken({ id: user.id, role: user.role as never }), user: publicUser(user) });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(profileSchema, req.body);
    const user = await prisma.user.update({ where: { id: req.user!.id }, data: body });
    res.json({ user: publicUser(user) });
  }),
);

authRouter.post(
  '/change-password',
  requireAuth,
  ah(async (req, res) => {
    const body = parse(changePasswordSchema, req.body);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
    if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) throw badRequest('Current password is incorrect');
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(body.newPassword, 10) } });
    await audit(user.id, 'user.password.change', 'user', user.id);
    res.json({ ok: true });
  }),
);

const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Password recovery. No email provider is configured in the prototype, so in development
 * the reset link is returned in the response (and logged). In production it is never returned.
 */
authRouter.post(
  '/forgot-password',
  limiter,
  ah(async (req, res) => {
    const { email } = parse(forgotSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    let devResetUrl: string | undefined;
    if (user) {
      const token = randomBytes(24).toString('hex');
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) } });
      devResetUrl = `${config.webOrigin[0]}/reset-password?token=${token}`;
      if (!config.isTest) console.log(`[password reset] ${user.email}: ${devResetUrl}`);
    }
    res.json({ ok: true, message: 'If that email has an account, a reset link has been sent.', ...(config.isProd ? {} : { devResetUrl }) });
  }),
);

authRouter.post(
  '/reset-password',
  limiter,
  ah(async (req, res) => {
    const { token, password } = parse(resetSchema, req.body);
    const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw badRequest('This reset link is invalid or has expired');
    await prisma.$transaction([
      prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(password, 10) } }),
      prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    ]);
    await audit(row.userId, 'user.password.reset', 'user', row.userId);
    res.json({ ok: true });
  }),
);
