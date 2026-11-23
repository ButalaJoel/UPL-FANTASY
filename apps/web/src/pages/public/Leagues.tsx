import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Copy, Globe, Lock, Plus, Swords, Trophy } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar } from '../../components/brand';
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, Tabs } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { api } from '../../lib/api';
import type { Standings } from './Home';

interface League {
  id: string;
  name: string;
  type: 'CLASSIC' | 'H2H';
  visibility: 'PUBLIC' | 'PRIVATE';
  code: string;
  isSystem: boolean;
  startGameweek: number;
  myRank?: number | null;
  _count: { members: number };
  owner?: { displayName: string } | null;
}

export function LeaguesPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ['leagues', 'mine'], queryFn: () => api<{ leagues: League[]; cups: { id: string; name: string; status: string }[] }>('/leagues/mine'), enabled: !!user });
  const pub = useQuery({ queryKey: ['leagues', 'public'], queryFn: () => api<League[]>('/leagues/public') });
  const cups = useQuery({ queryKey: ['leagues', 'cups'], queryFn: () => api<{ id: string; name: string; status: string; startGameweek: number; league: { name: string } | null }[]>('/leagues/cups/all') });
  const [create, setCreate] = useState(false);
  const [join, setJoin] = useState(false);
  const myIds = new Set(mine.data?.leagues.map((l) => l.id));
  const joinPublic = useMutation({ mutationFn: (id: string) => api(`/leagues/${id}/join`, { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }) });

  return (
    <div>
      <PageHeader
        title="Leagues & cups"
        subtitle="Classic leagues rank by total points. Head-to-head pits you against one rival a week."
        actions={
          user && (
            <>
              <button className="btn-ghost" onClick={() => setJoin(true)}>
                Join with code
              </button>
              <button className="btn-primary" onClick={() => setCreate(true)}>
                <Plus className="h-4 w-4" /> Create league
              </button>
            </>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-2 font-display text-lg font-bold">My leagues</h2>
          {!user ? (
            <p className="text-sm text-ink/60">
              <Link to="/login" className="font-semibold text-pitch">
                Sign in
              </Link>{' '}
              to see your leagues.
            </p>
          ) : mine.isLoading ? (
            <Loading />
          ) : mine.data?.leagues.length ? (
            <ul className="divide-y divide-ink/5">
              {mine.data.leagues.map((l) => (
                <li key={l.id}>
                  <Link to={`/leagues/${l.id}`} className="flex items-center gap-3 py-2.5 hover:text-pitch">
                    {l.type === 'H2H' ? <Swords className="h-4 w-4 text-clay" /> : l.isSystem ? <Globe className="h-4 w-4 text-pitch" /> : l.visibility === 'PRIVATE' ? <Lock className="h-4 w-4 text-ink/40" /> : <Globe className="h-4 w-4 text-ink/40" />}
                    <span className="flex-1 font-semibold">{l.name}</span>
                    <span className="text-xs text-ink/50">{l._count.members} teams</span>
                    {l.myRank && <span className="chip bg-ink text-white">#{l.myRank}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No leagues yet">Create your team first, then create or join a league.</Empty>
          )}
        </section>
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-2 font-display text-lg font-bold">Public leagues</h2>
            <ul className="divide-y divide-ink/5">
              {pub.data?.map((l) => (
                <li key={l.id} className="flex items-center gap-3 py-2.5">
                  <Link to={`/leagues/${l.id}`} className="flex-1 font-semibold hover:text-pitch">
                    {l.name}
                  </Link>
                  <span className="text-xs text-ink/50">{l._count.members} teams</span>
                  {user && !myIds.has(l.id) && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => joinPublic.mutate(l.id)}>
                      Join
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <ErrorBox error={joinPublic.error} />
          </section>
          <section className="card p-4">
            <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-bold">
              <Trophy className="h-5 w-5 text-gold" /> Cups
            </h2>
            {cups.data?.length ? (
              cups.data.map((c) => (
                <Link key={c.id} to={`/cups/${c.id}`} className="flex items-center justify-between py-2 hover:text-pitch">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-ink/50">
                    from GW{c.startGameweek} · {c.status.toLowerCase()}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-ink/50">No cups yet.</p>
            )}
          </section>
        </div>
      </div>
      <CreateLeague open={create} onClose={() => setCreate(false)} />
      <JoinLeague open={join} onClose={() => setJoin(false)} />
    </div>
  );
}

function CreateLeague({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [type, setType] = useState<'CLASSIC' | 'H2H'>('CLASSIC');
  const m = useMutation({ mutationFn: () => api<League>('/leagues', { body: { name, type, visibility: 'PRIVATE' } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }) });
  return (
    <Modal open={open} onClose={() => { m.reset(); onClose(); }} title="Create a private league">
      {m.data ? (
        <div className="space-y-3 text-center">
          <p>Share this code with your friends:</p>
          <div className="font-mono text-3xl font-bold tracking-widest">{m.data.code}</div>
          <button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(m.data!.code)}>
            <Copy className="h-4 w-4" /> Copy code
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <Field label="League name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Scoring">
            <div className="grid grid-cols-2 gap-2">
              {(['CLASSIC', 'H2H'] as const).map((t) => (
                <button key={t} onClick={() => setType(t)} className={clsx('rounded-xl p-3 text-left text-sm ring-1', type === t ? 'bg-pitch-50 ring-pitch' : 'ring-ink/10')}>
                  <b>{t === 'CLASSIC' ? 'Classic' : 'Head-to-head'}</b>
                  <span className="block text-xs text-ink/60">{t === 'CLASSIC' ? 'Ranked by total points' : '3 pts for a weekly win'}</span>
                </button>
              ))}
            </div>
          </Field>
          <ErrorBox error={m.error} />
          <button className="btn-primary w-full" disabled={name.length < 3 || m.isPending} onClick={() => m.mutate()}>
            Create
          </button>
        </div>
      )}
    </Modal>
  );
}

function JoinLeague({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState('');
  const m = useMutation({ mutationFn: () => api<League>('/leagues/join', { body: { code } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['leagues'] }) });
  return (
    <Modal open={open} onClose={() => { m.reset(); onClose(); }} title="Join a league">
      {m.data ? (
        <p>
          You joined <b>{m.data.name}</b>.{' '}
          <Link className="text-pitch" to={`/leagues/${m.data.id}`}>
            Open league
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          <Field label="Invitation code">
            <input className="input font-mono uppercase tracking-widest" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
          </Field>
          <ErrorBox error={m.error} />
          <button className="btn-primary w-full" disabled={code.length < 4 || m.isPending} onClick={() => m.mutate()}>
            Join
          </button>
        </div>
      )}
    </Modal>
  );
}

interface H2HData {
  teams: Record<string, { id: string; name: string; user: { displayName: string; avatarColor: string; avatarUrl: string | null } }>;
  matches: { id: string; gameweekNumber: number; teamAId: string | null; teamBId: string | null; scoreA: number; scoreB: number; finished: boolean; live: boolean }[];
  table: { teamId: string; played: number; won: number; drawn: number; lost: number; pointsFor: number; leaguePoints: number }[];
}

export function LeaguePage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['leagues', id], queryFn: () => api<{ league: League; standings?: Standings; h2h?: H2HData }>(`/leagues/${id}`) });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const l = data.league;
  return (
    <div>
      <PageHeader
        title={l.name}
        subtitle={
          <>
            {l.type === 'H2H' ? 'Head-to-head' : 'Classic'} · {l._count.members} teams{!l.isSystem && <> · code <span className="font-mono font-bold">{l.code}</span></>}
          </>
        }
      />
      {data.standings && <ClassicTable s={data.standings} />}
      {data.h2h && <H2HView h={data.h2h} />}
    </div>
  );
}

function ClassicTable({ s }: { s: Standings }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th className="w-12">Rank</th>
            <th>Team & manager</th>
            <th className="text-right">GW{s.gameweek?.number}</th>
            <th className="text-right">Total</th>
            <th className="hidden text-right sm:table-cell">Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {s.rows.map((r) => (
            <tr key={r.teamId} className="hover:bg-ink/[0.03]">
              <td className="font-display font-bold">{r.rank}</td>
              <td>
                <Link to={`/teams/${r.teamId}`} className="flex items-center gap-2">
                  <Avatar name={r.manager.displayName} color={r.manager.avatarColor} url={r.manager.avatarUrl} size={28} />
                  <span>
                    <span className="block font-semibold">{r.teamName}</span>
                    <span className="block text-xs text-ink/50">{r.manager.displayName}</span>
                  </span>
                </Link>
              </td>
              <td className="text-right tabular-nums">{r.gameweekPoints}</td>
              <td className="text-right font-display font-bold tabular-nums">{r.totalPoints}</td>
              <td className="hidden text-right tabular-nums text-pitch sm:table-cell">{r.confirmedTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {s.total > s.rows.length && <p className="p-3 text-center text-xs text-ink/50">Showing top {s.rows.length} of {s.total}</p>}
    </div>
  );
}

function H2HView({ h }: { h: H2HData }) {
  const gws = [...new Set(h.matches.map((m) => m.gameweekNumber))];
  const firstOpen = h.matches.find((m) => !m.finished)?.gameweekNumber ?? gws[gws.length - 1];
  const [gw, setGw] = useState<number>(firstOpen ?? 1);
  const name = (id: string | null) => (id ? h.teams[id]?.name ?? '?' : 'League average');
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Team</th>
              <th className="text-right">P</th>
              <th className="text-right">W</th>
              <th className="text-right">D</th>
              <th className="text-right">L</th>
              <th className="text-right">Score</th>
              <th className="text-right">Pts</th>
            </tr>
          </thead>
          <tbody>
            {h.table.map((r, i) => (
              <tr key={r.teamId}>
                <td className="font-bold">{i + 1}</td>
                <td>
                  <Link to={`/teams/${r.teamId}`} className="font-semibold hover:text-pitch">
                    {name(r.teamId)}
                  </Link>
                </td>
                <td className="text-right">{r.played}</td>
                <td className="text-right">{r.won}</td>
                <td className="text-right">{r.drawn}</td>
                <td className="text-right">{r.lost}</td>
                <td className="text-right">{r.pointsFor}</td>
                <td className="text-right font-display font-bold">{r.leaguePoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!h.matches.length && <p className="p-4 text-center text-sm text-ink/50">The schedule is drawn when the league's first gameweek starts.</p>}
      </div>
      {gws.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display font-bold">Matches</h3>
            <select className="input w-auto" value={gw} onChange={(e) => setGw(Number(e.target.value))} aria-label="Gameweek">
              {gws.map((g) => (
                <option key={g} value={g}>
                  Gameweek {g}
                </option>
              ))}
            </select>
          </div>
          {h.matches
            .filter((m) => m.gameweekNumber === gw)
            .map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-ink/5 py-2 text-sm">
                <span className="truncate text-right font-semibold">{name(m.teamAId)}</span>
                <span className={clsx('rounded-lg px-2 py-0.5 font-display font-bold tabular-nums', m.live ? 'bg-clay text-white' : m.finished ? 'bg-ink text-white' : 'bg-ink/5')}>
                  {m.finished || m.live ? `${m.scoreA} - ${m.scoreB}` : 'v'}
                </span>
                <span className="truncate font-semibold">{name(m.teamBId)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export function CupPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['leagues', 'cup', id],
    queryFn: () =>
      api<{ cup: { name: string; status: string; method: string; startGameweek: number; winnerTeamId: string | null; league: { name: string } | null }; teams: Record<string, { name: string; user: { displayName: string } }>; fixtures: { id: string; round: number; roundName: string; gameweekNumber: number; teamAId: string | null; teamBId: string | null; seedA: number | null; seedB: number | null; liveA: number | null; liveB: number | null; winnerId: string | null; gameweekStatus: string }[] }>(`/leagues/cups/${id}`),
  });
  const [round, setRound] = useState<string>('1');
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const rounds = [...new Set(data.fixtures.map((f) => f.round))];
  const name = (t: string | null) => (t ? data.teams[t]?.name ?? '?' : 'Bye');
  return (
    <div>
      <PageHeader title={data.cup.name} subtitle={`${data.cup.method === 'SEEDED' ? 'Seeded' : 'Random'} draw · ${data.cup.league?.name ?? 'Overall'} · starts GW${data.cup.startGameweek}`} />
      {data.cup.winnerTeamId && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-gold p-4 font-display text-lg font-bold text-ink">
          <Trophy /> Winner: {name(data.cup.winnerTeamId)}
        </div>
      )}
      <div className="mb-4">
        <Tabs value={round} onChange={setRound} options={rounds.map((r) => ({ value: String(r), label: data.fixtures.find((f) => f.round === r)!.roundName }))} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {data.fixtures
          .filter((f) => String(f.round) === round)
          .map((f) => (
            <div key={f.id} className="card p-3">
              <div className="mb-1 text-xs text-ink/50">Gameweek {f.gameweekNumber} · {f.gameweekStatus.toLowerCase()}</div>
              {[
                [f.teamAId, f.seedA, f.liveA],
                [f.teamBId, f.seedB, f.liveB],
              ].map(([t, seed, score], i) => (
                <div key={i} className={clsx('flex items-center justify-between py-1', f.winnerId && f.winnerId === t && 'font-bold text-pitch', f.winnerId && f.winnerId !== t && 'text-ink/40')}>
                  <span>
                    <span className="mr-2 text-xs text-ink/40">{seed ?? ''}</span>
                    {name(t as string | null)}
                  </span>
                  <span className="font-display tabular-nums">{score ?? '-'}</span>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  );
}
