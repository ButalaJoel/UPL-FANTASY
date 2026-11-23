import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { can, type Permission, type Role } from '@kiwanja/core';
import { api, tokenStore } from '../lib/api';
import { reconnectSocket } from '../lib/socket';

export interface Me {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  avatarColor: string;
  avatarUrl: string | null;
  favouriteClubId: string | null;
  notifyGoals: boolean;
  notifyDeadlines: boolean;
  canAccessOps: boolean;
  createdAt: string;
}

interface AuthCtx {
  user: Me | null;
  loading: boolean;
  signIn: (token: string, user: Me) => void;
  signOut: () => void;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AuthCtx>(null as never);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (tokenStore.get() ? (await api<{ user: Me }>('/auth/me')).user : null),
    retry: false,
    staleTime: 60_000,
  });
  const signIn = useCallback(
    (token: string, user: Me) => {
      tokenStore.set(token);
      qc.setQueryData(['me'], user);
      qc.invalidateQueries();
      reconnectSocket();
    },
    [qc],
  );
  const signOut = useCallback(() => {
    tokenStore.set(null);
    qc.setQueryData(['me'], null);
    qc.clear();
    reconnectSocket();
  }, [qc]);
  const user = data ?? null;
  return <Ctx.Provider value={{ user, loading: isLoading, signIn, signOut, can: (p) => can(user?.role, p) }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
