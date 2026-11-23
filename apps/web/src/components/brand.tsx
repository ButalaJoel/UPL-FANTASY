import clsx from 'clsx';

/** Kiwanja mark: centre circle + a "K" that doubles as a passing lane. Original placeholder identity. */
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#0B1A14" />
      <circle cx="32" cy="32" r="17" fill="none" stroke="#0E7C66" strokeWidth="5" />
      <path d="M24 18v28M24 33l15-15M28 29l12 17" stroke="#F2B705" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Logo({ sub, light }: { sub?: string; light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-none">
        <span className={clsx('block font-display text-lg font-extrabold tracking-tight', light ? 'text-white' : 'text-ink')}>kiwanja</span>
        {sub && <span className={clsx('block text-[10px] font-semibold uppercase tracking-[0.18em]', light ? 'text-gold' : 'text-pitch')}>{sub}</span>}
      </span>
    </span>
  );
}

/** Generated crest from club colours and short name: no real club logos are used. */
export function ClubCrest({ club, size = 28 }: { club?: { shortName: string; primaryColor: string; secondaryColor: string } | null; size?: number }) {
  if (!club) return <span style={{ width: size, height: size }} className="inline-block rounded-full bg-ink/10" />;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label={club.shortName} className="shrink-0">
      <path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill={club.primaryColor} stroke="rgba(0,0,0,.15)" />
      <path d="M20 2 L36 8 V14 H4 V8 Z" fill={club.secondaryColor} opacity=".9" />
      <text x="20" y="28" textAnchor="middle" fontSize="10" fontWeight="800" fontFamily="Sora, sans-serif" fill={club.secondaryColor}>
        {club.shortName}
      </text>
    </svg>
  );
}

/** Shirt shape in club colours for pitch views. */
export function Shirt({ primary, secondary, gk, size = 44 }: { primary: string; secondary: string; gk?: boolean; size?: number }) {
  const body = gk ? '#F2B705' : primary;
  const trim = gk ? '#0B1A14' : secondary;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="drop-shadow">
      <path d="M16 4 L8 8 L2 18 L9 22 L12 18 V44 H36 V18 L39 22 L46 18 L40 8 L32 4 C30 8 18 8 16 4 Z" fill={body} stroke="rgba(0,0,0,.25)" strokeWidth="1" />
      <path d="M16 4 C18 8 30 8 32 4" stroke={trim} strokeWidth="3" fill="none" />
      <rect x="22" y="12" width="4" height="32" fill={trim} opacity=".55" />
    </svg>
  );
}

export function Avatar({ name, color, url, size = 36 }: { name: string; color?: string; url?: string | null; size?: number }) {
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  if (url) return <img src={url} alt="" style={{ width: size, height: size }} className="rounded-full object-cover" />;
  return (
    <span style={{ width: size, height: size, background: color ?? '#0E7C66', fontSize: size * 0.38 }} className="inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-white">
      {initials}
    </span>
  );
}
