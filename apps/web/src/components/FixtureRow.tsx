import clsx from 'clsx';
import { Link } from 'react-router-dom';
import type { Fixture } from '../hooks/data';
import { STATUS_LABEL, isFinished, isLive, time } from '../lib/format';
import { ClubCrest } from './brand';

export function FixtureRow({ f, to }: { f: Fixture; to?: string }) {
  const live = isLive(f.status);
  const done = isFinished(f.status);
  return (
    <Link to={to ?? `/match/${f.id}`} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl px-2 py-2.5 transition hover:bg-ink/5">
      <span className="flex items-center justify-end gap-2 text-right text-sm font-semibold">
        <span className="truncate">{f.homeClub.name}</span>
        <ClubCrest club={f.homeClub} size={26} />
      </span>
      <span className={clsx('min-w-[76px] rounded-lg px-2 py-1 text-center font-display text-sm font-bold tabular-nums', live ? 'bg-clay text-white' : done ? 'bg-ink text-white' : 'bg-ink/5 text-ink/70')}>
        {live || done ? `${f.homeScore} - ${f.awayScore}` : time(f.kickoffAt)}
        {(live || f.status === 'POSTPONED') && <span className="block text-[9px] font-semibold uppercase tracking-wide">{STATUS_LABEL[f.status]}</span>}
      </span>
      <span className="flex items-center gap-2 text-sm font-semibold">
        <ClubCrest club={f.awayClub} size={26} />
        <span className="truncate">{f.awayClub.name}</span>
      </span>
    </Link>
  );
}
