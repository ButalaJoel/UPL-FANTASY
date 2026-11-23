import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLES, ROLE_LABELS } from '@kiwanja/core';
import { useState } from 'react';
import { ErrorBox, Loading, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { api } from '../../lib/api';
import { ago, date } from '../../lib/format';

interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  active: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  isSample: boolean;
  _count: { eventsRecorded: number; verifications: number; assignments: number };
}

export function OpsUsersPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['ops', 'users', q], queryFn: () => api<AdminUser[]>(`/ops/users?q=${encodeURIComponent(q)}`) });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: unknown }) => api(`/ops/users/${id}`, { method: 'PATCH', body }), onSuccess: () => qc.invalidateQueries({ queryKey: ['ops', 'users'] }) });
  return (
    <div>
      <PageHeader title="Users & permissions" subtitle="Assign roles. Only staff roles can open Data Ops; analysts can only edit matches they are assigned to." />
      <input className="input mb-3 max-w-sm" placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox error={update.error} />
      {isLoading ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th className="text-right">Events</th>
                <th className="text-right">Verifications</th>
                <th>Joined</th>
                <th>Last sign-in</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {data?.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="font-semibold">
                      {u.displayName} {u.isSample && <span className="chip bg-sky/10 text-sky">sample</span>}
                    </div>
                    <div className="text-xs text-ink/50">{u.email}</div>
                  </td>
                  <td>
                    <select className="input w-52 px-2 py-1" value={u.role} disabled={u.id === user?.id} onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value } })}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">{u._count.eventsRecorded}</td>
                  <td className="text-right">{u._count.verifications}</td>
                  <td className="text-xs">{date(u.createdAt)}</td>
                  <td className="text-xs">{u.lastLoginAt ? ago(u.lastLoginAt) : '-'}</td>
                  <td>
                    <input type="checkbox" className="h-4 w-4 accent-pitch" checked={u.active} disabled={u.id === user?.id} onChange={(e) => update.mutate({ id: u.id, body: { active: e.target.checked } })} aria-label="Active" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
