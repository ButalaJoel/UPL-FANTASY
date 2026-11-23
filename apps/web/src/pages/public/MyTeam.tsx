import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formationOf, parseFormation, validateLineup, type LineupPick, type Position } from '@kiwanja/core';
import clsx from 'clsx';
import { ArrowLeftRight, Info, Repeat } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { Avatar } from '../../components/brand';
import { Pitch, type PitchSlot } from '../../components/Pitch';
import { Countdown, Empty, ErrorBox, Loading, Modal, PageHeader, Stat, Tabs } from '../../components/ui';
import { useMeta, useGameweeks, type Player } from '../../hooks/data';
import { api } from '../../lib/api';
import { dateTime, price } from '../../lib/format';

interface SquadEntry {
  id: string;
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  purchasePrice: number;
  nextOpponent: string | null;
  player: Player;
}
interface PointsLine { code: string; label: string; value: number; points: number }
interface LivePick {
  playerId: string;
  slot: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
  position: Position;
  player: Player;
  provisionalPoints: number;
  confirmedPoints: number;
  minutes: number;
  multiplier: number;
  counted: boolean;
  subbedIn: boolean;
  subbedOut: boolean;
  teamPoints: number;
  breakdown: { fixtureId: string; provisional: PointsLine[]; confirmed: PointsLine[]; fixtureStatus: string }[];
}
export interface TeamGameweekView {
  score: { provisional: number; confirmed: number; transferCost: number; transfersMade: number; net: number } | null;
  autoSubs: { outId: string; inId: string }[];
  multiplierTo: string | null;
  picks: LivePick[];
}
interface MyTeamResponse {
  team: { id: string; name: string; bank: number; totalPoints: number; confirmedTotal: number; freeTransfers: number } | null;
  rank: number;
  squad: SquadEntry[];
  squadValue: number;
  currentGameweek: { id: string; number: number; name: string; status: string } | null;
  nextGameweek: { id: string; number: number; name: string; deadlineAt: string } | null;
  live: TeamGameweekView | null;
  transfersInfo: { freeTransfers: number; unlimited: boolean; hitCost: number; wildcardsLeft: number; wildcardActive: boolean };
}

export const useMyTeam = () => useQuery({ queryKey: ['fantasy', 'me'], queryFn: () => api<MyTeamResponse>('/fantasy/me') });

export function MyTeamPage() {
  const { data, isLoading, error } = useMyTeam();
  const [params] = useSearchParams();
  const hasLive = !!data?.live;
  const [tab, setTab] = useState<'points' | 'pick'>(params.get('tab') === 'pick' ? 'pick' : 'points');
  useEffect(() => {
    if (data && !data.live && !params.get('tab')) setTab('pick');
  }, [data, params]);
  if (isLoading) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  if (!data?.team) return <Navigate to="/create-team" replace />;
  const t = data.team;
  return (
    <div>
      <PageHeader
        title={t.name}
        subtitle={`Overall rank #${data.rank} · Squad value ${price(data.squadValue)} · Bank ${price(t.bank)}`}
        actions={
          <Link to="/transfers" className="btn-dark">
            <Repeat className="h-4 w-4" /> Transfers
          </Link>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat accent label={data.currentGameweek?.name ?? 'Gameweek'} value={data.live?.score?.net ?? '-'} hint={data.live?.score ? `${data.live.score.confirmed - data.live.score.transferCost} confirmed${data.live.score.transferCost ? ` · -${data.live.score.transferCost} hits` : ''}` : 'Starts at the deadline'} />
        <Stat label="Total points" value={t.totalPoints} hint={`${t.confirmedTotal} confirmed`} />
        <Stat label="Free transfers" value={data.transfersInfo.unlimited ? '∞' : t.freeTransfers} hint={data.transfersInfo.unlimited ? 'Unlimited until your first deadline' : `then -${data.transfersInfo.hitCost} pts each`} />
        <Stat label={data.nextGameweek ? `${data.nextGameweek.name} deadline` : 'Deadline'} value={data.nextGameweek ? <Countdown to={data.nextGameweek.deadlineAt} /> : '-'} hint={data.nextGameweek ? dateTime(data.nextGameweek.deadlineAt) : 'Season complete'} />
      </div>
      <div className="mb-4 max-w-sm">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            ...(hasLive ? [{ value: 'points' as const, label: `Points · ${data.currentGameweek?.name}` }] : []),
            { value: 'pick' as const, label: data.nextGameweek ? `Pick team · ${data.nextGameweek.name}` : 'Pick team' },
          ]}
        />
      </div>
      {tab === 'points' && data.live ? <PointsView view={data.live} /> : <PickTeam data={data} />}
    </div>
  );
}

