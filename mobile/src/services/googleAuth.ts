import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useEffect } from 'react';

// Configuração do Google OAuth usando variáveis de ambiente
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

if (!GOOGLE_CLIENT_ID_WEB) {
  throw new Error('EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB não está configurado no arquivo .env');
}

// Configurar o Google Sign-In
GoogleSignin.configure({
  webClientId: GOOGLE_CLIENT_ID_WEB, // Do Google Cloud Console (Web Client)
  offlineAccess: true,
  scopes: ['openid', 'profile', 'email'],
  forceCodeForRefreshToken: true, // Força refresh token
});

export function useGoogleAuth() {
  useEffect(() => {
    console.log('=== Google Sign-In NATIVO configurado ===');
    console.log('Web Client ID:', GOOGLE_CLIENT_ID_WEB);
  }, []);

  return {
    signIn: async () => {
      try {
        console.log('Iniciando Google Sign-In nativo...');

        // Fazer logout silencioso primeiro para forçar escolha de conta
        try {
          await GoogleSignin.signOut();
        } catch (e) {
          // Ignora erro se não estava logado
        }

        // Verificar se Google Play Services está disponível
        await GoogleSignin.hasPlayServices();

        // Fazer login - agora vai mostrar a tela de escolha de conta
        const userInfo = await GoogleSignin.signIn();

        console.log('Login bem-sucedido!', userInfo);

        // Pegar o ID Token
        const tokens = await GoogleSignin.getTokens();
        const idToken = tokens.idToken;

        console.log('ID Token obtido:', idToken ? 'Token encontrado ✓' : 'Token não encontrado ✗');

        return idToken;
      } catch (error: any) {
        console.error('Erro no Google Sign-In:', error);
        throw error;
      }
    },
    signOut: async () => {
      try {
        await GoogleSignin.signOut();
        console.log('Logout bem-sucedido');
      } catch (error) {
        console.error('Erro no logout:', error);
      }
    }
  };
}
