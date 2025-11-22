// @ts-ignore - Dynamic import to handle CommonJS/ES module compatibility
let GoogleSignin: any = null;

const loadGoogleSignin = async () => {
  if (!GoogleSignin) {
    const module = await import('@react-native-google-signin/google-signin');
    GoogleSignin = module.GoogleSignin;
  }
  return GoogleSignin;
};

import { useEffect } from 'react';

// Configuração do Google OAuth usando variáveis de ambiente
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;

console.log('=== DEBUG googleAuth.ts ===');
console.log('GOOGLE_CLIENT_ID_WEB:', GOOGLE_CLIENT_ID_WEB);
console.log('process.env:', Object.keys(process.env));

if (!GOOGLE_CLIENT_ID_WEB) {
  console.error('ERRO: EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB não está configurado!');
  // Não lançar erro para não travar o app
}

// Configurar o Google Sign-In
const configureGoogleSignin = async () => {
  try {
    const GoogleSigninModule = await loadGoogleSignin();
    GoogleSigninModule.configure({
      webClientId: GOOGLE_CLIENT_ID_WEB, // Do Google Cloud Console (Web Client)
      offlineAccess: true,
      scopes: ['openid', 'profile', 'email'],
      forceCodeForRefreshToken: true, // Força refresh token
    });
    console.log('Google Sign-In configurado com sucesso');
  } catch (error) {
    console.error('Erro ao configurar Google Sign-In:', error);
  }
};

// Chamar configuração (não bloqueia a renderização)
configureGoogleSignin();

export function useGoogleAuth() {
  useEffect(() => {
    console.log('=== Google Sign-In NATIVO configurado ===');
    console.log('Web Client ID:', GOOGLE_CLIENT_ID_WEB);
  }, []);

  return {
    signIn: async () => {
      try {
        console.log('Iniciando Google Sign-In nativo...');

        const GoogleSigninModule = await loadGoogleSignin();

        // Fazer logout silencioso primeiro para forçar escolha de conta
        try {
          await GoogleSigninModule.signOut();
        } catch (e) {
          // Ignora erro se não estava logado
        }

        // Verificar se Google Play Services está disponível
        await GoogleSigninModule.hasPlayServices();

        // Fazer login - agora vai mostrar a tela de escolha de conta
        const userInfo = await GoogleSigninModule.signIn();

        console.log('Login bem-sucedido!', userInfo);

        // Pegar o ID Token
        const tokens = await GoogleSigninModule.getTokens();
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
        const GoogleSigninModule = await loadGoogleSignin();
        await GoogleSigninModule.signOut();
        console.log('Logout bem-sucedido');
      } catch (error) {
        console.error('Erro no logout:', error);
      }
    }
  };
}
