import { colors, isFinished, isLive, STATUS_LABEL, time, type Fixture } from '@kiwanja/client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ClubCrest } from './brand';

export function FixtureRow({ f }: { f: Fixture }) {
  const live = isLive(f.status);
  const done = isFinished(f.status);
  return (
    <Pressable onPress={() => router.push(`/match/${f.id}`)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.faint }]} accessibilityRole="button" accessibilityLabel={`${f.homeClub.name} v ${f.awayClub.name}`}>
      <View style={[styles.side, { justifyContent: 'flex-end' }]}>
        <Text style={[styles.club, { textAlign: 'right' }]} numberOfLines={1}>
          {f.homeClub.name}
        </Text>
        <ClubCrest club={f.homeClub} size={24} />
      </View>
      <View style={[styles.score, live ? { backgroundColor: colors.clay } : done ? { backgroundColor: colors.ink } : { backgroundColor: colors.faint }]}>
        <Text style={[styles.scoreText, !live && !done && { color: colors.muted }]}>{live || done ? `${f.homeScore} - ${f.awayScore}` : time(f.kickoffAt)}</Text>
        {(live || f.status === 'POSTPONED') && <Text style={styles.status}>{STATUS_LABEL[f.status]}</Text>}
      </View>
      <View style={styles.side}>
        <ClubCrest club={f.awayClub} size={24} />
        <Text style={styles.club} numberOfLines={1}>
          {f.awayClub.name}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 12 },
  side: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  club: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: colors.ink },
  score: { minWidth: 64, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 6, alignItems: 'center' },
  scoreText: { color: colors.white, fontWeight: '800', fontSize: 13, fontVariant: ['tabular-nums'] },
  status: { color: colors.white, fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
});
