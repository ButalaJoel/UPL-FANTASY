import { useQuery, useQueryClient } from '@tanstack/react-query';
import { can, type EventInput } from '@kiwanja/core';
import clsx from 'clsx';
import { ArrowLeft, Check, CloudOff, History, Pencil, RefreshCw, ShieldAlert, Timer, Trash2, Wifi, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { EventHistoryModal } from '../../components/EventHistory';
import { ErrorBox, Loading, Modal, StatusChip } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useMeta, type EventTypeMeta } from '../../hooks/data';
import { useMatchRoom } from '../../hooks/live';
import { api, errorMessage } from '../../lib/api';
import { STATUS_LABEL } from '../../lib/format';
import { EVENT_ICON, useMatchClock, type MatchEventRow, type MatchPlayer, type MatchStateResponse, type SquadRow } from '../../lib/match';
import { offlineQueue, type QueuedEvent } from '../../lib/offlineQueue';

type Side = 'HOME' | 'AWAY';
interface Flow {
  type: EventTypeMeta;
  step: 'player' | 'secondary' | 'confirm';
  side?: Side;
  playerId?: string | null;
  secondaryPlayerId?: string | null;
  minute: number;
}

const PRIMARY_CODES = ['GOAL', 'YELLOW_CARD', 'RED_CARD', 'SUBSTITUTION', 'SAVE', 'SHOT_ON_TARGET'];
const SECONDARY_CODES = ['OWN_GOAL', 'PENALTY_AWARDED', 'PENALTY_MISSED', 'PENALTY_SAVED', 'MAN_OF_THE_MATCH'];
const BUTTON_STYLE: Record<string, string> = {
  GOAL: 'bg-pitch text-white',
  YELLOW_CARD: 'bg-gold text-ink',
  RED_CARD: 'bg-clay text-white',
  SUBSTITUTION: 'bg-sky text-white',
};

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)));

/** Players on the pitch right now, derived from the line-ups and substitution / red-card events. */
function onPitch(squad: SquadRow[], events: { code: string; playerId: string | null; secondaryPlayerId: string | null; status: string }[]) {
  const on = new Set(squad.filter((s) => s.isStarter).map((s) => s.playerId));
  const off = new Set<string>();
  for (const e of events) {
    if (['REJECTED', 'VOIDED'].includes(e.status)) continue;
    if (e.code === 'SUBSTITUTION') {
      if (e.playerId) {
        on.delete(e.playerId);
        off.add(e.playerId);
      }
      if (e.secondaryPlayerId && !off.has(e.secondaryPlayerId)) on.add(e.secondaryPlayerId);
    }
    if (e.code === 'RED_CARD' && e.playerId) {
      on.delete(e.playerId);
      off.add(e.playerId);
    }
  }
  return { on, off };
}

