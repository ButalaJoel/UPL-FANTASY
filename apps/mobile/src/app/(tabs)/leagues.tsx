import { colors, useAuth, useCups, useLeagueMutations, useMyLeagues, usePublicLeagues, type League } from '@kiwanja/client';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Chip, Empty, ErrorView, Ionicons, Loading, Row, Screen, SectionTitle, Segmented, Sheet, type } from '@/components/ui';

function LeagueRow({ l, right }: { l: League; right?: React.ReactNode }) {
  const icon = l.type === 'H2H' ? 'flash' : l.isSystem ? 'globe' : l.visibility === 'PRIVATE' ? 'lock-closed' : 'people';
  return (
    <Pressable onPress={() => router.push(`/league/${l.id}`)} style={styles.row}>
      <Ionicons name={icon} size={18} color={l.type === 'H2H' ? colors.clay : colors.pitch} />
      <View style={{ flex: 1 }}>
        <Text style={type.h3} numberOfLines={1}>
          {l.name}
        </Text>
        <Text style={type.small}>
          {l.type === 'H2H' ? 'Head-to-head' : 'Classic'} · {l._count.members} teams
        </Text>
      </View>
      {right ?? (l.myRank ? <Chip label={`#${l.myRank}`} color={colors.ink} textColor={colors.white} /> : null)}
    </Pressable>
  );
}

export default function Leagues() {
  const { user } = useAuth();
  const mine = useMyLeagues(!!user);
  const pub = usePublicLeagues();
  const cups = useCups();
  const m = useLeagueMutations();
  const [sheet, setSheet] = useState<'create' | 'join' | null>(null);
  const myIds = new Set(mine.data?.leagues.map((l) => l.id));
  const refresh = () => {
    mine.refetch();
    pub.refetch();
    cups.refetch();
  };
  return (
    <Screen onRefresh={refresh} refreshing={mine.isRefetching}>
      {user && (
        <Row>
          <Button style={{ flex: 1 }} variant="ghost" icon="key-outline" title="Join with code" onPress={() => setSheet('join')} />
          <Button style={{ flex: 1 }} icon="add" title="Create" onPress={() => setSheet('create')} />
        </Row>
      )}
      <Card>
        <SectionTitle>My leagues</SectionTitle>
        {!user ? (
          <Button variant="ghost" title="Sign in to see your leagues" onPress={() => router.push('/login')} />
        ) : mine.isLoading ? (
          <Loading />
        ) : mine.data?.leagues.length ? (
          mine.data.leagues.map((l) => <LeagueRow key={l.id} l={l} />)
        ) : (
          <Empty title="No leagues yet">Create your team first, then create or join a league.</Empty>
        )}
      </Card>
      <Card>
        <SectionTitle>Public leagues</SectionTitle>
        {pub.data?.map((l) => (
          <LeagueRow key={l.id} l={l} right={user && !myIds.has(l.id) ? <Button small variant="ghost" title="Join" loading={m.joinPublic.isPending && m.joinPublic.variables === l.id} onPress={() => m.joinPublic.mutate(l.id)} /> : undefined} />
        ))}
        <ErrorView error={m.joinPublic.error} />
      </Card>
      <Card>
        <SectionTitle>Cups</SectionTitle>
        {cups.data?.length ? (
          cups.data.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/cup/${c.id}`)} style={styles.row}>
              <Ionicons name="trophy" size={18} color={colors.gold} />
              <Text style={[type.h3, { flex: 1 }]}>{c.name}</Text>
              <Text style={type.small}>
                from GW{c.startGameweek} · {c.status.toLowerCase()}
              </Text>
            </Pressable>
          ))
        ) : (
          <Text style={type.small}>No cups yet.</Text>
        )}
      </Card>
      <CreateLeague open={sheet === 'create'} onClose={() => setSheet(null)} />
      <JoinLeague open={sheet === 'join'} onClose={() => setSheet(null)} />
    </Screen>
  );
}

function CreateLeague({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useLeagueMutations();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'CLASSIC' | 'H2H'>('CLASSIC');
  const close = () => {
    create.reset();
    setName('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Create a private league">
      {create.data ? (
        <View style={{ gap: 12, alignItems: 'center' }}>
          <Text style={type.body}>Share this code with your friends:</Text>
          <Text style={styles.code}>{create.data.code}</Text>
          <Row>
            <Button variant="ghost" icon="copy-outline" title="Copy" onPress={() => Clipboard.setStringAsync(create.data!.code)} />
            <Button icon="share-social-outline" title="Share" onPress={() => Share.share({ message: `Join my Kiwanja fantasy league "${create.data!.name}" with code ${create.data!.code}` })} />
          </Row>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput style={styles.input} placeholder="League name" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={40} />
          <Segmented value={kind} onChange={setKind} options={[{ value: 'CLASSIC', label: 'Classic (total points)' }, { value: 'H2H', label: 'Head-to-head' }]} />
          <ErrorView error={create.error} />
          <Button title="Create league" disabled={name.trim().length < 3} loading={create.isPending} onPress={() => create.mutate({ name: name.trim(), type: kind })} />
        </View>
      )}
    </Sheet>
  );
}

function JoinLeague({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { joinByCode } = useLeagueMutations();
  const [code, setCode] = useState('');
  const close = () => {
    joinByCode.reset();
    setCode('');
    onClose();
  };
  return (
    <Sheet open={open} onClose={close} title="Join a league">
      {joinByCode.data ? (
        <View style={{ gap: 12 }}>
          <Text style={type.body}>
            You joined <Text style={{ fontWeight: '800' }}>{joinByCode.data.name}</Text>.
          </Text>
          <Button
            title="Open league"
            onPress={() => {
              const id = joinByCode.data!.id;
              close();
              router.push(`/league/${id}`);
            }}
          />
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <TextInput style={[styles.input, styles.codeInput]} placeholder="CODE" placeholderTextColor={colors.muted} value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" autoCorrect={false} />
          <ErrorView error={joinByCode.error} />
          <Button title="Join" disabled={code.trim().length < 4} loading={joinByCode.isPending} onPress={() => joinByCode.mutate(code)} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  input: { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: colors.ink },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontWeight: '800', fontSize: 22 },
  code: { fontSize: 34, fontWeight: '900', letterSpacing: 6, color: colors.ink },
});
