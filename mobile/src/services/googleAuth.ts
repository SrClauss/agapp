import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';

// Permite que o Expo Go complete o redirect de autenticação OAuth
WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agilizapro.cloud';
const POLLING_INTERVAL_MS = 2000;
const POLLING_TIMEOUT_MS = 60000;

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

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const pollSession = async (sessionId: string) => {
    const startTime = Date.now();

    while (Date.now() - startTime < POLLING_TIMEOUT_MS) {
      const statusRes = await fetch(`${BACKEND_URL}/auth/google/session/${sessionId}`);
      if (!statusRes.ok) {
        throw new Error('Falha ao consultar status do login Google');
      }

      const statusData = await statusRes.json();

      if (statusData.status === 'authorized') {
        const accessToken = statusData.access_token;
        const refreshToken = statusData.refresh_token;
        const tokenType = statusData.token_type || 'bearer';

        if (!accessToken || !refreshToken) {
          throw new Error('Sessão autorizada sem tokens válidos');
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

      if (statusData.status === 'expired' || statusData.status === 'failed') {
        throw new Error('Sessão de login expirou. Tente novamente.');
      }

      await sleep(POLLING_INTERVAL_MS);
    }

    throw new Error('Tempo de login excedido (60s). Tente novamente.');
  };

  const signIn = async () => {
    try {
      setResponse(null);

      const sessionRes = await fetch(`${BACKEND_URL}/auth/google/session`, {
        method: 'POST',
      });

      if (!sessionRes.ok) {
        throw new Error('Falha ao iniciar sessão de login Google');
      }

      const sessionData = await sessionRes.json();
      const authUrl = sessionData.auth_url;
      const sessionId = sessionData.session_id;

      if (!authUrl || !sessionId) {
        throw new Error('Resposta inválida ao iniciar sessão de login');
      }

      console.log('[GoogleAuth] Abrindo URL do backend:', authUrl);

      // Inicia polling em paralelo ao navegador para não depender de fechamento manual.
      const pollingPromise = pollSession(sessionId);
      const browserPromise = WebBrowser.openBrowserAsync(authUrl);

      await pollingPromise;

      // Tenta fechar o navegador automaticamente após autorização.
      try {
        await WebBrowser.dismissBrowser();
      } catch {
        // Em alguns ambientes/plataformas o dismiss pode ser ignorado.
      }

      // Consome resultado do browser para evitar promise pendente.
      await browserPromise;
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
