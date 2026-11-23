import { ago, colors, useNotificationMutations, useNotifications } from '@kiwanja/client';
import { router, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Loading, Screen, type } from '@/components/ui';

export default function Notifications() {
  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const { readAll } = useNotificationMutations();
  if (isLoading) return <Loading />;
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: 'Notifications' }} />
      {!!data?.unread && <Button variant="ghost" icon="checkmark-done" title="Mark all read" onPress={() => readAll.mutate()} />}
      {data?.items.length ? (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {data.items.map((n) => (
            <Pressable key={n.id} disabled={!n.link?.startsWith('/match/')} onPress={() => router.push(n.link as `/match/${string}`)} style={[styles.item, !n.readAt && { backgroundColor: colors.goldLight }]}>
              <View style={[styles.dot, !n.readAt && { backgroundColor: colors.clay }]} />
              <View style={{ flex: 1 }}>
                <Text style={type.h3}>{n.title}</Text>
                <Text style={type.small}>{n.body}</Text>
                <Text style={[type.small, { marginTop: 2 }]}>{ago(n.createdAt)}</Text>
              </View>
            </Pressable>
          ))}
        </Card>
      ) : (
        <Empty title="Nothing yet" icon="notifications-outline">
          You'll hear from us when your players score, or a gameweek goes live.
        </Empty>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 10, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
