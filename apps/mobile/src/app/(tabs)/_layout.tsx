import { colors, useAuth, useNotifications } from '@kiwanja/client';
import { Tabs } from 'expo-router';
import { Ionicons } from '@/components/ui';

export default function TabsLayout() {
  const { user } = useAuth();
  const unread = useNotifications(!!user).data?.unread ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.white,
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: colors.pitch,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', headerShown: false, tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color as string} size={size} /> }} />
      <Tabs.Screen name="team" options={{ title: 'My Team', tabBarIcon: ({ color, size }) => <Ionicons name="shirt" color={color as string} size={size} /> }} />
      <Tabs.Screen name="fixtures" options={{ title: 'Fixtures', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" color={color as string} size={size} /> }} />
      <Tabs.Screen name="leagues" options={{ title: 'Leagues', tabBarIcon: ({ color, size }) => <Ionicons name="trophy" color={color as string} size={size} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarBadge: unread ? unread : undefined, tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color as string} size={size} /> }} />
    </Tabs>
  );
}
