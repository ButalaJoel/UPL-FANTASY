import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { STAT_KEYS, STAT_LABELS, type GameRules } from '@kiwanja/core';
import { Lock, Play, Plus, Trash2, Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ErrorBox, Field, Loading, PageHeader, Tabs } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useGameweeks } from '../../hooks/data';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';

type Tab = 'gameweeks' | 'scoring' | 'rules' | 'leagues';

export function OpsFantasyPage() {
  const [tab, setTab] = useState<Tab>('scoring');
  return (
    <div>
      <PageHeader title="Fantasy management" subtitle="Every rule here is configuration, not code. Changes recalculate points from the event log." />
      <div className="mb-4 max-w-xl">
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'scoring', label: 'Scoring rules' },
            { value: 'gameweeks', label: 'Gameweeks' },
            { value: 'rules', label: 'Game rules' },
            { value: 'leagues', label: 'Leagues & cups' },
          ]}
        />
      </div>
      {tab === 'scoring' && <ScoringRules />}
      {tab === 'gameweeks' && <Gameweeks />}
      {tab === 'rules' && <GameRulesEditor />}
      {tab === 'leagues' && <LeaguesAdmin />}
    </div>
  );
}

interface DbRule {
  code: string;
  label: string;
  statKey: string;
  mode: 'PER_UNIT' | 'RANGE';
  unit: number;
  min: number | null;
  max: number | null;
  minMinutes: number;
  pointsGK: number;
  pointsDEF: number;
  pointsMID: number;
  pointsFWD: number;
  enabled: boolean;
  experimental: boolean;
  description: string | null;
}

function RuleRow({ r }: { r: DbRule }) {
  const qc = useQueryClient();
  const [d, setD] = useState(r);
  useEffect(() => setD(r), [r]);
  const dirty = JSON.stringify(d) !== JSON.stringify(r);
  const save = useMutation({
    mutationFn: () =>
      api<{ recomputed: { fixtures: number } }>(`/ops/fantasy/scoring-rules/${r.code}`, {
        method: 'PUT',
        body: { label: d.label, statKey: d.statKey, mode: d.mode, unit: d.unit, min: d.min, max: d.max, minMinutes: d.minMinutes, points: { GK: d.pointsGK, DEF: d.pointsDEF, MID: d.pointsMID, FWD: d.pointsFWD }, enabled: d.enabled, description: d.description },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'rules'] });
      qc.invalidateQueries({ queryKey: ['meta'] });
    },
  });
  const num = (k: keyof DbRule) => (
    <input type="number" className="input w-16 px-2 py-1 text-center" value={(d[k] as number | null) ?? ''} onChange={(e) => setD({ ...d, [k]: e.target.value === '' ? null : Number(e.target.value) })} aria-label={String(k)} />
  );
  return (
    <tr className={d.enabled ? '' : 'opacity-60'}>
      <td>
        <input type="checkbox" className="h-4 w-4 accent-pitch" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} aria-label="Enabled" />
      </td>
      <td>
        <input className="input w-44 px-2 py-1" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} />
        {r.experimental && <span className="chip ml-1 bg-sky/10 text-sky">experimental</span>}
      </td>
      <td>
        <select className="input w-40 px-2 py-1" value={d.statKey} onChange={(e) => setD({ ...d, statKey: e.target.value })}>
          {STAT_KEYS.map((k) => (
            <option key={k} value={k}>
              {STAT_LABELS[k]}
            </option>
          ))}
        </select>
      </td>
      <td>
        <select className="input w-28 px-2 py-1" value={d.mode} onChange={(e) => setD({ ...d, mode: e.target.value as DbRule['mode'] })}>
          <option value="PER_UNIT">Per unit</option>
          <option value="RANGE">Range</option>
        </select>
      </td>
      <td>{d.mode === 'PER_UNIT' ? num('unit') : <span className="flex gap-1">{num('min')}{num('max')}</span>}</td>
      <td>{num('minMinutes')}</td>
      <td>{num('pointsGK')}</td>
      <td>{num('pointsDEF')}</td>
      <td>{num('pointsMID')}</td>
      <td>{num('pointsFWD')}</td>
      <td>
        <button className="btn-primary px-3 py-1 text-xs" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Recalculating…' : 'Save'}
        </button>
        {save.error && <div className="text-xs text-clay">{(save.error as Error).message}</div>}
      </td>
    </tr>
  );
}

