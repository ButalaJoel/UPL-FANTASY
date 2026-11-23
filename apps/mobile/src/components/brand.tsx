import { colors, initials, type ClubRef } from '@kiwanja/client';
import { Text, View } from 'react-native';
import Svg, { Circle, Path, Rect, Text as SvgText } from 'react-native-svg';

/** Kiwanja mark: centre circle + a "K" that doubles as a passing lane (original placeholder identity). */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Rect width="64" height="64" rx="16" fill={colors.ink} />
      <Circle cx="32" cy="32" r="17" fill="none" stroke={colors.pitch} strokeWidth="5" />
      <Path d="M24 18v28M24 33l15-15M28 29l12 17" stroke={colors.gold} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function Logo({ light, sub = 'fantasy' }: { light?: boolean; sub?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <LogoMark />
      <View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: light ? colors.white : colors.ink, letterSpacing: -0.3 }}>kiwanja</Text>
        <Text style={{ fontSize: 9, fontWeight: '700', color: light ? colors.gold : colors.pitch, letterSpacing: 2, textTransform: 'uppercase' }}>{sub}</Text>
      </View>
    </View>
  );
}

/** Generated crest from club colours and short name: no real club logos are used. */
export function ClubCrest({ club, size = 28 }: { club?: ClubRef | null; size?: number }) {
  if (!club) return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.faint }} />;
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" accessibilityLabel={club.shortName}>
      <Path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill={club.primaryColor} stroke="rgba(0,0,0,.15)" />
      <Path d="M20 2 L36 8 V14 H4 V8 Z" fill={club.secondaryColor} opacity={0.9} />
      <SvgText x="20" y="28" textAnchor="middle" fontSize="10" fontWeight="800" fill={club.secondaryColor}>
        {club.shortName}
      </SvgText>
    </Svg>
  );
}

/** Shirt in club colours for pitch views. Goalkeepers wear gold. */
export function Shirt({ primary, secondary, gk, size = 44 }: { primary: string; secondary: string; gk?: boolean; size?: number }) {
  const body = gk ? colors.gold : primary;
  const trim = gk ? colors.ink : secondary;
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path d="M16 4 L8 8 L2 18 L9 22 L12 18 V44 H36 V18 L39 22 L46 18 L40 8 L32 4 C30 8 18 8 16 4 Z" fill={body} stroke="rgba(0,0,0,.25)" strokeWidth="1" />
      <Path d="M16 4 C18 8 30 8 32 4" stroke={trim} strokeWidth="3" fill="none" />
      <Rect x="22" y="12" width="4" height="32" fill={trim} opacity={0.55} />
    </Svg>
  );
}

export function Avatar({ name, color, size = 36 }: { name: string; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? colors.pitch, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.white, fontWeight: '800', fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}
