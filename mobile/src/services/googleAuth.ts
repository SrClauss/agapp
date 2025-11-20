import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';

// Importante: completa a sessão de autenticação quando retornar da WebView
WebBrowser.maybeCompleteAuthSession();

// Configuração do Google OAuth usando variáveis de ambiente
// TODOS os Client IDs apontam para o mesmo valor do google-services.json
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';

export function useGoogleAuth() {
  // Usar proxy do Expo (https://auth.expo.io)
  // Isso evita problemas com URIs personalizadas que Google não aceita
  const redirectUri = makeRedirectUri({
    useProxy: true,
  });

  console.log('🔐 Google OAuth Redirect URI:', redirectUri);

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    webClientId: GOOGLE_CLIENT_ID_WEB,
    redirectUri: redirectUri,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
    // Configurações para obter id_token diretamente
    responseType: 'id_token',
    usePKCE: false,
  });

  return {
    request,
    response,
    promptAsync,
  };
}

export function extractIdTokenFromResponse(response: any): string | null {
  if (response?.type === 'success') {
    const { authentication } = response;
    return authentication?.idToken || null;
  }
  return null;
}
