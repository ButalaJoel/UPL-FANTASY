import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can, type Permission } from '@kiwanja/core';
import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { api, tokens } from './api';
import type { AuthResponse, Me } from './types';

interface AuthCtx {
  user: Me | null;
  loading: boolean;
  signIn: (res: AuthResponse) => Promise<void>;
  signOut: () => Promise<void>;
  can: (p: Permission) => boolean;
}

const Ctx = createContext<AuthCtx>(null as never);

/** Session state for both apps. The token store (localStorage / SecureStore) is configured per app. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      if (!tokens.get()) return null;
      try {
        return (await api<{ user: Me }>('/auth/me')).user;
      } catch (e) {
        // An expired or revoked token: sign out quietly rather than showing an error.
        if ((e as { status?: number }).status === 401) {
          await tokens.set(null);
          return null;
        }
        throw e;
      }
    },
    retry: false,
    staleTime: 60_000,
  });
  const signIn = useCallback(
    async ({ token, user }: AuthResponse) => {
      await tokens.set(token);
      qc.setQueryData(['me'], user);
      qc.invalidateQueries();
    },
    [qc],
  );
  const signOut = useCallback(async () => {
    await tokens.set(null);
    qc.clear();
    qc.setQueryData(['me'], null);
  }, [qc]);
  const user = data ?? null;
  return <Ctx.Provider value={{ user, loading: isLoading, signIn, signOut, can: (p) => can(user?.role, p) }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export const authApi = {
  login: (email: string, password: string) => api<AuthResponse>('/auth/login', { body: { email, password } }),
  register: (b: { email: string; password: string; displayName: string }) => api<AuthResponse>('/auth/register', { body: b }),
  forgot: (email: string) => api<{ message: string; devResetUrl?: string }>('/auth/forgot-password', { body: { email } }),
  updateProfile: (b: Partial<Pick<Me, 'displayName' | 'avatarColor' | 'favouriteClubId' | 'notifyGoals' | 'notifyDeadlines'>>) => api<{ user: Me }>('/auth/me', { method: 'PATCH', body: b }),
  changePassword: (currentPassword: string, newPassword: string) => api('/auth/change-password', { body: { currentPassword, newPassword } }),
};

export const DEMO_ACCOUNTS = [
  { email: 'fan@kiwanja.test', label: 'Fantasy manager' },
  { email: 'manager1@kiwanja.test', label: 'Another manager' },
];
export const DEMO_PASSWORD = 'kiwanja123';
