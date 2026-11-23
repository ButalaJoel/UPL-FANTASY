import { AuthProvider, colors, onClientConfigChange, useLiveUpdates, useMeta, type LiveNotification } from '@kiwanja/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Loading } from '@/components/ui';
import { bootSession, currentServer } from '@/lib/session';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 10_000 } } });

/** Pushed notifications (goals by your players, gameweek live...) slide in from the top. */
function LiveBanner() {
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<LiveNotification | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hide = useCallback(() => Animated.timing(y, { toValue: -160, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setNote(null)), [y]);
  const onNotification = useCallback(
    (n: LiveNotification) => {
      setNote(n);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, 6000);
    },
    [y, hide],
  );
  useLiveUpdates(onNotification);
  useMeta(); // loads the currency and rules used for price formatting
  if (!note) return null;
  return (
    <Animated.View style={[styles.banner, { top: insets.top + 6, transform: [{ translateY: y }] }]}>
      <Pressable
        onPress={() => {
          hide();
          if (note.link?.startsWith('/match/')) router.push(note.link as `/match/${string}`);
        }}
        style={{ flex: 1 }}
      >
        <Text style={styles.bannerTitle}>{note.title}</Text>
        {note.body ? <Text style={styles.bannerBody}>{note.body}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [server, setServer] = useState('');
  useEffect(() => {
    bootSession().then(() => {
      setServer(currentServer());
      setReady(true);
    });
    // Changing the server in Settings rebuilds every cached query against the new API.
    return onClientConfigChange(() =>
      setServer((prev) => {
        const next = currentServer();
        if (prev && next !== prev) queryClient.clear();
        return next;
      }),
    );
  }, []);
  if (!ready) return <Loading label="Starting Kiwanja…" />;
  return (
    <QueryClientProvider client={queryClient} key={server}>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.ink },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: '800' },
            contentStyle: { backgroundColor: colors.paper },
            headerBackButtonDisplayMode: 'minimal',
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ title: 'Sign in', presentation: 'modal' }} />
          <Stack.Screen name="register" options={{ title: 'Create account', presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: 'Server' }} />
          <Stack.Screen name="match/[id]" options={{ title: 'Match centre' }} />
          <Stack.Screen name="player/[id]" options={{ title: 'Player' }} />
          <Stack.Screen name="players" options={{ title: 'Players' }} />
          <Stack.Screen name="create-team" options={{ title: 'Pick your squad' }} />
          <Stack.Screen name="transfers" options={{ title: 'Transfers' }} />
          <Stack.Screen name="league/[id]" options={{ title: 'League' }} />
          <Stack.Screen name="cup/[id]" options={{ title: 'Cup' }} />
          <Stack.Screen name="team/[id]" options={{ title: 'Team' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
          <Stack.Screen name="history" options={{ title: 'Season history' }} />
        </Stack>
        <LiveBanner />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', backgroundColor: colors.ink, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(242,183,5,.5)', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  bannerTitle: { color: colors.gold, fontWeight: '800', fontSize: 14 },
  bannerBody: { color: 'rgba(255,255,255,.75)', fontSize: 12, marginTop: 2 },
});
