import clsx from 'clsx';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { ORIGIN_LABELS, type RecordOrigin } from '@kiwanja/core';

export const Spinner = ({ className }: { className?: string }) => <Loader2 className={clsx('animate-spin text-pitch', className ?? 'h-5 w-5')} />;

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-ink/50">
      <Spinner /> {label}…
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-clay-50 p-3 text-sm text-clay-600 ring-1 ring-clay/20">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error instanceof Error ? error.message : String(error)}</span>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-ink/30">{icon}</div>}
      <p className="font-display font-semibold">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink/60">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, dark }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; dark?: boolean }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className={clsx('font-display text-2xl font-bold md:text-3xl', dark && 'text-white')}>{title}</h1>
        {subtitle && <p className={clsx('mt-1 text-sm', dark ? 'text-white/70' : 'text-ink/60')}>{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className={clsx('max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{title}</h2>
          <button className="rounded-full p-1.5 hover:bg-ink/5" onClick={onClose} aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, options, dark }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; dark?: boolean }) {
  return (
    <div className={clsx('scrollbar-none flex gap-1 overflow-x-auto rounded-xl p-1', dark ? 'bg-white/10' : 'bg-ink/5')}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx(
            'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition',
            value === o.value ? (dark ? 'bg-white text-ink' : 'bg-white text-ink shadow-sm') : dark ? 'text-white/70 hover:text-white' : 'text-ink/60 hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const ORIGIN_STYLE: Record<string, string> = {
  SAMPLE: 'bg-sky/10 text-sky',
  MANUAL: 'bg-pitch-50 text-pitch-700',
  IMPORTED: 'bg-gold-50 text-gold-600',
  DEVICE: 'bg-ink/10 text-ink',
  VIDEO: 'bg-ink/10 text-ink',
};
/** Labels every record with where it came from (fictional, manual, imported...). */
export function OriginBadge({ origin }: { origin: string }) {
  const short = { SAMPLE: 'Sample', MANUAL: 'Manual', IMPORTED: 'Imported', DEVICE: 'Device', VIDEO: 'Video' }[origin] ?? origin;
  return (
    <span title={ORIGIN_LABELS[origin as RecordOrigin]} className={clsx('chip', ORIGIN_STYLE[origin] ?? 'bg-ink/5')}>
      {short}
    </span>
  );
}

const EVENT_STYLE: Record<string, string> = {
  PENDING: 'bg-gold-50 text-gold-600 ring-1 ring-gold/30',
  VERIFIED: 'bg-pitch-50 text-pitch-700',
  DISPUTED: 'bg-clay-50 text-clay-600 ring-1 ring-clay/30',
  REJECTED: 'bg-ink/5 text-ink/50 line-through',
  VOIDED: 'bg-ink/5 text-ink/50 line-through',
  QUEUED: 'bg-sky/10 text-sky',
};
export function StatusChip({ status }: { status: string }) {
  const label = { PENDING: 'Provisional', VERIFIED: 'Verified', DISPUTED: 'Disputed', REJECTED: 'Rejected', VOIDED: 'Voided', QUEUED: 'Queued offline' }[status] ?? status;
  return <span className={clsx('chip', EVENT_STYLE[status] ?? 'bg-ink/5')}>{label}</span>;
}

export function PosChip({ pos }: { pos: string }) {
  const s = { GK: 'bg-gold-50 text-gold-600', DEF: 'bg-pitch-50 text-pitch-700', MID: 'bg-sky/10 text-sky', FWD: 'bg-clay-50 text-clay-600' }[pos];
  return <span className={clsx('chip w-10 justify-center', s)}>{pos}</span>;
}

export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span>Deadline passed</span>;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return <span className="font-mono tabular-nums">{d > 0 ? `${d}d ` : ''}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>;
}

export function Stat({ label, value, hint, accent }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={clsx('rounded-2xl p-4', accent ? 'bg-ink text-white' : 'bg-white shadow-card ring-1 ring-ink/5')}>
      <div className={clsx('text-xs font-semibold uppercase tracking-wide', accent ? 'text-gold' : 'text-ink/50')}>{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className={clsx('mt-0.5 text-xs', accent ? 'text-white/60' : 'text-ink/50')}>{hint}</div>}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink/50">{hint}</span>}
    </label>
  );
}
