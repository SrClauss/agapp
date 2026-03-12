import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

if (!GOOGLE_CLIENT_ID_WEB) {
  console.error('ERRO: EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB não está configurado!');
}

export function useGoogleAuth() {
  // useIdTokenAuthRequest usa ResponseType.IdToken e adiciona nonce automaticamente.
  // Isso resolve o erro 400 "invalid_request" que ocorre quando o nonce está ausente.
  // webClientId = usado pelo Expo Go. O redirect URI será: https://auth.expo.io/@clausemberg/agapp
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_CLIENT_ID_WEB!,
  });

  useEffect(() => {
    console.log('=== Google OAuth (useIdTokenAuthRequest) ===');
    console.log('Web Client ID:', GOOGLE_CLIENT_ID_WEB);
    console.log('Redirect URI:', request?.redirectUri);
  }, [request]);

  useEffect(() => {
    if (response?.type === 'success') {
      console.log('✅ OAuth OK - id_token presente:', !!response.params?.id_token);
    } else if (response?.type === 'error') {
      console.error('❌ Erro OAuth:', response.error);
    }
  }, [response]);

  return {
    signIn: async () => {
      const result = await promptAsync();

      if (result?.type === 'success') {
        const idToken    = result.params?.id_token    ?? null;
        const accessToken = result.params?.access_token ?? null;

        console.log('idToken:', idToken ? 'OK' : 'NULL');
        console.log('accessToken:', accessToken ? 'OK' : 'NULL');

        let userInfo = null;
        if (accessToken) {
          try {
            const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            userInfo = await resp.json();
          } catch (err) {
            console.warn('Erro ao buscar userinfo:', err);
          }
        }

        return { idToken, accessToken, userInfo };
      }

      if (result?.type === 'error') {
        throw new Error(result.error?.message ?? 'Erro no login do Google');
      }

      throw new Error('Login cancelado');
    },
    signOut: async () => {
      console.log('Logout - limpar tokens locais');
    },
  };
}
