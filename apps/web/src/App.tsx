import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { OpsLayout, PublicLayout } from './components/layouts';
import { Loading } from './components/ui';
import { useAuth } from './hooks/auth';
import { useMeta } from './hooks/data';
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from './pages/public/Auth';
import { CreateTeamPage } from './pages/public/CreateTeam';
import { FixturesPage } from './pages/public/Fixtures';
import { HomePage } from './pages/public/Home';
import { CupPage, LeaguePage, LeaguesPage } from './pages/public/Leagues';
import { MatchCentrePage } from './pages/public/MatchCentre';
import { MyTeamPage, TeamViewPage } from './pages/public/MyTeam';
import { NotificationsPage } from './pages/public/Notifications';
import { PlayerPage } from './pages/public/PlayerProfile';
import { PlayersPage } from './pages/public/Players';
import { ProfilePage } from './pages/public/Profile';
import { StatsPage } from './pages/public/Stats';
import { TransfersPage } from './pages/public/Transfers';
import { OpsClubsPage } from './pages/ops/Clubs';
import { CollectPage } from './pages/ops/Collect';
import { OpsFantasyPage } from './pages/ops/Fantasy';
import { FixtureSetupPage } from './pages/ops/FixtureSetup';
import { OpsFixturesPage } from './pages/ops/Fixtures';
import { LiveMatchesPage } from './pages/ops/LiveMatches';
import { OverviewPage } from './pages/ops/Overview';
import { OpsPlayersPage } from './pages/ops/Players';
import { OpsSettingsPage } from './pages/ops/Settings';
import { OpsStatisticsPage } from './pages/ops/Statistics';
import { OpsUsersPage } from './pages/ops/Users';
import { VerifyPage } from './pages/ops/Verify';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  return <>{children}</>;
}

/** Data-operations screens are only reachable by staff roles (the API enforces this too). */
function RequireOps({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!user.canAccessOps) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  const meta = useMeta();
  if (meta.isLoading) return <Loading label="Starting Kiwanja" />;
  if (meta.error)
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-xl font-bold">Cannot reach the Kiwanja API</h1>
        <p className="mt-2 text-sm text-ink/60">Start the backend with <code className="rounded bg-ink/5 px-1">pnpm dev</code> and make sure the database is seeded.</p>
      </div>
    );
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPage />} />
        <Route path="reset-password" element={<ResetPage />} />
        <Route path="players" element={<PlayersPage />} />
        <Route path="players/:id" element={<PlayerPage />} />
        <Route path="fixtures" element={<FixturesPage />} />
        <Route path="match/:id" element={<MatchCentrePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="leagues" element={<LeaguesPage />} />
        <Route path="leagues/:id" element={<LeaguePage />} />
        <Route path="cups/:id" element={<CupPage />} />
        <Route path="teams/:id" element={<TeamViewPage />} />
        <Route path="my-team" element={<RequireAuth><MyTeamPage /></RequireAuth>} />
        <Route path="create-team" element={<RequireAuth><CreateTeamPage /></RequireAuth>} />
        <Route path="transfers" element={<RequireAuth><TransfersPage /></RequireAuth>} />
        <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
        <Route path="*" element={<div className="py-20 text-center font-display text-xl">Page not found</div>} />
      </Route>
      <Route path="ops" element={<RequireOps><OpsLayout /></RequireOps>}>
        <Route index element={<OverviewPage />} />
        <Route path="live" element={<LiveMatchesPage />} />
        <Route path="collect/:id" element={<CollectPage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="fixtures" element={<OpsFixturesPage />} />
        <Route path="fixtures/:id" element={<FixtureSetupPage />} />
        <Route path="clubs" element={<OpsClubsPage />} />
        <Route path="players" element={<OpsPlayersPage />} />
        <Route path="statistics" element={<OpsStatisticsPage />} />
        <Route path="fantasy" element={<OpsFantasyPage />} />
        <Route path="users" element={<OpsUsersPage />} />
        <Route path="settings" element={<OpsSettingsPage />} />
      </Route>
    </Routes>
  );
}
