import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

// Configuração do Google OAuth usando variáveis de ambiente
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '756816795062-0sj0423v6lqbaacrbij1fefc4fg9mk8g.apps.googleusercontent.com';

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    webClientId: GOOGLE_CLIENT_ID_WEB,
    // Usar WebView em vez de navegador externo
    useProxy: true,
    // Configuração para melhor experiência no mobile
    selectAccount: true,
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
