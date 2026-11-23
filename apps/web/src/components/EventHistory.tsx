import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { dateTime } from '../lib/format';
import { ErrorBox, Loading, Modal, OriginBadge, StatusChip } from './ui';

interface HistoryResponse {
  event: {
    id: string;
    code: string;
    minute: number;
    status: string;
    origin: string;
    version: number;
    clientEventId: string;
    clientRecordedAt: string;
    recordedAt: string;
    player: { firstName: string; lastName: string } | null;
    secondaryPlayer: { firstName: string; lastName: string } | null;
    recordedBy: { displayName: string; role: string };
    source: { name: string } | null;
    type: { label: string; requiresVerification: boolean };
    verifications: { id: string; decision: string; note: string | null; createdAt: string; user: { displayName: string; role: string } | null }[];
    corrections: { id: string; reason: string; before: Record<string, unknown>; after: Record<string, unknown>; versionFrom: number; versionTo: number; createdAt: string; user: { displayName: string } }[];
  };
  audit: { id: string; action: string; createdAt: string; user: { displayName: string } | null }[];
}

/** Full verification and correction history of one match event. */
export function EventHistoryModal({ eventId, onClose }: { eventId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['event-history', eventId], queryFn: () => api<HistoryResponse>(`/ops/matches/events/${eventId}/history`), enabled: !!eventId });
  const e = data?.event;
  return (
    <Modal open={!!eventId} onClose={onClose} title="Event history" wide>
      {isLoading && <Loading />}
      <ErrorBox error={error} />
      {e && (
        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-lg font-bold">
              {e.type.label} · {e.minute}'
            </span>
            <StatusChip status={e.status} />
            <OriginBadge origin={e.origin} />
            <span className="chip bg-ink/5">v{e.version}</span>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-paper p-3 text-xs">
            <dt className="text-ink/50">Player</dt>
            <dd>{e.player ? `${e.player.firstName} ${e.player.lastName}` : '-'}</dd>
            <dt className="text-ink/50">Second player</dt>
            <dd>{e.secondaryPlayer ? `${e.secondaryPlayer.firstName} ${e.secondaryPlayer.lastName}` : '-'}</dd>
            <dt className="text-ink/50">Recorded by</dt>
            <dd>{e.recordedBy.displayName}</dd>
            <dt className="text-ink/50">Tapped on device</dt>
            <dd>{dateTime(e.clientRecordedAt)}</dd>
            <dt className="text-ink/50">Received by server</dt>
            <dd>{dateTime(e.recordedAt)}</dd>
            <dt className="text-ink/50">Source</dt>
            <dd>{e.source?.name ?? 'Kiwanja analysts'}</dd>
            <dt className="text-ink/50">Device event id</dt>
            <dd className="truncate font-mono">{e.clientEventId}</dd>
          </dl>
          <div>
            <h3 className="mb-1 font-semibold">Verification</h3>
            {e.verifications.length === 0 && <p className="text-ink/50">Not yet verified.</p>}
            <ol className="space-y-1">
              {e.verifications.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 ring-1 ring-ink/5">
                  <span className="chip bg-ink text-white">{v.decision.replace('_', ' ')}</span>
                  <span>{v.user?.displayName ?? 'System'}</span>
                  <span className="text-ink/50">{dateTime(v.createdAt)}</span>
                  {v.note && <span className="w-full text-xs text-ink/60">“{v.note}”</span>}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Corrections</h3>
            {e.corrections.length === 0 && <p className="text-ink/50">No corrections.</p>}
            {e.corrections.map((c) => (
              <div key={c.id} className="mb-2 rounded-lg bg-white p-2 ring-1 ring-ink/5">
                <div className="text-xs text-ink/50">
                  v{c.versionFrom} → v{c.versionTo} · {c.user.displayName} · {dateTime(c.createdAt)}
                </div>
                <div className="mt-1">“{c.reason}”</div>
                <div className="mt-1 grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <pre className="overflow-x-auto rounded bg-clay-50 p-2">{JSON.stringify(c.before, null, 1)}</pre>
                  <pre className="overflow-x-auto rounded bg-pitch-50 p-2">{JSON.stringify(c.after, null, 1)}</pre>
                </div>
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-1 font-semibold">Audit trail</h3>
            {data!.audit.map((a) => (
              <div key={a.id} className="text-xs text-ink/60">
                {dateTime(a.createdAt)} · {a.user?.displayName ?? 'system'} · {a.action}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
