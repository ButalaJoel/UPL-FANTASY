import { buyBlocker, colors, dateTime, previewTransfers, price, squadAfter, useFantasyMutations, useMeta, useMyTeam, useTransferHistory, type PendingTransfer, type Player, type TransferPreview } from '@kiwanja/client';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ClubCrest } from '@/components/brand';
import { PlayerMarket } from '@/components/PlayerMarket';
import { Button, Card, Chip, Empty, ErrorView, Ionicons, Loading, Notice, Row, Screen, SectionTitle, Sheet, Stat, StatGrid, type } from '@/components/ui';

export default function Transfers() {
  const { data: meta } = useMeta();
  const { data, isLoading } = useMyTeam();
  const history = useTransferHistory();
  const { makeTransfers } = useFantasyMutations();
  const [selling, setSelling] = useState<Player | null>(null);
  const [pending, setPending] = useState<PendingTransfer[]>([]);
  const [wildcard, setWildcard] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<TransferPreview | null>(null);
  const body = useMemo(() => ({ transfers: pending.map((p) => ({ outId: p.out.id, inId: p.in.id })), useWildcard: wildcard }), [pending, wildcard]);

  useEffect(() => {
    if (!pending.length) return setPreview(null);
    const ctrl = new AbortController();
    previewTransfers(body, ctrl.signal).then(setPreview).catch(() => undefined);
    return () => ctrl.abort();
  }, [body, pending.length]);

  if (isLoading || !meta) return <Loading />;
  if (!data?.team) return <Screen><Empty title="Create your team first" /><Button title="Pick your squad" onPress={() => router.replace('/create-team')} /></Screen>;
  if (!data.nextGameweek) return <Screen><Empty title="No upcoming gameweek">Transfers open again when the next gameweek is scheduled.</Empty></Screen>;

  const info = data.transfersInfo;
  const after = squadAfter(data.squad.map((s) => s.player), pending, data.team.bank);
  const inIds = new Set(pending.map((p) => p.in.id));

  return (
    <Screen>
      <Text style={type.small}>
        For {data.nextGameweek.name} · deadline {dateTime(data.nextGameweek.deadlineAt)}
      </Text>
      <StatGrid>
        <Stat label="Free transfers" value={info.unlimited ? '∞' : info.freeTransfers} hint={info.unlimited ? 'Unlimited before first deadline' : `Extra cost ${info.hitCost} pts`} />
        <Stat label="In the bank" value={price(after.bank)} accent={after.bank < 0} />
        <Stat label="Cost" value={preview ? (preview.cost ? `-${preview.cost} pts` : 'Free') : '-'} hint={preview && !preview.unlimited && !preview.wildcard ? `${preview.freeUsed} free used` : undefined} />
      </StatGrid>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={type.h3}>Wildcard</Text>
          <Text style={type.small}>{info.wildcardActive ? 'Active this gameweek' : `${info.wildcardsLeft} left: unlimited free transfers`}</Text>
        </View>
        <Switch value={wildcard || info.wildcardActive} disabled={info.wildcardActive || info.wildcardsLeft <= 0} onValueChange={setWildcard} trackColor={{ true: colors.pitch }} />
      </Card>

      {pending.length > 0 && (
        <Card>
          <SectionTitle>Pending transfers</SectionTitle>
          {pending.map((t) => (
            <Row key={t.out.id} style={{ paddingVertical: 6 }}>
              <Text style={{ flex: 1, color: colors.clay }} numberOfLines={1}>
                {t.out.lastName}
              </Text>
              <Ionicons name="arrow-forward" size={16} color={colors.muted} />
              <Text style={{ flex: 1, textAlign: 'right', color: colors.pitch, fontWeight: '800' }} numberOfLines={1}>
                {t.in.lastName}
              </Text>
              <Pressable onPress={() => setPending(pending.filter((x) => x !== t))} hitSlop={10} accessibilityLabel="Undo">
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            </Row>
          ))}
          {preview?.issues.map((i) => (
            <Notice key={i.message} tone="warn">
              {i.message}
            </Notice>
          ))}
          <Button style={{ marginTop: 8 }} title="Make transfers" disabled={!!preview?.issues.length} onPress={() => setConfirm(true)} />
        </Card>
      )}

      <Card>
        <SectionTitle>Your squad</SectionTitle>
        <Text style={[type.small, { marginBottom: 4 }]}>Tap Sell to pick a replacement.</Text>
        {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) =>
          after.players
            .filter((p) => p.position === pos)
            .map((p) => (
              <Row key={p.id} style={styles.squadRow}>
                <Text style={styles.pos}>{pos}</Text>
                <ClubCrest club={p.club} size={24} />
                <Text style={[type.h3, { flex: 1 }]} numberOfLines={1}>
                  {p.firstName[0]}. {p.lastName}
                </Text>
                {inIds.has(p.id) && <Chip label="new" color={colors.pitchLight} textColor={colors.pitchDark} />}
                <Text style={styles.price}>{price(p.price)}</Text>
                {inIds.has(p.id) ? (
                  <Button small variant="ghost" title="Undo" onPress={() => setPending(pending.filter((x) => x.in.id !== p.id))} />
                ) : (
                  <Button small variant="ghost" title="Sell" onPress={() => setSelling(p)} />
                )}
              </Row>
            )),
        )}
      </Card>

      <Card>
        <SectionTitle>Transfer history</SectionTitle>
        {history.data?.length ? (
          history.data.map((h) => (
            <Row key={h.id} style={{ paddingVertical: 5 }}>
              <Text style={styles.pos}>GW{h.gameweek.number}</Text>
              <Text style={{ flex: 1 }} numberOfLines={1}>
                <Text style={{ color: colors.clay }}>{h.playerOut.lastName}</Text> → <Text style={{ fontWeight: '800' }}>{h.playerIn.lastName}</Text>
              </Text>
              {h.isWildcard ? <Chip label="WC" color={colors.goldLight} /> : h.cost ? <Chip label={`-${h.cost}`} color={colors.clayLight} textColor={colors.clay} /> : null}
            </Row>
          ))
        ) : (
          <Text style={type.small}>No transfers yet.</Text>
        )}
      </Card>

      <Sheet open={!!selling} onClose={() => setSelling(null)} title={selling ? `Replace ${selling.lastName} · ${price(after.bank + selling.price)} to spend` : ''} tall>
        <View style={{ flex: 1 }}>
          {selling && (
            <PlayerMarket
              lockedPosition={selling.position}
              action={(p) => {
                const reason = buyBlocker(after.players, after.bank, selling, p, meta.rules);
                return (
                  <Button
                    small
                    style={{ width: 84 }}
                    title={reason ?? 'Buy'}
                    disabled={!!reason}
                    onPress={() => {
                      setPending([...pending, { out: selling, in: p }]);
                      setSelling(null);
                    }}
                  />
                );
              }}
            />
          )}
        </View>
      </Sheet>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Confirm transfers">
        <View style={{ gap: 10 }}>
          {pending.map((t) => (
            <Text key={t.out.id} style={type.body}>
              {t.out.firstName} {t.out.lastName} → <Text style={{ fontWeight: '800' }}>{t.in.firstName} {t.in.lastName}</Text>
            </Text>
          ))}
          <Card style={{ padding: 12 }}>
            <Text style={type.body}>
              Points cost: <Text style={{ fontWeight: '800' }}>{preview?.cost ? `-${preview.cost}` : 'none'}</Text> · Bank after: <Text style={{ fontWeight: '800' }}>{price(preview?.bankAfter ?? after.bank)}</Text>
            </Text>
            {preview?.wildcard && <Text style={{ color: '#8A6A00', marginTop: 4 }}>Your wildcard will be played.</Text>}
          </Card>
          <ErrorView error={makeTransfers.error} />
          <Button
            title="Confirm"
            loading={makeTransfers.isPending}
            onPress={() =>
              makeTransfers.mutate(body, {
                onSuccess: () => {
                  setPending([]);
                  setWildcard(false);
                  setConfirm(false);
                },
              })
            }
          />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  squadRow: { paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  pos: { width: 34, fontSize: 11, fontWeight: '800', color: colors.muted },
  price: { fontWeight: '700', fontVariant: ['tabular-nums'], fontSize: 13, color: colors.ink },
});
