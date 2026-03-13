import { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Permite que o Expo Go complete o redirect de autenticação OAuth
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agilizapro.cloud';
const DEEP_LINK_SCHEME = 'com.agilizapro.agapp://auth/callback';
const REDIRECT_URL = 'https://auth.expo.io/@clausemberg/agapp';

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

  useEffect(() => {
    // Listener para capturar o deep-link de retorno do OAuth
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[GoogleAuth] Deep-link recebido:', url);
      
      if (url.startsWith(DEEP_LINK_SCHEME)) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    try {
      console.log('[GoogleAuth] Processando URL:', url);
      
      // Tentar parsear tokens do fragmento (#) ou query string (?)
      let params: URLSearchParams;
      
      // Primeiro tenta fragmento: com.agilizapro.agapp://auth/callback#access_token=xxx
      const fragmentMatch = url.match(/#(.+)$/);
      if (fragmentMatch) {
        params = new URLSearchParams(fragmentMatch[1]);
      } else {
        // Tenta query string: com.agilizapro.agapp://auth/callback?access_token=xxx
        const queryMatch = url.match(/\?(.+)$/);
        if (queryMatch) {
          params = new URLSearchParams(queryMatch[1]);
        } else {
          console.error('[GoogleAuth] URL sem tokens');
          setResponse({ type: 'error' });
          return;
        }
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const tokenType = params.get('token_type');

      console.log('[GoogleAuth] Tokens extraídos:', {
        hasAccess: !!accessToken,
        hasRefresh: !!refreshToken,
        tokenType,
      });

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
        console.error('[GoogleAuth] Tokens ausentes');
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
      // Usar redirect URL do Expo que funciona com openAuthSessionAsync
      const authUrl = `${BACKEND_URL}/auth/google/start?next=${encodeURIComponent(DEEP_LINK_SCHEME)}`;
      console.log('[GoogleAuth] Abrindo URL do backend:', authUrl);
      
      // Usar openAuthSessionAsync com redirect URL configurado
      const result = await WebBrowser.openAuthSessionAsync(authUrl, DEEP_LINK_SCHEME, {
        preferEphemeralSession: true, // Não usar cache/cookies compartilhados
      });
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
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