function ScoringRules() {
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'rules'], queryFn: () => api<DbRule[]>('/ops/fantasy/scoring-rules') });
  if (isLoading) return <Loading />;
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>On</th>
            <th>Rule</th>
            <th>Statistic</th>
            <th>Mode</th>
            <th>Every / range</th>
            <th>Min. minutes</th>
            <th>GK</th>
            <th>DEF</th>
            <th>MID</th>
            <th>FWD</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data?.map((r) => (
            <RuleRow key={r.code} r={r} />
          ))}
        </tbody>
      </table>
      <p className="p-3 text-xs text-ink/50">“Per unit” awards points for every N of the statistic (e.g. every 3 saves). “Range” awards points once when the statistic is within min..max (e.g. 60+ minutes). Saving a rule recalculates every player's and every team's points from the stored match events.</p>
    </div>
  );
}

function Gameweeks() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const gws = useGameweeks();
  const act = useMutation({ mutationFn: ({ id, action }: { id: string; action: string }) => api(`/ops/football/gameweeks/${id}/${action}`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries() });
  const [deadline, setDeadline] = useState<{ id: string; value: string } | null>(null);
  const saveDeadline = useMutation({ mutationFn: () => api(`/ops/football/gameweeks/${deadline!.id}`, { method: 'PUT', body: { deadlineAt: new Date(deadline!.value).toISOString() } }), onSuccess: () => { setDeadline(null); qc.invalidateQueries({ queryKey: ['gameweeks'] }); } });
  const addGw = useMutation({
    mutationFn: () => {
      const last = gws.data?.[gws.data.length - 1];
      return api('/ops/football/gameweeks', { body: { number: (last?.number ?? 0) + 1, deadlineAt: new Date(new Date(last?.deadlineAt ?? Date.now()).getTime() + 7 * 86400000).toISOString() } });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gameweeks'] }),
  });
  if (gws.isLoading) return <Loading />;
  return (
    <div className="space-y-3">
      <ErrorBox error={act.error ?? saveDeadline.error} />
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Gameweek</th>
              <th>Deadline</th>
              <th>Status</th>
              <th className="text-right">Fixtures</th>
              <th className="text-right">Avg / high</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gws.data?.map((g) => (
              <tr key={g.id}>
                <td className="font-semibold">
                  {g.name} {g.isCurrent && <span className="chip bg-gold text-ink">current</span>}
                </td>
                <td>
                  {deadline?.id === g.id ? (
                    <span className="flex gap-1">
                      <input type="datetime-local" className="input px-2 py-1" value={deadline.value} onChange={(e) => setDeadline({ id: g.id, value: e.target.value })} />
                      <button className="btn-primary px-2 py-1 text-xs" onClick={() => saveDeadline.mutate()}>
                        Save
                      </button>
                    </span>
                  ) : (
                    <button className="text-left hover:text-pitch" disabled={g.status !== 'UPCOMING'} onClick={() => setDeadline({ id: g.id, value: new Date(new Date(g.deadlineAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) })}>
                      {dateTime(g.deadlineAt)}
                    </button>
                  )}
                </td>
                <td>
                  <span className="chip bg-ink/5">{g.status.toLowerCase()}</span>
                </td>
                <td className="text-right">{g._count?.fixtures}</td>
                <td className="text-right">
                  {g.averagePoints} / {g.highestPoints}
                </td>
                <td className="text-right">
                  {g.status === 'UPCOMING' && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => confirm(`Start ${g.name}? Every team's line-up will be locked.`) && act.mutate({ id: g.id, action: 'start' })}>
                      <Play className="h-3.5 w-3.5" /> Start (deadline)
                    </button>
                  )}
                  {(g.status === 'LIVE' || g.status === 'FINISHED') && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act.mutate({ id: g.id, action: 'lock' })}>
                      <Lock className="h-3.5 w-3.5" /> Lock results
                    </button>
                  )}
                  {g.status === 'LOCKED' && can('users.manage') && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => act.mutate({ id: g.id, action: 'unlock' })}>
                      <Unlock className="h-3.5 w-3.5" /> Unlock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button className="btn-ghost" onClick={() => addGw.mutate()}>
        <Plus className="h-4 w-4" /> Add gameweek
      </button>
      <p className="text-xs text-ink/50">A gameweek also starts automatically when one of its matches kicks off. Locking requires every match to be published; it makes confirmed points final and advances cups.</p>
    </div>
  );
}

