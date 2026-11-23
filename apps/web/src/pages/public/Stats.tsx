import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { Loading, PageHeader } from '../../components/ui';
import type { Player } from '../../hooks/data';
import { api } from '../../lib/api';
import { price } from '../../lib/format';

type Row = Player & { stats: NonNullable<Player['stats']> };
const BOARDS: { key: string; title: string; value: (r: Row) => string | number }[] = [
  { key: 'points', title: 'Fantasy points', value: (r) => r.stats.totalPoints },
  { key: 'goals', title: 'Goals', value: (r) => r.stats.goals },
  { key: 'assists', title: 'Assists', value: (r) => r.stats.assists },
  { key: 'cleanSheets', title: 'Clean sheets', value: (r) => r.stats.cleanSheets },
  { key: 'saves', title: 'Saves', value: (r) => r.stats.saves },
  { key: 'form', title: 'In form', value: (r) => r.stats.form },
  { key: 'selected', title: 'Most selected', value: (r) => `${r.stats.selectedByPct}%` },
  { key: 'cards', title: 'Discipline', value: (r) => `${r.stats.yellowCards}🟨 ${r.stats.redCards}🟥` },
];

export function StatsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['stats', 'leaders'], queryFn: () => api<Record<string, Row[]>>('/stats/leaders') });
  if (isLoading || !data) return <Loading />;
  return (
    <div>
      <PageHeader title="Statistics" subtitle="Season leaders, derived from every logged match event." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BOARDS.map((b) => (
          <section key={b.key} className="card p-4">
            <h2 className="mb-2 font-display font-bold">{b.title}</h2>
            <ol className="space-y-1">
              {(data[b.key] ?? []).map((r, i) => (
                <li key={r.id}>
                  <Link to={`/players/${r.id}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-ink/5">
                    <span className="w-4 text-xs text-ink/40">{i + 1}</span>
                    <ClubCrest club={r.club} size={20} />
                    <span className="min-w-0 flex-1 truncate">
                      {r.firstName[0]}. {r.lastName} <span className="text-xs text-ink/40">{price(r.price)}</span>
                    </span>
                    <b className="tabular-nums">{b.value(r)}</b>
                  </Link>
                </li>
              ))}
            </ol>
            {!(data[b.key] ?? []).length && <p className="text-sm text-ink/40">No data yet.</p>}
          </section>
        ))}
      </div>
    </div>
  );
}
