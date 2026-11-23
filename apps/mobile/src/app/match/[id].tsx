import { colors, dateTime, describeEvent, EVENT_ICON, isLive, keyEvents, statLabel, STATUS_LABEL, TEAM_STAT_KEYS, unverifiedCount, useMatch, useMatchClock, useMatchRoom, type MatchStateResponse } from '@kiwanja/client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ClubCrest } from '@/components/brand';
import { Card, Empty, ErrorView, Loading, OriginChip, Row, Screen, Segmented, StatusChip, type } from '@/components/ui';

export default function MatchCentre() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useMatchRoom(id);
  const { data, isLoading, error, refetch, isRefetching } = useMatch(id);
  const clock = useMatchClock(data);
  const [tab, setTab] = useState<'timeline' | 'lineups' | 'stats' | 'points'>('timeline');
  if (isLoading) return <Loading />;
  if (error || !data) return <Screen><ErrorView error={error} onRetry={refetch} /></Screen>;
  const f = data.fixture;
  const live = isLive(f.status);
  const pending = unverifiedCount(data.events);
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: `${f.homeClub.shortName} v ${f.awayClub.shortName}` }} />
      <View style={styles.header}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text style={styles.meta} numberOfLines={1}>
            {f.gameweek?.name} · {dateTime(f.kickoffAt)}
          </Text>
          <OriginChip origin={f.origin} />
        </Row>
        <View style={styles.scoreRow}>
          <View style={styles.team}>
            <ClubCrest club={f.homeClub} size={52} />
            <Text style={styles.teamName} numberOfLines={2}>
              {f.homeClub.name}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.score}>
              {f.homeScore} <Text style={{ color: 'rgba(255,255,255,.3)' }}>-</Text> {f.awayScore}
            </Text>
            <View style={[styles.status, live && { backgroundColor: colors.clay }]}>
              <Text style={styles.statusText}>{f.status === 'FIRST_HALF' || f.status === 'SECOND_HALF' ? `● ${clock.label}` : STATUS_LABEL[f.status]}</Text>
            </View>
          </View>
          <View style={styles.team}>
            <ClubCrest club={f.awayClub} size={52} />
            <Text style={styles.teamName} numberOfLines={2}>
              {f.awayClub.name}
            </Text>
          </View>
        </View>
        <Text style={styles.source}>
          {f.venue ? `${f.venue} · ` : ''}Source: {f.source?.name ?? 'Kiwanja analysts'}
          {pending > 0 ? ` · ${pending} event(s) awaiting verification` : ''}
        </Text>
      </View>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'timeline', label: 'Timeline' },
          { value: 'lineups', label: 'Line-ups' },
          { value: 'stats', label: 'Stats' },
          { value: 'points', label: 'Points' },
        ]}
      />
      {tab === 'timeline' && <Timeline data={data} />}
      {tab === 'lineups' && <Lineups data={data} />}
      {tab === 'stats' && <TeamStats data={data} />}
      {tab === 'points' && <Points data={data} />}
    </Screen>
  );
}

function Timeline({ data }: { data: MatchStateResponse }) {
  const events = [...keyEvents(data.events)].reverse();
  if (!events.length) return <Empty title="No events yet">Events appear here the moment our analysts log them.</Empty>;
  return (
    <Card style={{ paddingVertical: 8 }}>
      {events.map((e) => {
        const d = describeEvent(e);
        const away = e.side === 'AWAY';
        if (d.kind === 'period')
          return (
            <View key={e.id} style={styles.period}>
              <Text style={{ fontWeight: '800', textTransform: 'capitalize', color: colors.muted }}>
                {EVENT_ICON[e.code]} {d.main}
              </Text>
            </View>
          );
        return (
          <View key={e.id} style={[styles.event, away && { flexDirection: 'row-reverse' }]}>
            <Text style={styles.minute}>{e.minute}'</Text>
            <Text style={{ fontSize: 18 }}>{EVENT_ICON[e.code] ?? '•'}</Text>
            <View style={{ flex: 1, alignItems: away ? 'flex-end' : 'flex-start' }}>
              <Text style={[type.h3, d.kind === 'sub' && { color: colors.pitch }]}>{d.main}</Text>
              {d.detail ? <Text style={[type.small, d.kind === 'sub' && { color: colors.clay }]}>{d.detail}</Text> : null}
            </View>
            <StatusChip status={e.status} />
          </View>
        );
      })}
    </Card>
  );
}

