import { addBlocker, autoFill, colors, price, squadComplete, squadIssues, squadSpend, useFantasyMutations, useMeta, usePlayers, type Player } from '@kiwanja/client';
import { POSITIONS, type Position } from '@kiwanja/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Pitch, type PitchSlot } from '@/components/Pitch';
import { PlayerMarket } from '@/components/PlayerMarket';
import { Button, ErrorView, inputStyle, Loading, Notice, Row, Screen, Sheet, Stat, StatGrid, T, type } from '@/components/ui';

export default function CreateTeam() {
  const { data: meta } = useMeta();
  const pool = usePlayers({});
  const { createTeam } = useFantasyMutations();
  const [picked, setPicked] = useState<Player[]>([]);
  const [slotPos, setSlotPos] = useState<Position | null>(null);
  const [name, setName] = useState('');
  const rules = meta?.rules;
  const issues = useMemo(() => (rules ? squadIssues(picked, rules) : []), [picked, rules]);
  if (!rules) return <Loading />;
  const left = rules.squad.budget - squadSpend(picked);
  const complete = squadComplete(picked, rules);

  const slots: PitchSlot[] = POSITIONS.flatMap((pos) => {
    const mine = picked.filter((p) => p.position === pos);
    return Array.from({ length: rules.squad.composition[pos] }, (_, i) => {
      const p = mine[i];
      return p ? { key: p.id, position: pos, name: p.lastName, club: p.club, caption: price(p.price) } : { key: `empty-${pos}-${i}`, position: pos, empty: true };
    });
  });
  const c = rules.squad.composition;

  return (
    <Screen>
      <T style={type.small}>
        {rules.squad.size} players: {c.GK} GK, {c.DEF} DEF, {c.MID} MID, {c.FWD} FWD · max {rules.squad.maxPerClub} per club
      </T>
      <StatGrid>
        <Stat label="Selected" value={`${picked.length}/${rules.squad.size}`} />
        <Stat label="Budget left" value={price(left)} accent={left < 0} />
      </StatGrid>
      <Row>
        <Button style={{ flex: 1 }} variant="ghost" icon="shuffle" title="Auto-complete" disabled={!pool.data} onPress={() => setPicked(autoFill(picked, pool.data?.players ?? [], rules))} />
        <Button style={{ flex: 1 }} variant="ghost" icon="trash-outline" title="Reset" disabled={!picked.length} onPress={() => setPicked([])} />
      </Row>
      <Pitch
        starters={slots}
        onSelect={(key) => {
          if (key.startsWith('empty-')) setSlotPos(key.split('-')[1] as Position);
          else setPicked(picked.filter((p) => p.id !== key));
        }}
      />
      <T style={[type.small, { textAlign: 'center' }]}>Tap an empty shirt to add a player, tap a player to remove them.</T>
      {issues.map((i) => (
        <Notice key={i.message} tone="warn">
          {i.message}
        </Notice>
      ))}
      <TextInput style={inputStyle} placeholder="Team name, e.g. Kampala Crushers" placeholderTextColor={colors.muted} value={name} onChangeText={setName} maxLength={30} />
      <ErrorView error={createTeam.error} />
      <Button
        title="Save squad"
        disabled={!complete || name.trim().length < 3}
        loading={createTeam.isPending}
        onPress={() => createTeam.mutate({ name: name.trim(), playerIds: picked.map((p) => p.id) }, { onSuccess: () => router.replace('/team') })}
      />
      <Sheet open={!!slotPos} onClose={() => setSlotPos(null)} title={`Add a ${slotPos} · ${price(left)} left`} tall>
        <View style={{ flex: 1 }}>
          {slotPos && (
            <PlayerMarket
              lockedPosition={slotPos}
              action={(p) => {
                const reason = addBlocker(picked, p, rules);
                return (
                  <Button
                    small
                    title={reason ?? 'Add'}
                    disabled={!!reason}
                    style={{ width: 84 }}
                    onPress={() => {
                      setPicked([...picked, p]);
                      setSlotPos(null);
                    }}
                  />
                );
              }}
            />
          )}
        </View>
      </Sheet>
    </Screen>
  );
}
