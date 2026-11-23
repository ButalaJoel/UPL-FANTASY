import { colors, date, dateTime, price, usePlayer } from '@kiwanja/client';
import { POSITION_LABELS } from '@kiwanja/core';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ClubCrest, Shirt } from '@/components/brand';
import { Card, Chip, ErrorView, Loading, OriginChip, Row, Screen, SectionTitle, Stat, StatGrid, type } from '@/components/ui';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error, refetch, isRefetching } = usePlayer(id);
  if (isLoading) return <Loading />;
  if (error || !data) return <Screen><ErrorView error={error} onRetry={refetch} /></Screen>;
  const { player: p, stats: s } = data;
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: p.lastName }} />
      <View style={[styles.hero, { backgroundColor: p.club.primaryColor }]}>
        <View style={styles.heroShade} />
        <Shirt primary={p.club.primaryColor} secondary={p.club.secondaryColor} gk={p.position === 'GK'} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <Row>
            <ClubCrest club={p.club} size={18} />
            <Text style={styles.heroSub}>
              {p.club.name} · #{p.shirtNumber ?? '-'}
            </Text>
          </Row>
          <Text style={styles.heroName}>
            {p.firstName} {p.lastName}
          </Text>
          <Row style={{ flexWrap: 'wrap' }}>
            <Chip label={POSITION_LABELS[p.position]} color="rgba(255,255,255,.18)" textColor={colors.white} />
            <Chip label={price(p.price)} color={colors.gold} />
            <Chip label={p.status.toLowerCase()} color={p.status === 'AVAILABLE' ? colors.pitch : colors.clay} textColor={colors.white} />
            <OriginChip origin={p.origin} />
          </Row>
          {p.statusNote ? <Text style={styles.heroSub}>{p.statusNote}</Text> : null}
        </View>
      </View>
      <StatGrid>
        <Stat accent label="Total points" value={s.totalPoints} hint={`${s.confirmedPoints} confirmed`} />
        <Stat label="Form" value={s.form} hint="avg last 3" />
        <Stat label="Goals / assists" value={`${s.goals} / ${s.assists}`} />
        <Stat label="Appearances" value={s.appearances} hint={`${s.minutes} min`} />
        <Stat label="Clean sheets" value={s.cleanSheets} />
        <Stat label="Selected by" value={`${s.selectedByPct}%`} />
        <Stat label="Saves" value={s.saves} />
        <Stat label="Cards" value={`${s.yellowCards}🟨 ${s.redCards}🟥`} />
      </StatGrid>
      <Card>
        <SectionTitle>Match history</SectionTitle>
        {data.history.length === 0 && <Text style={type.small}>No appearances yet.</Text>}
        {data.history.map((h) => (
          <Pressable key={h.fixtureId} onPress={() => router.push(`/match/${h.fixtureId}`)} style={styles.row}>
            <Text style={styles.gw}>GW{h.fixture.gameweek?.number}</Text>
            <View style={{ flex: 1 }}>
              <Text style={type.h3}>
                {h.fixture.homeClub.shortName} {h.fixture.homeScore}-{h.fixture.awayScore} {h.fixture.awayClub.shortName}
              </Text>
              <Text style={type.small}>
                {h.minutes}' · {h.stat?.goals ?? 0}G {h.stat?.assists ?? 0}A{h.stat?.yellowCards ? ' 🟨' : ''}
                {h.stat?.redCards ? ' 🟥' : ''}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.pts}>{h.provisionalPoints}</Text>
              {h.confirmedPoints !== h.provisionalPoints && <Text style={{ fontSize: 11, color: colors.pitch }}>{h.confirmedPoints}✓</Text>}
            </View>
          </Pressable>
        ))}
      </Card>
      <Card>
        <SectionTitle>Upcoming</SectionTitle>
        {data.upcoming.map((f) => {
          const home = f.homeClubId === p.clubId;
          const opp = home ? f.awayClub : f.homeClub;
          return (
            <Row key={f.id} style={{ paddingVertical: 6 }}>
              <Text style={styles.gw}>GW{f.gameweek?.number}</Text>
              <ClubCrest club={opp} size={22} />
              <Text style={[type.h3, { flex: 1 }]}>
                {opp.name} ({home ? 'H' : 'A'})
              </Text>
              <Text style={type.small}>{dateTime(f.kickoffAt)}</Text>
            </Row>
          );
        })}
      </Card>
      <Card style={{ gap: 4 }}>
        <SectionTitle>Data source</SectionTitle>
        <Text style={type.body}>{p.source?.name ?? 'Manually entered'}</Text>
        {p.priceChanges.map((c) => (
          <Row key={c.id} style={{ justifyContent: 'space-between' }}>
            <Text style={type.small}>
              {date(c.createdAt)} · {c.reason}
            </Text>
            <Text style={{ fontSize: 12, color: c.newPrice > c.oldPrice ? colors.pitch : colors.clay }}>
              {price(c.oldPrice)} → {price(c.newPrice)}
            </Text>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, overflow: 'hidden' },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,26,20,.55)' },
  heroName: { color: colors.white, fontSize: 24, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,.75)', fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  gw: { width: 40, fontSize: 11, fontWeight: '700', color: colors.muted },
  pts: { fontWeight: '800', fontSize: 16, color: colors.ink, fontVariant: ['tabular-nums'] },
});
