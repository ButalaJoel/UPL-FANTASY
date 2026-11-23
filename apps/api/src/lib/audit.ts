import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

type Tx = Prisma.TransactionClient | typeof prisma;

export function audit(userId: string | null | undefined, action: string, entity: string, entityId?: string | null, data?: unknown, tx: Tx = prisma) {
  return tx.auditLog.create({ data: { userId: userId ?? null, action, entity, entityId: entityId ?? null, data: (data ?? undefined) as Prisma.InputJsonValue } });
}
