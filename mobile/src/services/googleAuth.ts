import { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Permite que o Expo Go complete o redirect de autenticação OAuth
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agilizapro.cloud';
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

  const handleAuthUrl = (url: string) => {
    try {
      console.log('[GoogleAuth] Processando URL de retorno:', url);
      
      // Extrair tokens da query string ou fragmento
      let params: URLSearchParams;
      
      // Tenta query string primeiro: https://auth.expo.io/@clausemberg/agapp?access_token=xxx
      const queryMatch = url.match(/\?(.+)$/);
      if (queryMatch) {
        params = new URLSearchParams(queryMatch[1]);
      } else {
        // Tenta fragmento: https://auth.expo.io/@clausemberg/agapp#access_token=xxx  
        const fragmentMatch = url.match(/#(.+)$/);
        if (fragmentMatch) {
          params = new URLSearchParams(fragmentMatch[1]);
        } else {
          console.error('[GoogleAuth] URL sem parametros');
          setResponse({ type: 'error' });
          return;
        }
      }

      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const tokenType = params.get('token_type');

      console.log('[GoogleAuth] Tokens encontrados:', {
        hasAccess: !!accessToken,
        hasRefresh: !!refreshToken,
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
        console.error('[GoogleAuth] Tokens ausentes na URL');
        setResponse({ type: 'error' });
      }
    } catch (error) {
      console.error('[GoogleAuth] Erro ao parsear URL:', error);
      setResponse({ type: 'error' });
    }
  };

  const signIn = async () => {
    try {
      setResponse(null);
      // Pass the Expo Auth Proxy URL as redirect_uri
      const authUrl = `${BACKEND_URL}/auth/google/start?redirect_uri=${encodeURIComponent(REDIRECT_URL)}`;
      console.log('[GoogleAuth] Iniciando OAuth via:', authUrl);
      
      // openAuthSessionAsync captura o redirect automaticamente
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URL, {
        preferEphemeralSession: true,
      });
      
      console.log('[GoogleAuth] Resultado:', result);
      
      if (result.type === 'success' && result.url) {
        // Parsear tokens da URL retornada
        handleAuthUrl(result.url);
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setResponse({ type: result.type });
      } else {
        setResponse({ type: 'error' });
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
