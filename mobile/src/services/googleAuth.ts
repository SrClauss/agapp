import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

// Backend URL base — usa a variável de ambiente ou o domínio de produção
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || 'https://agilizapro.cloud';

export function useGoogleAuth() {
  useEffect(() => {
    console.log('=== Google OAuth (server-side flow) ===');
    console.log('Backend:', BACKEND_URL);
  }, []);

  return {
    signIn: async () => {
      // Deep link para onde o backend vai redirecionar após o login
      // Em Expo Go isso gera algo como exp://192.168.x.x:8081/--/auth/google/callback
      const returnUrl = Linking.createURL('auth/google/callback');
      console.log('Return URL (deep link):', returnUrl);

      const startUrl = `${BACKEND_URL}/api/auth/google/start?return_url=${encodeURIComponent(returnUrl)}`;
      console.log('Abrindo:', startUrl);

      // Abre o browser. Ele fecha automaticamente quando detectar um redirect para returnUrl
      const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
      console.log('Resultado do browser:', result.type);

      if (result.type !== 'success') {
        if (result.type === 'cancel' || result.type === 'dismiss') {
          throw new Error('Login cancelado');
        }
        throw new Error('Erro ao abrir browser de autenticação');
      }

      // Extrai o token e o email do URL retornado
      const url = result.url;
      console.log('URL retornada:', url);

      const parsed = Linking.parse(url);
      const token = parsed.queryParams?.token as string | undefined;
      const email = parsed.queryParams?.email as string | undefined;

      if (!token) {
        throw new Error('Token não encontrado na resposta do Google');
      }

      console.log('✅ Login server-side OK. Email:', email);

      // Retorna o token JWT da aplicação diretamente (o backend já autenticou com o Google)
      return { serverToken: token, idToken: null, accessToken: null, userInfo: null };
    },
    signOut: async () => {
      console.log('Logout - limpar tokens locais');
    },
  };
}