function Lineups({ data }: { data: MatchStateResponse }) {
  const f = data.fixture;
  return (
    <>
      {(['HOME', 'AWAY'] as const).map((side) => {
        const club = side === 'HOME' ? f.homeClub : f.awayClub;
        const rows = data.squad.filter((s) => s.side === side);
        return (
          <Card key={side}>
            <Row style={{ marginBottom: 6 }}>
              <ClubCrest club={club} size={24} />
              <Text style={type.h2}>{club.name}</Text>
            </Row>
            {!rows.length && <Text style={type.small}>Line-up not registered yet.</Text>}
            {[true, false].map((starter) =>
              rows.some((r) => r.isStarter === starter) ? (
                <View key={String(starter)} style={{ marginTop: 6 }}>
                  <Text style={type.label}>{starter ? 'Starting XI' : 'Substitutes'}</Text>
                  {rows
                    .filter((r) => r.isStarter === starter)
                    .map((r) => (
                      <Pressable key={r.id} onPress={() => router.push(`/player/${r.playerId}`)} style={styles.lineupRow}>
                        <Text style={styles.shirtNo}>{r.shirtNumber ?? ''}</Text>
                        <Text style={styles.pos}>{r.position}</Text>
                        <Text style={type.body}>
                          {r.player.firstName} {r.player.lastName}
                        </Text>
                      </Pressable>
                    ))}
                </View>
              ) : null,
            )}
          </Card>
        );
      })}
    </>
  );
}

function TeamStats({ data }: { data: MatchStateResponse }) {
  const f = data.fixture;
  return (
    <Card>
      {TEAM_STAT_KEYS.map((k) => {
        const h = data.teamStats.provisional.HOME?.[k] ?? 0;
        const a = data.teamStats.provisional.AWAY?.[k] ?? 0;
        const total = h + a || 1;
        return (
          <View key={k} style={{ paddingVertical: 7 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={styles.statNum}>{h}</Text>
              <Text style={type.label}>{statLabel(k)}</Text>
              <Text style={styles.statNum}>{a}</Text>
            </Row>
            <View style={styles.barTrack}>
              <View style={{ flex: h / total, backgroundColor: f.homeClub.primaryColor, borderRadius: 3 }} />
              <View style={{ flex: a / total, backgroundColor: f.awayClub.primaryColor, borderRadius: 3 }} />
            </View>
          </View>
        );
      })}
      <Text style={[type.small, { marginTop: 8 }]}>Collected by Kiwanja analysts. Possession and tracking data are not collected yet.</Text>
    </Card>
  );
}

function Points({ data }: { data: MatchStateResponse }) {
  if (!data.points.length) return <Empty title="No fantasy points yet">Points appear once the match kicks off.</Empty>;
  return (
    <Card style={{ paddingVertical: 6 }}>
      {data.points.map((p) => (
        <Pressable key={p.playerId} onPress={() => router.push(`/player/${p.playerId}`)} style={styles.pointsRow}>
          <View style={{ flex: 1 }}>
            <Text style={type.h3}>
              {p.player.firstName[0]}. {p.player.lastName} <Text style={type.small}>{p.minutes}'</Text>
            </Text>
            <Text style={type.small} numberOfLines={2}>
              {p.provisionalBreakdown.map((l) => `${l.label} ${l.points > 0 ? '+' : ''}${l.points}`).join(' · ')}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.statNum}>{p.provisionalPoints}</Text>
            {p.confirmedPoints !== p.provisionalPoints && <Text style={{ fontSize: 11, color: colors.pitch }}>{p.confirmedPoints}✓</Text>}
          </View>
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.ink, borderRadius: 24, padding: 16, gap: 12 },
  meta: { color: 'rgba(255,255,255,.6)', fontSize: 12, flex: 1 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: colors.white, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  score: { color: colors.white, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  status: { marginTop: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(255,255,255,.12)' },
  statusText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  source: { color: 'rgba(255,255,255,.5)', fontSize: 11, textAlign: 'center' },
  period: { alignItems: 'center', backgroundColor: colors.faint, borderRadius: 10, paddingVertical: 6, marginVertical: 4 },
  event: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  minute: { width: 34, textAlign: 'center', fontWeight: '800', color: colors.muted, fontVariant: ['tabular-nums'] },
  lineupRow: { flexDirection: 'row', gap: 8, paddingVertical: 5, alignItems: 'center' },
  shirtNo: { width: 22, textAlign: 'right', color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  pos: { width: 32, color: colors.muted, fontSize: 11, fontWeight: '700' },
  statNum: { fontWeight: '800', fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  barTrack: { flexDirection: 'row', height: 6, gap: 3 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
