import { colors, useGameweeks, useTeamView } from '@kiwanja/client';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Avatar } from '@/components/brand';
import { PointsView } from '@/components/TeamViews';
import { Empty, ErrorView, Loading, Row, Screen, Stat, StatGrid, type } from '@/components/ui';

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [gw, setGw] = useState<number | null>(null);
  const gws = useGameweeks();
  const { data, isLoading, error, refetch, isRefetching } = useTeamView(id, gw);
  if (isLoading) return <Loading />;
  if (error || !data) return <Screen><ErrorView error={error} onRetry={refetch} /></Screen>;
  const played = gws.data?.filter((g) => g.status !== 'UPCOMING') ?? [];
  const selected = gw ?? data.gameweek?.number;
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: data.team.name }} />
      <Row style={{ gap: 12 }}>
        <Avatar name={data.team.user.displayName} color={data.team.user.avatarColor} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={type.h2}>{data.team.name}</Text>
          <Text style={type.small}>
            {data.team.user.displayName} · {data.team.totalPoints} pts · rank #{data.rank}
          </Text>
        </View>
      </Row>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {played.map((g) => (
          <Pressable key={g.id} onPress={() => setGw(g.number)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: g.number === selected ? colors.ink : colors.faint }}>
            <Text style={{ fontWeight: '800', fontSize: 12, color: g.number === selected ? colors.white : colors.ink }}>GW{g.number}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {data.view && data.view.picks.length ? (
        <>
          <StatGrid>
            <Stat accent label={`${data.gameweek?.name} points`} value={data.view.score?.net ?? 0} />
            <Stat label="Confirmed" value={(data.view.score?.confirmed ?? 0) - (data.view.score?.transferCost ?? 0)} />
          </StatGrid>
          <PointsView view={data.view} />
        </>
      ) : (
        <Empty title="No line-up for this gameweek" />
      )}
    </Screen>
  );
}
