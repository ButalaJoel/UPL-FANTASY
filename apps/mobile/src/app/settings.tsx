import { colors } from '@kiwanja/client';
import { useState } from 'react';
import { TextInput } from 'react-native';
import { Button, Card, Notice, Screen, T, type, inputStyle } from '@/components/ui';
import { currentServer, customServer, detectedServer, setCustomServer } from '@/lib/session';

/** Where the app finds the Kiwanja API. Normally detected automatically. */
export default function Settings() {
  const [url, setUrl] = useState(customServer ?? '');
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail' | 'checking'>('idle');
  const check = async (base: string) => {
    setStatus('checking');
    try {
      const r = await fetch(`${base.replace(/\/+$/, '')}/api/health`);
      setStatus(r.ok ? 'ok' : 'fail');
      return r.ok;
    } catch {
      setStatus('fail');
      return false;
    }
  };
  return (
    <Screen>
      <Card style={{ gap: 6 }}>
        <T style={type.label}>Using</T>
        <T style={{ fontWeight: '800' }}>{currentServer()}</T>
        <T style={type.small}>Detected automatically: {detectedServer()}</T>
      </Card>
      <Notice>
        When you run the app with Expo Go, it finds the API on the same computer automatically. Only set an address if your phone can't connect, for example http://192.168.1.20:4000 (your computer's Wi-Fi address).
      </Notice>
      <TextInput style={inputStyle} placeholder="http://192.168.1.20:4000" placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} keyboardType="url" value={url} onChangeText={setUrl} />
      {status === 'ok' && <Notice tone="ok">Connected.</Notice>}
      {status === 'fail' && <Notice tone="warn">No Kiwanja API answered at that address. Check the computer is on the same Wi-Fi and the API is running.</Notice>}
      <Button title="Test connection" variant="ghost" loading={status === 'checking'} onPress={() => check(url || currentServer())} />
      <Button
        title="Save and reconnect"
        disabled={!url}
        onPress={async () => {
          if (await check(url)) await setCustomServer(url);
        }}
      />
      {customServer && <Button variant="ghost" title="Use automatic address" onPress={() => (setCustomServer(null), setUrl(''))} />}
    </Screen>
  );
}
