import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { ErrorBox, Field, Loading, Modal, OriginBadge, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useClubs, useGameweeks, useMeta, type Club } from '../../hooks/data';
import { api } from '../../lib/api';
import { STATUS_LABEL, dateTime } from '../../lib/format';

export interface OpsFixture {
  id: string;
  kickoffAt: string;
  status: string;
  homeScore: number;
  awayScore: number;
  origin: string;
  venue: string | null;
  homeClub: Club;
  awayClub: Club;
  gameweek: { id: string; number: number; status: string } | null;
  assignments: { role: string; user: { id: string; displayName: string } }[];
  _count: { squad: number; events: number };
}

export function OpsFixturesPage() {
  const { can } = useAuth();
  const { data: meta } = useMeta();
  const gws = useGameweeks();
  const [gw, setGw] = useState<string>(String(meta?.nextGameweek?.number ?? meta?.currentGameweek?.number ?? 1));
  const [create, setCreate] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'fixtures', gw], queryFn: () => api<OpsFixture[]>(`/ops/football/fixtures${gw ? `?gameweek=${gw}` : ''}`) });
  return (
    <div>
      <PageHeader
        title="Fixtures"
        subtitle="Schedule matches, register line-ups and assign analysts."
        actions={
          <>
            <select className="input w-auto" value={gw} onChange={(e) => setGw(e.target.value)} aria-label="Gameweek">
              <option value="">All gameweeks</option>
              {gws.data?.map((g) => (
                <option key={g.id} value={g.number}>
                  {g.name} ({g.status.toLowerCase()})
                </option>
              ))}
            </select>
            {can('football.manage') && (
              <button className="btn-primary" onClick={() => setCreate(true)}>
                <Plus className="h-4 w-4" /> New fixture
              </button>
            )}
          </>
        }
      />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Kick-off</th>
                <th>Match</th>
                <th>Status</th>
                <th>Squads</th>
                <th>Analysts</th>
                <th>Origin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((f) => (
                <tr key={f.id}>
                  <td className="text-xs">
                    GW{f.gameweek?.number} · {dateTime(f.kickoffAt)}
                  </td>
                  <td>
                    <span className="flex items-center gap-2 font-semibold">
                      <ClubCrest club={f.homeClub} size={22} /> {f.homeClub.shortName}
                      <span className="tabular-nums text-ink/60">
                        {f.status === 'SCHEDULED' ? 'v' : `${f.homeScore}-${f.awayScore}`}
                      </span>
                      {f.awayClub.shortName} <ClubCrest club={f.awayClub} size={22} />
                    </span>
                  </td>
                  <td>
                    <span className="chip bg-ink/5">{STATUS_LABEL[f.status]}</span>
                  </td>
                  <td>{f._count.squad ? <span className="chip bg-pitch-50 text-pitch-700">{f._count.squad} players</span> : <span className="chip bg-clay-50 text-clay-600">none</span>}</td>
                  <td className="text-xs">{f.assignments.map((a) => a.user.displayName).join(', ') || '-'}</td>
                  <td>
                    <OriginBadge origin={f.origin} />
                  </td>
                  <td className="text-right">
                    <Link to={`/ops/fixtures/${f.id}`} className="btn-ghost px-3 py-1.5 text-xs">
                      Setup
                    </Link>{' '}
                    <Link to={`/ops/collect/${f.id}`} className="btn-dark px-3 py-1.5 text-xs">
                      Collect
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CreateFixture open={create} onClose={() => setCreate(false)} defaultGw={gw} />
    </div>
  );
}

function CreateFixture({ open, onClose, defaultGw }: { open: boolean; onClose: () => void; defaultGw: string }) {
  const qc = useQueryClient();
  const clubs = useClubs();
  const gws = useGameweeks();
  const comps = useQuery({ queryKey: ['ops', 'competitions'], queryFn: () => api<{ id: string; name: string }[]>('/ops/football/competitions'), enabled: open });
  const [form, setForm] = useState({ homeClubId: '', awayClubId: '', kickoffAt: '', gameweekNumber: defaultGw, venue: '', origin: 'MANUAL' });
  const m = useMutation({
    mutationFn: () => {
      const g = gws.data?.find((x) => String(x.number) === form.gameweekNumber);
      return api<{ id: string }>('/ops/football/fixtures', {
        body: { homeClubId: form.homeClubId, awayClubId: form.awayClubId, kickoffAt: new Date(form.kickoffAt).toISOString(), gameweekId: g?.id ?? null, competitionId: comps.data?.[0]?.id, venue: form.venue || clubs.data?.find((c) => c.id === form.homeClubId)?.stadium || null, origin: form.origin },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'fixtures'] });
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title="New fixture">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Home club">
            <select className="input" value={form.homeClubId} onChange={(e) => setForm({ ...form, homeClubId: e.target.value })}>
              <option value="">Select</option>
              {clubs.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Away club">
            <select className="input" value={form.awayClubId} onChange={(e) => setForm({ ...form, awayClubId: e.target.value })}>
              <option value="">Select</option>
              {clubs.data?.filter((c) => c.id !== form.homeClubId).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Kick-off">
          <input type="datetime-local" className="input" value={form.kickoffAt} onChange={(e) => setForm({ ...form, kickoffAt: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gameweek">
            <select className="input" value={form.gameweekNumber} onChange={(e) => setForm({ ...form, gameweekNumber: e.target.value })}>
              <option value="">None</option>
              {gws.data?.map((g) => (
                <option key={g.id} value={g.number}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Record origin">
            <select className="input" value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })}>
              <option value="MANUAL">Manual (our analysts)</option>
              <option value="IMPORTED">Imported (historical)</option>
              <option value="SAMPLE">Sample (fictional)</option>
            </select>
          </Field>
        </div>
        <Field label="Venue (optional)">
          <input className="input" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
        </Field>
        <ErrorBox error={m.error} />
        <button className="btn-primary w-full" disabled={!form.homeClubId || !form.awayClubId || !form.kickoffAt || m.isPending} onClick={() => m.mutate()}>
          Create fixture
        </button>
      </div>
    </Modal>
  );
}
