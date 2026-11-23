import { colors, errorMessage, ORIGIN_SHORT } from '@kiwanja/client';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24 } as const;

export const type = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  h2: { fontSize: 18, fontWeight: '800', color: colors.ink },
  h3: { fontSize: 15, fontWeight: '700', color: colors.ink },
  body: { fontSize: 14, color: colors.ink },
  small: { fontSize: 12, color: colors.muted },
  label: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  num: { fontVariant: ['tabular-nums'] },
});

/** Scrollable page with pull-to-refresh. */
export function Screen({ children, onRefresh, refreshing = false, padded = true, style }: { children: ReactNode; onRefresh?: () => void; refreshing?: boolean; padded?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={[padded && { padding: space.lg }, { paddingBottom: space.xl + insets.bottom, gap: space.lg }, style]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const body = <View style={[styles.card, style]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.85 }}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

export function SectionTitle({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={type.h2}>{children}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={{ color: colors.pitch, fontWeight: '700' }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

type ButtonVariant = 'primary' | 'dark' | 'gold' | 'ghost' | 'danger';
export function Button({ title, onPress, variant = 'primary', disabled, loading, icon, style, small }: { title: string; onPress?: () => void; variant?: ButtonVariant; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; small?: boolean }) {
  const v = BUTTON[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: v.bg }, variant === 'ghost' && { borderWidth: 1, borderColor: colors.line }, (disabled || loading) && { opacity: 0.45 }, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Ionicons name={icon} size={small ? 14 : 18} color={v.fg} /> : null}
      <Text style={[styles.buttonText, small && { fontSize: 12 }, { color: v.fg }]}>{title}</Text>
    </Pressable>
  );
}
const BUTTON: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.pitch, fg: colors.white },
  dark: { bg: colors.ink, fg: colors.white },
  gold: { bg: colors.gold, fg: colors.ink },
  ghost: { bg: colors.white, fg: colors.ink },
  danger: { bg: colors.clay, fg: colors.white },
};

export function Chip({ label, color = colors.faint, textColor = colors.ink, style }: { label: string; color?: string; textColor?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.chip, { backgroundColor: color }, style]}>
      <Text style={[styles.chipText, { color: textColor }]}>{label}</Text>
    </View>
  );
}

export function OriginChip({ origin }: { origin: string }) {
  return <Chip label={ORIGIN_SHORT[origin] ?? origin} color={origin === 'SAMPLE' ? colors.goldLight : colors.faint} textColor={origin === 'SAMPLE' ? '#8A6A00' : colors.ink} />;
}

export function StatusChip({ status }: { status: string }) {
  const s = { PENDING: [colors.goldLight, '#8A6A00'], VERIFIED: [colors.pitchLight, colors.pitchDark], DISPUTED: [colors.clayLight, colors.clay] }[status];
  if (!s) return null;
  return <Chip label={status === 'VERIFIED' ? '✓' : status.toLowerCase()} color={s[0]} textColor={s[1]} />;
}

export function Stat({ label, value, hint, accent, style }: { label: string; value: ReactNode; hint?: string; accent?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.stat, accent && { backgroundColor: colors.ink }, style]}>
      <Text style={[type.label, accent && { color: colors.gold }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.statValue, accent && { color: colors.white }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? (
        <Text style={[type.small, accent && { color: 'rgba(255,255,255,.6)' }]} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.statGrid}>{children}</View>;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.pitch} size="large" />
      {label ? <Text style={[type.small, { marginTop: 8 }]}>{label}</Text> : null}
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={18} color={colors.clay} />
      <Text style={{ flex: 1, color: colors.clay, fontSize: 13 }}>{errorMessage(error)}</Text>
      {onRetry && <Button small variant="ghost" title="Retry" onPress={onRetry} />}
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const bg = { info: '#E8F0FE', warn: colors.clayLight, ok: colors.pitchLight }[tone];
  const fg = { info: '#1E4FA8', warn: colors.clay, ok: colors.pitchDark }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, lineHeight: 17 }}>{children}</Text>
    </View>
  );
}

export function Empty({ title, children, icon = 'football-outline' }: { title: string; children?: ReactNode; icon?: IconName }) {
  return (
    <View style={[styles.center, { paddingVertical: 32 }]}>
      <Ionicons name={icon} size={34} color={colors.muted} />
      <Text style={[type.h3, { marginTop: 8 }]}>{title}</Text>
      {children ? <Text style={[type.small, { textAlign: 'center', marginTop: 4, maxWidth: 280 }]}>{children}</Text> : null}
    </View>
  );
}

/** iOS-style segmented control. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, on && styles.segmentOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
            <Text style={[styles.segmentText, on && { color: colors.ink }]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom sheet built on the core Modal (works in Expo Go and on web). */
export function Sheet({ open, onClose, title, children, tall }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; tall?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }, tall && { height: '88%' }]}>
        <View style={styles.grabber} />
        {title ? (
          <View style={styles.sheetHeader}>
            <Text style={[type.h2, { flex: 1 }]} numberOfLines={2}>
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
        ) : null}
        {children}
      </View>
    </Modal>
  );
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>{children}</View>;
}

export function Divider() {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />;
}

export function T({ children, style, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[type.body, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export const inputStyle: TextStyle = { backgroundColor: colors.white, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.ink };

export const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, shadowColor: colors.ink, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  button: { minHeight: 48, borderRadius: radius.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  buttonSmall: { minHeight: 34, paddingHorizontal: space.md, borderRadius: radius.sm },
  buttonText: { fontSize: 15, fontWeight: '700' },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '700' },
  stat: { flexGrow: 1, flexBasis: '45%', backgroundColor: colors.white, borderRadius: radius.lg, padding: space.md, gap: 2, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  statValue: { fontSize: 24, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  error: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.clayLight, borderRadius: radius.md, padding: space.md },
  notice: { borderRadius: radius.md, padding: space.md },
  segmented: { flexDirection: 'row', backgroundColor: colors.faint, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: radius.sm, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,26,20,.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92%', backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: space.lg, paddingTop: space.sm },
  grabber: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.line, marginBottom: space.sm },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
});
