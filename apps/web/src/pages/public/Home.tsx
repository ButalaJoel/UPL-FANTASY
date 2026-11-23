import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Radio, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Avatar, ClubCrest } from '../../components/brand';
import { FixtureRow } from '../../components/FixtureRow';
import { DataNotice } from '../../components/layouts';
import { Countdown, Empty, Loading, Stat } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useGameweeks, useMeta, type Fixture, type Player } from '../../hooks/data';
import { api } from '../../lib/api';
import { dateTime, isLive, price } from '../../lib/format';

export interface Standings {
  gameweek: { id: string; number: number; status: string } | null;
  total: number;
  rows: { rank: number; teamId: string; teamName: string; manager: { displayName: string; avatarColor: string; avatarUrl: string | null }; totalPoints: number; confirmedTotal: number; gameweekPoints: number; gameweekConfirmed: number }[];
}

export function HomePage() {
  const { user } = useAuth();
  const { data: meta } = useMeta();
  const gws = useGameweeks();
  const current = meta?.currentGameweek;
  const next = meta?.nextGameweek;
  const fixtures = useQuery({ queryKey: ['fixtures', 'gw', current?.number], queryFn: () => api<Fixture[]>(`/fixtures?gameweek=${current!.number}`), enabled: !!current });
  const nextFixtures = useQuery({ queryKey: ['fixtures', 'gw', next?.number], queryFn: () => api<Fixture[]>(`/fixtures?gameweek=${next!.number}`), enabled: !!next && next.id !== current?.id });
  const board = useQuery({ queryKey: ['leagues', 'overall', 'top'], queryFn: () => api<Standings>('/leagues/overall?limit=5') });
  const mine = useQuery({ queryKey: ['fantasy', 'me'], queryFn: () => api<{ team: { id: string; name: string; totalPoints: number } | null; rank: number; live: { score: { net: number; confirmed: number } | null } | null }>('/fantasy/me'), enabled: !!user });
  const leaders = useQuery({ queryKey: ['stats', 'leaders'], queryFn: () => api<{ points: (Player & { stats: { totalPoints: number } })[] }>('/stats/leaders') });
  const gwInfo = gws.data?.find((g) => g.id === current?.id);
  const liveFixtures = fixtures.data?.filter((f) => isLive(f.status)) ?? [];

  return (
    <div className="space-y-6">
      <section className="pitch-bg relative overflow-hidden rounded-3xl p-5 text-white shadow-card md:p-8">
        <div className="relative z-10 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-gold">{meta?.season.competition} · {meta?.season.name}</div>
            <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight md:text-5xl">
              Every tap at the stadium.
              <br />
              Points on your phone.
            </h1>
            <p className="mt-3 max-w-lg text-sm text-white/80">Fantasy football powered by our own match analysts. Goals are logged live, verified by a second analyst, and scored in seconds.</p>
            {!mine.data?.team && (
              <Link to={user ? '/create-team' : '/register'} className="btn-gold mt-5">
                Pick your squad <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
          {next && (
            <div className="rounded-2xl bg-ink/40 p-4 ring-1 ring-white/15 backdrop-blur">
              <div className="text-xs font-semibold uppercase tracking-wide text-white/60">{next.name} deadline</div>
              <div className="mt-1 font-display text-3xl font-bold">
                <Countdown to={next.deadlineAt} />
              </div>
              <div className="text-xs text-white/60">{dateTime(next.deadlineAt)}</div>
            </div>
          )}
        </div>
      </section>

      <DataNotice />

      {mine.data?.team && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat accent label={`${current?.name ?? 'Gameweek'} points`} value={mine.data.live?.score?.net ?? 0} hint={mine.data.live?.score ? `${mine.data.live.score.confirmed} confirmed` : 'Line-up not yet locked'} />
          <Stat label="Total points" value={mine.data.team.totalPoints} hint={mine.data.team.name} />
          <Stat label="Overall rank" value={mine.data.rank ? `#${mine.data.rank}` : '-'} />
          <Stat label="Average / highest" value={`${gwInfo?.averagePoints ?? 0} / ${gwInfo?.highestPoints ?? 0}`} hint={current?.name} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold">
              {liveFixtures.length > 0 && <Radio className="h-4 w-4 animate-pulse text-clay" />}
              {current?.name ?? 'Fixtures'}
            </h2>
            <Link to="/fixtures" className="text-sm font-semibold text-pitch">
              All fixtures
            </Link>
          </div>
          {fixtures.isLoading ? <Loading /> : fixtures.data?.map((f) => <FixtureRow key={f.id} f={f} />)}
          {nextFixtures.data && nextFixtures.data.length > 0 && (
            <>
              <h3 className="mb-1 mt-4 text-xs font-bold uppercase tracking-wide text-ink/50">Next up · {next?.name}</h3>
              {nextFixtures.data.slice(0, 8).map((f) => (
                <FixtureRow key={f.id} f={f} />
              ))}
            </>
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold">
                <Trophy className="h-5 w-5 text-gold" /> Overall leaders
              </h2>
              <Link to="/leagues" className="text-sm font-semibold text-pitch">
                Leagues
              </Link>
            </div>
            {board.data?.rows.length ? (
              <ol className="space-y-1">
                {board.data.rows.map((r) => (
                  <li key={r.teamId}>
                    <Link to={`/teams/${r.teamId}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ink/5">
                      <span className="w-6 text-center font-display font-bold text-ink/50">{r.rank}</span>
                      <Avatar name={r.manager.displayName} color={r.manager.avatarColor} url={r.manager.avatarUrl} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{r.teamName}</span>
                        <span className="block truncate text-xs text-ink/50">{r.manager.displayName}</span>
                      </span>
                      <span className="font-display font-bold tabular-nums">{r.totalPoints}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <Empty title="No teams yet" />
            )}
          </section>
          <section className="card p-4">
            <h2 className="mb-3 font-display text-lg font-bold">Top players</h2>
            {leaders.data?.points.slice(0, 5).map((p) => (
              <Link key={p.id} to={`/players/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-ink/5">
                <ClubCrest club={p.club} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.firstName} {p.lastName}</span>
                  <span className="text-xs text-ink/50">{p.position} · {price(p.price)}</span>
                </span>
                <span className="font-display font-bold">{p.stats.totalPoints}</span>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
