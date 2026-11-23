import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, Field, Loading, Modal, PageHeader, Tabs } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useMeta } from '../../hooks/data';
import { api } from '../../lib/api';
import { dateTime } from '../../lib/format';

type Tab = 'sources' | 'events' | 'audit' | 'sync';

export function OpsSettingsPage() {
  const [tab, setTab] = useState<Tab>('sources');
  return (
    <div>
      <PageHeader title="Settings" subtitle="Data sources, the event dictionary and the audit trail." />
      <div className="mb-4 max-w-xl">
        <Tabs value={tab} onChange={setTab} options={[{ value: 'sources', label: 'Data sources' }, { value: 'events', label: 'Event types' }, { value: 'audit', label: 'Audit log' }, { value: 'sync', label: 'Device sync log' }]} />
      </div>
      {tab === 'sources' && <Sources />}
      {tab === 'events' && <EventTypes />}
      {tab === 'audit' && <Audit />}
      {tab === 'sync' && <SyncLog />}
    </div>
  );
}

interface Source {
  id: string;
  name: string;
  kind: string;
  url: string | null;
  attribution: string | null;
  licence: string | null;
  notes: string | null;
  active: boolean;
  hasApiKey: boolean;
  _count: { events: number; fixtures: number; players: number; metrics: number };
}
const KINDS = ['MANUAL_LIVE', 'MANUAL_HISTORICAL', 'IMPORT', 'SAMPLE', 'TRACKING_DEVICE', 'VIDEO_ANALYTICS', 'PARTNER_FEED'];

