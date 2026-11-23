import { colors, useAuth, useFantasyHistory, useMyTeam, useNotifications } from '@kiwanja/client';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/brand';
import { Button, Card, Ionicons, Screen, type, type IconName } from '@/components/ui';
import { currentServer } from '@/lib/session';

function Item({ icon, label, detail, onPress, badge }: { icon: IconName; label: string; detail?: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.faint }]}>
      <Ionicons name={icon} size={20} color={colors.pitch} />
      <View style={{ flex: 1 }}>
        <Text style={type.h3}>{label}</Text>
        {detail ? <Text style={type.small}>{detail}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={{ color: colors.white, fontSize: 11, fontWeight: '800' }}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.muted} />
    </Pressable>
  );
}

export default function Me() {
  const { user, signOut } = useAuth();
  const team = useMyTeam(!!user);
  const notes = useNotifications(!!user);
  const history = useFantasyHistory(!!user);
  const best = history.data?.gameweeks.reduce((m, g) => Math.max(m, g.points - g.transferCost), 0);
  return (
    <Screen>
      {user ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={user.displayName} color={user.avatarColor} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={type.h2}>{user.displayName}</Text>
            <Text style={type.small}>{user.email}</Text>
            {team.data?.team && (
              <Text style={[type.small, { color: colors.pitch, fontWeight: '700' }]}>
                {team.data.team.name} · {team.data.team.totalPoints} pts{best ? ` · best GW ${best}` : ''}
              </Text>
            )}
          </View>
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <Text style={type.h2}>Welcome to Kiwanja</Text>
          <Text style={type.small}>Sign in to pick a team, join leagues and get live alerts when your players score.</Text>
          <Button title="Sign in" onPress={() => router.push('/login')} />
          <Button variant="ghost" title="Create an account" onPress={() => router.push('/register')} />
        </Card>
      )}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {user && <Item icon="notifications-outline" label="Notifications" badge={notes.data?.unread} onPress={() => router.push('/notifications')} />}
        {user && <Item icon="stats-chart-outline" label="Season history" detail="Points per gameweek" onPress={() => router.push('/history')} />}
        {user && team.data?.team && <Item icon="swap-horizontal" label="Transfers" onPress={() => router.push('/transfers')} />}
        <Item icon="search-outline" label="Players" detail="Prices, form and statistics" onPress={() => router.push('/players')} />
        <Item icon="server-outline" label="Server" detail={currentServer()} onPress={() => router.push('/settings')} />
      </Card>
      {user && <Button variant="ghost" icon="log-out-outline" title="Sign out" onPress={() => signOut()} />}
      <Text style={[type.small, { textAlign: 'center' }]}>Kiwanja prototype · all clubs and players are fictional sample data</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  badge: { backgroundColor: colors.clay, borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
});
