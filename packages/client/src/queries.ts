/** React Query hooks for every screen. Both apps use these, so a fix here lands everywhere. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { setCurrency } from './format';
import type {
  Club,
  CupResponse,
  CupSummary,
  Fixture,
  Gameweek,
  LeadersResponse,
  League,
  LeagueResponse,
  MatchStateResponse,
  Meta,
  MyLeaguesResponse,
  MyTeamResponse,
  NotificationsResponse,
  PlayerResponse,
  PlayersResponse,
  Standings,
  TeamViewResponse,
  TransferHistoryItem,
  TransferPreview,
} from './types';

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][]).toString();

export const useMeta = () =>
  useQuery({
    queryKey: ['meta'],
    queryFn: async () => {
      const m = await api<Meta>('/meta');
      setCurrency(m.rules.currency);
      return m;
    },
    staleTime: 30_000,
  });

export const useClubs = () => useQuery({ queryKey: ['clubs'], queryFn: () => api<Club[]>('/clubs'), staleTime: 300_000 });
export const useGameweeks = () => useQuery({ queryKey: ['gameweeks'], queryFn: () => api<Gameweek[]>('/gameweeks') });

export interface PlayerFilters {
  position?: string;
  club?: string;
  sort?: string;
  maxPrice?: string | number;
  q?: string;
}
export const usePlayers = (f: PlayerFilters = {}) => {
  const query = qs({ position: f.position, club: f.club, sort: f.sort, maxPrice: f.maxPrice });
  return useQuery({ queryKey: ['players', query], queryFn: () => api<PlayersResponse>(`/players?${query}`) });
};
/** Client-side name search over a loaded player list. */
export const searchPlayers = <T extends { firstName: string; lastName: string }>(list: T[], q?: string) => {
  const needle = (q ?? '').trim().toLowerCase();
  return needle ? list.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle)) : list;
};
export const usePlayer = (id: string | undefined) => useQuery({ queryKey: ['player', id], queryFn: () => api<PlayerResponse>(`/players/${id}`), enabled: !!id });
export const useLeaders = () => useQuery({ queryKey: ['stats', 'leaders'], queryFn: () => api<LeadersResponse>('/stats/leaders') });

export const useFixtures = (gameweek: number | undefined) =>
  useQuery({ queryKey: ['fixtures', 'gw', gameweek], queryFn: () => api<Fixture[]>(`/fixtures?gameweek=${gameweek}`), enabled: !!gameweek });
export const useMatch = (id: string | undefined) => useQuery({ queryKey: ['match', id], queryFn: () => api<MatchStateResponse>(`/matches/${id}`), enabled: !!id });

// Fantasy
export const useMyTeam = (enabled = true) => useQuery({ queryKey: ['fantasy', 'me'], queryFn: () => api<MyTeamResponse>('/fantasy/me'), enabled });
export const useTeamView = (teamId: string | undefined, gameweek?: number | null) =>
  useQuery({ queryKey: ['fantasy', 'team', teamId, gameweek ?? null], queryFn: () => api<TeamViewResponse>(`/fantasy/teams/${teamId}${gameweek ? `?gameweek=${gameweek}` : ''}`), enabled: !!teamId });
export const useTransferHistory = (enabled = true) => useQuery({ queryKey: ['fantasy', 'transfers'], queryFn: () => api<TransferHistoryItem[]>('/fantasy/transfers'), enabled });

export interface TransferRequest {
  transfers: { outId: string; inId: string }[];
  useWildcard: boolean;
}
export const previewTransfers = (body: TransferRequest, signal?: AbortSignal) => api<TransferPreview>('/fantasy/transfers/preview', { body, signal });

export function useFantasyMutations() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['fantasy'] });
    qc.invalidateQueries({ queryKey: ['players'] });
    qc.invalidateQueries({ queryKey: ['leagues'] });
  };
  return {
    createTeam: useMutation({ mutationFn: (b: { name: string; playerIds: string[] }) => api('/fantasy/team', { body: b }), onSuccess: refresh }),
    renameTeam: useMutation({ mutationFn: (name: string) => api('/fantasy/team', { method: 'PATCH', body: { name } }), onSuccess: refresh }),
    saveLineup: useMutation({
      mutationFn: (picks: { playerId: string; slot: number; isCaptain: boolean; isViceCaptain: boolean }[]) => api('/fantasy/lineup', { method: 'PUT', body: { picks } }),
      onSuccess: refresh,
    }),
    makeTransfers: useMutation({ mutationFn: (b: TransferRequest) => api('/fantasy/transfers', { body: b }), onSuccess: refresh }),
  };
}

// Leagues
export const useOverall = (limit = 50) => useQuery({ queryKey: ['leagues', 'overall', limit], queryFn: () => api<Standings>(`/leagues/overall?limit=${limit}`) });
export const useMyLeagues = (enabled = true) => useQuery({ queryKey: ['leagues', 'mine'], queryFn: () => api<MyLeaguesResponse>('/leagues/mine'), enabled });
export const usePublicLeagues = () => useQuery({ queryKey: ['leagues', 'public'], queryFn: () => api<League[]>('/leagues/public') });
export const useCups = () => useQuery({ queryKey: ['leagues', 'cups'], queryFn: () => api<CupSummary[]>('/leagues/cups/all') });
export const useLeague = (id: string | undefined) => useQuery({ queryKey: ['leagues', id], queryFn: () => api<LeagueResponse>(`/leagues/${id}`), enabled: !!id });
export const useCup = (id: string | undefined) => useQuery({ queryKey: ['leagues', 'cup', id], queryFn: () => api<CupResponse>(`/leagues/cups/${id}`), enabled: !!id });

export function useLeagueMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['leagues'] });
  return {
    create: useMutation({ mutationFn: (b: { name: string; type: 'CLASSIC' | 'H2H'; visibility?: 'PUBLIC' | 'PRIVATE' }) => api<League>('/leagues', { body: { visibility: 'PRIVATE', ...b } }), onSuccess: refresh }),
    joinByCode: useMutation({ mutationFn: (code: string) => api<League>('/leagues/join', { body: { code: code.trim().toUpperCase() } }), onSuccess: refresh }),
    joinPublic: useMutation({ mutationFn: (id: string) => api(`/leagues/${id}/join`, { method: 'POST' }), onSuccess: refresh }),
    leave: useMutation({ mutationFn: (id: string) => api(`/leagues/${id}/membership`, { method: 'DELETE' }), onSuccess: refresh }),
  };
}

// Notifications
export const useNotifications = (enabled = true) => useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationsResponse>('/notifications'), enabled });
export function useNotificationMutations() {
  const qc = useQueryClient();
  return {
    readAll: useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) }),
  };
}

export interface HistoryResponse {
  gameweeks: { gameweek: number; gameweekId: string; status: string; points: number; confirmed: number; transferCost: number; transfers: number; average: number; total: number }[];
}
export const useFantasyHistory = (enabled = true) => useQuery({ queryKey: ['fantasy', 'history'], queryFn: () => api<HistoryResponse>('/fantasy/history'), enabled });
