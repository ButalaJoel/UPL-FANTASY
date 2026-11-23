import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ClubCrest } from '../../components/brand';
import { Empty, ErrorBox, Loading, OriginBadge, StatusChip, Tabs } from '../../components/ui';
import { useMatchRoom } from '../../hooks/live';
import { api } from '../../lib/api';
import { STATUS_LABEL, dateTime, isLive } from '../../lib/format';
import { EVENT_ICON, useMatchClock, type MatchEventRow, type MatchStateResponse } from '../../lib/match';

const label = (e: MatchEventRow) => {
  const n = (p: MatchEventRow['player']) => (p ? `${p.firstName[0]}. ${p.lastName}` : '');
  switch (e.code) {
    case 'GOAL':
      return (
        <>
          <b>{n(e.player)}</b> {e.secondaryPlayer && <span className="text-ink/60">assist {n(e.secondaryPlayer)}</span>}
        </>
      );
    case 'OWN_GOAL':
      return (
        <>
          <b>{n(e.player)}</b> <span className="text-ink/60">own goal</span>
        </>
      );
    case 'SUBSTITUTION':
      return (
        <>
          <span className="text-pitch">▲ {n(e.secondaryPlayer)}</span> <span className="text-clay">▼ {n(e.player)}</span>
        </>
      );
    default:
      return (
        <>
          {e.player ? <b>{n(e.player)}</b> : null} <span className="text-ink/60">{e.code.replace(/_/g, ' ').toLowerCase()}</span>
          {e.secondaryPlayer && <span className="text-ink/60"> ({n(e.secondaryPlayer)})</span>}
        </>
      );
  }
};

