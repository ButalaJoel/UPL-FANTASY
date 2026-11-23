import { colors, dateTime, isLive, price, useAuth, useFixtures, useGameweeks, useLeaders, useMeta, useMyTeam, useOverall } from '@kiwanja/client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, ClubCrest, Logo } from '@/components/brand';
import { Countdown } from '@/components/Countdown';
import { FixtureRow } from '@/components/FixtureRow';
import { Button, Card, Empty, Ionicons, Loading, Notice, Screen, SectionTitle, Stat, StatGrid, type } from '@/components/ui';

export default function Home() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const meta = useMeta();
  const gws = useGameweeks();
  const current = meta.data?.currentGameweek;
  const next = meta.data?.nextGameweek;
  const fixtures = useFixtures(current?.number);
  const mine = useMyTeam(!!user);
  const board = useOverall(5);
  const leaders = useLeaders();
  const gwInfo = gws.data?.find((g) => g.id === current?.id);
  const live = fixtures.data?.some((f) => isLive(f.status));
  const refreshing = meta.isRefetching || fixtures.isRefetching;
  const refresh = () => {
    meta.refetch();
    fixtures.refetch();
    board.refetch();
    if (user) mine.refetch();
  };

  return (
    <Screen padded={false} onRefresh={refresh} refreshing={refreshing}>
      <View style={[styles.hero, { paddingTop: insets.top + 16 }]}>
        <Logo light />
        <Text style={styles.season}>
          {meta.data?.season.competition} · {meta.data?.season.name}
        </Text>
        <Text style={styles.heroTitle}>Every tap at the stadium.{'\n'}Points on your phone.</Text>
        {next && (
          <View style={styles.deadline}>
            <Text style={styles.deadlineLabel}>{next.name} deadline</Text>
            <Countdown to={next.deadlineAt} style={styles.deadlineValue} />
            <Text style={styles.deadlineDate}>{dateTime(next.deadlineAt)}</Text>
          </View>
        )}
        {!user ? (
          <Button variant="gold" title="Sign in to play" icon="log-in-outline" onPress={() => router.push('/login')} />
        ) : mine.data && !mine.data.team ? (
          <Button variant="gold" title="Pick your squad" icon="arrow-forward" onPress={() => router.push('/create-team')} />
        ) : null}
      </View>

      <View style={{ paddingHorizontal: 16, gap: 16 }}>
        <Notice>All clubs, players and matches in this prototype are fictional sample data.</Notice>

        {mine.data?.team && (
          <StatGrid>
            <Stat accent label={`${current?.name ?? 'Gameweek'} points`} value={mine.data.live?.score?.net ?? 0} hint={mine.data.live?.score ? `${mine.data.live.score.confirmed} confirmed` : 'Line-up not locked yet'} />
            <Stat label="Total points" value={mine.data.team.totalPoints} hint={mine.data.team.name} />
            <Stat label="Overall rank" value={mine.data.rank ? `#${mine.data.rank}` : '-'} />
            <Stat label="Avg / highest" value={`${gwInfo?.averagePoints ?? 0} / ${gwInfo?.highestPoints ?? 0}`} hint={current?.name} />
          </StatGrid>
        )}

        <Card>
          <SectionTitle action="All fixtures" onAction={() => router.push('/fixtures')}>
            {live ? '🔴 ' : ''}
            {current?.name ?? 'Fixtures'}
          </SectionTitle>
          {fixtures.isLoading ? <Loading /> : fixtures.data?.length ? fixtures.data.map((f) => <FixtureRow key={f.id} f={f} />) : <Empty title="No fixtures" />}
        </Card>

        <Card>
          <SectionTitle action="Leagues" onAction={() => router.push('/leagues')}>
            Overall leaders
          </SectionTitle>
          {board.data?.rows.map((r) => (
            <Pressable key={r.teamId} onPress={() => router.push(`/team/${r.teamId}`)} style={styles.leaderRow}>
              <Text style={styles.rank}>{r.rank}</Text>
              <Avatar name={r.manager.displayName} color={r.manager.avatarColor} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3} numberOfLines={1}>
                  {r.teamName}
                </Text>
                <Text style={type.small}>{r.manager.displayName}</Text>
              </View>
              <Text style={styles.points}>{r.totalPoints}</Text>
            </Pressable>
          ))}
        </Card>

        <Card>
          <SectionTitle action="All players" onAction={() => router.push('/players')}>
            Top players
          </SectionTitle>
          {leaders.data?.points.slice(0, 5).map((p) => (
            <Pressable key={p.id} onPress={() => router.push(`/player/${p.id}`)} style={styles.leaderRow}>
              <ClubCrest club={p.club} size={26} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3} numberOfLines={1}>
                  {p.firstName} {p.lastName}
                </Text>
                <Text style={type.small}>
                  {p.position} · {price(p.price)}
                </Text>
              </View>
              <Text style={styles.points}>{p.stats.totalPoints}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
          ))}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.pitch, paddingHorizontal: 20, paddingBottom: 24, gap: 12, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  season: { color: colors.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 8 },
  heroTitle: { color: colors.white, fontSize: 28, fontWeight: '800', lineHeight: 33, letterSpacing: -0.5 },
  deadline: { backgroundColor: 'rgba(11,26,20,.35)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,.15)' },
  deadlineLabel: { color: 'rgba(255,255,255,.65)', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  deadlineValue: { color: colors.white, fontSize: 30, fontWeight: '800', marginTop: 2 },
  deadlineDate: { color: 'rgba(255,255,255,.6)', fontSize: 12 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  rank: { width: 20, textAlign: 'center', fontWeight: '800', color: colors.muted },
  points: { fontSize: 17, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
});
