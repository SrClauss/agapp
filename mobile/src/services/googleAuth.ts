import { useState } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

// Permite que o Expo Go complete o redirect de autenticação OAuth
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agilizapro.cloud';

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

  const signIn = async () => {
    try {
      setResponse(null);

      const redirectUri = Linking.createURL('auth/callback');
      const authUrl = `${BACKEND_URL}/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;

      console.log('[GoogleAuth] Abrindo URL do backend:', authUrl);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type === 'success' && result.url) {
        const parsed = Linking.parse(result.url);
        const accessToken = parsed.queryParams?.token as string | undefined;
        const refreshToken = parsed.queryParams?.refresh_token as string | undefined;
        const tokenType = (parsed.queryParams?.token_type as string | undefined) || 'bearer';

        if (!accessToken) {
          throw new Error('Token não retornado no callback OAuth');
        }

        setResponse({
          type: 'success',
          authentication: {
            accessToken,
            refreshToken,
            tokenType,
          },
        });
        return;
      }

      if (result.type === 'cancel' || result.type === 'dismiss') {
        setResponse({ type: result.type });
        return;
      }

      setResponse({ type: 'error' });
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
