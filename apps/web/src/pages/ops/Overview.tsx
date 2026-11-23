import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { Loading, PageHeader, Stat } from '../../components/ui';
import { api } from '../../lib/api';
import { STATUS_LABEL, ago } from '../../lib/format';

interface Overview {
  gameweek: { name: string; status: string } | null;
  counts: { clubs: number; players: number; teams: number; users: number; pending: number; disputed: number; events24: number };
  fixturesByStatus: Record<string, number>;
  activeMatches: { id: string; status: string; homeScore: number; awayScore: number; homeClub: { name: string; shortName: string; primaryColor: string; secondaryColor: string }; awayClub: { name: string; shortName: string; primaryColor: string; secondaryColor: string }; _count: { events: number } }[];
  recent: { id: string; action: string; entity: string; createdAt: string; user: { displayName: string } | null }[];
  analystActivity: { userId: string; name: string; events: number }[];
}

export function OverviewPage() {
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'overview'], queryFn: () => api<Overview>('/ops/overview'), refetchInterval: 15_000 });
  if (isLoading || !data) return <Loading />;
  const c = data.counts;
  return (
    <div className="space-y-6">
      <PageHeader title="Operations overview" subtitle={data.gameweek ? `${data.gameweek.name} · ${data.gameweek.status.toLowerCase()}` : undefined} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat accent label="Awaiting verification" value={c.pending} />
        <Stat label="Disputed" value={c.disputed} />
        <Stat label="Events (24h)" value={c.events24} />
        <Stat label="Clubs" value={c.clubs} />
        <Stat label="Players" value={c.players} />
        <Stat label="Fantasy teams" value={c.teams} />
        <Stat label="Users" value={c.users} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-4">
          <h2 className="mb-3 font-display text-lg font-bold">Active matches</h2>
          {data.activeMatches.length === 0 && <p className="text-sm text-ink/50">No matches in progress or awaiting publication.</p>}
          {data.activeMatches.map((m) => (
            <Link key={m.id} to={`/ops/collect/${m.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink/5">
              <ClubCrest club={m.homeClub} size={24} />
              <span className="font-semibold">
                {m.homeClub.shortName} {m.homeScore}-{m.awayScore} {m.awayClub.shortName}
              </span>
              <ClubCrest club={m.awayClub} size={24} />
              <span className="chip ml-auto bg-ink/5">{STATUS_LABEL[m.status]}</span>
              {m._count.events > 0 && <span className="chip bg-gold-50 text-gold-600">{m._count.events} pending</span>}
            </Link>
          ))}
          <h3 className="mb-2 mt-5 text-xs font-bold uppercase text-ink/50">Fixtures by status</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(data.fixturesByStatus).map(([s, n]) => (
              <span key={s} className="chip bg-ink/5 text-sm">
                {STATUS_LABEL[s] ?? s}: {n}
              </span>
            ))}
          </div>
        </section>
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-2 font-display text-lg font-bold">Analyst activity (24h)</h2>
            {data.analystActivity.length === 0 && <p className="text-sm text-ink/50">No events recorded in the last 24 hours.</p>}
            {data.analystActivity.map((a) => (
              <div key={a.userId} className="flex justify-between py-1 text-sm">
                <span>{a.name}</span>
                <b>{a.events} events</b>
              </div>
            ))}
          </section>
          <section className="card p-4">
            <h2 className="mb-2 font-display text-lg font-bold">Recent activity</h2>
            {data.recent.map((r) => (
              <div key={r.id} className="flex gap-2 py-1 text-xs">
                <span className="w-14 shrink-0 text-ink/40">{ago(r.createdAt)}</span>
                <span className="font-semibold">{r.user?.displayName ?? 'system'}</span>
                <span className="text-ink/60">{r.action}</span>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
