import { colors, useLeague, type H2HData, type Standings } from '@kiwanja/client';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/brand';
import { Button, Card, ErrorView, Loading, Row, Screen, type } from '@/components/ui';

export default function LeagueScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error, refetch, isRefetching } = useLeague(id);
  if (isLoading) return <Loading />;
  if (error || !data) return <Screen><ErrorView error={error} onRetry={refetch} /></Screen>;
  const l = data.league;
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: l.name }} />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={type.small}>
          {l.type === 'H2H' ? 'Head-to-head' : 'Classic'} · {l._count.members} teams
          {!l.isSystem ? ` · code ${l.code}` : ''}
        </Text>
        {!l.isSystem && <Button small variant="ghost" icon="share-social-outline" title="Invite" onPress={() => Share.share({ message: `Join my Kiwanja fantasy league "${l.name}" with code ${l.code}` })} />}
      </Row>
      {data.standings && <ClassicTable s={data.standings} />}
      {data.h2h && <H2HView h={data.h2h} />}
    </Screen>
  );
}

function ClassicTable({ s }: { s: Standings }) {
  return (
    <Card style={{ paddingVertical: 6 }}>
      <Row style={styles.head}>
        <Text style={[type.label, { width: 30 }]}>#</Text>
        <Text style={[type.label, { flex: 1 }]}>Team</Text>
        <Text style={[type.label, styles.num]}>GW{s.gameweek?.number}</Text>
        <Text style={[type.label, styles.num]}>Total</Text>
      </Row>
      {s.rows.map((r) => (
        <Pressable key={r.teamId} onPress={() => router.push(`/team/${r.teamId}`)} style={styles.row}>
          <Text style={[styles.rank]}>{r.rank}</Text>
          <Avatar name={r.manager.displayName} color={r.manager.avatarColor} size={28} />
          <View style={{ flex: 1 }}>
            <Text style={type.h3} numberOfLines={1}>
              {r.teamName}
            </Text>
            <Text style={type.small} numberOfLines={1}>
              {r.manager.displayName}
            </Text>
          </View>
          <Text style={[styles.num, type.body]}>{r.gameweekPoints}</Text>
          <Text style={[styles.num, styles.total]}>{r.totalPoints}</Text>
        </Pressable>
      ))}
      {s.total > s.rows.length && <Text style={[type.small, { textAlign: 'center', padding: 8 }]}>Top {s.rows.length} of {s.total}</Text>}
    </Card>
  );
}

function H2HView({ h }: { h: H2HData }) {
  const gws = [...new Set(h.matches.map((m) => m.gameweekNumber))];
  const [gw, setGw] = useState<number>(h.matches.find((m) => !m.finished)?.gameweekNumber ?? gws[gws.length - 1] ?? 1);
  const name = (id: string | null) => (id ? h.teams[id]?.name ?? '?' : 'League average');
  return (
    <>
      <Card style={{ paddingVertical: 6 }}>
        <Row style={styles.head}>
          <Text style={[type.label, { flex: 1 }]}>Team</Text>
          {['P', 'W', 'D', 'L', 'Pts'].map((k) => (
            <Text key={k} style={[type.label, styles.small]}>
              {k}
            </Text>
          ))}
        </Row>
        {h.table.map((r, i) => (
          <Pressable key={r.teamId} onPress={() => router.push(`/team/${r.teamId}`)} style={styles.row}>
            <Text style={styles.rank}>{i + 1}</Text>
            <Text style={[type.h3, { flex: 1 }]} numberOfLines={1}>
              {name(r.teamId)}
            </Text>
            <Text style={styles.small}>{r.played}</Text>
            <Text style={styles.small}>{r.won}</Text>
            <Text style={styles.small}>{r.drawn}</Text>
            <Text style={styles.small}>{r.lost}</Text>
            <Text style={[styles.small, styles.total]}>{r.leaguePoints}</Text>
          </Pressable>
        ))}
        {!h.matches.length && <Text style={[type.small, { padding: 10, textAlign: 'center' }]}>The schedule is drawn when the league's first gameweek starts.</Text>}
      </Card>
      {gws.length > 0 && (
        <Card>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 8 }}>
            {gws.map((g) => (
              <Pressable key={g} onPress={() => setGw(g)} style={[styles.gwPill, g === gw && { backgroundColor: colors.ink }]}>
                <Text style={{ fontWeight: '800', fontSize: 12, color: g === gw ? colors.white : colors.ink }}>GW{g}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {h.matches
            .filter((m) => m.gameweekNumber === gw)
            .map((m) => (
              <Row key={m.id} style={{ paddingVertical: 8 }}>
                <Text style={[type.h3, { flex: 1, textAlign: 'right' }]} numberOfLines={1}>
                  {name(m.teamAId)}
                </Text>
                <View style={[styles.score, m.live ? { backgroundColor: colors.clay } : m.finished ? { backgroundColor: colors.ink } : null]}>
                  <Text style={{ fontWeight: '800', color: m.live || m.finished ? colors.white : colors.ink, fontVariant: ['tabular-nums'] }}>{m.finished || m.live ? `${m.scoreA} - ${m.scoreB}` : 'v'}</Text>
                </View>
                <Text style={[type.h3, { flex: 1 }]} numberOfLines={1}>
                  {name(m.teamBId)}
                </Text>
              </Row>
            ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  head: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rank: { width: 24, textAlign: 'center', fontWeight: '800', color: colors.muted },
  num: { width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  small: { width: 28, textAlign: 'right', fontVariant: ['tabular-nums'], color: colors.ink },
  total: { fontWeight: '900', fontSize: 15, color: colors.ink },
  gwPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: colors.faint },
  score: { minWidth: 54, alignItems: 'center', paddingVertical: 4, borderRadius: 8, backgroundColor: colors.faint },
});
