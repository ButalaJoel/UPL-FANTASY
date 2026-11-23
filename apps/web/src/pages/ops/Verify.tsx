import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, History } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventHistoryModal } from '../../components/EventHistory';
import { Empty, ErrorBox, Loading, PageHeader, StatusChip } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';
import { EVENT_ICON } from '../../lib/match';

interface QueueItem {
  id: string;
  code: string;
  minute: number;
  status: string;
  recordedAt: string;
  fixtureId: string;
  player: { firstName: string; lastName: string; shirtNumber: number | null } | null;
  secondaryPlayer: { firstName: string; lastName: string } | null;
  recordedBy: { id: string; displayName: string };
  fixture: { homeClub: { shortName: string }; awayClub: { shortName: string } };
  verifications: { decision: string; note: string | null; user: { displayName: string } | null }[];
}

export function VerifyPage() {
  const { user, can } = useAuth();
  const qc = useQueryClient();
  const [hist, setHist] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'queue'], queryFn: () => api<QueueItem[]>('/ops/matches/queue/verification'), refetchInterval: 10_000 });
  const act = useMutation({
    mutationFn: ({ id, path, body }: { id: string; path: string; body: unknown }) => api(`/ops/matches/events/${id}/${path}`, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ops'] }),
  });
  return (
    <div>
      <PageHeader title="Verification queue" subtitle="Events recorded by one analyst must be confirmed by another before points are confirmed." />
      <ErrorBox error={act.error} />
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="All caught up">No events are waiting for verification.</Empty>
      ) : (
        <div className="card divide-y divide-ink/5">
          {data.map((e) => {
            const mine = e.recordedBy.id === user?.id;
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="text-lg">{EVENT_ICON[e.code]}</span>
                <div className="min-w-0 flex-1">
                  <div>
                    <b>{e.code.replace(/_/g, ' ').toLowerCase()}</b> {e.minute}' · {e.player ? `#${e.player.shirtNumber} ${e.player.firstName} ${e.player.lastName}` : ''}
                    {e.secondaryPlayer && <span className="text-ink/60"> ({e.secondaryPlayer.lastName})</span>}
                  </div>
                  <div className="text-xs text-ink/50">
                    <Link className="text-pitch" to={`/ops/collect/${e.fixtureId}`}>
                      {e.fixture.homeClub.shortName} v {e.fixture.awayClub.shortName}
                    </Link>{' '}
                    · by {e.recordedBy.displayName} {ago(e.recordedAt)}
                    {e.status === 'DISPUTED' && <> · “{e.verifications.find((v) => v.decision === 'DISPUTE')?.note}”</>}
                  </div>
                </div>
                <StatusChip status={e.status} />
                {e.status === 'PENDING' && !mine && (
                  <>
                    <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => act.mutate({ id: e.id, path: 'verify', body: { decision: 'CONFIRM' } })}>
                      <Check className="h-3.5 w-3.5" /> Confirm
                    </button>
                    <button
                      className="btn-ghost px-3 py-1.5 text-xs"
                      onClick={() => {
                        const note = prompt('What is wrong with this event?');
                        if (note) act.mutate({ id: e.id, path: 'verify', body: { decision: 'DISPUTE', note } });
                      }}
                    >
                      Dispute
                    </button>
                  </>
                )}
                {e.status === 'PENDING' && mine && <span className="text-xs text-ink/40">Your event: needs another analyst</span>}
                {e.status === 'DISPUTED' && can('events.resolve') && (
                  <>
                    <button className="btn-primary px-3 py-1.5 text-xs" onClick={() => act.mutate({ id: e.id, path: 'resolve', body: { decision: 'VERIFY', note: 'Supervisor upheld the event' } })}>
                      Uphold
                    </button>
                    <button className="btn-danger px-3 py-1.5 text-xs" onClick={() => act.mutate({ id: e.id, path: 'resolve', body: { decision: 'REJECT', note: 'Supervisor rejected the event' } })}>
                      Reject
                    </button>
                  </>
                )}
                <button onClick={() => setHist(e.id)} aria-label="History" className="text-ink/50">
                  <History className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <EventHistoryModal eventId={hist} onClose={() => setHist(null)} />
    </div>
  );
}
