import { colors, dateTime, price, useAuth, useMeta, useMyTeam } from '@kiwanja/client';
import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Countdown } from '@/components/Countdown';
import { PickTeam, PointsView } from '@/components/TeamViews';
import { Button, Empty, ErrorView, Ionicons, Loading, Screen, Segmented, Stat, StatGrid, T, type } from '@/components/ui';

export default function MyTeam() {
  const { user, loading } = useAuth();
  const meta = useMeta();
  const { data, isLoading, error, refetch, isRefetching } = useMyTeam(!!user);
  const [tab, setTab] = useState<'points' | 'pick'>('points');
  useEffect(() => {
    if (data && !data.live) setTab('pick');
  }, [data]);

  if (loading) return <Loading />;
  if (!user)
    return (
      <Screen>
        <Empty title="Sign in to manage your team" icon="shirt-outline">
          Pick 15 players, choose a captain and score points from every verified event.
        </Empty>
        <Button title="Sign in" onPress={() => router.push('/login')} />
        <Button variant="ghost" title="Create an account" onPress={() => router.push('/register')} />
      </Screen>
    );
  if (isLoading || !meta.data) return <Loading />;
  if (error) return <Screen><ErrorView error={error} onRetry={refetch} /></Screen>;
  if (!data?.team)
    return (
      <Screen>
        <Empty title="You don't have a team yet" icon="people-outline">
          Build a 15-player squad within the {price(meta.data.rules.squad.budget)} budget.
        </Empty>
        <Button variant="gold" title="Pick your squad" icon="arrow-forward" onPress={() => router.push('/create-team')} />
      </Screen>
    );
  const t = data.team;
  const info = data.transfersInfo;
  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen
        options={{
          headerTitle: t.name,
          headerRight: () => (
            <Pressable onPress={() => router.push('/transfers')} style={{ paddingHorizontal: 16, flexDirection: 'row', gap: 4, alignItems: 'center' }} accessibilityLabel="Transfers">
              <Ionicons name="swap-horizontal" size={20} color={colors.gold} />
              <T style={{ color: colors.gold, fontWeight: '800' }}>Transfers</T>
            </Pressable>
          ),
        }}
      />
      <T style={type.small}>
        Overall rank #{data.rank} · Squad value {price(data.squadValue)} · Bank {price(t.bank)}
      </T>
      <StatGrid>
        <Stat accent label={data.currentGameweek?.name ?? 'Gameweek'} value={data.live?.score?.net ?? '-'} hint={data.live?.score ? `${data.live.score.confirmed - data.live.score.transferCost} confirmed` : 'Starts at the deadline'} />
        <Stat label="Total points" value={t.totalPoints} hint={`${t.confirmedTotal} confirmed`} />
        <Stat label="Free transfers" value={info.unlimited ? '∞' : t.freeTransfers} hint={info.unlimited ? 'Unlimited until first deadline' : `then -${info.hitCost} pts each`} />
        <Stat label={data.nextGameweek ? `${data.nextGameweek.name} deadline` : 'Deadline'} value={data.nextGameweek ? <Countdown to={data.nextGameweek.deadlineAt} style={{ fontSize: 18, fontWeight: '800' }} /> : '-'} hint={data.nextGameweek ? dateTime(data.nextGameweek.deadlineAt) : 'Season complete'} />
      </StatGrid>
      <View>
        <Segmented
          value={data.live ? tab : 'pick'}
          onChange={setTab}
          options={[...(data.live ? [{ value: 'points' as const, label: `Points · ${data.currentGameweek?.name}` }] : []), { value: 'pick' as const, label: data.nextGameweek ? `Pick team · GW${data.nextGameweek.number}` : 'Pick team' }]}
        />
      </View>
      {tab === 'points' && data.live ? <PointsView view={data.live} /> : <PickTeam data={data} />}
    </Screen>
  );
}
