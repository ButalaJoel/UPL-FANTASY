import clsx from 'clsx';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Shirt } from './brand';

export interface PitchSlot {
  key: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  name?: string;
  club?: { primaryColor: string; secondaryColor: string; shortName: string };
  caption?: ReactNode;
  badge?: 'C' | 'V' | null;
  muted?: boolean;
  highlighted?: boolean;
  tag?: ReactNode;
  empty?: boolean;
}

function SlotView({ s, onClick }: { s: PitchSlot; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} className={clsx('group relative flex w-[72px] flex-col items-center sm:w-[92px]', s.muted && 'opacity-50')} aria-label={s.name ?? `Empty ${s.position} slot`}>
      <div className={clsx('relative rounded-full p-0.5 transition', s.highlighted && 'ring-4 ring-gold')}>
        {s.empty ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-dashed border-white/50 text-white/80 group-hover:border-gold group-hover:text-gold">
            <Plus className="h-5 w-5" />
          </span>
        ) : (
          <Shirt primary={s.club?.primaryColor ?? '#ccc'} secondary={s.club?.secondaryColor ?? '#fff'} gk={s.position === 'GK'} />
        )}
        {s.badge && <span className={clsx('absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-extrabold', s.badge === 'C' ? 'bg-gold text-ink' : 'bg-white text-ink')}>{s.badge}</span>}
        {s.tag && <span className="absolute -left-2 -top-1">{s.tag}</span>}
      </div>
      <div className="mt-1 w-full overflow-hidden rounded-md text-center shadow">
        <div className="truncate bg-white px-1 py-0.5 text-[11px] font-bold text-ink">{s.empty ? s.position : s.name}</div>
        {s.caption != null && <div className="bg-ink px-1 py-0.5 text-[11px] font-semibold text-white">{s.caption}</div>}
      </div>
    </button>
  );
}

/** Football pitch with players arranged by line. Bench shown beneath. */
export function Pitch({ starters, bench, onSelect, benchLabel = 'Bench' }: { starters: PitchSlot[]; bench?: PitchSlot[]; onSelect?: (key: string) => void; benchLabel?: string }) {
  const rows = (['GK', 'DEF', 'MID', 'FWD'] as const).map((p) => starters.filter((s) => s.position === p)).reverse();
  return (
    <div className="overflow-hidden rounded-3xl shadow-card">
      <div className="pitch-bg relative px-2 py-5 sm:px-6">
        {/* Original pitch markings */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden>
          <g fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".5">
            <rect x="4" y="3" width="92" height="134" rx="1" />
            <line x1="4" y1="70" x2="96" y2="70" />
            <circle cx="50" cy="70" r="11" />
            <rect x="26" y="3" width="48" height="20" />
            <rect x="26" y="117" width="48" height="20" />
            <rect x="38" y="3" width="24" height="7" />
            <rect x="38" y="130" width="24" height="7" />
          </g>
        </svg>
        <div className="relative flex flex-col gap-4 sm:gap-6">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-center gap-1 sm:gap-4">
              {row.map((s) => (
                <SlotView key={s.key} s={s} onClick={onSelect ? () => onSelect(s.key) : undefined} />
              ))}
            </div>
          ))}
        </div>
      </div>
      {bench && bench.length > 0 && (
        <div className="bg-pitch-700 px-2 pb-4 pt-2">
          <div className="mb-2 text-center text-[11px] font-bold uppercase tracking-widest text-white/60">{benchLabel}</div>
          <div className="flex justify-center gap-1 sm:gap-4">
            {bench.map((s, i) => (
              <div key={s.key} className="flex flex-col items-center">
                <SlotView s={s} onClick={onSelect ? () => onSelect(s.key) : undefined} />
                <span className="mt-1 text-[10px] font-bold text-white/50">{s.position === 'GK' ? 'GK' : i}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
