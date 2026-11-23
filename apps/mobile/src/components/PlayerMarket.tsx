import { colors, price, searchPlayers, useClubs, usePlayers, type Player, type PlayerFilters } from '@kiwanja/client';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ClubCrest } from './brand';
import { Chip, Ionicons, Loading } from './ui';

const POSITIONS = [
  { value: undefined, label: 'All' },
  { value: 'GK', label: 'GK' },
  { value: 'DEF', label: 'DEF' },
  { value: 'MID', label: 'MID' },
  { value: 'FWD', label: 'FWD' },
] as const;
const SORTS = [
  { value: 'totalPoints', label: 'Points' },
  { value: 'form', label: 'Form' },
  { value: 'price', label: 'Price' },
  { value: 'goals', label: 'Goals' },
  { value: 'selectedByPct', label: 'Selected' },
];

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.pill, on && styles.pillOn]} accessibilityState={{ selected: on }}>
      <Text style={[styles.pillText, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

/** Search, filter and sort all players. `action` renders the per-row button (add, buy...). */
export function PlayerMarket({ action, lockedPosition, header }: { action?: (p: Player) => ReactNode; lockedPosition?: string; header?: ReactNode }) {
  const [f, setF] = useState<PlayerFilters>({ sort: 'totalPoints' });
  const position = lockedPosition ?? f.position;
  const { data, isLoading } = usePlayers({ position, club: f.club, sort: f.sort });
  const clubs = useClubs();
  const rows = useMemo(() => searchPlayers(data?.players ?? [], f.q), [data, f.q]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(p) => p.id}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={15}
      ListHeaderComponent={
        <View style={{ gap: 8, paddingBottom: 6 }}>
          {header}
          <View style={styles.search}>
            <Ionicons name="search" size={16} color={colors.muted} />
            <TextInput style={styles.searchInput} placeholder="Search player" placeholderTextColor={colors.muted} value={f.q ?? ''} onChangeText={(q) => setF({ ...f, q })} autoCorrect={false} />
          </View>
          {!lockedPosition && (
            <View style={styles.pills}>
              {POSITIONS.map((p) => (
                <Pill key={p.label} label={p.label} on={f.position === p.value} onPress={() => setF({ ...f, position: p.value })} />
              ))}
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            <Text style={styles.sortLabel}>Sort</Text>
            {SORTS.map((s) => (
              <Pill key={s.value} label={s.label} on={f.sort === s.value} onPress={() => setF({ ...f, sort: s.value })} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
            <Pill label="All clubs" on={!f.club} onPress={() => setF({ ...f, club: undefined })} />
            {clubs.data?.map((c) => (
              <Pressable key={c.id} onPress={() => setF({ ...f, club: f.club === c.id ? undefined : c.id })} style={[styles.clubPill, f.club === c.id && styles.pillOn]} accessibilityLabel={c.name}>
                <ClubCrest club={c} size={22} />
              </Pressable>
            ))}
          </ScrollView>
          <Text style={{ fontSize: 11, color: colors.muted }}>{isLoading ? 'Loading…' : `${rows.length} players`}</Text>
        </View>
      }
      ListEmptyComponent={isLoading ? <Loading /> : <Text style={{ textAlign: 'center', color: colors.muted, padding: 20 }}>No players match.</Text>}
      ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />}
      renderItem={({ item: p }) => (
        <View style={styles.row}>
          <ClubCrest club={p.club} size={30} />
          <Pressable style={{ flex: 1 }} onPress={() => router.push(`/player/${p.id}`)}>
            <Text style={styles.name} numberOfLines={1}>
              {p.firstName} {p.lastName}
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Text style={styles.meta}>
                {p.position} · {p.club.shortName} · form {p.stats?.form ?? 0}
              </Text>
              {p.status !== 'AVAILABLE' && <Chip label={p.status.toLowerCase()} color={colors.clayLight} textColor={colors.clay} />}
            </View>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>{price(p.price)}</Text>
            <Text style={styles.meta}>{p.stats?.totalPoints ?? 0} pts</Text>
          </View>
          {action?.(p)}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.line },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.ink },
  pills: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontSize: 12, fontWeight: '700', color: colors.ink },
  clubPill: { padding: 4, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  sortLabel: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 11, color: colors.muted },
  price: { fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
});
