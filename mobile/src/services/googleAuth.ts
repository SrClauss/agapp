import { useState, useEffect } from 'react';
import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

// Permite que o Expo Go complete o redirect de autenticação OAuth
WebBrowser.maybeCompleteAuthSession();

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

  useEffect(() => {
    // Listener para capturar o deep-link de retorno do OAuth
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[GoogleAuth] Deep-link recebido:', url);
      
      if (url.startsWith(DEEP_LINK_SCHEME) || url.includes('auth/callback')) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    try {
      console.log('[GoogleAuth] Processando deep-link:', url);
      
      // Parsear tokens da URL (query string ou fragment)
      // Backend envia como: com.agilizapro.agapp://auth/callback?token=xxx&refresh_token=yyy
      const parsed = Linking.parse(url);
      const accessToken = parsed.queryParams?.token as string | undefined;
      const refreshToken = parsed.queryParams?.refresh_token as string | undefined;
      const tokenType = (parsed.queryParams?.token_type as string | undefined) || 'bearer';

      console.log('[GoogleAuth] Tokens parseados:', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken,
        tokenType 
      });

      if (accessToken) {
        setResponse({
          type: 'success',
          authentication: {
            accessToken,
            refreshToken,
            tokenType,
          },
        });
      } else {
        console.warn('[GoogleAuth] Token não encontrado no deep-link');
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
      const authUrl = `${BACKEND_URL}/auth/google/start?redirect_uri=${encodeURIComponent(DEEP_LINK_SCHEME)}`;
      
      console.log('[GoogleAuth] Abrindo navegador com URL:', authUrl);
      
      // Usar openBrowserAsync para que o navegador não bloqueie o deep-link
      const result = await WebBrowser.openBrowserAsync(authUrl);
      
      console.log('[GoogleAuth] Navegador retornou:', result.type);
      
      if (result.type === 'cancel' || result.type === 'dismiss') {
        setResponse({ type: result.type });
      }
      // Não setar 'error' aqui - deixar o listener capturar o deep-link
    } catch (error) {
      console.error('[GoogleAuth] Erro ao abrir navegador:', error);
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
