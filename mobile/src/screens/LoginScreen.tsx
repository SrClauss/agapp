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
import client from '../api/axiosClient';
import axios from 'axios';
import { WebView } from 'react-native-webview';
import { Modal, ActivityIndicator } from 'react-native';

export default function LoginScreen() {
  const navigation = useNavigation();
  const setToken = useAuthStore((s: AuthState) => s.setToken);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileLoading, setTurnstileLoading] = useState(false);

  const { signIn } = useGoogleAuth();

  const checkAdAndNavigate = async (user: any) => {
    console.log('🔍 Verificando anúncios para usuário:', user.email, 'roles:', user.roles);

    if (!user.is_profile_complete) {
      console.log('📝 Usuário precisa completar perfil');
      navigation.navigate('CompleteProfile' as never);
      return;
    }

    if (user.roles.includes('client') && user.roles.includes('professional')) {
      console.log('👥 Usuário tem múltiplos roles, indo para seleção');
      navigation.navigate('ProfileSelection' as never);
      return;
    }

    // Determinar adType baseado no role (formato mobile)
    const adType = user.roles.includes('client') ? 'publi_client' : 'publi_professional';
    console.log('📍 AdType determinado:', adType);

    // Verificar se anúncios estão disponíveis
    try {
      console.log('🔍 Verificando anúncio para adType:', adType);

      const checkResponse = await client.get(`/system-admin/api/public/ads/${adType}/check`);
      console.log('📡 Status da verificação de anúncios:', checkResponse.status);
      console.log('📦 Check data:', checkResponse.data);

      if (checkResponse.data.exists) {
        console.log('✅ Anúncio encontrado, navegando para AdScreen');
        // Converter adType para location para compatibilidade com AdScreen
        const location = adType === 'publi_client' ? 'publi_screen_client' : 'publi_screen_professional';
        // Determine role when user already has a single role
        const roleParam = user.roles.includes('client') && !user.roles.includes('professional') ? 'client' : user.roles.includes('professional') && !user.roles.includes('client') ? 'professional' : undefined;
        navigation.navigate('AdScreen' as never, { location, role: roleParam } as any);
        return;
      }

      console.log('ℹ️ Nenhum anúncio disponível, indo para tela principal');
    } catch (error: any) {
      console.error('🚨 Erro ao verificar anúncios:', error);
    }

    // Se não houver anúncios ou erro, vai direto para tela principal
    const destination = user.roles.includes('client')
      ? 'WelcomeCustomer'
      : user.roles.includes('professional')
      ? 'WelcomeProfessional'
      : 'WelcomeCustomer';
    navigation.navigate(destination as never);
  };

  const onEmailLogin = async () => {
    console.log('[Login] onEmailLogin start', { email });
    setLoading(true);
    setError(null);
    try {
      // Fetch Turnstile site key from backend
      setTurnstileLoading(true);
      try {
        const { data } = await client.get('/auth/turnstile-site-key');
        console.log('[Login] got /auth/turnstile-site-key', data.site_key);
        setTurnstileSiteKey(data.site_key);
      } catch (err: any) {
        // If the dedicated endpoint is missing (404), fall back to fetching the /turnstile HTML page and extract site_key
        console.warn('[Login] /auth/turnstile-site-key returned 404, attempting /turnstile fallback');
        if (err?.response?.status === 404) {
          try {
            const { data: html } = await client.get('/turnstile');
            // Try to extract data-sitekey or a JS variable named site_key
            const m1 = html.match(/data-sitekey=\"([^\"]+)\"/i);
            const m2 = html.match(/site_key\W*[:=]\W*['\"]([^'\"]+)['\"]/i);
            const m = m1 || m2;
            if (m && m[1]) {
              console.log('[Login] extracted site_key from /turnstile', m[1]);
              setTurnstileSiteKey(m[1]);
            } else {
              throw new Error('Não foi possível extrair a site_key do HTML do Turnstile');
            }
          } catch (e: any) {
            setTurnstileLoading(false);
            setError('Erro ao obter chave do Turnstile');
            setLoading(false);
            return;
          }
        } else {
          setTurnstileLoading(false);
          setError('Erro ao iniciar verificação anti-bot');
          setLoading(false);
          return;
        }
      } finally {
        setTurnstileLoading(false);
      }

      setShowTurnstile(true);
    } catch (e: any) {
      setTurnstileLoading(false);
      setError('Erro ao iniciar verificação anti-bot');
      setLoading(false);
    }
  };

  // Handle message from WebView (turnstile token)
  const onTurnstileMessage = async (event: any) => {
    const token = event.nativeEvent.data;
    console.log('[Login] onTurnstileMessage received token', token && token.slice ? token.slice(0,30) : token);
    setShowTurnstile(false);
    setLoading(true);
    try {
      // 1) Verify token with backend
      const verifyResp = await client.post('/auth/verify-turnstile', { token });
      console.log('[Login] verify-turnstile response', verifyResp.data);
      if (!verifyResp.data || !verifyResp.data.success) {
        const msg = verifyResp.data?.message || 'Falha na verificação anti-bot';
        throw new Error(msg);
      }

      // 2) Call login normally (backend no longer needs the token here)
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

      try {
        await checkAdAndNavigate(user);
      } catch (navErr: any) {
        console.error('[Login] navigation failed', navErr);
        // Fallback: navigate to a safe default
        try {
          const dest = user.roles && user.roles.includes('client') ? 'WelcomeCustomer' : 'WelcomeProfessional';
          navigation.navigate(dest as never);
        } catch (fallbackErr) {
          console.error('[Login] fallback navigation also failed', fallbackErr);
        }
      }
    } catch (e: any) {
      console.error('[Login] onTurnstileMessage error', e);
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
      const signInResult: any = await signIn();
      const idToken = signInResult?.idToken;
      const accessToken = signInResult?.accessToken;
      const profile = signInResult?.userInfo;

      if (!idToken) {
        throw new Error('Não foi possível obter o token do Google');
      }

      console.log('Enviando token para o backend...');
      const data = await loginWithGoogle(idToken);

      await setToken(data.token);
      let user = data.user || (await fetchCurrentUser(data.token));
      // If backend didn't return avatar_url, try to get from Google profile or accessToken
      if (user && (!user.avatar_url || user.avatar_url === '')) {
        // Try to use profile returned from native GoogleSignIn
        const pictureFromProfile = profile?.user?.photo || profile?.user?.photoUrl || profile?.user?.photoURL || profile?.photo || profile?.picture;
        if (pictureFromProfile) {
          user = { ...user, avatar_url: pictureFromProfile };
        } else if (accessToken) {
          // Fallback: fetch from Google Userinfo endpoint using accessToken
          try {
            const { data: googleProfile } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            if (googleProfile?.picture) {
              user = { ...user, avatar_url: googleProfile.picture };
            }
          } catch (err) {
            console.warn('Erro ao buscar foto do Google via API userinfo', err);
          }
        }
      }
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

      await checkAdAndNavigate(user);
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

          {/* Turnstile modal */}
          <Modal visible={showTurnstile} animationType="slide" transparent={false} onRequestClose={() => setShowTurnstile(false)}>
            {turnstileLoading || !turnstileSiteKey ? (
              <ActivityIndicator size="large" />
            ) : (
              <WebView
                originWhitelist={["*"]}
                source={{ html: `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
  </head>
  <body>
    <div id="widget"></div>
    <script>
      function onSuccess(token) {
        window.ReactNativeWebView.postMessage(token);
      }
      function onLoad() {
        const container = document.getElementById('widget');
        if (container) {
          container.innerHTML = '<div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-callback="onSuccess"></div>';
          var script = document.createElement('script');
          script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
          document.body.appendChild(script);
        }
      }
      window.onload = onLoad;
    </script>
  </body>
</html>` }}
                onMessage={onTurnstileMessage}
                onError={(e) => {
                  console.error('[Login] WebView onError', e);
                  setShowTurnstile(false);
                  setError('Erro ao carregar widget de verificação');
                }}
                onHttpError={(e) => {
                  console.error('[Login] WebView onHttpError', e);
                  setShowTurnstile(false);
                  setError('Erro ao carregar widget de verificação (HTTP)');
                }}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
              />
                onMessage={onTurnstileMessage}
                javaScriptEnabled
                domStorageEnabled
                startInLoadingState
              />
            )}
          </Modal>

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
