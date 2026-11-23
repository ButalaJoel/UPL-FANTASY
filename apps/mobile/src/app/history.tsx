import { colors, useFantasyHistory } from '@kiwanja/client';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Empty, Loading, Row, Screen, type } from '@/components/ui';

export default function History() {
  const { data, isLoading, refetch, isRefetching } = useFantasyHistory();
  if (isLoading) return <Loading />;
  const rows = data?.gameweeks ?? [];
  const max = Math.max(1, ...rows.map((g) => Math.max(g.points - g.transferCost, g.average)));
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      {!rows.length ? (
        <Empty title="No gameweeks yet">Your points appear here once your first gameweek starts.</Empty>
      ) : (
        <Card>
          <Row style={{ marginBottom: 8, gap: 14 }}>
            <Row style={{ gap: 4 }}>
              <View style={[styles.key, { backgroundColor: colors.pitch }]} />
              <Text style={type.small}>You</Text>
            </Row>
            <Row style={{ gap: 4 }}>
              <View style={[styles.key, { backgroundColor: colors.line }]} />
              <Text style={type.small}>Average</Text>
            </Row>
          </Row>
          {rows.map((g) => {
            const net = g.points - g.transferCost;
            return (
              <View key={g.gameweekId} style={styles.row}>
                <Text style={styles.gw}>GW{g.gameweek}</Text>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={[styles.bar, { width: `${(Math.max(net, 0) / max) * 100}%`, backgroundColor: colors.pitch }]} />
                  <View style={[styles.bar, { width: `${(g.average / max) * 100}%`, backgroundColor: colors.line }]} />
                </View>
                <View style={{ width: 64, alignItems: 'flex-end' }}>
                  <Text style={styles.pts}>{net}</Text>
                  <Text style={type.small}>{g.transferCost ? `-${g.transferCost} hits · ` : ''}Σ {g.total}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  gw: { width: 38, fontWeight: '700', color: colors.muted, fontSize: 12 },
  bar: { height: 8, borderRadius: 4, minWidth: 2 },
  key: { width: 10, height: 10, borderRadius: 2 },
  pts: { fontWeight: '800', fontSize: 16, fontVariant: ['tabular-nums'], color: colors.ink },
});