function GameRulesEditor() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['ops', 'gamerules'], queryFn: () => api<GameRules>('/ops/fantasy/game-rules') });
  const [r, setR] = useState<GameRules | null>(null);
  useEffect(() => {
    if (data) setR(data);
  }, [data]);
  const save = useMutation({ mutationFn: () => api('/ops/fantasy/game-rules', { method: 'PUT', body: r }), onSuccess: () => qc.invalidateQueries() });
  if (!r) return <Loading />;
  const n = (v: number, set: (x: number) => void, label: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input type="number" className="input" value={v} onChange={(e) => set(Number(e.target.value))} />
    </Field>
  );
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card space-y-3 p-4">
        <h3 className="font-display font-bold">Squad</h3>
        <div className="grid grid-cols-2 gap-3">
          {n(r.squad.size, (x) => setR({ ...r, squad: { ...r.squad, size: x } }), 'Squad size')}
          {n(r.squad.budget, (x) => setR({ ...r, squad: { ...r.squad, budget: x } }), 'Budget (tenths)', `${(r.squad.budget / 10).toFixed(1)}${r.currency.suffix}`)}
          {n(r.squad.maxPerClub, (x) => setR({ ...r, squad: { ...r.squad, maxPerClub: x } }), 'Max players per club')}
          {(['GK', 'DEF', 'MID', 'FWD'] as const).map((p) => n(r.squad.composition[p], (x) => setR({ ...r, squad: { ...r.squad, composition: { ...r.squad.composition, [p]: x } } }), `${p} in squad`))}
        </div>
        <Field label="Allowed formations (comma separated)">
          <input className="input" value={r.formations.join(', ')} onChange={(e) => setR({ ...r, formations: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Currency symbol">
            <input className="input" value={r.currency.symbol} onChange={(e) => setR({ ...r, currency: { ...r.currency, symbol: e.target.value } })} />
          </Field>
          <Field label="Suffix">
            <input className="input" value={r.currency.suffix} onChange={(e) => setR({ ...r, currency: { ...r.currency, suffix: e.target.value } })} />
          </Field>
          <Field label="Name">
            <input className="input" value={r.currency.name} onChange={(e) => setR({ ...r, currency: { ...r.currency, name: e.target.value } })} />
          </Field>
        </div>
      </section>
      <section className="card space-y-3 p-4">
        <h3 className="font-display font-bold">Transfers, captaincy & prices</h3>
        <div className="grid grid-cols-2 gap-3">
          {n(r.transfers.freePerGameweek, (x) => setR({ ...r, transfers: { ...r.transfers, freePerGameweek: x } }), 'Free transfers per GW')}
          {n(r.transfers.maxBanked, (x) => setR({ ...r, transfers: { ...r.transfers, maxBanked: x } }), 'Max banked')}
          {n(r.transfers.hitCost, (x) => setR({ ...r, transfers: { ...r.transfers, hitCost: x } }), 'Points per extra transfer')}
          {n(r.transfers.wildcardsPerSeason, (x) => setR({ ...r, transfers: { ...r.transfers, wildcardsPerSeason: x } }), 'Wildcards per season')}
          {n(r.captain.multiplier, (x) => setR({ ...r, captain: { ...r.captain, multiplier: x } }), 'Captain multiplier')}
          {n(r.pricing.thresholdPct, (x) => setR({ ...r, pricing: { ...r.pricing, thresholdPct: x } }), 'Price change threshold (%)', 'Net transfers as % of all teams per 0.1 change')}
          {n(r.matchLength, (x) => setR({ ...r, matchLength: x }), 'Match length (minutes)')}
        </div>
        {(
          [
            ['Vice-captain takes over', r.captain.viceTakesOver, (v: boolean) => setR({ ...r, captain: { ...r.captain, viceTakesOver: v } })],
            ['Automatic substitutions', r.autoSubs, (v: boolean) => setR({ ...r, autoSubs: v })],
            ['Unlimited transfers before first deadline', r.transfers.unlimitedBeforeFirstDeadline, (v: boolean) => setR({ ...r, transfers: { ...r.transfers, unlimitedBeforeFirstDeadline: v } })],
            ['Automatic price changes', r.pricing.enabled, (v: boolean) => setR({ ...r, pricing: { ...r.pricing, enabled: v } })],
          ] as [string, boolean, (v: boolean) => void][]
        ).map(([label, v, set]) => (
          <label key={label} className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-pitch" checked={v} onChange={(e) => set(e.target.checked)} /> {label}
          </label>
        ))}
        <ErrorBox error={save.error} />
        {save.isSuccess && <p className="text-sm text-pitch">Saved.</p>}
        <button className="btn-primary w-full" onClick={() => save.mutate()}>
          Save game rules
        </button>
      </section>
    </div>
  );
}

function LeaguesAdmin() {
  const qc = useQueryClient();
  const gws = useGameweeks();
  const leagues = useQuery({ queryKey: ['ops', 'leagues'], queryFn: () => api<{ id: string; name: string; type: string; visibility: string; code: string; isSystem: boolean; _count: { members: number }; owner: { displayName: string } | null }[]>('/ops/fantasy/leagues') });
  const [lf, setLf] = useState({ name: '', type: 'CLASSIC', visibility: 'PUBLIC' });
  const upcoming = gws.data?.filter((g) => g.status === 'UPCOMING') ?? [];
  const [cf, setCf] = useState({ name: '', leagueId: '', startGameweek: 0, maxEntrants: 16, method: 'SEEDED' });
  const createLeague = useMutation({ mutationFn: () => api('/ops/fantasy/leagues', { body: lf }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'leagues'] }) });
  const delLeague = useMutation({ mutationFn: (id: string) => api(`/ops/fantasy/leagues/${id}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'leagues'] }) });
  const createCup = useMutation({ mutationFn: () => api<{ id: string }>('/ops/fantasy/cups', { body: { ...cf, leagueId: cf.leagueId || null, startGameweek: cf.startGameweek || upcoming[0]?.number } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }) });
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="card overflow-x-auto p-4">
        <h3 className="mb-2 font-display font-bold">Leagues</h3>
        <table className="table">
          <tbody>
            {leagues.data?.map((l) => (
              <tr key={l.id}>
                <td className="font-semibold">
                  <Link to={`/leagues/${l.id}`} className="hover:text-pitch">
                    {l.name}
                  </Link>
                </td>
                <td className="text-xs">{l.type} · {l.visibility.toLowerCase()}</td>
                <td className="font-mono text-xs">{l.code}</td>
                <td className="text-right">{l._count.members}</td>
                <td>
                  {!l.isSystem && (
                    <button onClick={() => confirm(`Delete ${l.name}?`) && delLeague.mutate(l.id)} aria-label="Delete">
                      <Trash2 className="h-4 w-4 text-clay" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <div className="space-y-6">
        <section className="card space-y-3 p-4">
          <h3 className="font-display font-bold">New public league</h3>
          <input className="input" placeholder="League name" value={lf.name} onChange={(e) => setLf({ ...lf, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select className="input" value={lf.type} onChange={(e) => setLf({ ...lf, type: e.target.value })}>
              <option value="CLASSIC">Classic</option>
              <option value="H2H">Head-to-head</option>
            </select>
            <select className="input" value={lf.visibility} onChange={(e) => setLf({ ...lf, visibility: e.target.value })}>
              <option value="PUBLIC">Public</option>
              <option value="PRIVATE">Private</option>
            </select>
          </div>
          <ErrorBox error={createLeague.error} />
          <button className="btn-primary w-full" disabled={lf.name.length < 3} onClick={() => createLeague.mutate()}>
            Create league
          </button>
        </section>
        <section className="card space-y-3 p-4">
          <h3 className="font-display font-bold">New knockout cup</h3>
          <input className="input" placeholder="Cup name" value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} />
          <select className="input" value={cf.leagueId} onChange={(e) => setCf({ ...cf, leagueId: e.target.value })}>
            <option value="">Qualify from: overall</option>
            {leagues.data?.filter((l) => !l.isSystem).map((l) => (
              <option key={l.id} value={l.id}>
                Qualify from: {l.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select className="input" value={cf.startGameweek || upcoming[0]?.number} onChange={(e) => setCf({ ...cf, startGameweek: Number(e.target.value) })} aria-label="Start gameweek">
              {upcoming.map((g) => (
                <option key={g.id} value={g.number}>
                  From GW{g.number}
                </option>
              ))}
            </select>
            <select className="input" value={cf.maxEntrants} onChange={(e) => setCf({ ...cf, maxEntrants: Number(e.target.value) })} aria-label="Entrants">
              {[4, 8, 16, 32, 64].map((x) => (
                <option key={x} value={x}>
                  {x} teams
                </option>
              ))}
            </select>
            <select className="input" value={cf.method} onChange={(e) => setCf({ ...cf, method: e.target.value })} aria-label="Draw">
              <option value="SEEDED">Seeded</option>
              <option value="RANDOM">Random</option>
            </select>
          </div>
          <ErrorBox error={createCup.error} />
          {createCup.data && (
            <Link to={`/cups/${createCup.data.id}`} className="text-sm font-semibold text-pitch">
              Cup drawn: view bracket
            </Link>
          )}
          <button className="btn-primary w-full" disabled={cf.name.length < 3} onClick={() => createCup.mutate()}>
            Draw cup
          </button>
        </section>
      </div>
    </div>
  );
}
