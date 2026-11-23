import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { ClubCrest } from '../../components/brand';
import { ErrorBox, Field, Loading, Modal, OriginBadge, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useClubs, type Club } from '../../hooks/data';
import { api } from '../../lib/api';

const blank = { name: '', shortName: '', city: '', stadium: '', primaryColor: '#0E7C66', secondaryColor: '#FFFFFF', origin: 'MANUAL' };

export function OpsClubsPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useClubs();
  const [edit, setEdit] = useState<(typeof blank & { id?: string }) | null>(null);
  const save = useMutation({
    mutationFn: () => (edit!.id ? api(`/ops/football/clubs/${edit!.id}`, { method: 'PUT', body: edit }) : api('/ops/football/clubs', { body: edit })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clubs'] });
      setEdit(null);
    },
  });
  return (
    <div>
      <PageHeader title="Clubs" subtitle="Crests are generated from club colours. No official logos are used." actions={can('football.manage') && <button className="btn-primary" onClick={() => setEdit({ ...blank })}><Plus className="h-4 w-4" /> New club</button>} />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data?.map((c: Club) => (
            <div key={c.id} className="card flex items-center gap-3 p-4">
              <ClubCrest club={c} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-xs text-ink/50">
                  {c.city} · {c._count?.players} players
                </div>
                <OriginBadge origin={c.origin} />
              </div>
              {can('football.manage') && (
                <button onClick={() => setEdit({ ...blank, ...c, city: c.city ?? '', stadium: c.stadium ?? '' })} aria-label="Edit">
                  <Pencil className="h-4 w-4 text-ink/50" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit club' : 'New club'}>
        {edit && (
          <div className="space-y-3">
            <div className="flex justify-center">
              <ClubCrest club={{ shortName: edit.shortName || '???', primaryColor: edit.primaryColor, secondaryColor: edit.secondaryColor }} size={72} />
            </div>
            <Field label="Name">
              <input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Short name (2-4)">
                <input className="input uppercase" maxLength={4} value={edit.shortName} onChange={(e) => setEdit({ ...edit, shortName: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="City">
                <input className="input" value={edit.city} onChange={(e) => setEdit({ ...edit, city: e.target.value })} />
              </Field>
            </div>
            <Field label="Stadium">
              <input className="input" value={edit.stadium} onChange={(e) => setEdit({ ...edit, stadium: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Primary">
                <input type="color" className="h-10 w-full rounded-lg" value={edit.primaryColor} onChange={(e) => setEdit({ ...edit, primaryColor: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Secondary">
                <input type="color" className="h-10 w-full rounded-lg" value={edit.secondaryColor} onChange={(e) => setEdit({ ...edit, secondaryColor: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Origin">
                <select className="input" value={edit.origin} onChange={(e) => setEdit({ ...edit, origin: e.target.value })}>
                  <option value="MANUAL">Manual</option>
                  <option value="IMPORTED">Imported</option>
                  <option value="SAMPLE">Sample</option>
                </select>
              </Field>
            </div>
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
