import { authApi, colors, useAuth } from '@kiwanja/client';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { Button, ErrorView, Screen, T, type, inputStyle } from '@/components/ui';

export default function Register() {
  const { signIn } = useAuth();
  const [displayName, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const valid = displayName.trim().length >= 2 && email.includes('@') && password.length >= 8;
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(await authApi.register({ displayName: displayName.trim(), email: email.trim(), password }));
      router.replace('/create-team');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen>
        <T style={type.small}>Free to play. Your name appears on league tables.</T>
        <TextInput style={inputStyle} placeholder="Your name" placeholderTextColor={colors.muted} value={displayName} onChangeText={setName} autoComplete="name" />
        <TextInput style={inputStyle} placeholder="Email" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
        <TextInput style={inputStyle} placeholder="Password (8+ characters)" placeholderTextColor={colors.muted} secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword} />
        <ErrorView error={error} />
        <Button title="Create account" loading={busy} disabled={!valid} onPress={submit} />
        <Button variant="ghost" title="I already have an account" onPress={() => router.replace('/login')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