function Sources() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'sources'], queryFn: () => api<Source[]>('/ops/data-sources') });
  const [edit, setEdit] = useState<Partial<Source> | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body = { name: edit!.name, kind: edit!.kind, url: edit!.url || null, attribution: edit!.attribution || null, licence: edit!.licence || null, notes: edit!.notes || null, active: edit!.active ?? true };
      return edit!.id ? api(`/ops/data-sources/${edit!.id}`, { method: 'PUT', body }) : api('/ops/data-sources', { body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ops', 'sources'] });
      setEdit(null);
    },
  });
  const issueKey = useMutation({ mutationFn: (id: string) => api<{ apiKey: string }>(`/ops/data-sources/${id}/api-key`, { method: 'POST' }), onSuccess: (r) => setKey(r.apiKey) });
  if (isLoading) return <Loading />;
  return (
    <div className="space-y-3">
      {can('settings.manage') && (
        <button className="btn-primary" onClick={() => setEdit({ kind: 'MANUAL_HISTORICAL', active: true })}>
          <Plus className="h-4 w-4" /> New data source
        </button>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {data?.map((s) => (
          <div key={s.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-ink/50">
                  {s.kind.replace(/_/g, ' ').toLowerCase()} · {s.active ? 'active' : 'inactive'}
                </div>
              </div>
              {can('settings.manage') && (
                <div className="flex gap-1">
                  <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEdit(s)}>
                    Edit
                  </button>
                  {['TRACKING_DEVICE', 'VIDEO_ANALYTICS', 'PARTNER_FEED'].includes(s.kind) && (
                    <button className="btn-ghost px-2 py-1 text-xs" onClick={() => issueKey.mutate(s.id)} title="Issue ingest API key">
                      <KeyRound className="h-3.5 w-3.5" /> {s.hasApiKey ? 'Rotate key' : 'API key'}
                    </button>
                  )}
                </div>
              )}
            </div>
            {s.attribution && <p className="mt-2 text-sm">{s.attribution}</p>}
            {s.notes && <p className="mt-1 text-xs text-ink/60">{s.notes}</p>}
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
              <span className="chip bg-ink/5">{s._count.fixtures} fixtures</span>
              <span className="chip bg-ink/5">{s._count.events} events</span>
              <span className="chip bg-ink/5">{s._count.players} players</span>
              <span className="chip bg-ink/5">{s._count.metrics} tracking samples</span>
            </div>
          </div>
        ))}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit data source' : 'New data source'}>
        {edit && (
          <div className="space-y-3">
            <Field label="Name">
              <input className="input" value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Kind">
              <select className="input" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                {KINDS.map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            <Field label="URL">
              <input className="input" value={edit.url ?? ''} onChange={(e) => setEdit({ ...edit, url: e.target.value })} />
            </Field>
            <Field label="Attribution text">
              <input className="input" value={edit.attribution ?? ''} onChange={(e) => setEdit({ ...edit, attribution: e.target.value })} />
            </Field>
            <Field label="Licence / permission">
              <input className="input" value={edit.licence ?? ''} onChange={(e) => setEdit({ ...edit, licence: e.target.value })} />
            </Field>
            <Field label="Notes">
              <textarea className="input" rows={3} value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-pitch" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> Active
            </label>
            <ErrorBox error={save.error} />
            <button className="btn-primary w-full" onClick={() => save.mutate()}>
              Save
            </button>
          </div>
        )}
      </Modal>
      <Modal open={!!key} onClose={() => setKey(null)} title="Ingest API key">
        <p className="text-sm">Copy this key now. It will not be shown again. Devices send it as the <code>x-api-key</code> header to <code>POST /api/ingest/metrics</code>.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-ink p-3 text-xs text-gold">{key}</pre>
      </Modal>
    </div>
  );
}

function EventTypes() {
  const qc = useQueryClient();
  const { can } = useAuth();
  const { data: meta } = useMeta();
  const update = useMutation({ mutationFn: ({ code, body }: { code: string; body: unknown }) => api(`/ops/event-types/${code}`, { method: 'PATCH', body }), onSuccess: () => qc.invalidateQueries({ queryKey: ['meta'] }) });
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Event</th>
            <th>Category</th>
            <th>Description</th>
            <th>Enabled</th>
            <th>Needs 2nd analyst</th>
          </tr>
        </thead>
        <tbody>
          {meta?.eventTypes.map((t) => (
            <tr key={t.code}>
              <td className="font-semibold">
                {t.label} {t.extended && <span className="chip bg-sky/10 text-sky">extended</span>}
              </td>
              <td className="text-xs">{t.category.toLowerCase()}</td>
              <td className="max-w-md whitespace-normal text-xs text-ink/60">{t.description}</td>
              <td>
                <input type="checkbox" className="h-4 w-4 accent-pitch" disabled={!can('settings.manage')} checked={t.enabled} onChange={(e) => update.mutate({ code: t.code, body: { enabled: e.target.checked } })} aria-label="Enabled" />
              </td>
              <td>
                <input type="checkbox" className="h-4 w-4 accent-gold" disabled={!can('settings.manage')} checked={t.requiresVerification} onChange={(e) => update.mutate({ code: t.code, body: { requiresVerification: e.target.checked } })} aria-label="Requires verification" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Audit() {
  const [entity, setEntity] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'audit', entity], queryFn: () => api<{ id: string; action: string; entity: string; entityId: string | null; data: unknown; createdAt: string; user: { displayName: string; role: string } | null }[]>(`/ops/audit?entity=${entity}`) });
  return (
    <div className="space-y-3">
      <select className="input w-auto" value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Entity">
        <option value="">All entities</option>
        {['match_event', 'fixture', 'scoring_rule', 'gameweek', 'player', 'club', 'user', 'fantasy_team', 'fantasy_league', 'app_settings', 'data_source'].map((e) => (
          <option key={e}>{e}</option>
        ))}
      </select>
      {isLoading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((a) => (
                <tr key={a.id}>
                  <td className="text-xs">{dateTime(a.createdAt)}</td>
                  <td className="text-xs">{a.user?.displayName ?? 'system'}</td>
                  <td className="font-mono text-xs">{a.action}</td>
                  <td className="text-xs">{a.entity}</td>
                  <td className="max-w-md truncate font-mono text-[11px] text-ink/50">{a.data ? JSON.stringify(a.data) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SyncLog() {
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'sync'], queryFn: () => api<{ id: string; deviceId: string | null; received: number; created: number; duplicates: number; conflicts: number; createdAt: string; user: { displayName: string } }[]>('/ops/sync-log') });
  if (isLoading) return <Loading />;
  return (
    <div className="card overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>When</th>
            <th>Analyst</th>
            <th>Device</th>
            <th className="text-right">Received</th>
            <th className="text-right">Created</th>
            <th className="text-right">Duplicates skipped</th>
            <th className="text-right">Rejected</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((s) => (
            <tr key={s.id}>
              <td className="text-xs">{dateTime(s.createdAt)}</td>
              <td>{s.user.displayName}</td>
              <td className="font-mono text-xs">{s.deviceId}</td>
              <td className="text-right">{s.received}</td>
              <td className="text-right">{s.created}</td>
              <td className="text-right">{s.duplicates}</td>
              <td className="text-right">{s.conflicts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data?.length && <p className="p-4 text-center text-sm text-ink/50">No device syncs yet.</p>}
    </div>
  );
}
