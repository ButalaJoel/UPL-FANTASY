import { useQuery } from '@tanstack/react-query';
import type { GameRules, ScoringRule } from '@kiwanja/core';
import { api } from '../lib/api';
import { setCurrency } from '../lib/format';

export interface Club {
  id: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  city?: string | null;
  stadium?: string | null;
  origin: string;
  _count?: { players: number };
}
export interface Gameweek {
  id: string;
  number: number;
  name: string;
  deadlineAt: string;
  status: 'UPCOMING' | 'LIVE' | 'FINISHED' | 'LOCKED';
  isCurrent: boolean;
  averagePoints?: number;
  highestPoints?: number;
  _count?: { fixtures: number };
}
export interface PlayerStats {
  totalPoints: number;
  confirmedPoints: number;
  goals: number;
  assists: number;
  appearances: number;
  minutes: number;
  yellowCards: number;
  redCards: number;
  cleanSheets: number;
  saves: number;
  shotsOnTarget: number;
  form: number;
  selectedByPct: number;
}
export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  price: number;
  clubId: string;
  shirtNumber: number | null;
  status: string;
  statusNote?: string | null;
  origin: string;
  club: Club;
  stats?: PlayerStats;
}
export interface Fixture {
  id: string;
  kickoffAt: string;
  status: string;
  homeScore: number;
  awayScore: number;
  homeClub: Club;
  awayClub: Club;
  homeClubId: string;
  awayClubId: string;
  venue?: string | null;
  origin: string;
  gameweek?: { id: string; number: number; name?: string; status?: string } | null;
}
export interface EventTypeMeta {
  code: string;
  label: string;
  category: string;
  needsPlayer: boolean;
  requiresVerification: boolean;
  enabled: boolean;
  extended: boolean;
  primary?: boolean;
  playerLabel?: string;
  secondaryLabel?: string;
  secondaryRequired?: boolean;
  secondaryIsOpponent?: boolean;
  description: string;
}
export interface Meta {
  season: { id: string; name: string; competition: string };
  rules: GameRules;
  scoringRules: ScoringRule[];
  currentGameweek: Gameweek | null;
  nextGameweek: Gameweek | null;
  eventTypes: EventTypeMeta[];
  dataSources: { id: string; name: string; kind: string; attribution: string | null }[];
}

export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: async () => {
      const m = await api<Meta>('/meta');
      setCurrency(m.rules.currency);
      return m;
    },
    staleTime: 30_000,
  });
}

export const useClubs = () => useQuery({ queryKey: ['clubs'], queryFn: () => api<Club[]>('/clubs'), staleTime: 300_000 });
export const useGameweeks = () => useQuery({ queryKey: ['gameweeks'], queryFn: () => api<Gameweek[]>('/gameweeks') });
export const usePlayers = (params: Record<string, string | undefined> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return useQuery({ queryKey: ['players', qs], queryFn: () => api<{ total: number; players: Player[] }>(`/players?${qs}`) });
};
