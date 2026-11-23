import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardCheck,
  Database,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  Radio,
  Settings,
  Shield,
  Shirt as ShirtIcon,
  Trophy,
  User,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/auth';
import { useLiveUpdates } from '../hooks/live';
import { api } from '../lib/api';
import { Avatar, Logo } from './brand';

const PUBLIC_NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/my-team', label: 'My Team', icon: ShirtIcon },
  { to: '/players', label: 'Players', icon: Users },
  { to: '/fixtures', label: 'Fixtures', icon: CalendarDays },
  { to: '/leagues', label: 'Leagues', icon: Trophy },
  { to: '/stats', label: 'Statistics', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: User },
];

function Toasts() {
  const { toasts, dismiss } = useLiveUpdates();
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-50 flex flex-col items-center gap-2 px-4 md:items-end md:pr-6">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full max-w-sm rounded-2xl bg-ink p-4 text-white shadow-2xl ring-1 ring-gold/40">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-display text-sm font-bold text-gold">{t.title}</div>
              {t.body && <div className="mt-0.5 text-xs text-white/70">{t.body}</div>}
              {t.link && (
                <Link to={t.link} className="mt-1 inline-block text-xs font-semibold text-pitch-100 underline" onClick={() => dismiss(t.id)}>
                  Open match centre
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X className="h-4 w-4 text-white/60" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationBell() {
  const { user } = useAuth();
  const { data } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ unread: number }>('/notifications'), enabled: !!user, refetchInterval: 60_000 });
  if (!user) return null;
  return (
    <Link to="/notifications" className="relative rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" aria-label="Notifications">
      <Bell className="h-5 w-5" />
      {!!data?.unread && <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{data.unread > 9 ? '9+' : data.unread}</span>}
    </Link>
  );
}

export function PublicLayout() {
  const { user, signOut } = useAuth();
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <header className="sticky top-0 z-40 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          <Link to="/">
            <Logo sub="Fantasy" light />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {PUBLIC_NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('rounded-lg px-3 py-1.5 text-sm font-semibold transition', isActive ? 'bg-white/10 text-gold' : 'text-white/70 hover:text-white')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <NotificationBell />
            {user?.canAccessOps && (
              <Link to="/ops" className="hidden rounded-lg bg-gold px-3 py-1.5 text-xs font-bold text-ink sm:inline-flex" title="Data operations platform">
                Data Ops
              </Link>
            )}
            {user ? (
              <button onClick={signOut} className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Sign out" aria-label="Sign out">
                <LogOut className="h-5 w-5" />
              </button>
            ) : (
              <Link to="/login" className="rounded-lg bg-pitch px-3 py-1.5 text-sm font-semibold text-white">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <Toasts />
      <main className="mx-auto max-w-6xl px-4 py-5 md:py-8">
        <Outlet />
      </main>
      <footer className="mx-auto hidden max-w-6xl px-4 pb-8 text-xs text-ink/40 md:block">
        Kiwanja is an independent prototype. Clubs, players and statistics shown are fictional sample data unless labelled otherwise. Not affiliated with any league or federation.
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="grid grid-cols-6">
          {PUBLIC_NAV.filter((n) => n.to !== '/stats').map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => clsx('flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold', isActive ? 'text-pitch' : 'text-ink/50')}>
              <n.icon className="h-5 w-5" />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

const OPS_NAV: { to: string; label: string; icon: typeof Home; end?: boolean; perm?: string }[] = [
  { to: '/ops', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/ops/live', label: 'Live Matches', icon: Radio },
  { to: '/ops/verify', label: 'Verification', icon: ClipboardCheck },
  { to: '/ops/fixtures', label: 'Fixtures', icon: CalendarDays },
  { to: '/ops/clubs', label: 'Clubs', icon: Shield },
  { to: '/ops/players', label: 'Players', icon: Users },
  { to: '/ops/statistics', label: 'Statistics', icon: BarChart3 },
  { to: '/ops/fantasy', label: 'Fantasy Management', icon: Wand2, perm: 'fantasy.manage' },
  { to: '/ops/users', label: 'Users', icon: ListChecks, perm: 'users.manage' },
  { to: '/ops/settings', label: 'Settings', icon: Settings, perm: 'audit.view' },
];

export function OpsLayout({ children }: { children?: ReactNode }) {
  const { user, can, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const full = loc.pathname.startsWith('/ops/collect/');
  const nav = OPS_NAV.filter((n) => !n.perm || can(n.perm as never));
  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 pt-2">
        <Logo sub="Data Ops" light />
      </div>
      {nav.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-pitch text-white' : 'text-white/70 hover:bg-white/5 hover:text-white')}>
          <n.icon className="h-4 w-4" />
          {n.label}
        </NavLink>
      ))}
      <div className="mt-auto space-y-2 border-t border-white/10 pt-3">
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white">
          <Activity className="h-4 w-4" /> Fantasy app
        </Link>
        {user && (
          <div className="flex items-center gap-2 px-2">
            <Avatar name={user.displayName} color={user.avatarColor} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{user.displayName}</div>
              <div className="truncate text-[11px] text-white/50">{user.role.replace(/_/g, ' ').toLowerCase()}</div>
            </div>
            <button onClick={signOut} className="text-white/50 hover:text-white" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
  return (
    <div className="min-h-screen bg-[#EEF1EE]">
      {!full && <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-ink lg:block">{sidebar}</aside>}
      {open && (
        <div className="fixed inset-0 z-50 bg-ink/60 lg:hidden" onClick={() => setOpen(false)}>
          <aside className="h-full w-64 bg-ink" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className={clsx(!full && 'lg:pl-60')}>
        {!full && (
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 bg-ink px-4 lg:hidden">
            <button onClick={() => setOpen(true)} className="text-white" aria-label="Menu">
              <Menu className="h-6 w-6" />
            </button>
            <Logo sub="Data Ops" light />
          </header>
        )}
        <main className={clsx(!full && 'mx-auto max-w-7xl p-4 md:p-6')}>{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}

export function DataNotice() {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-sky/10 px-3 py-2 text-xs text-sky">
      <Database className="h-4 w-4 shrink-0" /> All clubs, players and matches in this prototype are fictional sample data.
    </div>
  );
}
