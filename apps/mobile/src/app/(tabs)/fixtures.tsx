import { colors, dateTime, dayLabel, useFixtures, useGameweeks, useMeta, type Fixture } from '@kiwanja/client';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FixtureRow } from '@/components/FixtureRow';
import { Card, Empty, Ionicons, Loading, Screen, type } from '@/components/ui';

export default function Fixtures() {
  const meta = useMeta();
  const gws = useGameweeks();
  const [gw, setGw] = useState<number>(meta.data?.currentGameweek?.number ?? 1);
  useEffect(() => {
    if (meta.data?.currentGameweek) setGw(meta.data.currentGameweek.number);
  }, [meta.data?.currentGameweek?.number]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, isLoading, refetch, isRefetching } = useFixtures(gw);
  const info = gws.data?.find((g) => g.number === gw);
  const max = gws.data?.length ?? 1;
  const byDay = new Map<string, Fixture[]>();
  for (const f of data ?? []) {
    const k = new Date(f.kickoffAt).toDateString();
    byDay.set(k, [...(byDay.get(k) ?? []), f]);
  }
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <View style={styles.switcher}>
        <Pressable disabled={gw <= 1} onPress={() => setGw(gw - 1)} hitSlop={10} accessibilityLabel="Previous gameweek" style={gw <= 1 && { opacity: 0.3 }}>
          <Ionicons name="chevron-back" size={22} color={colors.white} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.gwName}>{info?.name ?? `Gameweek ${gw}`}</Text>
          {info && (
            <Text style={styles.gwSub}>
              Deadline {dateTime(info.deadlineAt)} · {info.status.toLowerCase()}
            </Text>
          )}
        </View>
        <Pressable disabled={gw >= max} onPress={() => setGw(gw + 1)} hitSlop={10} accessibilityLabel="Next gameweek" style={gw >= max && { opacity: 0.3 }}>
          <Ionicons name="chevron-forward" size={22} color={colors.white} />
        </Pressable>
      </View>
      {isLoading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="No fixtures in this gameweek" />
      ) : (
        [...byDay.entries()].map(([day, list]) => (
          <Card key={day} style={{ paddingVertical: 8 }}>
            <Text style={[type.label, { marginLeft: 4, marginTop: 4 }]}>{dayLabel(day)}</Text>
            {list.map((f) => (
              <FixtureRow key={f.id} f={f} />
            ))}
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.ink, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  gwName: { color: colors.white, fontWeight: '800', fontSize: 16 },
  gwSub: { color: 'rgba(255,255,255,.6)', fontSize: 11, marginTop: 2 },
});
