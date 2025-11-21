import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Button, TextInput, Surface, Title, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { loginWithEmail, loginWithGoogle, fetchCurrentUser } from '../api/auth';
import { useGoogleAuth } from '../services/googleAuth';

export default function LoginScreen() {
  const navigation = useNavigation();
  const setToken = useAuthStore((s: AuthState) => s.setToken);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { signIn } = useGoogleAuth();

  const onEmailLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loginWithEmail(email, password);
      await setToken(data.token);
      const user = data.user || (await fetchCurrentUser(data.token));
      setUser(user);
      if (!user.is_profile_complete) {
        navigation.navigate('CompleteProfile' as never);
      } else {
        navigation.navigate('Welcome' as never);
      }
    } catch (e: any) {
      setError(e.message || 'Erro no login');
    } finally {
      setLoading(false);
    }
  };

  const onGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      // Fazer login nativo com Google
      const idToken = await signIn();

      if (!idToken) {
        throw new Error('Não foi possível obter o token do Google');
      }

      console.log('Enviando token para o backend...');
      const data = await loginWithGoogle(idToken);

      await setToken(data.token);
      const user = data.user || (await fetchCurrentUser(data.token));
      setUser(user);

      if (!user.is_profile_complete) {
        navigation.navigate('CompleteProfile' as never);
      } else {
        navigation.navigate('Welcome' as never);
      }
    } catch (e: any) {
      console.error('Erro no Google Sign-In:', e);
      setError(e.message || 'Erro ao fazer login com Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Surface style={styles.surface} elevation={2}>
        <Title style={styles.title}>Entrar</Title>

        <TextInput
          label="E-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          label="Senha"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        {error ? <HelperText type="error">{error}</HelperText> : null}

        <Button mode="contained" onPress={onEmailLogin} loading={loading} style={styles.button}>
          Entrar com e-mail
        </Button>

        <Button
          mode="outlined"
          onPress={onGoogleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
        >
          Entrar com Google
        </Button>

        <Button onPress={() => navigation.navigate('SignUp')} compact>
          Criar conta
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 16 },
  surface: { padding: 20, borderRadius: 8 },
  title: { marginBottom: 12 },
  input: { marginBottom: 12 },
  button: { marginVertical: 6 },
});
