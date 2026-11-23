import { z } from 'zod';
import { POSITIONS, RECORD_ORIGINS } from './football.js';
import { ROLES } from './permissions.js';
import { STAT_KEYS } from './stats.js';

/** Request payload schemas shared by the API (validation) and the web app (forms). */

export const registerSchema = z.object({
  email: z.string().email().max(160),
  password: z.string().min(8, 'Use at least 8 characters').max(128),
  displayName: z.string().min(2).max(40),
});
export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
export const forgotSchema = z.object({ email: z.string().email() });
export const resetSchema = z.object({ token: z.string().min(10), password: z.string().min(8).max(128) });
export const profileSchema = z.object({
  displayName: z.string().min(2).max(40).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  favouriteClubId: z.string().nullable().optional(),
  notifyGoals: z.boolean().optional(),
  notifyDeadlines: z.boolean().optional(),
});
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(128) });

export const clubSchema = z.object({
  name: z.string().min(2).max(60),
  shortName: z.string().min(2).max(4).transform((s) => s.toUpperCase()),
  city: z.string().max(60).optional().nullable(),
  stadium: z.string().max(80).optional().nullable(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  origin: z.enum(RECORD_ORIGINS).default('MANUAL'),
});

export const playerSchema = z.object({
  firstName: z.string().min(1).max(40),
  lastName: z.string().min(1).max(40),
  clubId: z.string().min(1),
  position: z.enum(POSITIONS),
  shirtNumber: z.number().int().min(1).max(99).nullable().optional(),
  price: z.number().int().min(10).max(200),
  status: z.enum(['AVAILABLE', 'DOUBTFUL', 'INJURED', 'SUSPENDED', 'UNAVAILABLE']).default('AVAILABLE'),
  statusNote: z.string().max(140).nullable().optional(),
  nationality: z.string().max(40).nullable().optional(),
  origin: z.enum(RECORD_ORIGINS).default('MANUAL'),
});

export const fixtureSchema = z.object({
  homeClubId: z.string().min(1),
  awayClubId: z.string().min(1),
  kickoffAt: z.coerce.date(),
  gameweekId: z.string().nullable().optional(),
  competitionId: z.string().min(1),
  venue: z.string().max(80).nullable().optional(),
  origin: z.enum(RECORD_ORIGINS).default('MANUAL'),
  sourceId: z.string().nullable().optional(),
});

export const lineupSchema = z.object({
  side: z.enum(['HOME', 'AWAY']),
  players: z
    .array(z.object({ playerId: z.string(), isStarter: z.boolean(), shirtNumber: z.number().int().min(1).max(99).nullable().optional(), position: z.enum(POSITIONS).optional() }))
    .max(30),
});

export const assignmentSchema = z.object({ userId: z.string(), role: z.enum(['PRIMARY', 'VERIFIER', 'SUPERVISOR']) });

export const eventInputSchema = z.object({
  /** Client-generated UUID. Makes offline sync idempotent: replays never duplicate. */
  clientEventId: z.string().uuid(),
  code: z.string().min(2).max(40),
  side: z.enum(['HOME', 'AWAY']).nullable().optional(),
  playerId: z.string().nullable().optional(),
  secondaryPlayerId: z.string().nullable().optional(),
  minute: z.number().int().min(0).max(130),
  details: z.record(z.unknown()).optional(),
  /** When the analyst tapped the button, on their device. Preserved through offline queues. */
  clientRecordedAt: z.coerce.date(),
  /** Accept even if a near-identical event exists. */
  force: z.boolean().optional(),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export const eventBatchSchema = z.object({ events: z.array(eventInputSchema).min(1).max(200) });

export const correctionSchema = z.object({
  expectedVersion: z.number().int().min(1),
  changes: z.object({
    side: z.enum(['HOME', 'AWAY']).nullable().optional(),
    playerId: z.string().nullable().optional(),
    secondaryPlayerId: z.string().nullable().optional(),
    minute: z.number().int().min(0).max(130).optional(),
    code: z.string().optional(),
    details: z.record(z.unknown()).optional(),
  }),
  reason: z.string().min(3).max(300),
});

export const verifySchema = z.object({
  decision: z.enum(['CONFIRM', 'DISPUTE']),
  note: z.string().max(300).optional(),
});
export const resolveSchema = z.object({
  decision: z.enum(['VERIFY', 'REJECT', 'VOID']),
  note: z.string().min(3).max(300),
});

export const squadSubmitSchema = z.object({
  name: z.string().min(3).max(30),
  playerIds: z.array(z.string()).min(1).max(25),
});
export const lineupSubmitSchema = z.object({
  picks: z.array(z.object({ playerId: z.string(), slot: z.number().int().min(1), isCaptain: z.boolean(), isViceCaptain: z.boolean() })),
});
export const transferSubmitSchema = z.object({
  transfers: z.array(z.object({ outId: z.string(), inId: z.string() })).min(1).max(15),
  useWildcard: z.boolean().default(false),
});

export const leagueCreateSchema = z.object({
  name: z.string().min(3).max(40),
  type: z.enum(['CLASSIC', 'H2H']),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PRIVATE'),
  startGameweek: z.number().int().min(1).optional(),
});
export const joinLeagueSchema = z.object({ code: z.string().min(4).max(12).transform((s) => s.toUpperCase()) });

export const cupCreateSchema = z.object({
  name: z.string().min(3).max(40),
  leagueId: z.string().nullable().optional(),
  startGameweek: z.number().int().min(1),
  maxEntrants: z.number().int().min(2).max(1024),
  method: z.enum(['RANDOM', 'SEEDED']),
});

export const scoringRuleSchema = z.object({
  label: z.string().min(2).max(60),
  statKey: z.enum(STAT_KEYS),
  mode: z.enum(['PER_UNIT', 'RANGE']),
  unit: z.number().int().min(1).max(100),
  min: z.number().int().nullable(),
  max: z.number().int().nullable(),
  minMinutes: z.number().int().min(0).max(120),
  points: z.object({ GK: z.number().int().min(-20).max(20), DEF: z.number().int().min(-20).max(20), MID: z.number().int().min(-20).max(20), FWD: z.number().int().min(-20).max(20) }),
  enabled: z.boolean(),
  description: z.string().max(200).nullable().optional(),
});

export const gameweekSchema = z.object({
  number: z.number().int().min(1).max(60),
  name: z.string().max(40).optional(),
  deadlineAt: z.coerce.date(),
});

export const userAdminSchema = z.object({ role: z.enum(ROLES).optional(), active: z.boolean().optional() });

export const dataSourceSchema = z.object({
  name: z.string().min(2).max(80),
  kind: z.enum(['MANUAL_LIVE', 'MANUAL_HISTORICAL', 'IMPORT', 'SAMPLE', 'TRACKING_DEVICE', 'VIDEO_ANALYTICS', 'PARTNER_FEED']),
  url: z.string().url().nullable().optional(),
  attribution: z.string().max(200).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  licence: z.string().max(200).nullable().optional(),
  active: z.boolean().default(true),
});

/** Future: wearables / video analytics push per-player metrics through this payload. */
export const metricIngestSchema = z.object({
  fixtureId: z.string(),
  samples: z
    .array(
      z.object({
        playerId: z.string(),
        metric: z.enum(['DISTANCE_M', 'TOP_SPEED_KMH', 'SPRINTS', 'HIGH_INTENSITY_M', 'ACCELERATIONS', 'AVG_POSITION_X', 'AVG_POSITION_Y']),
        value: z.number(),
        recordedAt: z.coerce.date().optional(),
        confidence: z.number().min(0).max(1).optional(),
      }),
    )
    .min(1)
    .max(5000),
});
