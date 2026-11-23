import { colors, useCup } from '@kiwanja/client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card, ErrorView, Ionicons, Loading, Row, Screen, Segmented, type } from '@/components/ui';

export default function CupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error, refetch, isRefetching } = useCup(id);
  const [round, setRound] = useState('1');
  if (isLoading) return <Loading />;
  if (error || !data) return <Screen><ErrorView error={error} onRetry={refetch} /></Screen>;
  const rounds = [...new Set(data.fixtures.map((f) => f.round))];
  const name = (t: string | null) => (t ? data.teams[t]?.name ?? '?' : 'Bye');
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: data.cup.name }} />
      <Text style={type.small}>
        {data.cup.method === 'SEEDED' ? 'Seeded' : 'Random'} draw · {data.cup.league?.name ?? 'Overall'} · starts GW{data.cup.startGameweek}
      </Text>
      {data.cup.winnerTeamId && (
        <Row style={styles.winner}>
          <Ionicons name="trophy" size={22} color={colors.ink} />
          <Text style={[type.h2]}>Winner: {name(data.cup.winnerTeamId)}</Text>
        </Row>
      )}
      {rounds.length > 4 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Segmented value={round} onChange={setRound} options={rounds.map((r) => ({ value: String(r), label: data.fixtures.find((f) => f.round === r)!.roundName }))} />
        </ScrollView>
      ) : (
        rounds.length > 0 && <Segmented value={round} onChange={setRound} options={rounds.map((r) => ({ value: String(r), label: data.fixtures.find((f) => f.round === r)!.roundName }))} />
      )}
      {data.fixtures
        .filter((f) => String(f.round) === round)
        .map((f) => (
          <Card key={f.id} style={{ padding: 12 }}>
            <Text style={[type.small, { marginBottom: 4 }]}>
              Gameweek {f.gameweekNumber} · {f.gameweekStatus.toLowerCase()}
            </Text>
            {(
              [
                [f.teamAId, f.seedA, f.liveA],
                [f.teamBId, f.seedB, f.liveB],
              ] as const
            ).map(([t, seed, score], i) => {
              const won = f.winnerId && f.winnerId === t;
              const lost = f.winnerId && f.winnerId !== t;
              return (
                <View key={i} style={styles.line}>
                  <Text style={[type.body, { flex: 1 }, won ? { fontWeight: '800', color: colors.pitch } : null, lost ? { color: colors.muted } : null]}>
                    <Text style={type.small}>{seed ?? ''} </Text>
                    {name(t)}
                  </Text>
                  <Text style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>{score ?? '-'}</Text>
                </View>
              );
            })}
          </Card>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  winner: { backgroundColor: colors.gold, borderRadius: 16, padding: 14 },
  line: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
});
