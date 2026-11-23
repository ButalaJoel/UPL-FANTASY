import { useQuery } from '@tanstack/react-query';
import { Radio } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { Empty, Loading, PageHeader, Tabs } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { api } from '../../lib/api';
import { STATUS_LABEL, dateTime, isLive } from '../../lib/format';
import type { OpsFixture } from './Fixtures';

/** Matches the analyst can open in the live collection console. */
export function LiveMatchesPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<'mine' | 'all'>(user?.role === 'MATCH_ANALYST' ? 'mine' : 'all');
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'fixtures', 'live', scope], queryFn: () => api<OpsFixture[]>(`/ops/football/fixtures${scope === 'mine' ? '?mine=1' : ''}`), refetchInterval: 20_000 });
  const relevant = (data ?? []).filter((f) => !['PUBLISHED', 'POSTPONED'].includes(f.status) && (isLive(f.status) || ['FULL_TIME', 'COMPLETED'].includes(f.status) || new Date(f.kickoffAt).getTime() < Date.now() + 10 * 86400_000));
  return (
    <div>
      <PageHeader title="Live matches" subtitle="Open a match to record events. Works offline: events sync when the connection returns." actions={<Tabs value={scope} onChange={setScope} options={[{ value: 'mine', label: 'Assigned to me' }, { value: 'all', label: 'All' }]} />} />
      {isLoading ? (
        <Loading />
      ) : relevant.length === 0 ? (
        <Empty icon={<Radio className="h-8 w-8" />} title="No matches to collect">Ask a competition administrator to assign you to a fixture.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {relevant.map((f) => (
            <Link key={f.id} to={`/ops/collect/${f.id}`} className="card block p-4 transition hover:ring-pitch">
              <div className="flex items-center justify-between text-xs text-ink/50">
                <span>GW{f.gameweek?.number} · {dateTime(f.kickoffAt)}</span>
                <span className={isLive(f.status) ? 'chip bg-clay text-white' : 'chip bg-ink/5'}>{STATUS_LABEL[f.status]}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  <ClubCrest club={f.homeClub} size={28} /> {f.homeClub.shortName}
                </span>
                <span className="font-display text-xl font-bold">
                  {f.homeScore} - {f.awayScore}
                </span>
                <span className="flex items-center gap-2 font-semibold">
                  {f.awayClub.shortName} <ClubCrest club={f.awayClub} size={28} />
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1 text-[11px] text-ink/50">
                {f._count.squad === 0 && <span className="chip bg-clay-50 text-clay-600">No line-ups</span>}
                {f.assignments.map((a) => (
                  <span key={a.user.id} className="chip bg-ink/5">
                    {a.role.toLowerCase()}: {a.user.displayName}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
