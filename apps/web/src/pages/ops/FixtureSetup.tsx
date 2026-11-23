import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, History, Radio, Trash2, Wand } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { EventHistoryModal } from '../../components/EventHistory';
import { ErrorBox, Loading, OriginBadge, PageHeader, PosChip, StatusChip } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { api, tokenStore } from '../../lib/api';
import { STATUS_LABEL, dateTime } from '../../lib/format';
import type { MatchStateResponse } from '../../lib/match';

interface ClubPlayer {
  id: string;
  firstName: string;
  lastName: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  shirtNumber: number | null;
  status: string;
  clubId: string;
}
type Row = { inSquad: boolean; isStarter: boolean; shirtNumber: number | null };

export async function downloadCsv(path: string, filename: string) {
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${tokenStore.get()}` } });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function LineupEditor({ fixtureId, side, club, squad, locked }: { fixtureId: string; side: 'HOME' | 'AWAY'; club: MatchStateResponse['fixture']['homeClub']; squad: MatchStateResponse['squad']; locked: boolean }) {
  const qc = useQueryClient();
  const players = useQuery({ queryKey: ['ops', 'players', club.id], queryFn: () => api<ClubPlayer[]>(`/ops/football/players?club=${club.id}`) });
  const [rows, setRows] = useState<Record<string, Row>>({});
  useEffect(() => {
    if (!players.data) return;
    const current = new Map(squad.filter((s) => s.side === side).map((s) => [s.playerId, s]));
    setRows(Object.fromEntries(players.data.map((p) => [p.id, { inSquad: current.has(p.id), isStarter: current.get(p.id)?.isStarter ?? false, shirtNumber: current.get(p.id)?.shirtNumber ?? p.shirtNumber }])));
  }, [players.data, squad, side]);
  const save = useMutation({
    mutationFn: () => api(`/ops/football/fixtures/${fixtureId}/lineup`, { method: 'PUT', body: { side, players: Object.entries(rows).filter(([, r]) => r.inSquad).map(([playerId, r]) => ({ playerId, isStarter: r.isStarter, shirtNumber: r.shirtNumber })) } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-match', fixtureId] }),
  });
  const starters = Object.values(rows).filter((r) => r.isStarter).length;
  const inSquad = Object.values(rows).filter((r) => r.inSquad).length;
  const autoPick = () => {
    const ps = [...(players.data ?? [])].filter((p) => p.status === 'AVAILABLE');
    const pick = (pos: string, n: number) => ps.filter((p) => p.position === pos).slice(0, n).map((p) => p.id);
    const xi = new Set([...pick('GK', 1), ...pick('DEF', 4), ...pick('MID', 4), ...pick('FWD', 2)]);
    const bench = ps.filter((p) => !xi.has(p.id)).slice(0, 7).map((p) => p.id);
    setRows(Object.fromEntries((players.data ?? []).map((p) => [p.id, { inSquad: xi.has(p.id) || bench.includes(p.id), isStarter: xi.has(p.id), shirtNumber: rows[p.id]?.shirtNumber ?? p.shirtNumber }])));
  };
  if (players.isLoading) return <Loading />;
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ClubCrest club={club} size={28} />
        <h3 className="flex-1 font-display text-lg font-bold">{club.name}</h3>
        <span className={`chip ${starters === 11 ? 'bg-pitch-50 text-pitch-700' : 'bg-clay-50 text-clay-600'}`}>{starters}/11 starters</span>
        <span className="chip bg-ink/5">{inSquad} in squad</span>
      </div>
      {!locked && (
        <button className="btn-ghost mb-2 w-full text-xs" onClick={autoPick}>
          <Wand className="h-3.5 w-3.5" /> Suggest XI + 7 subs from available players
        </button>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>Squad</th>
            <th>XI</th>
            <th>No.</th>
            <th>Player</th>
          </tr>
        </thead>
        <tbody>
          {players.data?.map((p) => {
            const r = rows[p.id] ?? { inSquad: false, isStarter: false, shirtNumber: p.shirtNumber };
            const set = (patch: Partial<Row>) => setRows({ ...rows, [p.id]: { ...r, ...patch } });
            return (
              <tr key={p.id} className={r.inSquad ? '' : 'opacity-60'}>
                <td>
                  <input type="checkbox" className="h-4 w-4 accent-pitch" disabled={locked} checked={r.inSquad} onChange={(e) => set({ inSquad: e.target.checked, isStarter: e.target.checked ? r.isStarter : false })} aria-label="In squad" />
                </td>
                <td>
                  <input type="checkbox" className="h-4 w-4 accent-gold" disabled={locked || !r.inSquad} checked={r.isStarter} onChange={(e) => set({ isStarter: e.target.checked })} aria-label="Starter" />
                </td>
                <td>
                  <input type="number" className="input w-16 px-2 py-1" disabled={locked} value={r.shirtNumber ?? ''} onChange={(e) => set({ shirtNumber: e.target.value ? Number(e.target.value) : null })} aria-label="Shirt number" />
                </td>
                <td>
                  <span className="flex items-center gap-2">
                    <PosChip pos={p.position} /> {p.firstName} {p.lastName}
                    {p.status !== 'AVAILABLE' && <span className="chip bg-clay-50 text-clay-600">{p.status.toLowerCase()}</span>}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ErrorBox error={save.error} />
      {save.isSuccess && <p className="mt-2 text-sm text-pitch">Line-up saved.</p>}
      {!locked && (
        <button className="btn-primary mt-3 w-full" disabled={save.isPending} onClick={() => save.mutate()}>
          Save {club.shortName} line-up
        </button>
      )}
    </section>
  );
}

export function FixtureSetupPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [hist, setHist] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['ops-match', id], queryFn: () => api<MatchStateResponse>(`/ops/matches/${id}`) });
  const staff = useQuery({ queryKey: ['ops', 'staff'], queryFn: () => api<{ id: string; displayName: string; role: string }[]>('/ops/users?staff=1'), enabled: can('football.manage') });
  const [assign, setAssign] = useState({ userId: '', role: 'PRIMARY' });
  const addAssign = useMutation({ mutationFn: () => api(`/ops/football/fixtures/${id}/assignments`, { body: assign }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-match', id] }) });
  const removeAssign = useMutation({ mutationFn: (userId: string) => api(`/ops/football/fixtures/${id}/assignments/${userId}`, { method: 'DELETE' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ops-match', id] }) });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const f = data.fixture;
  const locked = f.status === 'PUBLISHED' || !can('football.manage');
  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <ClubCrest club={f.homeClub} size={36} /> {f.homeClub.shortName} v {f.awayClub.shortName} <ClubCrest club={f.awayClub} size={36} />
          </span>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {f.gameweek?.name} · {dateTime(f.kickoffAt)} · {STATUS_LABEL[f.status]} <OriginBadge origin={f.origin} />
          </span>
        }
        actions={
          <>
            <button className="btn-ghost" onClick={() => downloadCsv(`/ops/export/events?fixtureId=${f.id}`, `events-${f.homeClub.shortName}-${f.awayClub.shortName}.csv`)}>
              <Download className="h-4 w-4" /> Events CSV
            </button>
            <Link to={`/ops/collect/${f.id}`} className="btn-dark">
              <Radio className="h-4 w-4" /> Open live console
            </Link>
          </>
        }
      />
      <section className="card p-4">
        <h2 className="mb-3 font-display text-lg font-bold">Analyst assignments</h2>
        <div className="flex flex-wrap gap-2">
          {data.assignments?.map((a) => (
            <span key={a.userId} className="chip bg-ink/5 py-1 text-sm">
              {a.role.toLowerCase()}: {a.user.displayName}
              {can('football.manage') && (
                <button onClick={() => removeAssign.mutate(a.userId)} aria-label="Remove">
                  <Trash2 className="h-3.5 w-3.5 text-clay" />
                </button>
              )}
            </span>
          ))}
          {!data.assignments?.length && <span className="text-sm text-ink/50">No analysts assigned.</span>}
        </div>
        {can('football.manage') && (
          <div className="mt-3 flex flex-wrap gap-2">
            <select className="input w-auto" value={assign.userId} onChange={(e) => setAssign({ ...assign, userId: e.target.value })} aria-label="Staff member">
              <option value="">Choose staff…</option>
              {staff.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.displayName} ({u.role.toLowerCase().replace(/_/g, ' ')})
                </option>
              ))}
            </select>
            <select className="input w-auto" value={assign.role} onChange={(e) => setAssign({ ...assign, role: e.target.value })} aria-label="Assignment role">
              <option value="PRIMARY">Analyst A (records)</option>
              <option value="VERIFIER">Analyst B (verifies)</option>
              <option value="SUPERVISOR">Supervisor</option>
            </select>
            <button className="btn-primary" disabled={!assign.userId} onClick={() => addAssign.mutate()}>
              Assign
            </button>
          </div>
        )}
        <ErrorBox error={addAssign.error} />
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <LineupEditor fixtureId={f.id} side="HOME" club={f.homeClub} squad={data.squad} locked={locked} />
        <LineupEditor fixtureId={f.id} side="AWAY" club={f.awayClub} squad={data.squad} locked={locked} />
      </div>
      <section className="card overflow-x-auto p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Event record</h2>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Min</th>
              <th>Event</th>
              <th>Player</th>
              <th>Status</th>
              <th>Recorded by</th>
              <th>Ver.</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.events.map((e) => (
              <tr key={e.id}>
                <td className="text-ink/40">{e.sequence}</td>
                <td className="font-mono">{e.minute}'</td>
                <td>{e.code.replace(/_/g, ' ').toLowerCase()}</td>
                <td>
                  {e.player ? `${e.player.firstName} ${e.player.lastName}` : '-'}
                  {e.secondaryPlayer && <span className="text-ink/50"> / {e.secondaryPlayer.lastName}</span>}
                </td>
                <td>
                  <StatusChip status={e.status} />
                </td>
                <td className="text-xs">{e.recordedBy?.displayName}</td>
                <td>v{e.version}</td>
                <td>
                  <button onClick={() => setHist(e.id)} aria-label="History" className="text-pitch">
                    <History className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!data.events.length && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-ink/50">
                  No events recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
      <EventHistoryModal eventId={hist} onClose={() => setHist(null)} />
    </div>
  );
}
