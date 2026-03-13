import React, { useState, useRef, useEffect } from 'react';
import { Text, KeyboardAvoidingView, Platform, ImageBackground, Image, View, StyleSheet } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import useAuthStore, { AuthState } from '../stores/authStore';
import { loginWithEmail, loginWithGoogle, fetchCurrentUser } from '../api/auth';
import { useGoogleAuth } from '../services/googleAuth';
import SocialButton from '../components/SocialButton';
import NotificationsService from '../services/notifications';

import client from '../api/axiosClient';
import axios from 'axios';
import { checkAdScreenVersion } from '../api/adsService';
import { WebView } from 'react-native-webview';
import { Modal, ActivityIndicator, Linking } from 'react-native';

export default function LoginScreen() {
  const navigation = useNavigation();
  const token = useAuthStore((s: AuthState) => s.token);
  const setToken = useAuthStore((s: AuthState) => s.setToken);
  const setUser = useAuthStore((s: AuthState) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showTurnstile, setShowTurnstile] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileUri, setTurnstileUri] = useState<string | null>(null);
  const [turnstileLoading, setTurnstileLoading] = useState(false);
  const [webviewError, setWebviewError] = useState<string | null>(null);

  // Ref para controlar timeout do WebView (evita usar `window` diretamente)
  const turnstileTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (turnstileTimeoutRef.current) {
        clearTimeout(turnstileTimeoutRef.current);
        turnstileTimeoutRef.current = null;
      }
    };
  }, []);

  const { request, response, signIn } = useGoogleAuth();
  // Ref para controlar se um login Google está em andamento
  const googleLoginInProgressRef = useRef(false);

  // Monitora a resposta do OAuth Google (expo-auth-session é assíncrono/reativo)
  useEffect(() => {
    if (!response || !googleLoginInProgressRef.current) return;

    if (response.type === 'success') {
      const { authentication } = response;
      handleGoogleAuthSuccess(authentication);
    } else if (response.type === 'error') {
      setError('Erro ao fazer login com Google');
      setLoading(false);
      googleLoginInProgressRef.current = false;
    } else if (response.type === 'dismiss' || response.type === 'cancel' || response.type === 'locked') {
      setLoading(false);
      googleLoginInProgressRef.current = false;
    }
  }, [response]);

  const checkAdAndNavigate = async (user: any) => {
    console.log('🔍 Verificando anúncios para usuário:', user.email, 'roles:', user.roles);
    console.log('🔍 [checkAdAndNavigate] Token no store:', token ? 'Existe ✓' : 'NULL ✗');

    if (!user.is_profile_complete) {
      console.log('📝 Usuário precisa completar perfil');
      console.log('🚀 Navegando para CompleteProfile...');
      navigation.navigate('CompleteProfile' as never);
      return;
    }

    if (user.roles.includes('client') && user.roles.includes('professional')) {
      console.log('👥 Usuário tem múltiplos roles, indo para seleção');
      navigation.navigate('ProfileSelection' as never);
      return;
    }

    // Determine target based on user role
    const target: 'client' | 'professional' = user.roles.includes('client') ? 'client' : 'professional';
    const roleParam: 'client' | 'professional' | undefined = target;

    // Check if AdScreen is configured using the version endpoint
    try {
      console.log('🔍 Verificando versão do AdScreen para target:', target);
      const version = await checkAdScreenVersion(target);
      if (version > 0) {
        console.log(`✅ AdScreen configurado (v${version}), navegando para AdScreen`);
        navigation.navigate('AdScreen' as never, { target, role: roleParam } as any);
        return;
      }

      console.log('ℹ️ Nenhum AdScreen disponível, indo para tela principal');
    } catch (error: any) {
      console.error('🚨 Erro ao verificar AdScreen:', error);
    }

    // If no AdScreen or error, go directly to main screen
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
    setTurnstileLoading(true);
    try {
      // First, ask backend for site_key and hosted URL (if available)
      const { data } = await client.get('/auth/turnstile-site-key');
      console.log('[Login] got turnstile info', data);
      if (data.turnstile_url) {
        // Defensive: às vezes a URL vem como objeto { _url: 'http://...' } quando serializada
        const turnstileUrl = typeof data.turnstile_url === 'string' ? data.turnstile_url : (data.turnstile_url && (data.turnstile_url._url || String(data.turnstile_url)));
        setTurnstileUri(turnstileUrl);
        console.log('[Login] using hosted turnstile_url', turnstileUrl, 'raw:', data.turnstile_url);
      } else if (data.site_key) {
        setTurnstileSiteKey(data.site_key);
      } else {
        throw new Error('Turnstile info incomplete');
      }
    } catch (err: any) {
      console.error('[Login] error determining Turnstile source', err);
      // If both endpoints 404 (server not deployed), try a known absolute domain fallback
      if (err?.response?.status === 404) {
        const fallback = 'https://agilizapro.cloud/turnstile';
        console.warn('[Login] falling back to absolute turnstile URL', fallback);
        setTurnstileUri(fallback);
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
    
    // Timeout: se após 10s não receber mensagem, mostrar erro
    const timeoutId = setTimeout(() => {
      console.warn('[Login] WebView timeout - no message received after 10s');
      setWebviewError('Timeout ao carregar verificação. Tente novamente ou abra no navegador.');
    }, 10000);
    
    // Guardar timeout em ref para podermos limpar depois
    turnstileTimeoutRef.current = timeoutId;
  };

  // Handle message from WebView (turnstile token)
  const onTurnstileMessage = async (event: any) => {
    // Limpar timeout (se existente)
    if (turnstileTimeoutRef.current) {
      clearTimeout(turnstileTimeoutRef.current);
      turnstileTimeoutRef.current = null;
    }
    
    let payload = event.nativeEvent.data;
    // Console messages from WebView might be JSON; try parse
    let parsed: any = null;
    try { parsed = JSON.parse(payload); } catch(e) { parsed = null; }

    if (parsed && parsed.type === 'console') {
      console.log('[Login][WebViewConsole]', parsed.level, ...parsed.args);
      return;
    }
    if (parsed && parsed.type === 'debug') {
      console.log('[Login][WebViewDebug]', parsed.msg);
      // Detect common failure modes and show friendly message
      const msgLower = String(parsed.msg || '').toLowerCase();
      if (msgLower.includes('widget-not-present') || msgLower.includes('turnstile script error') || msgLower.includes('no widget container') || msgLower.includes('widget-timeout')) {
        setWebviewError('Verificação indisponível para este domínio. Entre em contato com o administrador se o problema persistir.');
      }
      return;
    }

    // Ignore non-token control messages from the hosted page (e.g., turnstile_ready)
    const allowedTypes = new Set(['token', 'turnstile_success', 'turnstile_error']);
    if (parsed && parsed.type && !allowedTypes.has(parsed.type)) {
      console.log('[Login] Ignoring non-token WebView message type:', parsed.type);
      return;
    }

    if (parsed && parsed.type === 'token') {
      payload = parsed.token;
    }

    let token = payload;

    console.log('[Login] onTurnstileMessage received token/evt (first30):', token && token.slice ? token.slice(0,30) : token, 'parsedType=', parsed?.type);
    setShowTurnstile(false);
    setLoading(true);
    try {
      // If message is from hosted page types
      if (parsed && parsed.type === 'turnstile_success') {
        token = parsed.token;
      } else if (parsed && parsed.type === 'turnstile_error') {
        setWebviewError(parsed.error || 'Erro na verificação anti-bot');
        throw new Error(parsed.error || 'Erro na verificação anti-bot');
      }

      // Directly use the token in the login request and let the backend verify it once
      const data = await loginWithEmail(email, password, token);
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
      // Mensagem de erro já formatada pela API
      setError(e.message || 'Erro no login');
      setShowTurnstile(false);
    } finally {
      setLoading(false);
    }
  };

  // Processa a autenticação Google com sucesso (chamado pelo useEffect que monitora response)
  const handleGoogleAuthSuccess = async (authentication: any) => {
    try {
      const accessToken = authentication?.accessToken;
      const refreshToken = authentication?.refreshToken;

      if (!accessToken) {
        throw new Error('Não foi possível obter o token do backend');
      }

      console.log('✅ Login com Google bem-sucedido (server-side OAuth)');

      // O backend já retornou os JWTs; apenas setar no store
      await setToken(accessToken);
      const user = await fetchCurrentUser(accessToken);
      console.log('👤 User recebido:', user ? user.email : 'NULL');
      setUser(user);

      // Aguardar um pouco para garantir que o estado seja persistido
      await new Promise(resolve => setTimeout(resolve, 100));

      // Registrar push token após login com Google
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
      googleLoginInProgressRef.current = false;
    }
  };

  const onGoogleLogin = () => {
    setError(null);
    setLoading(true);
    googleLoginInProgressRef.current = true;
    signIn();
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

          {/* Turnstile small overlay */}
          <Modal visible={showTurnstile} animationType="fade" transparent={true} onRequestClose={() => { setShowTurnstile(false); setWebviewError(null); }}>
            <View style={styles.overlay}>
              <View style={styles.turnstileBox}>
                <View style={styles.turnstileHeader}>
                  <Text style={styles.turnstileTitle}>Verificação anti-bot</Text>
                  <Button compact onPress={() => { setShowTurnstile(false); setWebviewError(null); }}>Fechar</Button>
                </View>

                {turnstileLoading || (!turnstileSiteKey && !turnstileUri) ? (
                  <View style={styles.turnstileLoader}><ActivityIndicator size="large" /></View>
                ) : webviewError ? (
                  <View style={styles.turnstileErrorContainer}>
                    <Text style={styles.turnstileErrorText}>{webviewError}</Text>
                    <Button mode="contained" onPress={() => { setWebviewError(null); setShowTurnstile(false); }} style={{marginTop:12}}>OK</Button>
                    {turnstileUri ? (
                      <Button onPress={() => Linking.openURL(turnstileUri)} style={{marginTop:12}}>Abrir verificação no navegador</Button>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.turnstileWebviewContainer}>
                    <WebView
                      originWhitelist={["*"]}
                      source={ turnstileUri ? { uri: turnstileUri } : { html: `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <script>
      // Debug wrapper: forward console.* to ReactNativeWebView
      (function(){
        const methods = ['log','error','warn','info','debug'];
        methods.forEach(m => {
          const original = console[m];
          console[m] = function(...args){
            try{ window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'console', level: m, args })); } catch(e){}
            original && original.apply(console, args);
          }
        });
      })();
    </script>
  </head>
  <body>
    <div id="widget"></div>
    <script>
      function postDebug(msg){ try{ window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'debug', msg })); } catch(e){} }
      postDebug('onLoad script start');

      function onSuccess(token) {
        postDebug('onSuccess token received');
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'token', token }));
      }

      function loadTurnstile(){
        var container = document.getElementById('widget');
        if (!container){ postDebug('no widget container'); return; }
        container.innerHTML = '<div class="cf-turnstile" data-sitekey="${turnstileSiteKey}" data-callback="onSuccess"></div>';
        var script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = function(){ postDebug('turnstile script loaded');
          // wait a bit then check if widget rendered
          setTimeout(function(){
            if (container.querySelector('.cf-turnstile') || container.querySelector('iframe')){
              postDebug('widget-present');
            } else {
              postDebug('widget-not-present-after-load');
            }
          }, 1000);
        };
        script.onerror = function(e){ postDebug('turnstile script error'); };
        document.body.appendChild(script);
      }

      window.addEventListener('load', function(){ postDebug('window.load'); loadTurnstile(); });
      // Safety timeout
      setTimeout(function(){ postDebug('widget-timeout-check'); }, 8000);
    </script>
  </body>
</html>` } }
                      onMessage={onTurnstileMessage}
                      onError={(e) => {
                        console.error('[Login] WebView onError', e);
                        setWebviewError('Erro ao carregar widget de verificação.');
                      }}
                      onHttpError={(e) => {
                        console.error('[Login] WebView onHttpError', e);
                        setWebviewError('Erro ao carregar widget de verificação (HTTP)');
                      }}
                      onLoadStart={() => console.log('[Login] WebView load start')}
                      onLoadEnd={() => console.log('[Login] WebView load end')}
                      onNavigationStateChange={(navState) => {
                        console.log('[Login] WebView navigation:', navState.url, 'loading:', navState.loading);
                      }}
                      mixedContentMode="always"
                      javaScriptEnabled
                      domStorageEnabled
                      startInLoadingState
                      style={{flex:1}}/>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <SocialButton
            label="Continuar com Google"
            onPress={onGoogleLogin}
            loading={loading}
            disabled={!request || loading}
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
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 16,
  },
  turnstileBox: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 10,
    overflow: 'hidden',
    padding: 12,
  },
  turnstileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  turnstileTitle: {
    fontWeight: 'bold',
  },
  turnstileLoader: {
    padding: 24,
    alignItems: 'center',
  },
  turnstileWebviewContainer: {
    height: 320,
    width: '100%',
  },
  turnstileErrorContainer: {
    padding: 12,
    alignItems: 'center',
  },
  turnstileErrorText: {
    color: '#b00020',
    textAlign: 'center',
  },
});
