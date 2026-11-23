import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Bell } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Empty, Loading, PageHeader } from '../../components/ui';
import { api } from '../../lib/api';
import { ago } from '../../lib/format';

export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: () => api<{ unread: number; items: { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string }[] }>('/notifications') });
  const readAll = useMutation({ mutationFn: () => api('/notifications/read-all', { method: 'POST' }), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  if (isLoading) return <Loading />;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Notifications" actions={!!data?.unread && <button className="btn-ghost" onClick={() => readAll.mutate()}>Mark all read</button>} />
      <div className="card divide-y divide-ink/5">
        {data?.items.length ? (
          data.items.map((n) => (
            <div key={n.id} className={clsx('flex gap-3 p-4', !n.readAt && 'bg-gold-50/50')}>
              <span className={clsx('mt-1 h-2 w-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-clay')} />
              <div className="flex-1">
                <div className="font-semibold">{n.title}</div>
                <div className="text-sm text-ink/60">{n.body}</div>
                <div className="mt-1 flex gap-3 text-xs text-ink/40">
                  {ago(n.createdAt)}
                  {n.link && (
                    <Link to={n.link} className="font-semibold text-pitch">
                      Open
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <Empty icon={<Bell className="h-8 w-8" />} title="Nothing yet">You'll hear from us when your players score, or a gameweek goes live.</Empty>
        )}
      </div>
    </div>
  );
}
