import React, { useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, ImageBackground, Image, View } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { loginWithEmail, loginWithGoogle, fetchCurrentUser } from '../api/auth';
import { useGoogleAuth } from '../services/googleAuth';
import { commonStyles } from '../theme/styles';
import { BlurView } from 'expo-blur';
import SocialButton from '../components/SocialButton';
import NotificationsService from '../services/notifications';

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
      // Register push token on successful login
      try {
        const pushToken = await NotificationsService.registerForPushNotificationsAsync();
        if (pushToken) {
          await NotificationsService.registerPushTokenOnServer(pushToken);
        }
      } catch (err) {
        console.warn('Failed to register push token', err);
      }
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
      // Register push token on successful Google login
      try {
        const pushToken = await NotificationsService.registerForPushNotificationsAsync();
        if (pushToken) {
          await NotificationsService.registerPushTokenOnServer(pushToken);
        }
      } catch (err) {
        console.warn('Failed to register push token', err);
      }

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
    <ImageBackground
      source={require('../../assets/background.jpg')}
      style={commonStyles.fullBackground}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={commonStyles.centeredContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BlurView intensity={60} tint="light" style={commonStyles.glassSurface}>
          <View style={commonStyles.glassSurfaceContainer}>
            <Image source={require('../../assets/icon.png')} style={commonStyles.logo} />
            <Text style={commonStyles.title}>Entrar</Text>
            <Text style={commonStyles.subtitle}>Agilize quem você precisa, exatamente onde você está</Text>

            <TextInput
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={commonStyles.input}
            />

            <TextInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={commonStyles.input}
            />

            {error ? <HelperText type="error">{error}</HelperText> : null}

            <Button mode="contained" onPress={onEmailLogin} loading={loading} style={commonStyles.button}>
              Entrar
            </Button>

            <SocialButton
              label="Continuar com Google"
              onPress={onGoogleLogin}
              loading={loading}
              disabled={loading}
              iconName="google"
              iconColor="#DB4437"
              mode="outlined"
              style={commonStyles.googleButton}
            />

            <Button onPress={() => navigation.navigate('SignUp')} compact>
              Criar conta
            </Button>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}
