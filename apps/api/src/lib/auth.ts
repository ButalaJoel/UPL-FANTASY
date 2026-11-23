import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { can, type Permission, type Role } from '@kiwanja/core';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { HttpError, forbidden } from './http.js';

export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  displayName: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const signToken = (u: { id: string; role: Role }) => jwt.sign({ sub: u.id, role: u.role }, config.jwtSecret, { expiresIn: config.jwtTtl });

export async function userFromToken(token: string | undefined | null): Promise<AuthUser | null> {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, config.jwtSecret) as { sub: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return null;
    // Role is always read from the database so demotions take effect immediately.
    return { id: user.id, role: user.role as Role, email: user.email, displayName: user.displayName };
  } catch {
    return null;
  }
}

const bearer = (req: Request) => {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
};

/** Attach req.user when a valid token is present; never rejects. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = (await userFromToken(bearer(req))) ?? undefined;
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in', 'UNAUTHENTICATED'));
  next();
}

export const requirePermission =
  (...perms: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Please sign in', 'UNAUTHENTICATED'));
    if (!perms.every((p) => can(req.user!.role, p))) return next(forbidden());
    next();
  };