/** Gameweek points on the pitch, with per-player explanations. */
export function PointsView({ view }: { view: TeamGameweekView }) {
  const [sel, setSel] = useState<LivePick | null>(null);
  const toSlot = (p: LivePick): PitchSlot => ({
    key: p.playerId,
    position: p.position,
    name: p.player.lastName,
    club: p.player.club,
    caption: (
      <span className="tabular-nums">
        {p.counted ? p.teamPoints : p.provisionalPoints}
        {p.confirmedPoints !== p.provisionalPoints && <span className="ml-1 text-gold">({p.confirmedPoints * (p.multiplier || 1)}✓)</span>}
      </span>
    ),
    badge: p.isCaptain ? 'C' : p.isViceCaptain ? 'V' : null,
    muted: !p.counted,
    tag: p.subbedIn ? <span className="chip bg-pitch text-white">IN</span> : p.subbedOut ? <span className="chip bg-clay text-white">OUT</span> : undefined,
  });
  const starters = view.picks.filter((p) => p.slot <= 11);
  const bench = view.picks.filter((p) => p.slot > 11);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Pitch starters={starters.map(toSlot)} bench={bench.map(toSlot)} onSelect={(k) => setSel(view.picks.find((p) => p.playerId === k) ?? null)} />
      <div className="card p-4">
        <h3 className="font-display font-bold">How the points add up</h3>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-ink/60">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Provisional points appear as soon as our analyst logs an event. Numbers marked ✓ are confirmed by a second analyst.
        </p>
        {view.autoSubs.length > 0 && <div className="mt-3 rounded-lg bg-pitch-50 p-2 text-xs text-pitch-700">{view.autoSubs.length} automatic substitution(s) applied.</div>}
        {view.multiplierTo && view.picks.find((p) => p.isCaptain)?.playerId !== view.multiplierTo && <div className="mt-2 rounded-lg bg-gold-50 p-2 text-xs text-gold-600">Your captain did not play: the vice-captain gets the armband.</div>}
        <table className="table mt-3">
          <tbody>
            {view.picks
              .filter((p) => p.counted)
              .sort((a, b) => b.teamPoints - a.teamPoints)
              .map((p) => (
                <tr key={p.playerId} className="cursor-pointer hover:bg-ink/5" onClick={() => setSel(p)}>
                  <td className="px-1">
                    {p.player.firstName[0]}. {p.player.lastName} {p.multiplier > 1 && <span className="chip bg-gold text-ink">x{p.multiplier}</span>}
                  </td>
                  <td className="px-1 text-right font-bold tabular-nums">{p.teamPoints}</td>
                </tr>
              ))}
          </tbody>
        </table>
        {!!view.score?.transferCost && <div className="mt-2 flex justify-between border-t border-ink/10 pt-2 text-sm text-clay"><span>Transfer hits</span><span>-{view.score.transferCost}</span></div>}
      </div>
      <Modal open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.player.firstName} ${sel.player.lastName}` : ''}>
        {sel && <PointsBreakdown pick={sel} />}
      </Modal>
    </div>
  );
}

function PointsBreakdown({ pick }: { pick: LivePick }) {
  return (
    <div className="space-y-4">
      {pick.breakdown.length === 0 && <Empty title="No match yet">Points appear when this player's match kicks off.</Empty>}
      {pick.breakdown.map((b) => (
        <div key={b.fixtureId} className="rounded-xl bg-paper p-3">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-ink/60">
            <span>Match status: {b.fixtureStatus.replace('_', ' ').toLowerCase()}</span>
            <Link to={`/match/${b.fixtureId}`} className="text-pitch">
              Match centre
            </Link>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th className="px-1">Rule</th>
                <th className="px-1 text-right">Stat</th>
                <th className="px-1 text-right">Provisional</th>
                <th className="px-1 text-right">Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {[...new Set([...b.provisional, ...b.confirmed].map((l) => l.code))].map((code) => {
                const p = b.provisional.find((l) => l.code === code);
                const c = b.confirmed.find((l) => l.code === code);
                return (
                  <tr key={code}>
                    <td className="px-1">{(p ?? c)!.label}</td>
                    <td className="px-1 text-right tabular-nums">{(p ?? c)!.value}</td>
                    <td className="px-1 text-right font-semibold tabular-nums">{p?.points ?? 0}</td>
                    <td className="px-1 text-right tabular-nums text-pitch">{c?.points ?? 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div className="flex justify-between rounded-xl bg-ink p-3 text-white">
        <span>
          Total {pick.multiplier > 1 ? `(captain x${pick.multiplier})` : ''}
          {!pick.counted && ' · on the bench'}
        </span>
        <span className="font-display font-bold">{pick.counted ? pick.teamPoints : pick.provisionalPoints}</span>
      </div>
      <Link to={`/players/${pick.playerId}`} className="btn-ghost w-full">
        Player profile
      </Link>
    </div>
  );
}

interface Draft extends LineupPick {
  player: Player;
  nextOpponent: string | null;
}

function PickTeam({ data }: { data: MyTeamResponse }) {
  const qc = useQueryClient();
  const { data: meta } = useMeta();
  const rules = meta!.rules;
  const initial = useMemo<Draft[]>(() => data.squad.map((s) => ({ playerId: s.playerId, position: s.player.position, slot: s.slot, isCaptain: s.isCaptain, isViceCaptain: s.isViceCaptain, player: s.player, nextOpponent: s.nextOpponent })), [data.squad]);
  const [draft, setDraft] = useState<Draft[]>(initial);
  const [sel, setSel] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  useEffect(() => setDraft(initial), [initial]);
  const n = rules.squad.startersCount;
  const issues = validateLineup(draft, rules);
  const dirty = JSON.stringify(draft.map((d) => [d.playerId, d.slot, d.isCaptain, d.isViceCaptain])) !== JSON.stringify(initial.map((d) => [d.playerId, d.slot, d.isCaptain, d.isViceCaptain]));
  const save = useMutation({
    mutationFn: () => api('/fantasy/lineup', { method: 'PUT', body: { picks: draft.map(({ playerId, slot, isCaptain, isViceCaptain }) => ({ playerId, slot, isCaptain, isViceCaptain })) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fantasy'] }),
  });

  const swap = (a: string, b: string) => {
    const pa = draft.find((d) => d.playerId === a)!;
    const pb = draft.find((d) => d.playerId === b)!;
    const next = draft.map((d) => {
      if (d.playerId === a) return { ...d, slot: pb.slot, isCaptain: pb.slot > n ? false : d.isCaptain, isViceCaptain: pb.slot > n ? false : d.isViceCaptain };
      if (d.playerId === b) return { ...d, slot: pa.slot, isCaptain: pa.slot > n ? false : d.isCaptain, isViceCaptain: pa.slot > n ? false : d.isViceCaptain };
      return d;
    });
    // Keep an armband holder if one moved to the bench.
    const starters = next.filter((d) => d.slot <= n);
    if (!next.some((d) => d.isCaptain)) {
      const c = starters.find((d) => !d.isViceCaptain);
      if (c) c.isCaptain = true;
    }
    if (!next.some((d) => d.isViceCaptain)) {
      const v = starters.find((d) => !d.isCaptain);
      if (v) v.isViceCaptain = true;
    }
    setDraft([...next]);
  };

  const canSwap = (a: string, b: string) => {
    const pa = draft.find((d) => d.playerId === a)!;
    const pb = draft.find((d) => d.playerId === b)!;
    if ((pa.slot <= n) === (pb.slot <= n)) return pa.slot > n && pb.slot > n && pa.position !== 'GK' && pb.position !== 'GK'; // reorder bench
    const test = draft.map((d) => (d.playerId === a ? { ...d, slot: pb.slot } : d.playerId === b ? { ...d, slot: pa.slot } : d));
    return !validateLineup(test.map((d) => ({ ...d, isCaptain: false, isViceCaptain: false })), rules).some((i) => i.code === 'FORMATION' || i.code === 'GK');
  };

  const setFormation = (f: string) => {
    const shape = parseFormation(f);
    const ordered = [...draft].sort((a, b) => (a.slot <= n ? 0 : 1) - (b.slot <= n ? 0 : 1) || b.player.price - a.player.price);
    const starters: Draft[] = [];
    for (const pos of ['GK', 'DEF', 'MID', 'FWD'] as Position[]) starters.push(...ordered.filter((d) => d.position === pos).slice(0, shape[pos]));
    const bench = draft.filter((d) => !starters.includes(d)).sort((a, b) => (a.position === 'GK' ? -1 : b.position === 'GK' ? 1 : a.slot - b.slot));
    const next = [...starters, ...bench].map((d, i) => ({ ...d, slot: i + 1 }));
    if (!next.some((d) => d.isCaptain && d.slot <= n)) next.forEach((d) => (d.isCaptain = d === next.find((x) => x.slot <= n && !x.isViceCaptain)));
    if (!next.some((d) => d.isViceCaptain && d.slot <= n)) next.forEach((d) => (d.isViceCaptain = d === next.find((x) => x.slot <= n && !x.isCaptain)));
    setDraft(next);
  };

  const onSelect = (id: string) => {
    if (swapFrom) {
      if (id !== swapFrom && canSwap(swapFrom, id)) swap(swapFrom, id);
      setSwapFrom(null);
      return;
    }
    setSel(id);
  };

  const toSlot = (d: Draft): PitchSlot => ({
    key: d.playerId,
    position: d.position,
    name: d.player.lastName,
    club: d.player.club,
    caption: d.nextOpponent ?? price(d.player.price),
    badge: d.isCaptain ? 'C' : d.isViceCaptain ? 'V' : null,
    highlighted: swapFrom === d.playerId || (!!swapFrom && swapFrom !== d.playerId && canSwap(swapFrom, d.playerId)),
    muted: !!swapFrom && swapFrom !== d.playerId && !canSwap(swapFrom, d.playerId),
    tag: d.player.status !== 'AVAILABLE' ? <span className="chip bg-clay text-white">!</span> : undefined,
  });
  const sorted = [...draft].sort((a, b) => a.slot - b.slot);
  const selected = draft.find((d) => d.playerId === sel);
  const formation = formationOf(draft.filter((d) => d.slot <= n));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        {swapFrom && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-gold-50 px-3 py-2 text-sm">
            <span>Tap a highlighted player to swap.</span>
            <button className="font-semibold" onClick={() => setSwapFrom(null)}>
              Cancel
            </button>
          </div>
        )}
        <Pitch starters={sorted.filter((d) => d.slot <= n).map(toSlot)} bench={sorted.filter((d) => d.slot > n).map(toSlot)} onSelect={onSelect} benchLabel="Substitutes (in order)" />
      </div>
      <div className="card h-fit space-y-4 p-4">
        <div>
          <label className="label">Formation</label>
          <div className="flex flex-wrap gap-1.5">
            {rules.formations.map((f) => (
              <button key={f} onClick={() => setFormation(f)} className={clsx('rounded-lg px-2.5 py-1 text-sm font-semibold', f === formation ? 'bg-pitch text-white' : 'bg-ink/5 hover:bg-ink/10')}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-ink/60">Tap a player to set captain or vice-captain, or to swap with the bench. Bench order decides automatic substitutions.</p>
        {issues.map((i) => (
          <div key={i.message} className="rounded-lg bg-clay-50 px-3 py-2 text-xs text-clay-600">
            {i.message}
          </div>
        ))}
        <ErrorBox error={save.error} />
        {save.isSuccess && !dirty && <div className="rounded-lg bg-pitch-50 px-3 py-2 text-xs text-pitch-700">Line-up saved for {data.nextGameweek?.name}.</div>}
        <button className="btn-primary w-full" disabled={!dirty || issues.length > 0 || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save line-up'}
        </button>
        {dirty && (
          <button className="btn-ghost w-full" onClick={() => setDraft(initial)}>
            Discard changes
          </button>
        )}
      </div>
      <Modal open={!!selected} onClose={() => setSel(null)} title={selected ? `${selected.player.firstName} ${selected.player.lastName}` : ''}>
        {selected && (
          <div className="grid gap-2">
            <button
              className="btn-ghost justify-start"
              disabled={selected.slot > n || selected.isCaptain}
              onClick={() => {
                // If the new captain was vice-captain, the old captain takes the vice armband.
                const oldCaptain = draft.find((d) => d.isCaptain)?.playerId;
                setDraft(
                  draft.map((d) => ({
                    ...d,
                    isCaptain: d.playerId === selected.playerId,
                    isViceCaptain: selected.isViceCaptain ? d.playerId === oldCaptain : d.isViceCaptain,
                  })),
                );
                setSel(null);
              }}
            >
              <span className="chip bg-gold text-ink">C</span> Make captain
            </button>
            <button
              className="btn-ghost justify-start"
              disabled={selected.slot > n || selected.isViceCaptain}
              onClick={() => {
                setDraft(
                  draft.map((d) => {
                    if (d.playerId === selected.playerId) return { ...d, isViceCaptain: true, isCaptain: false };
                    if (selected.isCaptain && d.isViceCaptain) return { ...d, isViceCaptain: false, isCaptain: true };
                    return { ...d, isViceCaptain: false };
                  }),
                );
                setSel(null);
              }}
            >
              <span className="chip bg-ink/10">V</span> Make vice-captain
            </button>
            <button
              className="btn-ghost justify-start"
              onClick={() => {
                setSwapFrom(selected.playerId);
                setSel(null);
              }}
            >
              <ArrowLeftRight className="h-4 w-4" /> {selected.slot > n ? 'Bring on / reorder bench' : 'Substitute'}
            </button>
            <Link to={`/players/${selected.playerId}`} className="btn-ghost justify-start">
              <Info className="h-4 w-4" /> Player profile
            </Link>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function TeamViewPage() {
  const { id } = useParams();
  const gws = useGameweeks();
  const [gw, setGw] = useState<number | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['fantasy', 'team', id, gw],
    queryFn: () => api<{ team: { name: string; totalPoints: number; user: { displayName: string; avatarColor: string; avatarUrl: string | null } }; rank: number; gameweek: { number: number; name: string } | null; view: TeamGameweekView | null }>(`/fantasy/teams/${id}${gw ? `?gameweek=${gw}` : ''}`),
  });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const played = gws.data?.filter((g) => g.status !== 'UPCOMING') ?? [];
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Avatar name={data.team.user.displayName} color={data.team.user.avatarColor} url={data.team.user.avatarUrl} size={48} />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-bold">{data.team.name}</h1>
          <p className="text-sm text-ink/60">
            {data.team.user.displayName} · {data.team.totalPoints} pts · rank #{data.rank}
          </p>
        </div>
        <select className="input w-auto" value={gw ?? data.gameweek?.number ?? ''} onChange={(e) => setGw(Number(e.target.value))} aria-label="Gameweek">
          {played.map((g) => (
            <option key={g.id} value={g.number}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      {data.view && data.view.picks.length ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:max-w-md">
            <Stat accent label={`${data.gameweek?.name} points`} value={data.view.score?.net ?? 0} />
            <Stat label="Confirmed" value={(data.view.score?.confirmed ?? 0) - (data.view.score?.transferCost ?? 0)} />
          </div>
          <PointsView view={data.view} />
        </>
      ) : (
        <Empty title="No line-up for this gameweek" />
      )}
    </div>
  );
}
