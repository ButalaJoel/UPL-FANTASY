import { colors, type ClubRef } from '@kiwanja/client';
import type { Position } from '@kiwanja/core';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { Shirt } from './brand';
import { Ionicons } from './ui';

export interface PitchSlot {
  key: string;
  position: Position;
  name?: string;
  club?: ClubRef;
  caption?: string;
  captionTone?: 'normal' | 'good' | 'pending';
  badge?: 'C' | 'V' | null;
  muted?: boolean;
  highlighted?: boolean;
  tag?: { label: string; color: string };
  empty?: boolean;
}

function SlotView({ s, onPress }: { s: PitchSlot; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.slot, s.muted && { opacity: 0.45 }]} accessibilityRole="button" accessibilityLabel={s.name ?? `Empty ${s.position} place`}>
      <View style={[styles.shirtWrap, s.highlighted && styles.highlight]}>
        {s.empty ? (
          <View style={styles.emptyShirt}>
            <Ionicons name="add" size={22} color="rgba(255,255,255,.85)" />
          </View>
        ) : (
          <Shirt primary={s.club?.primaryColor ?? '#ccc'} secondary={s.club?.secondaryColor ?? '#fff'} gk={s.position === 'GK'} size={40} />
        )}
        {s.badge ? (
          <View style={[styles.badge, { backgroundColor: s.badge === 'C' ? colors.gold : colors.white }]}>
            <Text style={styles.badgeText}>{s.badge}</Text>
          </View>
        ) : null}
        {s.tag ? (
          <View style={[styles.tag, { backgroundColor: s.tag.color }]}>
            <Text style={styles.tagText}>{s.tag.label}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.label}>
        <Text style={styles.name} numberOfLines={1}>
          {s.empty ? s.position : s.name}
        </Text>
        {s.caption != null ? (
          <Text style={[styles.caption, s.captionTone === 'pending' && { color: colors.gold }]} numberOfLines={1}>
            {s.caption}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Football pitch with players arranged by line (forwards at the top), bench beneath. */
export function Pitch({ starters, bench, onSelect, benchLabel = 'Bench' }: { starters: PitchSlot[]; bench?: PitchSlot[]; onSelect?: (key: string) => void; benchLabel?: string }) {
  const rows = (['FWD', 'MID', 'DEF', 'GK'] as const).map((p) => starters.filter((s) => s.position === p)).filter((r) => r.length);
  return (
    <View style={styles.wrap}>
      <View style={styles.pitch}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 140" preserveAspectRatio="none">
          {Array.from({ length: 7 }, (_, i) => (
            <Rect key={i} x="0" y={i * 20} width="100" height="10" fill="rgba(255,255,255,.035)" />
          ))}
          <Rect x="4" y="3" width="92" height="134" rx="1" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".5" />
          <Line x1="4" y1="70" x2="96" y2="70" stroke="rgba(255,255,255,.22)" strokeWidth=".5" />
          <Circle cx="50" cy="70" r="11" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".5" />
          <Rect x="26" y="3" width="48" height="20" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".5" />
          <Rect x="26" y="117" width="48" height="20" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth=".5" />
        </Svg>
        {rows.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((s) => (
              <SlotView key={s.key} s={s} onPress={onSelect ? () => onSelect(s.key) : undefined} />
            ))}
          </View>
        ))}
      </View>
      {bench && bench.length > 0 && (
        <View style={styles.bench}>
          <Text style={styles.benchLabel}>{benchLabel}</Text>
          <View style={styles.row}>
            {bench.map((s, i) => (
              <View key={s.key} style={{ alignItems: 'center' }}>
                <SlotView s={s} onPress={onSelect ? () => onSelect(s.key) : undefined} />
                <Text style={styles.benchIndex}>{s.position === 'GK' ? 'GK' : i}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 24, overflow: 'hidden' },
  pitch: { backgroundColor: colors.pitch, paddingVertical: 18, paddingHorizontal: 4, gap: 14 },
  row: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  slot: { width: 70, alignItems: 'center' },
  shirtWrap: { borderRadius: 30, padding: 2 },
  highlight: { backgroundColor: 'rgba(242,183,5,.55)' },
  emptyShirt: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,.6)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, top: -4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 10, fontWeight: '900', color: colors.ink },
  tag: { position: 'absolute', left: -8, top: -4, borderRadius: 999, paddingHorizontal: 4, paddingVertical: 1 },
  tagText: { fontSize: 9, fontWeight: '800', color: colors.white },
  label: { marginTop: 3, width: '100%', borderRadius: 6, overflow: 'hidden' },
  name: { backgroundColor: colors.white, color: colors.ink, fontSize: 10, fontWeight: '800', textAlign: 'center', paddingVertical: 2, paddingHorizontal: 2 },
  caption: { backgroundColor: colors.ink, color: colors.white, fontSize: 10, fontWeight: '700', textAlign: 'center', paddingVertical: 2, fontVariant: ['tabular-nums'] },
  bench: { backgroundColor: colors.pitchDark, paddingTop: 8, paddingBottom: 12 },
  benchLabel: { textAlign: 'center', color: 'rgba(255,255,255,.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 },
  benchIndex: { color: 'rgba(255,255,255,.5)', fontSize: 9, fontWeight: '800', marginTop: 2 },
});
