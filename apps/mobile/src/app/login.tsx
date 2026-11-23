import { authApi, colors, DEMO_ACCOUNTS, DEMO_PASSWORD, useAuth } from '@kiwanja/client';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Logo } from '@/components/brand';
import { Button, ErrorView, inputStyle, Screen, type } from '@/components/ui';
import { currentServer } from '@/lib/session';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(await authApi.login(email.trim(), password));
      router.back();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <View style={{ alignItems: 'center', marginVertical: 12 }}>
          <Logo />
        </View>
        <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={inputStyle} placeholder="Password" placeholderTextColor={colors.muted} secureTextEntry autoComplete="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
        <ErrorView error={error} />
        <Button title="Sign in" loading={busy} disabled={!email || !password} onPress={submit} />
        <Button variant="ghost" title="New here? Create an account" onPress={() => router.replace('/register')} />
        <View style={styles.demo}>
          <Text style={type.label}>Demo accounts (password {DEMO_PASSWORD})</Text>
          {DEMO_ACCOUNTS.map((a) => (
            <Pressable
              key={a.email}
              onPress={() => {
                setEmail(a.email);
                setPassword(DEMO_PASSWORD);
              }}
              style={{ paddingVertical: 6 }}
            >
              <Text style={{ color: colors.pitch, fontWeight: '700' }}>{a.email}</Text>
              <Text style={type.small}>{a.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => router.push('/settings')}>
          <Text style={[type.small, { textAlign: 'center' }]}>Server: {currentServer()} (change)</Text>
        </Pressable>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  demo: { backgroundColor: colors.white, borderRadius: 14, padding: 14, gap: 2, borderWidth: 1, borderColor: colors.line },
});
