import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { PlayerMarket } from '../../components/PlayerMarket';
import { Empty, ErrorBox, Loading, Modal, PageHeader, PosChip, Stat } from '../../components/ui';
import { useMeta, type Player } from '../../hooks/data';
import { api } from '../../lib/api';
import { dateTime, price } from '../../lib/format';
import { useMyTeam } from './MyTeam';

interface Preview {
  gameweek: number;
  count: number;
  cost: number;
  freeUsed: number;
  freeTransfers: number;
  bankAfter: number;
  unlimited: boolean;
  wildcard: boolean;
  issues: { code: string; message: string }[];
}

export function TransfersPage() {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const { data, isLoading } = useMyTeam();
  const [selling, setSelling] = useState<Player | null>(null);
  const [pending, setPending] = useState<{ out: Player; in: Player }[]>([]);
  const [wildcard, setWildcard] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const history = useQuery({ queryKey: ['fantasy', 'transfers'], queryFn: () => api<{ id: string; createdAt: string; cost: number; isWildcard: boolean; gameweek: { number: number }; playerIn: Player; playerOut: Player; priceIn: number; priceOut: number }[]>('/fantasy/transfers') });

  const body = useMemo(() => ({ transfers: pending.map((p) => ({ outId: p.out.id, inId: p.in.id })), useWildcard: wildcard }), [pending, wildcard]);
  useEffect(() => {
    if (!pending.length) return setPreview(null);
    let cancelled = false;
    api<Preview>('/fantasy/transfers/preview', { body }).then((p) => !cancelled && setPreview(p)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [body, pending.length]);

  const apply = useMutation({
    mutationFn: () => api('/fantasy/transfers', { body }),
    onSuccess: () => {
      setPending([]);
      setConfirm(false);
      setWildcard(false);
      qc.invalidateQueries({ queryKey: ['fantasy'] });
      qc.invalidateQueries({ queryKey: ['players'] });
    },
  });

  if (isLoading || !meta) return <Loading />;
  if (!data?.team) return <Navigate to="/create-team" replace />;
  if (!data.nextGameweek) return <Empty title="No upcoming gameweek">Transfers open again when the next gameweek is scheduled.</Empty>;

  const outIds = new Set(pending.map((p) => p.out.id));
  const inIds = new Set(pending.map((p) => p.in.id));
  const squad = data.squad.map((s) => s.player).filter((p) => !outIds.has(p.id));
  const current = [...squad, ...pending.map((p) => p.in)];
  const bank = data.team.bank + pending.reduce((s, p) => s + p.out.price - p.in.price, 0);
  const info = data.transfersInfo;

  const buyReason = (p: Player, out: Player) => {
    if (current.some((x) => x.id === p.id) || inIds.has(p.id)) return 'In squad';
    const clubCount = current.filter((x) => x.clubId === p.clubId && x.id !== out.id).length;
    if (clubCount >= meta.rules.squad.maxPerClub) return `${meta.rules.squad.maxPerClub} from club`;
    if (p.price > bank + out.price) return 'Too expensive';
    return null;
  };

  return (
    <div>
      <PageHeader title="Transfers" subtitle={`For ${data.nextGameweek.name} · deadline ${dateTime(data.nextGameweek.deadlineAt)}`} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Free transfers" value={info.unlimited ? '∞' : info.freeTransfers} hint={info.unlimited ? 'Unlimited before your first deadline' : `Extra transfers cost ${info.hitCost} pts`} />
        <Stat label="In the bank" value={price(bank)} />
        <Stat label="Cost" value={preview ? (preview.cost ? `-${preview.cost} pts` : 'Free') : '-'} hint={preview && !preview.unlimited && !preview.wildcard ? `${preview.freeUsed} free used` : undefined} accent={!!preview?.cost} />
        <div className="card flex flex-col justify-center gap-1 p-4">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={wildcard || info.wildcardActive} disabled={info.wildcardActive || info.wildcardsLeft <= 0} onChange={(e) => setWildcard(e.target.checked)} className="h-4 w-4 accent-pitch" />
            Wildcard
          </label>
          <span className="text-xs text-ink/50">{info.wildcardActive ? 'Active this gameweek' : `${info.wildcardsLeft} left: unlimited free transfers`}</span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="card p-4">
          <h2 className="mb-2 font-display font-bold">Your squad</h2>
          {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => (
            <div key={pos} className="mb-2">
              {current
                .filter((p) => p.position === pos)
                .map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border-b border-ink/5 py-2">
                    <PosChip pos={p.position} />
                    <ClubCrest club={p.club} size={24} />
                    <span className="flex-1 truncate text-sm font-semibold">
                      {p.firstName} {p.lastName} {inIds.has(p.id) && <span className="chip bg-pitch-50 text-pitch-700">new</span>}
                    </span>
                    <span className="text-sm tabular-nums">{price(p.price)}</span>
                    {inIds.has(p.id) ? (
                      <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPending(pending.filter((x) => x.in.id !== p.id))}>
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </button>
                    ) : (
                      <button className="btn-ghost px-2 py-1 text-xs text-clay" onClick={() => setSelling(p)}>
                        Sell
                      </button>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="mb-2 font-display font-bold">Pending transfers</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-ink/50">Sell a player to start.</p>
            ) : (
              pending.map((t) => (
                <div key={t.out.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="flex-1 truncate text-clay">{t.out.lastName}</span>
                  <ArrowRight className="h-4 w-4 text-ink/40" />
                  <span className="flex-1 truncate text-right font-semibold text-pitch">{t.in.lastName}</span>
                </div>
              ))
            )}
            {preview?.issues.map((i) => (
              <div key={i.message} className="mt-2 rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-600">
                {i.message}
              </div>
            ))}
            <button className="btn-primary mt-3 w-full" disabled={!pending.length || !!preview?.issues.length} onClick={() => setConfirm(true)}>
              Make transfers
            </button>
          </div>
          <div className="card p-4">
            <h2 className="mb-2 font-display font-bold">Transfer history</h2>
            {history.data?.length ? (
              <ul className="space-y-1.5 text-sm">
                {history.data.map((h) => (
                  <li key={h.id} className="flex items-center gap-2">
                    <span className="w-10 text-xs text-ink/50">GW{h.gameweek.number}</span>
                    <span className="flex-1 truncate">
                      <span className="text-clay">{h.playerOut.lastName}</span> → <span className="font-semibold">{h.playerIn.lastName}</span>
                    </span>
                    {h.isWildcard ? <span className="chip bg-gold-50 text-gold-600">WC</span> : h.cost ? <span className="chip bg-clay-50 text-clay-600">-{h.cost}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink/50">No transfers yet.</p>
            )}
          </div>
        </div>
      </div>

      <Modal open={!!selling} onClose={() => setSelling(null)} title={selling ? `Replace ${selling.firstName} ${selling.lastName} (${price(selling.price)})` : ''} wide>
        {selling && (
          <PlayerMarket
            compact
            lockedPosition={selling.position}
            initial={{ maxPrice: undefined }}
            action={(p) => {
              const r = buyReason(p, selling);
              return (
                <button
                  className="btn-primary w-24 px-2 py-1.5 text-xs"
                  disabled={!!r}
                  onClick={() => {
                    setPending([...pending, { out: selling, in: p }]);
                    setSelling(null);
                  }}
                >
                  {r ?? 'Buy'}
                </button>
              );
            }}
          />
        )}
      </Modal>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Confirm transfers">
        <div className="space-y-3 text-sm">
          {pending.map((t) => (
            <div key={t.out.id} className="flex justify-between">
              <span>
                {t.out.firstName} {t.out.lastName} → <b>{t.in.firstName} {t.in.lastName}</b>
              </span>
            </div>
          ))}
          <div className="rounded-xl bg-paper p-3">
            Points cost: <b>{preview?.cost ? `-${preview.cost}` : 'none'}</b> · Bank after: <b>{price(preview?.bankAfter ?? bank)}</b>
            {preview?.wildcard && <div className="mt-1 text-gold-600">Wildcard will be played.</div>}
          </div>
          <ErrorBox error={apply.error} />
          <button className="btn-primary w-full" disabled={apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending ? 'Confirming…' : 'Confirm'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
