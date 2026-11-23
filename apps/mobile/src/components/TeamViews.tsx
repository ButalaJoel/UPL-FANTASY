import {
  applyFormation,
  canSwap,
  colors,
  currentFormation,
  draftFromSquad,
  lineupChanged,
  lineupIssues,
  lineupPayload,
  makeCaptain,
  makeViceCaptain,
  price,
  swap,
  useFantasyMutations,
  useMeta,
  type LineupDraft,
  type LivePick,
  type MyTeamResponse,
  type TeamGameweekView,
} from '@kiwanja/client';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pitch, type PitchSlot } from './Pitch';
import { Button, Card, Divider, Empty, ErrorView, Notice, Row, Sheet, type } from './ui';

// ---------------------------------------------------------------------------------------
// Gameweek points

export function PointsView({ view }: { view: TeamGameweekView }) {
  const [sel, setSel] = useState<LivePick | null>(null);
  const toSlot = (p: LivePick): PitchSlot => ({
    key: p.playerId,
    position: p.position,
    name: p.player.lastName,
    club: p.player.club,
    caption: `${p.counted ? p.teamPoints : p.provisionalPoints}${p.confirmedPoints !== p.provisionalPoints ? ` (${p.confirmedPoints * (p.multiplier || 1)}✓)` : ''}`,
    captionTone: p.confirmedPoints !== p.provisionalPoints ? 'pending' : 'normal',
    badge: p.isCaptain ? 'C' : p.isViceCaptain ? 'V' : null,
    muted: !p.counted,
    tag: p.subbedIn ? { label: 'IN', color: colors.pitch } : p.subbedOut ? { label: 'OUT', color: colors.clay } : undefined,
  });
  const sorted = [...view.picks].sort((a, b) => a.slot - b.slot);
  const captainId = view.picks.find((p) => p.isCaptain)?.playerId;
  return (
    <View style={{ gap: 16 }}>
      <Pitch starters={sorted.filter((p) => p.slot <= 11).map(toSlot)} bench={sorted.filter((p) => p.slot > 11).map(toSlot)} onSelect={(k) => setSel(view.picks.find((p) => p.playerId === k) ?? null)} />
      <Card>
        <Text style={type.h2}>How the points add up</Text>
        <Text style={[type.small, { marginTop: 4, marginBottom: 8 }]}>Points appear as soon as an analyst logs an event. Numbers with ✓ are confirmed by a second analyst. Tap a player for details.</Text>
        {view.autoSubs.length > 0 && <Notice tone="ok">{view.autoSubs.length} automatic substitution(s) applied.</Notice>}
        {view.multiplierTo && captainId !== view.multiplierTo && <Notice tone="warn">Your captain did not play: the vice-captain gets the armband.</Notice>}
        {view.picks
          .filter((p) => p.counted)
          .sort((a, b) => b.teamPoints - a.teamPoints)
          .map((p) => (
            <Pressable key={p.playerId} onPress={() => setSel(p)} style={styles.lineRow}>
              <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                {p.player.firstName[0]}. {p.player.lastName}
                {p.multiplier > 1 ? `  ×${p.multiplier}` : ''}
              </Text>
              <Text style={styles.pts}>{p.teamPoints}</Text>
            </Pressable>
          ))}
        {!!view.score?.transferCost && (
          <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
            <Text style={{ color: colors.clay }}>Transfer hits</Text>
            <Text style={{ color: colors.clay, fontWeight: '800' }}>-{view.score.transferCost}</Text>
          </Row>
        )}
      </Card>
      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.player.firstName} ${sel.player.lastName}` : ''}>
        {sel && <PointsBreakdown pick={sel} onClose={() => setSel(null)} />}
      </Sheet>
    </View>
  );
}

function PointsBreakdown({ pick, onClose }: { pick: LivePick; onClose: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ gap: 12 }}>
      {pick.breakdown.length === 0 && <Empty title="No match yet">Points appear when this player's match kicks off.</Empty>}
      {pick.breakdown.map((b) => {
        const codes = [...new Set([...b.provisional, ...b.confirmed].map((l) => l.code))];
        return (
          <Card key={b.fixtureId} style={{ padding: 12 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <Text style={type.small}>Match: {b.fixtureStatus.replace('_', ' ').toLowerCase()}</Text>
              <Pressable
                onPress={() => {
                  onClose();
                  router.push(`/match/${b.fixtureId}`);
                }}
              >
                <Text style={{ color: colors.pitch, fontWeight: '700', fontSize: 12 }}>Match centre</Text>
              </Pressable>
            </Row>
            <Row style={styles.tableHead}>
              <Text style={[type.label, { flex: 1 }]}>Rule</Text>
              <Text style={[type.label, styles.cell]}>Stat</Text>
              <Text style={[type.label, styles.cell]}>Live</Text>
              <Text style={[type.label, styles.cell]}>✓</Text>
            </Row>
            {codes.map((code) => {
              const p = b.provisional.find((l) => l.code === code);
              const c = b.confirmed.find((l) => l.code === code);
              return (
                <Row key={code} style={{ paddingVertical: 4 }}>
                  <Text style={[type.body, { flex: 1 }]}>{(p ?? c)!.label}</Text>
                  <Text style={[type.body, styles.cell]}>{(p ?? c)!.value}</Text>
                  <Text style={[type.body, styles.cell, { fontWeight: '800' }]}>{p?.points ?? 0}</Text>
                  <Text style={[type.body, styles.cell, { color: colors.pitch }]}>{c?.points ?? 0}</Text>
                </Row>
              );
            })}
          </Card>
        );
      })}
      <View style={styles.totalBar}>
        <Text style={{ color: colors.white }}>
          Total{pick.multiplier > 1 ? ` (captain ×${pick.multiplier})` : ''}
          {!pick.counted ? ' · on the bench' : ''}
        </Text>
        <Text style={{ color: colors.white, fontWeight: '800', fontSize: 18 }}>{pick.counted ? pick.teamPoints : pick.provisionalPoints}</Text>
      </View>
      <Button
        variant="ghost"
        title="Player profile"
        onPress={() => {
          onClose();
          router.push(`/player/${pick.playerId}`);
        }}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------------------
// Pick team: armbands, substitutions and formation (all logic shared with the web app)

export function PickTeam({ data }: { data: MyTeamResponse }) {
  const { data: meta } = useMeta();
  const rules = meta!.rules;
  const { saveLineup } = useFantasyMutations();
  const initial = useMemo(() => draftFromSquad(data.squad), [data.squad]);
  const [draft, setDraft] = useState<LineupDraft[]>(initial);
  const [sel, setSel] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  useEffect(() => setDraft(initial), [initial]);
  const n = rules.squad.startersCount;
  const issues = lineupIssues(draft, rules);
  const dirty = lineupChanged(draft, initial);
  const formation = currentFormation(draft, rules);
  const selected = draft.find((d) => d.playerId === sel);

  const onSelect = (id: string) => {
    if (swapFrom) {
      if (id !== swapFrom) setDraft(swap(draft, swapFrom, id, rules));
      setSwapFrom(null);
      return;
    }
    setSel(id);
  };
  const toSlot = (d: LineupDraft): PitchSlot => ({
    key: d.playerId,
    position: d.position,
    name: d.player.lastName,
    club: d.player.club,
    caption: d.nextOpponent ?? price(d.player.price),
    badge: d.isCaptain ? 'C' : d.isViceCaptain ? 'V' : null,
    highlighted: swapFrom === d.playerId || (!!swapFrom && canSwap(draft, swapFrom, d.playerId, rules)),
    muted: !!swapFrom && swapFrom !== d.playerId && !canSwap(draft, swapFrom, d.playerId, rules),
    tag: d.player.status !== 'AVAILABLE' ? { label: '!', color: colors.clay } : undefined,
  });
  const sorted = [...draft].sort((a, b) => a.slot - b.slot);

  return (
    <View style={{ gap: 14 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {rules.formations.map((f) => (
          <Pressable key={f} onPress={() => setDraft(applyFormation(draft, f, rules))} style={[styles.formation, f === formation && { backgroundColor: colors.pitch }]}>
            <Text style={[styles.formationText, f === formation && { color: colors.white }]}>{f}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {swapFrom ? (
        <Row style={styles.swapBar}>
          <Text style={{ flex: 1, fontSize: 13 }}>Tap a highlighted player to swap.</Text>
          <Pressable onPress={() => setSwapFrom(null)}>
            <Text style={{ fontWeight: '800' }}>Cancel</Text>
          </Pressable>
        </Row>
      ) : (
        <Text style={type.small}>Tap a player to set the captain or make a substitution. Bench order decides automatic substitutions.</Text>
      )}
      <Pitch starters={sorted.filter((d) => d.slot <= n).map(toSlot)} bench={sorted.filter((d) => d.slot > n).map(toSlot)} onSelect={onSelect} benchLabel="Substitutes (in order)" />
      {issues.map((i) => (
        <Notice key={i.message} tone="warn">
          {i.message}
        </Notice>
      ))}
      <ErrorView error={saveLineup.error} />
      {saveLineup.isSuccess && !dirty && <Notice tone="ok">Line-up saved for {data.nextGameweek?.name}.</Notice>}
      <Button title={saveLineup.isPending ? 'Saving…' : 'Save line-up'} disabled={!dirty || issues.length > 0} loading={saveLineup.isPending} onPress={() => saveLineup.mutate(lineupPayload(draft))} />
      {dirty && <Button variant="ghost" title="Discard changes" onPress={() => setDraft(initial)} />}

      <Sheet open={!!selected} onClose={() => setSel(null)} title={selected ? `${selected.player.firstName} ${selected.player.lastName}` : ''}>
        {selected && (
          <View style={{ gap: 8 }}>
            <Text style={type.small}>
              {selected.player.club.name} · {price(selected.player.price)}
              {selected.nextOpponent ? ` · next: ${selected.nextOpponent}` : ''}
            </Text>
            <Button variant="gold" title="Make captain" disabled={selected.slot > n || selected.isCaptain} onPress={() => (setDraft(makeCaptain(draft, selected.playerId)), setSel(null))} />
            <Button variant="ghost" title="Make vice-captain" disabled={selected.slot > n || selected.isViceCaptain} onPress={() => (setDraft(makeViceCaptain(draft, selected.playerId)), setSel(null))} />
            <Button variant="dark" icon="swap-horizontal" title={selected.slot > n ? 'Bring on / reorder bench' : 'Substitute'} onPress={() => (setSwapFrom(selected.playerId), setSel(null))} />
            <Divider />
            <Button variant="ghost" icon="information-circle-outline" title="Player profile" onPress={() => (setSel(null), router.push(`/player/${selected.playerId}`))} />
          </View>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pts: { fontWeight: '800', fontSize: 15, color: colors.ink, fontVariant: ['tabular-nums'] },
  tableHead: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, paddingBottom: 4 },
  cell: { width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.ink, borderRadius: 14, padding: 14 },
  formation: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  formationText: { fontWeight: '800', fontSize: 13, color: colors.ink },
  swapBar: { backgroundColor: colors.goldLight, borderRadius: 12, padding: 12 },
});