export function CollectPage() {
  const { id } = useParams();
  const fixtureId = id!;
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: meta } = useMeta();
  useMatchRoom(fixtureId, 'ops');
  const [cached, setCached] = useState<MatchStateResponse | null>(null);
  const q = useQuery({
    queryKey: ['ops-match', fixtureId],
    queryFn: async () => {
      const s = await api<MatchStateResponse>(`/ops/matches/${fixtureId}`);
      offlineQueue.cacheMatch(fixtureId, s).catch(() => undefined);
      return s;
    },
    refetchInterval: 30_000,
  });
  useEffect(() => {
    offlineQueue.cachedMatch<MatchStateResponse>(fixtureId).then(setCached).catch(() => undefined);
  }, [fixtureId]);
  const state = q.data ?? cached ?? undefined;
  const clock = useMatchClock(state);

  // ----- offline queue & sync -----
  const [queue, setQueue] = useState<QueuedEvent[]>([]);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [syncError, setSyncError] = useState<string | null>(null);
  const refreshQueue = useCallback(async () => setQueue(await offlineQueue.list(fixtureId)), [fixtureId]);
  const sync = useCallback(async () => {
    try {
      const results = await offlineQueue.flush(fixtureId, (fid, events) => api(`/ops/matches/${fid}/events/sync`, { body: { events }, headers: { 'x-device-id': deviceId() } }));
      setSyncError(null);
      if (results.length) {
        await offlineQueue.clearSynced(fixtureId);
        qc.invalidateQueries({ queryKey: ['ops-match', fixtureId] });
      }
    } catch (e) {
      setSyncError(errorMessage(e));
    } finally {
      refreshQueue();
    }
  }, [fixtureId, qc, refreshQueue]);
  useEffect(() => {
    refreshQueue();
    const up = () => {
      setOnline(true);
      sync();
    };
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    const t = setInterval(() => {
      offlineQueue.pending(fixtureId).then((p) => {
        if (p.length) sync();
      });
    }, 5000);
    sync();
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
      clearInterval(t);
    };
  }, [fixtureId, refreshQueue, sync]);

  const record = async (input: Omit<EventInput, 'clientEventId' | 'clientRecordedAt'>) => {
    await offlineQueue.enqueue(fixtureId, { ...input, clientEventId: uuid(), clientRecordedAt: new Date() });
    await refreshQueue();
    sync();
  };

  // ----- event entry flow -----
  const [flow, setFlow] = useState<Flow | null>(null);
  const [more, setMore] = useState(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [editing, setEditing] = useState<MatchEventRow | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tab, setTab] = useState<'log' | 'verify'>('log');

  const types = useMemo(() => new Map((meta?.eventTypes ?? []).filter((t) => t.enabled).map((t) => [t.code, t])), [meta]);
  const queuedOverlay = queue.filter((q) => q.status === 'queued' || q.status === 'syncing');
  const allEvents = useMemo(
    () => [
      ...(state?.events ?? []),
      ...queuedOverlay.map((q) => ({ code: q.payload.code, playerId: q.payload.playerId ?? null, secondaryPlayerId: q.payload.secondaryPlayerId ?? null, status: 'PENDING' })),
    ],
    [state?.events, queuedOverlay],
  );
  if (!state || !meta) return q.error ? <div className="p-6"><ErrorBox error={q.error} /></div> : <Loading label="Opening match" />;

  const f = state.fixture;
  const squad = state.squad;
  const { on, off } = onPitch(squad, allEvents);
  const playersBySide = (side: Side) => squad.filter((s) => s.side === side);
  const findPlayer = (pid: string | null | undefined): MatchPlayer | undefined => squad.find((s) => s.playerId === pid)?.player;
  const sideOf = (pid: string) => squad.find((s) => s.playerId === pid)?.side;
  const live = ['FIRST_HALF', 'HALF_TIME', 'SECOND_HALF', 'FULL_TIME', 'COMPLETED'].includes(f.status);
  const canControl = can(user?.role, 'matches.control');
  const isSupervisor = can(user?.role, 'events.resolve');
  const minuteNow = Math.max(clock.minute, f.status === 'SECOND_HALF' ? 46 : 1);
  const pendingForMe = state.events.filter((e) => e.status === 'PENDING' && e.recordedBy?.id !== user?.id && types.get(e.code)?.requiresVerification);
  const disputed = state.events.filter((e) => e.status === 'DISPUTED');

  const start = (code: string) => {
    const type = types.get(code);
    if (!type) return;
    setMore(false);
    if (!type.needsPlayer && !type.playerLabel) return setFlow({ type, step: 'confirm', minute: minuteNow });
    setFlow({ type, step: 'player', minute: minuteNow });
  };

  const choosePlayer = (pid: string | null, side: Side) => {
    if (!flow) return;
    const t = flow.type;
    const next = { ...flow, side, playerId: pid };
    // Second step for goals (assist), substitutions (player on) and penalty saves (taker).
    if (t.secondaryLabel) return setFlow({ ...next, step: 'secondary' });
    commit(next);
  };

  const commit = async (fl: Flow) => {
    setFlow(null);
    await record({ code: fl.type.code, side: fl.side ?? null, playerId: fl.playerId ?? null, secondaryPlayerId: fl.secondaryPlayerId ?? null, minute: fl.minute });
  };

  const period = async (code: string) => {
    await record({ code, side: null, playerId: null, secondaryPlayerId: null, minute: code === 'MATCH_START' ? 0 : code === 'SECOND_HALF_START' ? 45 : code === 'HALF_TIME' ? 45 : 90 });
  };

  const act = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
      qc.invalidateQueries({ queryKey: ['ops-match', fixtureId] });
    } catch (e) {
      setActionError(errorMessage(e));
    }
  };

  const nextPeriod: Record<string, [string, string] | undefined> = {
    SCHEDULED: ['MATCH_START', 'Kick-off'],
    FIRST_HALF: ['HALF_TIME', 'Half-time'],
    HALF_TIME: ['SECOND_HALF_START', 'Start 2nd half'],
    SECOND_HALF: ['FULL_TIME', 'Full-time'],
  };
  const pendingPeriod = queuedOverlay.some((q) => ['MATCH_START', 'HALF_TIME', 'SECOND_HALF_START', 'FULL_TIME'].includes(q.payload.code));
  const np = nextPeriod[f.status];

  const PlayerButton = ({ s, disabled, onPick }: { s: SquadRow; disabled?: boolean; onPick: () => void }) => (
    <button
      disabled={disabled}
      onClick={onPick}
      className={clsx('flex min-h-[52px] items-center gap-2 rounded-xl px-2 py-2 text-left ring-1 transition active:scale-[.98] disabled:opacity-30', 'bg-white ring-ink/10 hover:ring-pitch')}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-mono text-base font-bold text-white" style={{ background: (s.side === 'HOME' ? f.homeClub : f.awayClub).primaryColor }}>
        {s.shirtNumber ?? '–'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{s.player.lastName}</span>
        <span className="text-[11px] text-ink/50">{s.position}</span>
      </span>
    </button>
  );

  const pickerFor = (step: 'player' | 'secondary') => {
    if (!flow) return null;
    const t = flow.type;
    const sides: Side[] = step === 'secondary' ? [t.secondaryIsOpponent ? (flow.side === 'HOME' ? 'AWAY' : 'HOME') : flow.side!] : ['HOME', 'AWAY'];
    const list = (side: Side) => {
      const ps = playersBySide(side);
      if (step === 'secondary' && t.code === 'SUBSTITUTION') return ps.filter((p) => !on.has(p.playerId) && !off.has(p.playerId));
      if (step === 'secondary') return ps.filter((p) => on.has(p.playerId) && p.playerId !== flow.playerId);
      if (t.code === 'SAVE' || t.code === 'PENALTY_SAVED') return ps.filter((p) => on.has(p.playerId) && p.position === 'GK');
      if (t.code === 'MAN_OF_THE_MATCH') return ps.filter((p) => on.has(p.playerId) || off.has(p.playerId));
      return ps.filter((p) => on.has(p.playerId));
    };
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="h-4 w-4" /> Minute
            <input type="number" className="input w-20 py-1.5 text-center font-mono text-lg" value={flow.minute} min={0} max={130} onChange={(e) => setFlow({ ...flow, minute: Number(e.target.value) })} />
          </label>
          <span className="text-xs text-ink/50">{t.description}</span>
        </div>
        <div className={clsx('grid gap-4', sides.length === 2 && 'md:grid-cols-2')}>
          {sides.map((side) => (
            <div key={side}>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold">
                <ClubCrest club={side === 'HOME' ? f.homeClub : f.awayClub} size={22} /> {(side === 'HOME' ? f.homeClub : f.awayClub).name}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {list(side).map((s) => (
                  <PlayerButton key={s.playerId} s={s} onPick={() => (step === 'player' ? choosePlayer(s.playerId, side) : commit({ ...flow, secondaryPlayerId: s.playerId }))} />
                ))}
                {step === 'player' && !t.needsPlayer && (
                  <button className="btn-ghost min-h-[52px]" onClick={() => choosePlayer(null, side)}>
                    Team only
                  </button>
                )}
              </div>
              {list(side).length === 0 && <p className="text-sm text-ink/50">No eligible players.</p>}
            </div>
          ))}
        </div>
        {step === 'secondary' && !t.secondaryRequired && (
          <button className="btn-dark w-full py-3" onClick={() => commit({ ...flow, secondaryPlayerId: null })}>
            No {t.secondaryLabel?.toLowerCase()} · save {t.label.toLowerCase()}
          </button>
        )}
      </div>
    );
  };

  const eventLabel = (e: { code: string; playerId: string | null; secondaryPlayerId: string | null }) => {
    const p = findPlayer(e.playerId);
    const s = findPlayer(e.secondaryPlayerId);
    const t = types.get(e.code);
    return (
      <>
        <b>{t?.label ?? e.code}</b> {p && <>· #{squad.find((x) => x.playerId === e.playerId)?.shirtNumber} {p.lastName}</>}
        {s && (
          <span className="text-ink/60">
            {' '}
            ({e.code === 'SUBSTITUTION' ? 'on' : e.code === 'GOAL' ? 'assist' : t?.secondaryLabel?.toLowerCase()} {s.lastName})
          </span>
        )}
      </>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#EEF1EE]">
      {/* Match bar */}
      <header className="sticky top-0 z-20 bg-ink text-white">
        <div className="flex items-center gap-3 px-3 py-2">
          <Link to="/ops/live" className="rounded-lg p-2 hover:bg-white/10" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex flex-1 items-center justify-center gap-3">
            <ClubCrest club={f.homeClub} size={30} />
            <span className="hidden font-display font-bold sm:inline">{f.homeClub.shortName}</span>
            <span className="rounded-lg bg-white/10 px-3 py-1 font-display text-2xl font-extrabold tabular-nums">
              {f.homeScore} - {f.awayScore}
            </span>
            <span className="hidden font-display font-bold sm:inline">{f.awayClub.shortName}</span>
            <ClubCrest club={f.awayClub} size={30} />
          </div>
          <div className="text-right">
            <div className="font-mono text-xl font-bold text-gold">{f.status === 'FIRST_HALF' || f.status === 'SECOND_HALF' ? clock.label : '--'}</div>
            <div className="text-[11px] text-white/60">{STATUS_LABEL[f.status]}</div>
          </div>
        </div>
        <div className={clsx('flex items-center justify-between gap-2 px-3 py-1.5 text-xs', online && !syncError ? 'bg-pitch-700' : 'bg-clay')}>
          <span className="flex items-center gap-1.5">
            {online && !syncError ? <Wifi className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            {online && !syncError ? 'Online · synced' : `Offline · events are saved on this device${syncError ? ` (${syncError})` : ''}`}
            {queuedOverlay.length > 0 && <b> · {queuedOverlay.length} waiting to sync</b>}
          </span>
          <button className="flex items-center gap-1 font-semibold" onClick={sync}>
            <RefreshCw className="h-3.5 w-3.5" /> Sync now
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          {/* Period controls */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-card">
            {np && canControl && (
              <button className="btn-dark py-3 text-base" disabled={pendingPeriod || squad.length === 0} onClick={() => period(np[0])}>
                {np[1]}
              </button>
            )}
            {(f.status === 'FIRST_HALF' || f.status === 'SECOND_HALF') && canControl && <ClockAdjust current={clock.minute} onSet={(m) => act(() => api(`/ops/matches/${fixtureId}/clock`, { body: { minute: m } }))} />}
            {f.status === 'FULL_TIME' && canControl && (
              <button className="btn-primary" onClick={() => act(() => api(`/ops/matches/${fixtureId}/complete`, { method: 'POST' }))}>
                <Check className="h-4 w-4" /> Mark complete
              </button>
            )}
            {f.status === 'COMPLETED' && can(user?.role, 'matches.publish') && (
              <button className="btn-gold" onClick={() => act(() => api(`/ops/matches/${fixtureId}/publish`, { method: 'POST' }))}>
                Publish statistics
              </button>
            )}
            {f.status === 'PUBLISHED' && <span className="chip bg-pitch text-white">Published</span>}
            {squad.length === 0 && (
              <span className="text-sm text-clay">
                No line-ups registered. <Link to={`/ops/fixtures/${fixtureId}`} className="font-semibold underline">Register squads</Link>
              </span>
            )}
            <Link to={`/ops/fixtures/${fixtureId}`} className="ml-auto text-sm font-semibold text-pitch">
              Match setup
            </Link>
          </div>
          {actionError && <ErrorBox error={actionError} />}

          {/* Event buttons */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PRIMARY_CODES.filter((c) => types.has(c)).map((c) => (
              <button key={c} disabled={!live || f.status === 'PUBLISHED'} onClick={() => start(c)} className={clsx('flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl text-sm font-bold shadow-card transition active:scale-[.97] disabled:opacity-40', BUTTON_STYLE[c] ?? 'bg-white text-ink')}>
                <span className="text-2xl">{EVENT_ICON[c]}</span>
                {types.get(c)!.label}
              </button>
            ))}
          </div>
          <button className="btn-ghost w-full bg-white" disabled={!live} onClick={() => setMore(true)}>
            More events (penalties, own goal, passes, tackles…)
          </button>

          {/* Who is on the pitch */}
          <div className="grid gap-3 md:grid-cols-2">
            {(['HOME', 'AWAY'] as Side[]).map((side) => (
              <div key={side} className="rounded-2xl bg-white p-3 shadow-card">
                <div className="mb-2 flex items-center gap-2 font-display font-bold">
                  <ClubCrest club={side === 'HOME' ? f.homeClub : f.awayClub} size={22} /> {(side === 'HOME' ? f.homeClub : f.awayClub).name}
                </div>
                <div className="grid grid-cols-2 gap-1 text-sm">
                  {playersBySide(side)
                    .filter((s) => on.has(s.playerId))
                    .sort((a, b) => (a.shirtNumber ?? 99) - (b.shirtNumber ?? 99))
                    .map((s) => (
                      <div key={s.playerId} className="flex items-center gap-1.5">
                        <span className="w-6 text-right font-mono text-xs font-bold text-ink/50">{s.shirtNumber}</span> {s.player.lastName}
                      </div>
                    ))}
                </div>
                <div className="mt-2 text-xs text-ink/50">Bench: {playersBySide(side).filter((s) => !on.has(s.playerId) && !off.has(s.playerId)).map((s) => `${s.shirtNumber ?? ''} ${s.player.lastName}`).join(', ') || 'none'}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Event log & verification */}
        <aside className="flex max-h-[calc(100vh-120px)] flex-col rounded-2xl bg-white shadow-card lg:sticky lg:top-24">
          <div className="flex gap-1 border-b border-ink/5 p-2">
            <button onClick={() => setTab('log')} className={clsx('flex-1 rounded-lg py-2 text-sm font-semibold', tab === 'log' ? 'bg-ink text-white' : 'text-ink/60')}>
              Event log
            </button>
            <button onClick={() => setTab('verify')} className={clsx('flex-1 rounded-lg py-2 text-sm font-semibold', tab === 'verify' ? 'bg-ink text-white' : 'text-ink/60')}>
              Verify {pendingForMe.length + disputed.length > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-xs text-ink">{pendingForMe.length + disputed.length}</span>}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {tab === 'log' && (
              <ol className="space-y-1.5">
                {queue
                  .filter((q) => q.status !== 'synced')
                  .map((q) => (
                    <li key={q.clientEventId} className={clsx('rounded-xl p-2 text-sm ring-1', q.status === 'rejected' || q.status === 'duplicate' ? 'bg-clay-50 ring-clay/30' : 'bg-sky/5 ring-sky/20')}>
                      <div className="flex items-center gap-2">
                        <span className="w-9 font-mono text-xs font-bold">{q.payload.minute}'</span>
                        <span className="flex-1">{eventLabel({ code: q.payload.code, playerId: q.payload.playerId ?? null, secondaryPlayerId: q.payload.secondaryPlayerId ?? null })}</span>
                        <StatusChip status={q.status === 'queued' || q.status === 'syncing' ? 'QUEUED' : q.status.toUpperCase()} />
                      </div>
                      {q.error && <div className="mt-1 text-xs text-clay-600">{q.error.message}</div>}
                      {(q.status === 'rejected' || q.status === 'duplicate') && (
                        <div className="mt-1 flex gap-2">
                          {q.status === 'duplicate' && (
                            <button
                              className="text-xs font-semibold text-pitch"
                              onClick={async () => {
                                await offlineQueue.remove(q.clientEventId);
                                await record({ ...q.payload, force: true });
                              }}
                            >
                              It is a separate event: record anyway
                            </button>
                          )}
                          <button className="text-xs font-semibold text-ink/60" onClick={async () => { await offlineQueue.remove(q.clientEventId); refreshQueue(); }}>
                            Dismiss
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                {[...state.events].reverse().map((e) => (
                  <li key={e.id} className={clsx('rounded-xl p-2 text-sm ring-1 ring-ink/5', ['REJECTED', 'VOIDED'].includes(e.status) && 'opacity-50')}>
                    <div className="flex items-center gap-2">
                      <span className="w-9 font-mono text-xs font-bold">{e.minute}'</span>
                      <span className="text-base">{EVENT_ICON[e.code]}</span>
                      <span className="min-w-0 flex-1">{eventLabel(e)}</span>
                      <StatusChip status={e.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 pl-11 text-[11px] text-ink/50">
                      <span>by {e.recordedBy?.displayName}</span>
                      {!!e._count?.corrections && <span>{e._count.corrections} correction(s)</span>}
                      <span className="ml-auto flex gap-2">
                        {!['REJECTED', 'VOIDED'].includes(e.status) && e.side && (isSupervisor || (e.recordedBy?.id === user?.id && e.status === 'PENDING')) && f.status !== 'PUBLISHED' && (
                          <button onClick={() => setEditing(e)} className="text-pitch" aria-label="Correct">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {isSupervisor && !['REJECTED', 'VOIDED'].includes(e.status) && f.status !== 'PUBLISHED' && (
                          <button
                            onClick={() => {
                              const note = prompt('Reason for voiding this event?');
                              if (note && note.length >= 3) act(() => api(`/ops/matches/events/${e.id}/resolve`, { body: { decision: 'VOID', note } }));
                            }}
                            className="text-clay"
                            aria-label="Void"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button onClick={() => setHistoryId(e.id)} aria-label="History">
                          <History className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </div>
                  </li>
                ))}
                {state.events.length === 0 && queue.length === 0 && <p className="p-6 text-center text-sm text-ink/50">No events yet.</p>}
              </ol>
            )}
            {tab === 'verify' && (
              <div className="space-y-2">
                <p className="px-1 text-xs text-ink/60">Confirm events recorded by the other analyst. Points become confirmed when you verify.</p>
                {pendingForMe.map((e) => (
                  <VerifyCard key={e.id} e={e} label={eventLabel(e)} onConfirm={() => act(() => api(`/ops/matches/events/${e.id}/verify`, { body: { decision: 'CONFIRM' } }))} onDispute={(note) => act(() => api(`/ops/matches/events/${e.id}/verify`, { body: { decision: 'DISPUTE', note } }))} />
                ))}
                {disputed.map((e) => (
                  <div key={e.id} className="rounded-xl bg-clay-50 p-3 text-sm ring-1 ring-clay/30">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4 text-clay" />
                      <span className="font-mono text-xs">{e.minute}'</span>
                      <span className="flex-1">{eventLabel(e)}</span>
                    </div>
                    <div className="mt-1 text-xs text-ink/60">“{e.verifications.find((v) => v.decision === 'DISPUTE')?.note}”</div>
                    {isSupervisor ? (
                      <div className="mt-2 flex gap-2">
                        <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => act(() => api(`/ops/matches/events/${e.id}/resolve`, { body: { decision: 'VERIFY', note: 'Supervisor upheld the event' } }))}>
                          Uphold
                        </button>
                        <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setEditing(e)}>
                          Correct
                        </button>
                        <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => act(() => api(`/ops/matches/events/${e.id}/resolve`, { body: { decision: 'REJECT', note: 'Supervisor rejected the event' } }))}>
                          Reject
                        </button>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-ink/50">Waiting for a supervisor.</div>
                    )}
                  </div>
                ))}
                {pendingForMe.length + disputed.length === 0 && <p className="p-6 text-center text-sm text-ink/50">Nothing to verify.</p>}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal open={!!flow && flow.step !== 'confirm'} onClose={() => setFlow(null)} title={flow ? `${EVENT_ICON[flow.type.code] ?? ''} ${flow.type.label}: ${flow.step === 'player' ? flow.type.playerLabel ?? 'player' : flow.type.secondaryLabel}` : ''} wide>
        {flow && flow.step !== 'confirm' && pickerFor(flow.step)}
      </Modal>
      <Modal open={!!flow && flow.step === 'confirm'} onClose={() => setFlow(null)} title={flow?.type.label ?? ''}>
        {flow && flow.step === 'confirm' && (
          <div className="space-y-3">
            <p className="text-sm text-ink/60">Which team?</p>
            <div className="grid grid-cols-2 gap-2">
              {(['HOME', 'AWAY'] as Side[]).map((side) => (
                <button key={side} className="btn-ghost py-4" onClick={() => commit({ ...flow, side })}>
                  <ClubCrest club={side === 'HOME' ? f.homeClub : f.awayClub} size={24} /> {(side === 'HOME' ? f.homeClub : f.awayClub).shortName}
                </button>
              ))}
            </div>
          </div>
        )}
      </Modal>
      <Modal open={more} onClose={() => setMore(false)} title="More events" wide>
        <div className="space-y-4">
          {[
            { title: 'Key events', codes: SECONDARY_CODES },
            { title: 'Extended statistics', codes: [...types.values()].filter((t) => t.extended).map((t) => t.code) },
          ].map((g) => (
            <div key={g.title}>
              <h3 className="mb-2 text-xs font-bold uppercase text-ink/50">{g.title}</h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {g.codes
                  .filter((c) => types.has(c))
                  .map((c) => (
                    <button key={c} className="flex min-h-[56px] items-center gap-2 rounded-xl bg-paper px-3 text-left text-sm font-semibold ring-1 ring-ink/5 hover:ring-pitch" onClick={() => start(c)}>
                      <span className="text-lg">{EVENT_ICON[c]}</span> {types.get(c)!.label}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
      <CorrectModal event={editing} squad={squad} onClose={() => setEditing(null)} onDone={() => qc.invalidateQueries({ queryKey: ['ops-match', fixtureId] })} />
      <EventHistoryModal eventId={historyId} onClose={() => setHistoryId(null)} />
    </div>
  );
}

function deviceId() {
  try {
    let d = localStorage.getItem('kiwanja.device');
    if (!d) {
      d = `dev-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('kiwanja.device', d);
    }
    return d;
  } catch {
    return 'unknown-device';
  }
}

function ClockAdjust({ current, onSet }: { current: number; onSet: (m: number) => void }) {
  const [open, setOpen] = useState(false);
  const [m, setM] = useState(current);
  return open ? (
    <span className="flex items-center gap-1">
      <input type="number" className="input w-20 py-2 text-center font-mono" value={m} onChange={(e) => setM(Number(e.target.value))} />
      <button className="btn-primary px-3" onClick={() => { onSet(m); setOpen(false); }}>
        Set
      </button>
      <button className="btn-ghost px-2" onClick={() => setOpen(false)} aria-label="Cancel">
        <X className="h-4 w-4" />
      </button>
    </span>
  ) : (
    <button className="btn-ghost" onClick={() => { setM(current); setOpen(true); }}>
      <Timer className="h-4 w-4" /> Adjust clock
    </button>
  );
}

function VerifyCard({ e, label, onConfirm, onDispute }: { e: MatchEventRow; label: React.ReactNode; onConfirm: () => void; onDispute: (note: string) => void }) {
  const [disputing, setDisputing] = useState(false);
  const [note, setNote] = useState('');
  return (
    <div className="rounded-xl bg-gold-50 p-3 text-sm ring-1 ring-gold/30">
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs font-bold">{e.minute}'</span>
        <span className="text-base">{EVENT_ICON[e.code]}</span>
        <span className="flex-1">{label}</span>
      </div>
      <div className="mt-1 text-[11px] text-ink/50">Recorded by {e.recordedBy?.displayName}</div>
      {disputing ? (
        <div className="mt-2 space-y-2">
          <input className="input py-1.5" placeholder="What is wrong? (e.g. scorer was #9)" value={note} onChange={(ev) => setNote(ev.target.value)} />
          <div className="flex gap-2">
            <button className="btn-danger px-3 py-1.5 text-xs" disabled={note.length < 3} onClick={() => onDispute(note)}>
              Send to supervisor
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setDisputing(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button className="btn-primary py-2.5" onClick={onConfirm}>
            <Check className="h-4 w-4" /> Confirm
          </button>
          <button className="btn-ghost py-2.5" onClick={() => setDisputing(true)}>
            Dispute
          </button>
        </div>
      )}
    </div>
  );
}

function CorrectModal({ event, squad, onClose, onDone }: { event: MatchEventRow | null; squad: SquadRow[]; onClose: () => void; onDone: () => void }) {
  const [minute, setMinute] = useState(0);
  const [playerId, setPlayerId] = useState<string>('');
  const [secondary, setSecondary] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (event) {
      setMinute(event.minute);
      setPlayerId(event.playerId ?? '');
      setSecondary(event.secondaryPlayerId ?? '');
      setReason('');
      setError(null);
    }
  }, [event]);
  if (!event) return null;
  const opts = squad.map((s) => (
    <option key={s.playerId} value={s.playerId}>
      {s.side === 'HOME' ? 'H' : 'A'} #{s.shirtNumber} {s.player.firstName} {s.player.lastName}
    </option>
  ));
  return (
    <Modal open onClose={onClose} title="Correct event">
      <div className="space-y-3">
        <label className="block">
          <span className="label">Minute</span>
          <input type="number" className="input" value={minute} onChange={(e) => setMinute(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="label">Player</span>
          <select className="input" value={playerId} onChange={(e) => setPlayerId(e.target.value)}>
            <option value="">-</option>
            {opts}
          </select>
        </label>
        <label className="block">
          <span className="label">Second player (assist / on / taker)</span>
          <select className="input" value={secondary} onChange={(e) => setSecondary(e.target.value)}>
            <option value="">None</option>
            {opts}
          </select>
        </label>
        <label className="block">
          <span className="label">Reason (kept in the audit log)</span>
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Video review: scorer was #10" />
        </label>
        {error && <ErrorBox error={error} />}
        <button
          className="btn-primary w-full"
          disabled={reason.length < 3}
          onClick={async () => {
            try {
              await api(`/ops/matches/events/${event.id}/correct`, {
                body: { expectedVersion: event.version, reason, changes: { minute, playerId: playerId || null, secondaryPlayerId: secondary || null } },
              });
              onDone();
              onClose();
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        >
          Save correction
        </button>
      </div>
    </Modal>
  );
}
