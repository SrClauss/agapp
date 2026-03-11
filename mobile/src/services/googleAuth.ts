import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

// Permite que o Expo Go complete o redirect de autenticação OAuth
WebBrowser.maybeCompleteAuthSession();

// Configuração do Google OAuth usando variáveis de ambiente
const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB;
const GOOGLE_CLIENT_ID_ANDROID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID;
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS;

if (!GOOGLE_CLIENT_ID_WEB) {
  console.error('ERRO: EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB não está configurado!');
}

/**
 * Hook de autenticação Google via expo-auth-session (compatível com Expo Go).
 *
 * Uso:
 *   const { request, response, signIn } = useGoogleAuth();
 *
 *   // Disparar o fluxo de login:
 *   signIn();
 *
 *   // Monitorar o resultado via useEffect:
 *   useEffect(() => {
 *     if (response?.type === 'success') {
 *       const { idToken, accessToken } = response.authentication ?? {};
 *       // usar idToken com o backend
 *     }
 *   }, [response]);
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: GOOGLE_CLIENT_ID_WEB,
    androidClientId: GOOGLE_CLIENT_ID_ANDROID,
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    scopes: ['openid', 'profile', 'email'],
  });

  return {
    /** Objeto de requisição OAuth (pronto quando não-nulo) */
    request,
    /** Resposta OAuth; monitore via useEffect para reagir ao resultado */
    response,
    /** Abre o fluxo de autenticação Google no navegador */
    signIn: () => promptAsync(),
  };
}
