import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useClubs, usePlayers, type Player } from '../hooks/data';
import { price } from '../lib/format';
import { ClubCrest } from './brand';
import { Loading, PosChip } from './ui';

export interface MarketFilters {
  position?: string;
  club?: string;
  q?: string;
  sort?: string;
  maxPrice?: string;
}

/** Browse / filter / search all players. `action` renders the per-row button (add, swap...). */
export function PlayerMarket({ action, lockedPosition, initial, compact, rowClass }: { action?: (p: Player) => ReactNode; lockedPosition?: string; initial?: MarketFilters; compact?: boolean; rowClass?: (p: Player) => string | undefined }) {
  const [f, setF] = useState<MarketFilters>({ sort: 'totalPoints', ...initial });
  const position = lockedPosition ?? f.position;
  const { data, isLoading } = usePlayers({ position, club: f.club, sort: f.sort, maxPrice: f.maxPrice });
  const clubs = useClubs();
  const rows = useMemo(() => {
    const q = (f.q ?? '').toLowerCase();
    return (data?.players ?? []).filter((p) => !q || `${p.firstName} ${p.lastName}`.toLowerCase().includes(q));
  }, [data, f.q]);
  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="relative col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/40" />
          <input className="input pl-9" placeholder="Search player" value={f.q ?? ''} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </label>
        {!lockedPosition && (
          <select className="input" value={f.position ?? ''} onChange={(e) => setF({ ...f, position: e.target.value || undefined })} aria-label="Position">
            <option value="">All positions</option>
            <option value="GK">Goalkeepers</option>
            <option value="DEF">Defenders</option>
            <option value="MID">Midfielders</option>
            <option value="FWD">Forwards</option>
          </select>
        )}
        <select className="input" value={f.club ?? ''} onChange={(e) => setF({ ...f, club: e.target.value || undefined })} aria-label="Club">
          <option value="">All clubs</option>
          {clubs.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select className="input" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} aria-label="Sort">
          <option value="totalPoints">Total points</option>
          <option value="form">Form</option>
          <option value="price">Price</option>
          <option value="goals">Goals</option>
          <option value="assists">Assists</option>
          <option value="selectedByPct">Selected by</option>
        </select>
        <select className="input" value={f.maxPrice ?? ''} onChange={(e) => setF({ ...f, maxPrice: e.target.value || undefined })} aria-label="Max price">
          <option value="">Any price</option>
          {[45, 50, 55, 60, 70, 80, 90].map((p) => (
            <option key={p} value={p}>
              Up to {price(p)}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-2 text-xs text-ink/50">{rows.length} players</div>
      {isLoading ? (
        <Loading />
      ) : (
        <div className={clsx('mt-1 divide-y divide-ink/5 overflow-y-auto', compact && 'max-h-[60vh]')}>
          {rows.map((p) => (
            <div key={p.id} className={clsx('flex items-center gap-3 py-2', rowClass?.(p))}>
              <ClubCrest club={p.club} size={30} />
              <div className="min-w-0 flex-1">
                <Link to={`/players/${p.id}`} className="block truncate text-sm font-semibold hover:text-pitch">
                  {p.firstName} {p.lastName}
                  {p.status !== 'AVAILABLE' && <span className="ml-1.5 chip bg-clay-50 text-clay-600">{p.status.toLowerCase()}</span>}
                </Link>
                <div className="flex items-center gap-2 text-xs text-ink/50">
                  <PosChip pos={p.position} />
                  <span>{p.club.shortName}</span>
                  <span>Form {p.stats?.form ?? 0}</span>
                  <span className="hidden sm:inline">Sel. {p.stats?.selectedByPct ?? 0}%</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold tabular-nums">{price(p.price)}</div>
                <div className="text-xs text-ink/50">{p.stats?.totalPoints ?? 0} pts</div>
              </div>
              {action?.(p)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
