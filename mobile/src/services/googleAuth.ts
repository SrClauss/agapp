import { useState, useEffect } from 'react';
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

  useEffect(() => {
    // Captura deep-link caso o app seja aberto diretamente via intent (cold start).
    const checkInitialUrl = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        console.log('[GoogleAuth] URL inicial:', initialUrl);
        if (initialUrl.includes('auth/callback')) {
          handleDeepLink(initialUrl);
        }
      }
    };

    checkInitialUrl();

    // Listener para capturar o deep-link de retorno do OAuth enquanto o app já está aberto.
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[GoogleAuth] Deep-link recebido:', url);
      
      // Aceita qualquer URL que contenha auth/callback (funciona com exp:// e com.agilizapro.agapp://)
      if (url.includes('auth/callback')) {
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
      const getParams = (input: string) => {
        const parts = input.split('?');
        if (parts.length < 2) return {};
        const query = parts[1].split('#')[0];
        return Object.fromEntries(new URLSearchParams(query));
      };

      const queryParams = getParams(url);
      const accessToken = queryParams['token'];
      const refreshToken = queryParams['refresh_token'];
      const tokenType = (queryParams['token_type'] as string | undefined) || 'bearer';

      console.log('[GoogleAuth] URL completa:', url);
      console.log('[GoogleAuth] Query params completo:', JSON.stringify(queryParams));
      console.log('[GoogleAuth] Tokens parseados:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        tokenType,
        accessTokenStart: accessToken?.substring(0, 20),
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
      
      // Gera o redirect URI correto para o ambiente atual (Expo Go ou standalone)
      // No Expo Go: exp://127.0.0.1:8081/--/auth/callback
      // No standalone: com.agilizapro.agapp://auth/callback
      const redirectUri = Linking.createURL('auth/callback');
      const authUrl = `${BACKEND_URL}/auth/google/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      console.log('[GoogleAuth] Redirect URI gerado:', redirectUri);
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
