import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { FixtureRow } from '../../components/FixtureRow';
import { Empty, Loading, PageHeader } from '../../components/ui';
import { useGameweeks, useMeta, type Fixture } from '../../hooks/data';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';

export function FixturesPage() {
  const { data: meta } = useMeta();
  const gws = useGameweeks();
  const [gw, setGw] = useState<number>(meta?.currentGameweek?.number ?? 1);
  useEffect(() => {
    if (meta?.currentGameweek) setGw(meta.currentGameweek.number);
  }, [meta?.currentGameweek?.number]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isLoading } = useQuery({ queryKey: ['fixtures', 'gw', gw], queryFn: () => api<Fixture[]>(`/fixtures?gameweek=${gw}`) });
  const info = gws.data?.find((g) => g.number === gw);
  const max = gws.data?.length ?? 1;
  const byDay = new Map<string, Fixture[]>();
  for (const f of data ?? []) {
    const k = new Date(f.kickoffAt).toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), f]);
  }
  return (
    <div>
      <PageHeader title="Fixtures & results" subtitle={info ? `Deadline ${dateTime(info.deadlineAt)} · ${info.status.toLowerCase()}` : undefined} />
      <div className="mb-4 flex items-center justify-between rounded-2xl bg-ink p-2 text-white">
        <button className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-30" disabled={gw <= 1} onClick={() => setGw(gw - 1)} aria-label="Previous gameweek">
          <ChevronLeft />
        </button>
        <span className="font-display font-bold">{info?.name ?? `Gameweek ${gw}`}</span>
        <button className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-30" disabled={gw >= max} onClick={() => setGw(gw + 1)} aria-label="Next gameweek">
          <ChevronRight />
        </button>
      </div>
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No fixtures in this gameweek" />
      ) : (
        <div className="space-y-4">
          {[...byDay.entries()].map(([day, list]) => (
            <section key={day} className="card p-3">
              <h2 className="mb-1 px-2 text-xs font-bold uppercase tracking-wide text-ink/50">{new Date(day).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
              {list.map((f) => (
                <FixtureRow key={f.id} f={f} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
