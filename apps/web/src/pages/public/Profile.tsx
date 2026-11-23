import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ROLE_LABELS } from '@kiwanja/core';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../../components/brand';
import { ErrorBox, Field, PageHeader } from '../../components/ui';
import { useAuth } from '../../hooks/auth';
import { useClubs } from '../../hooks/data';
import { api } from '../../lib/api';
import { date } from '../../lib/format';

const COLORS = ['#0E7C66', '#1D4E89', '#8C1C13', '#3D348B', '#BC6C25', '#5F0F40', '#E36414', '#0B1A14'];

export function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const clubs = useClubs();
  const [form, setForm] = useState({ displayName: '', avatarColor: '#0E7C66', avatarUrl: '', favouriteClubId: '', notifyGoals: true, notifyDeadlines: true });
  const [teamName, setTeamName] = useState('');
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const history = useQuery({ queryKey: ['fantasy', 'history'], queryFn: () => api<{ team: { name: string } | null; gameweeks: { gameweek: number; points: number; confirmed: number; transferCost: number; transfers: number; average: number; total: number; status: string }[] }>('/fantasy/history') });
  useEffect(() => {
    if (user) setForm({ displayName: user.displayName, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl ?? '', favouriteClubId: user.favouriteClubId ?? '', notifyGoals: user.notifyGoals, notifyDeadlines: user.notifyDeadlines });
  }, [user]);
  useEffect(() => {
    if (history.data?.team) setTeamName(history.data.team.name);
  }, [history.data?.team]);
  const save = useMutation({ mutationFn: () => api('/auth/me', { method: 'PATCH', body: { ...form, avatarUrl: form.avatarUrl || null, favouriteClubId: form.favouriteClubId || null } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }) });
  const rename = useMutation({ mutationFn: () => api('/fantasy/team', { method: 'PATCH', body: { name: teamName } }), onSuccess: () => qc.invalidateQueries({ queryKey: ['fantasy'] }) });
  const changePw = useMutation({ mutationFn: () => api('/auth/change-password', { body: pw }), onSuccess: () => setPw({ currentPassword: '', newPassword: '' }) });
  if (!user) return null;
  return (
    <div>
      <PageHeader title="Profile & settings" subtitle={`${ROLE_LABELS[user.role]} · member since ${date(user.createdAt)}`} actions={user.canAccessOps && <Link to="/ops" className="btn-gold">Open Data Ops</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card space-y-4 p-5">
          <div className="flex items-center gap-4">
            <Avatar name={form.displayName || user.displayName} color={form.avatarColor} url={form.avatarUrl || null} size={64} />
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button key={c} onClick={() => setForm({ ...form, avatarColor: c })} style={{ background: c }} className={`h-7 w-7 rounded-full ring-offset-2 ${form.avatarColor === c ? 'ring-2 ring-gold' : ''}`} aria-label={`Avatar colour ${c}`} />
              ))}
            </div>
          </div>
          <Field label="Display name">
            <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
          </Field>
          <Field label="Avatar image URL (optional)">
            <input className="input" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Favourite club">
            <select className="input" value={form.favouriteClubId} onChange={(e) => setForm({ ...form, favouriteClubId: e.target.value })}>
              <option value="">None</option>
              {clubs.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-pitch" checked={form.notifyGoals} onChange={(e) => setForm({ ...form, notifyGoals: e.target.checked })} /> Notify me when my players score or are sent off
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-pitch" checked={form.notifyDeadlines} onChange={(e) => setForm({ ...form, notifyDeadlines: e.target.checked })} /> Gameweek reminders
          </label>
          <ErrorBox error={save.error} />
          <button className="btn-primary" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isSuccess ? 'Saved' : 'Save profile'}
          </button>
        </section>
        <div className="space-y-6">
          {history.data?.team && (
            <section className="card space-y-3 p-5">
              <Field label="Fantasy team name">
                <input className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={30} />
              </Field>
              <ErrorBox error={rename.error} />
              <button className="btn-ghost" onClick={() => rename.mutate()} disabled={teamName.length < 3}>
                {rename.isSuccess ? 'Renamed' : 'Rename team'}
              </button>
            </section>
          )}
          <section className="card space-y-3 p-5">
            <h2 className="font-display font-bold">Change password</h2>
            <input className="input" type="password" placeholder="Current password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />
            <input className="input" type="password" placeholder="New password (8+ characters)" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />
            <ErrorBox error={changePw.error} />
            {changePw.isSuccess && <p className="text-sm text-pitch">Password changed.</p>}
            <button className="btn-ghost" onClick={() => changePw.mutate()} disabled={pw.newPassword.length < 8}>
              Update password
            </button>
          </section>
        </div>
      </div>
      <section className="card mt-6 overflow-x-auto p-4">
        <h2 className="mb-2 font-display text-lg font-bold">Season history</h2>
        <table className="table">
          <thead>
            <tr>
              <th>GW</th>
              <th className="text-right">Points</th>
              <th className="text-right">Confirmed</th>
              <th className="text-right">Average</th>
              <th className="text-right">Transfers</th>
              <th className="text-right">Hits</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.gameweeks.map((g) => (
              <tr key={g.gameweek}>
                <td>{g.gameweek}</td>
                <td className="text-right font-bold">{g.points}</td>
                <td className="text-right text-pitch">{g.confirmed}</td>
                <td className="text-right text-ink/60">{g.average}</td>
                <td className="text-right">{g.transfers}</td>
                <td className="text-right text-clay">{g.transferCost ? `-${g.transferCost}` : ''}</td>
                <td className="text-right font-display font-bold">{g.total}</td>
              </tr>
            ))}
            {!history.data?.gameweeks.length && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-ink/50">
                  No gameweeks played yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
