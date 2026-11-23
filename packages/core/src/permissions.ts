export const ROLES = ['SUPER_ADMIN', 'COMPETITION_ADMIN', 'MATCH_SUPERVISOR', 'MATCH_ANALYST', 'FANTASY_USER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Administrator',
  COMPETITION_ADMIN: 'Competition Administrator',
  MATCH_SUPERVISOR: 'Match Supervisor',
  MATCH_ANALYST: 'Match Analyst',
  FANTASY_USER: 'Fantasy User',
};

export const PERMISSIONS = [
  'ops.access', // open the data operations app
  'events.log', // record match events (assigned matches)
  'events.verify', // verify another analyst's events (assigned matches)
  'events.resolve', // resolve disputes, correct or void any event
  'matches.control', // start/stop periods, complete matches
  'matches.publish', // publish verified statistics
  'football.manage', // clubs, players, fixtures, lineups, assignments
  'fantasy.manage', // gameweeks, scoring rules, game rules, leagues, cups, prices
  'users.manage', // users and roles
  'settings.manage', // data sources, event types, app settings
  'audit.view',
  'data.export',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS];
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: ALL,
  COMPETITION_ADMIN: ['ops.access', 'events.log', 'events.verify', 'events.resolve', 'matches.control', 'matches.publish', 'football.manage', 'fantasy.manage', 'audit.view', 'data.export'],
  MATCH_SUPERVISOR: ['ops.access', 'events.log', 'events.verify', 'events.resolve', 'matches.control', 'matches.publish', 'audit.view', 'data.export'],
  MATCH_ANALYST: ['ops.access', 'events.log', 'events.verify', 'matches.control'],
  FANTASY_USER: [],
};

export const can = (role: Role | null | undefined, permission: Permission): boolean => !!role && ROLE_PERMISSIONS[role].includes(permission);

/** Roles that may work any match without an explicit assignment. */
export const UNRESTRICTED_MATCH_ROLES: Role[] = ['SUPER_ADMIN', 'COMPETITION_ADMIN', 'MATCH_SUPERVISOR'];
