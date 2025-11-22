import React, { useState } from 'react';
import { Text, KeyboardAvoidingView, Platform, ImageBackground, Image, View, StyleSheet } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { loginWithEmail, loginWithGoogle, fetchCurrentUser } from '../api/auth';
import { useGoogleAuth } from '../services/googleAuth';
import SocialButton from '../components/SocialButton';
import NotificationsService from '../services/notifications';
import { transparent } from 'react-native-paper/lib/typescript/styles/themes/v2/colors';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

export default function LoginScreen() {
  const navigation = useNavigation();
  const setToken = useAuthStore((s: AuthState) => s.setToken);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      } else if (user.roles.includes('client') && user.roles.includes('professional')) {
        navigation.navigate('ProfileSelection' as never);
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
      } else if (user.roles.includes('client') && user.roles.includes('professional')) {
        navigation.navigate('ProfileSelection' as never);
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
      style={styles.background}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.formContainer}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
          <Text style={styles.title}>Agiliza</Text>
          <Text style={styles.subtitle}>Quem você precisa, exatamente onde você está</Text>

          <TextInput
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            theme={{ colors: { text: '#000' } }}
            left={<TextInput.Icon icon="email" />}
          />

          <TextInput
            label="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            style={styles.input}
            theme={{ colors: { text: '#000' } }}
            left={<TextInput.Icon icon="lock" />}
            right={<TextInput.Icon icon={showPassword ? "eye-off" : "eye"} onPress={() => setShowPassword(!showPassword)} />}
          />

          {error ? <HelperText type="error" style={styles.errorText}>{error}</HelperText> : null}

          <Button mode="contained" onPress={onEmailLogin} loading={loading} style={styles.button} buttonColor="#6200ee">
            Entrar
          </Button>

          <SocialButton
            label="Continuar com Google"
            onPress={onGoogleLogin}
            loading={loading}
            disabled={loading}
            iconName="google"
            iconColor="#DB4437"
            mode="contained"
            style={styles.googleButton}
            
          />

          <Button
            onPress={() => navigation.navigate('SignUp')}
            mode="text"
            textColor="#fff"
            style={styles.signUpButton}
          >
            Criar conta
          </Button>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  transparent:{

    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    


  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#499bafff',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 84,
    height: 84,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
    textAlign: 'center',
    color: '#fff',
  },
  input: {
    width: '100%',
    marginBottom: 8,
    backgroundColor: 'white',
  },
  errorText: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  button: {
    width: '100%',
    marginVertical: 4,
  },
  googleButton: {

    width: '100%',
    marginVertical: 4,
    backgroundColor: '#ffffffff',
  },
  signUpButton: {
    marginTop: 8,
    width: '100%',
    borderColor: '#2e2e2eff',
    borderWidth: 1,
  },
});
