import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, Field, Loading, Modal, OriginBadge, PageHeader, PosChip } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useClubs } from '../../hooks/data';
import { api } from '../../lib/api';
import { price } from '../../lib/format';

interface OpsPlayer {
  id: string;
  firstName: string;
  lastName: string;
  clubId: string;
  position: 'GK' | 'DEF' | 'MID' | 'FWD';
  shirtNumber: number | null;
  price: number;
  status: string;
  statusNote: string | null;
  nationality: string | null;
  origin: string;
  active: boolean;
  club: { shortName: string };
}
const blank = { firstName: '', lastName: '', clubId: '', position: 'MID' as OpsPlayer['position'], shirtNumber: null as number | null, price: 50, status: 'AVAILABLE', statusNote: '', nationality: 'Uganda', origin: 'MANUAL', active: true };

export function OpsPlayersPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const clubs = useClubs();
  const [club, setClub] = useState('');
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'players', club, q], queryFn: () => api<OpsPlayer[]>(`/ops/football/players?club=${club}&q=${encodeURIComponent(q)}`) });
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { ...edit!, statusNote: edit!.statusNote || null };
      return edit!.id ? api(`/ops/football/players/${edit!.id}`, { method: 'PUT', body }) : api('/ops/football/players', { body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'players'] });
      qc.invalidateQueries({ queryKey: ['players'] });
      setEdit(null);
    },
  });
  return (
    <div>
      <PageHeader title="Players" subtitle="Positions, prices and availability. Price changes are logged." actions={can('football.manage') && <button className="btn-primary" onClick={() => setEdit({ ...blank, clubId: club || clubs.data?.[0]?.id || '' })}><Plus className="h-4 w-4" /> New player</button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <input className="input max-w-xs" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={club} onChange={(e) => setClub(e.target.value)} aria-label="Club">
          <option value="">All clubs</option>
          {clubs.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {isLoading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>No.</th>
                <th>Name</th>
                <th>Club</th>
                <th>Pos</th>
                <th className="text-right">Price</th>
                <th>Status</th>
                <th>Origin</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data?.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'opacity-50'}>
                  <td className="font-mono">{p.shirtNumber}</td>
                  <td className="font-semibold">
                    {p.firstName} {p.lastName}
                  </td>
                  <td>{p.club.shortName}</td>
                  <td>
                    <PosChip pos={p.position} />
                  </td>
                  <td className="text-right tabular-nums">{price(p.price)}</td>
                  <td className="text-xs">{p.status.toLowerCase()}</td>
                  <td>
                    <OriginBadge origin={p.origin} />
                  </td>
                  <td>
                    {can('football.manage') && (
                      <button onClick={() => setEdit({ ...blank, ...p, statusNote: p.statusNote ?? '', nationality: p.nationality ?? '' })} aria-label="Edit">
                        <Pencil className="h-4 w-4 text-ink/50" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit player' : 'New player'}>
        {edit && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name">
                <input className="input" value={edit.firstName} onChange={(e) => setEdit({ ...edit, firstName: e.target.value })} />
              </Field>
              <Field label="Last name">
                <input className="input" value={edit.lastName} onChange={(e) => setEdit({ ...edit, lastName: e.target.value })} />
              </Field>
              <Field label="Club">
                <select className="input" value={edit.clubId} onChange={(e) => setEdit({ ...edit, clubId: e.target.value })}>
                  {clubs.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Position">
                <select className="input" value={edit.position} onChange={(e) => setEdit({ ...edit, position: e.target.value as OpsPlayer['position'] })}>
                  {['GK', 'DEF', 'MID', 'FWD'].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Shirt number">
                <input type="number" className="input" value={edit.shirtNumber ?? ''} onChange={(e) => setEdit({ ...edit, shirtNumber: e.target.value ? Number(e.target.value) : null })} />
              </Field>
              <Field label="Price (tenths: 55 = 5.5m)">
                <input type="number" className="input" value={edit.price} onChange={(e) => setEdit({ ...edit, price: Number(e.target.value) })} />
              </Field>
              <Field label="Availability">
                <select className="input" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })}>
                  {['AVAILABLE', 'DOUBTFUL', 'INJURED', 'SUSPENDED', 'UNAVAILABLE'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Origin">
                <select className="input" value={edit.origin} onChange={(e) => setEdit({ ...edit, origin: e.target.value })}>
                  <option value="MANUAL">Manual</option>
                  <option value="IMPORTED">Imported</option>
                  <option value="SAMPLE">Sample</option>
                </select>
              </Field>
            </div>
            <Field label="Status note">
              <input className="input" value={edit.statusNote} onChange={(e) => setEdit({ ...edit, statusNote: e.target.value })} placeholder="e.g. Hamstring, back in 2 weeks" />
            </Field>
            {edit.id && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-pitch" checked={edit.active} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active (selectable in the fantasy game)
              </label>
            )}
            <ErrorBox error={save.error} />
            <button className="btn-primary w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              Save
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
