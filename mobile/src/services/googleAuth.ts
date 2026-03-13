import { useState } from 'react';
import * as AuthSession from 'expo-auth-session';

// Permite que o Expo Go complete o redirect de autenticação OAuth
AuthSession.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agilizapro.cloud';
const DEEP_LINK_SCHEME = 'com.agilizapro.agapp://auth/callback';

interface AuthResponse {
  type: 'success' | 'error' | 'dismiss' | 'cancel';
  authentication?: {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
  };
}

/**
 * Hook de autenticação Google via server-side OAuth (backend-driven).
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
 *       const { accessToken, refreshToken } = response.authentication ?? {};
 *       // usar tokens com o backend
 *     }
 *   }, [response]);
 */
export function useGoogleAuth() {
  const [response, setResponse] = useState<AuthResponse | null>(null);
  const [isReady, setIsReady] = useState(true);

  // Nota: Não precisamos mais do listener Linking porque AuthSession.openAuthSessionAsync
  // retorna a URL de callback diretamente

  const handleDeepLink = (url: string) => {
    try {
      // Parsear tokens do fragmento da URL
      // Exemplo: com.agilizapro.agapp://auth/callback#access_token=xxx&refresh_token=yyy&token_type=bearer
      const fragmentMatch = url.match(/#(.+)$/);
      if (!fragmentMatch) {
        setResponse({ type: 'error' });
        return;
      }

      const params = new URLSearchParams(fragmentMatch[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const tokenType = params.get('token_type');

      if (accessToken && refreshToken) {
        setResponse({
          type: 'success',
          authentication: {
            accessToken,
            refreshToken,
            tokenType: tokenType || 'bearer',
          },
        });
      } else {
        setResponse({ type: 'error' });
      }
    } catch (error) {
      console.error('[GoogleAuth] Erro ao parsear deep-link:', error);
      setResponse({ type: 'error' });
    }
  };

  const signIn = async () => {
    try {
      setResponse(null);
      const authUrl = `${BACKEND_URL}/auth/google/start?next=${encodeURIComponent(DEEP_LINK_SCHEME)}`;
      console.log('[GoogleAuth] Abrindo URL do backend:', authUrl);
      
      // Usar AuthSession ao invés de WebBrowser - mantém contexto do app
      const result = await AuthSession.openAuthSessionAsync(authUrl, DEEP_LINK_SCHEME);
      
      console.log('[GoogleAuth] Resultado do AuthSession:', result);
      
      if (result.type === 'success' && result.url) {
        // AuthSession já capturou a URL de retorno
        handleDeepLink(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setResponse({ type: result.type });
      }
    } catch (error) {
      console.error('[GoogleAuth] Erro ao abrir autenticação:', error);
      setResponse({ type: 'error' });
    }
  };

  return {
    /** Objeto de requisição OAuth (sempre pronto nessa implementação) */
    request: isReady ? {} : null,
    /** Resposta OAuth; monitore via useEffect para reagir ao resultado */
    response,
    /** Abre o fluxo de autenticação Google no navegador do sistema */
    signIn,
  };
}
