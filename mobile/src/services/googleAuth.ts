import { useEffect } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

// Este arquivo foi reescrito para utilizar o fluxo Web OAuth em vez do SDK nativo
// o que permite que o app funcione dentro do Expo Go sem módulos nativos.

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
// o client secret não é usado no fluxo público do cliente (expo-auth-session) porque
// o código roda no dispositivo e não deve expor segredos. Caso você precise trocar
// o código no backend, configure a variável abaixo e faça a troca no servidor.
const GOOGLE_CLIENT_SECRET_WEB = process.env.GOOGLE_CLIENT_SECRET_WEB;

if (!GOOGLE_CLIENT_ID_WEB) {
  console.error('ERRO: EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB não está configurado!');
}


// Configuração do discovery para o fluxo OAuth do Google
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

export function useGoogleAuth() {
  useEffect(() => {
    console.log('=== Google Web OAuth configurado ===');
    console.log('Web Client ID:', GOOGLE_CLIENT_ID_WEB);
  }, []);

  // URI fixo do proxy Expo baseado no app.json (owner + slug)
  const redirectUri = 'https://auth.expo.io/@clausemberg/agapp';

  console.log('🔗 REDIRECT URI GERADO:', redirectUri);
  console.log('👆 Copie este URI e adicione no Google Cloud Console!');

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID_WEB!,
      redirectUri,
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Token,
      // IdToken exige nonce; usamos Token + userinfo endpoint para evitar o 400
    },
    discovery
  );

  // opcional: lidar com o response automático se necessário
  useEffect(() => {
    if (response?.type === 'success') {
      console.log('Resposta do OAuth', response.params);
    }
  }, [response]);

  return {
    signIn: async () => {
      const result = await promptAsync();
      if (result?.type === 'success') {
        const { params } = result;
        const accessToken = params.access_token;

        // Busca informações do usuário via userinfo endpoint
        const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const userInfo = await userInfoResp.json();

        return {
          idToken: null,
          accessToken,
          userInfo,
        };
      }
      if (result?.type === 'error') {
        throw new Error(result.error || 'Erro no login do Google');
      }
      throw new Error('Login cancelado');
    },
    signOut: async () => {
      // fluxo web não exige signOut nativo; apenas limpar estado local
      console.log('Logout web - limpar tokens se necessário');
    },
  };
}
