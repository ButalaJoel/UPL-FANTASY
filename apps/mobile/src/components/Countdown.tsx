import { countdown } from '@kiwanja/client';
import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

export function Countdown({ to, style }: { to: string; style?: StyleProp<TextStyle> }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>{countdown(to, now) ?? 'Deadline passed'}</Text>;
}
