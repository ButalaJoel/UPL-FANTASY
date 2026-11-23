import { useQuery } from '@tanstack/react-query';
import { POSITION_LABELS } from '@kiwanja/core';
import { Link, useParams } from 'react-router-dom';
import { ClubCrest, Shirt } from '../../components/brand';
import { ErrorBox, Loading, OriginBadge, Stat } from '../../components/ui';
import type { Fixture, Player, PlayerStats } from '../../hooks/data';
import { api } from '../../lib/api';
import { date, dateTime, price } from '../../lib/format';

interface PlayerResponse {
  player: Player & { nationality: string | null; source: { name: string; kind: string } | null; priceChanges: { id: string; oldPrice: number; newPrice: number; reason: string; createdAt: string }[] };
  stats: PlayerStats;
  history: { fixtureId: string; provisionalPoints: number; confirmedPoints: number; minutes: number; fixture: Fixture & { gameweek: { number: number } | null }; stat: { goals: number; assists: number; yellowCards: number; redCards: number; cleanSheet: number; saves: number } | null }[];
  upcoming: (Fixture & { gameweek: { number: number } | null })[];
}

export function PlayerPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useQuery({ queryKey: ['player', id], queryFn: () => api<PlayerResponse>(`/players/${id}`) });
  if (isLoading) return <Loading />;
  if (error || !data) return <ErrorBox error={error} />;
  const { player: p, stats: s } = data;
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-3xl text-white shadow-card" style={{ background: `linear-gradient(135deg, ${p.club.primaryColor}, #0B1A14 70%)` }}>
        <div className="flex flex-wrap items-center gap-5 p-6">
          <div className="rounded-2xl bg-white/10 p-3">
            <Shirt primary={p.club.primaryColor} secondary={p.club.secondaryColor} gk={p.position === 'GK'} size={84} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm text-white/70">
              <ClubCrest club={p.club} size={22} /> {p.club.name} · #{p.shirtNumber ?? '-'}
            </div>
            <h1 className="mt-1 font-display text-3xl font-extrabold">
              {p.firstName} {p.lastName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="chip bg-white/15 text-white">{POSITION_LABELS[p.position]}</span>
              <span className="chip bg-gold text-ink">{price(p.price)}</span>
              <span className={`chip ${p.status === 'AVAILABLE' ? 'bg-pitch text-white' : 'bg-clay text-white'}`}>{p.status.toLowerCase()}</span>
              <OriginBadge origin={p.origin} />
            </div>
            {p.statusNote && <p className="mt-2 text-sm text-white/80">{p.statusNote}</p>}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <Stat accent label="Total points" value={s.totalPoints} hint={`${s.confirmedPoints} confirmed`} />
        <Stat label="Form" value={s.form} hint="avg last 3" />
        <Stat label="Goals" value={s.goals} />
        <Stat label="Assists" value={s.assists} />
        <Stat label="Appearances" value={s.appearances} hint={`${s.minutes} minutes`} />
        <Stat label="Clean sheets" value={s.cleanSheets} />
        <Stat label="Yellow / red" value={`${s.yellowCards} / ${s.redCards}`} />
        <Stat label="Saves" value={s.saves} />
        <Stat label="Shots on target" value={s.shotsOnTarget} />
        <Stat label="Selected by" value={`${s.selectedByPct}%`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-x-auto p-4">
          <h2 className="mb-2 font-display text-lg font-bold">Match history</h2>
          <table className="table">
            <thead>
              <tr>
                <th>GW</th>
                <th>Match</th>
                <th className="text-right">Min</th>
                <th className="text-right">G</th>
                <th className="text-right">A</th>
                <th className="text-right">CS</th>
                <th className="text-right">Cards</th>
                <th className="text-right">Pts</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.fixtureId}>
                  <td>{h.fixture.gameweek?.number}</td>
                  <td>
                    <Link to={`/match/${h.fixtureId}`} className="hover:text-pitch">
                      {h.fixture.homeClub.shortName} {h.fixture.homeScore}-{h.fixture.awayScore} {h.fixture.awayClub.shortName}
                    </Link>
                  </td>
                  <td className="text-right tabular-nums">{h.minutes}</td>
                  <td className="text-right">{h.stat?.goals ?? 0}</td>
                  <td className="text-right">{h.stat?.assists ?? 0}</td>
                  <td className="text-right">{h.stat?.cleanSheet && h.minutes >= 60 ? 1 : 0}</td>
                  <td className="text-right">{(h.stat?.yellowCards ?? 0) ? '🟨' : ''}{(h.stat?.redCards ?? 0) ? '🟥' : ''}</td>
                  <td className="text-right font-bold">
                    {h.provisionalPoints}
                    {h.confirmedPoints !== h.provisionalPoints && <span className="ml-1 text-xs text-ink/40">({h.confirmedPoints}✓)</span>}
                  </td>
                </tr>
              ))}
              {!data.history.length && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-ink/50">
                    No appearances yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
        <div className="space-y-6">
          <section className="card p-4">
            <h2 className="mb-2 font-display text-lg font-bold">Upcoming fixtures</h2>
            {data.upcoming.map((f) => {
              const home = f.homeClubId === p.clubId;
              const opp = home ? f.awayClub : f.homeClub;
              return (
                <div key={f.id} className="flex items-center gap-3 py-1.5 text-sm">
                  <span className="w-10 text-xs text-ink/50">GW{f.gameweek?.number}</span>
                  <ClubCrest club={opp} size={22} />
                  <span className="flex-1 font-semibold">
                    {opp.name} ({home ? 'H' : 'A'})
                  </span>
                  <span className="text-xs text-ink/50">{dateTime(f.kickoffAt)}</span>
                </div>
              );
            })}
          </section>
          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-display text-lg font-bold">Data source</h2>
            <p className="text-ink/70">{p.source?.name ?? 'Manually entered'}</p>
            {p.priceChanges.length > 0 && (
              <>
                <h3 className="mb-1 mt-3 text-xs font-bold uppercase text-ink/50">Price changes</h3>
                {p.priceChanges.map((c) => (
                  <div key={c.id} className="flex justify-between text-xs">
                    <span>{date(c.createdAt)} · {c.reason}</span>
                    <span className={c.newPrice > c.oldPrice ? 'text-pitch' : 'text-clay'}>
                      {price(c.oldPrice)} → {price(c.newPrice)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
