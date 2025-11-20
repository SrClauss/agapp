import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();

// Configuração do Google OAuth
// NOTA: Você precisará configurar suas credenciais OAuth no Google Cloud Console
// e adicionar essas variáveis no seu .env ou app.config.js
export const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID || '';
export const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS || '';
export const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB || '';

export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    webClientId: GOOGLE_CLIENT_ID_WEB,
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