export function MatchCentrePage() {
  const { id } = useParams();
  useMatchRoom(id);
  const { data, isLoading, error } = useQuery({ queryKey: ['match', id], queryFn: () => api<MatchStateResponse>(`/matches/${id}`) });
  const clock = useMatchClock(data);
  const [tab, setTab] = useState<'timeline' | 'lineups' | 'stats' | 'points'>('timeline');
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const f = data.fixture;
  const live = isLive(f.status);
  const keyEvents = data.events.filter((e) => !['PASS_COMPLETE', 'PASS_FAILED', 'TACKLE', 'INTERCEPTION', 'CLEARANCE', 'FOUL', 'OFFSIDE', 'CORNER', 'KEY_PASS', 'BIG_CHANCE_CREATED', 'SHOT_OFF_TARGET', 'SHOT_BLOCKED'].includes(e.code));
  const pending = data.events.filter((e) => e.status === 'PENDING' || e.status === 'DISPUTED').length;
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl bg-ink text-white shadow-card">
        <div className="flex items-center justify-between px-5 pt-4 text-xs text-white/60">
          <span>{f.gameweek?.name} · {dateTime(f.kickoffAt)} · {f.venue}</span>
          <OriginBadge origin={f.origin} />
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-6">
          <div className="flex flex-col items-center gap-2 text-center">
            <ClubCrest club={f.homeClub} size={56} />
            <span className="font-display text-sm font-bold md:text-lg">{f.homeClub.name}</span>
          </div>
          <div className="text-center">
            <div className="font-display text-5xl font-extrabold tabular-nums md:text-6xl">
              {f.homeScore}
              <span className="mx-2 text-white/30">-</span>
              {f.awayScore}
            </div>
            <div className={clsx('mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold', live ? 'bg-clay' : 'bg-white/10')}>
              {live && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
              {f.status === 'FIRST_HALF' || f.status === 'SECOND_HALF' ? clock.label : STATUS_LABEL[f.status]}
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <ClubCrest club={f.awayClub} size={56} />
            <span className="font-display text-sm font-bold md:text-lg">{f.awayClub.name}</span>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-2 text-center text-[11px] text-white/50">
          Source: {f.source?.name ?? 'Kiwanja analysts'} {pending > 0 && <>· {pending} event(s) awaiting verification (provisional)</>}
        </div>
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'timeline', label: 'Timeline' },
          { value: 'lineups', label: 'Line-ups' },
          { value: 'stats', label: 'Stats' },
          { value: 'points', label: 'Fantasy points' },
        ]}
      />

      {tab === 'timeline' && (
        <section className="card p-4">
          {keyEvents.length === 0 ? (
            <Empty title="No events yet">Events appear here the moment our analysts log them.</Empty>
          ) : (
            <ol className="space-y-1">
              {[...keyEvents].reverse().map((e) => (
                <li key={e.id} className={clsx('flex items-center gap-3 rounded-xl px-2 py-2', e.side === 'AWAY' && 'flex-row-reverse text-right', !e.side && 'justify-center bg-ink/5')}>
                  <span className="w-10 shrink-0 text-center font-mono text-sm font-bold text-ink/60">{e.minute}'</span>
                  <span className="text-lg">{EVENT_ICON[e.code] ?? '•'}</span>
                  <span className="min-w-0 flex-1 text-sm">{e.side ? label(e) : <b>{e.code.replace(/_/g, ' ').toLowerCase()}</b>}</span>
                  {e.side && <StatusChip status={e.status} />}
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {tab === 'lineups' && (
        <div className="grid gap-4 md:grid-cols-2">
          {(['HOME', 'AWAY'] as const).map((side) => {
            const club = side === 'HOME' ? f.homeClub : f.awayClub;
            const rows = data.squad.filter((s) => s.side === side);
            return (
              <section key={side} className="card p-4">
                <h3 className="mb-2 flex items-center gap-2 font-display font-bold">
                  <ClubCrest club={club} size={24} /> {club.name}
                </h3>
                {rows.length === 0 && <p className="text-sm text-ink/50">Line-up not yet registered.</p>}
                {[true, false].map((starter) => (
                  <div key={String(starter)} className="mb-2">
                    {rows.some((r) => r.isStarter === starter) && <div className="mb-1 mt-2 text-xs font-bold uppercase text-ink/40">{starter ? 'Starting XI' : 'Substitutes'}</div>}
                    {rows
                      .filter((r) => r.isStarter === starter)
                      .map((r) => (
                        <Link key={r.id} to={`/players/${r.playerId}`} className="flex items-center gap-2 rounded-lg px-1 py-1 text-sm hover:bg-ink/5">
                          <span className="w-6 text-right font-mono text-xs text-ink/50">{r.shirtNumber}</span>
                          <span className="w-8 text-xs font-semibold text-ink/40">{r.position}</span>
                          <span className="flex-1">
                            {r.player.firstName} {r.player.lastName}
                          </span>
                        </Link>
                      ))}
                  </div>
                ))}
              </section>
            );
          })}
        </div>
      )}

      {tab === 'stats' && (
        <section className="card p-4">
          {(['goals', 'shotsOnTarget', 'shotsOffTarget', 'corners', 'saves', 'fouls', 'offsides', 'yellowCards', 'redCards', 'passesCompleted', 'tackles', 'interceptions'] as const).map((k) => {
            const h = data.teamStats.provisional.HOME?.[k] ?? 0;
            const a = data.teamStats.provisional.AWAY?.[k] ?? 0;
            const total = h + a || 1;
            return (
              <div key={k} className="py-2">
                <div className="mb-1 flex justify-between text-sm">
                  <b className="tabular-nums">{h}</b>
                  <span className="text-xs font-semibold uppercase text-ink/50">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <b className="tabular-nums">{a}</b>
                </div>
                <div className="flex h-1.5 gap-1 overflow-hidden rounded-full">
                  <div style={{ width: `${(h / total) * 100}%`, background: f.homeClub.primaryColor }} className="rounded-full" />
                  <div style={{ width: `${(a / total) * 100}%`, background: f.awayClub.primaryColor }} className="rounded-full" />
                </div>
              </div>
            );
          })}
          <p className="mt-3 text-xs text-ink/50">Statistics are collected by Kiwanja analysts. Possession and tracking metrics are not collected yet.</p>
        </section>
      )}

      {tab === 'points' && (
        <section className="card overflow-x-auto p-4">
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="text-right">Min</th>
                <th>Breakdown</th>
                <th className="text-right">Prov.</th>
                <th className="text-right">Conf.</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((p) => (
                <tr key={p.playerId}>
                  <td>
                    <Link to={`/players/${p.playerId}`} className="font-semibold hover:text-pitch">
                      {p.player.firstName[0]}. {p.player.lastName}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{p.minutes}</td>
                  <td className="whitespace-normal text-xs text-ink/60">{p.provisionalBreakdown.map((l) => `${l.label} ${l.points > 0 ? '+' : ''}${l.points}`).join(' · ')}</td>
                  <td className="text-right font-bold tabular-nums">{p.provisionalPoints}</td>
                  <td className="text-right tabular-nums text-pitch">{p.confirmedPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
