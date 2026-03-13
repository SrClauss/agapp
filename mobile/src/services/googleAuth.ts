import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://agilizapro.cloud';

// Google OAuth endpoints
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
};

interface GoogleAuthResult {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

/**
 * Hook de autenticação Google usando expo-auth-session conforme documentação oficial.
 * 
 * O fluxo correto é:
 * 1. Mobile obtém authorization code do Google
 * 2. Envia code para o backend
 * 3. Backend troca code por tokens e retorna JWTs próprios
 */
export function useGoogleAuth() {
  const [authResult, setAuthResult] = useState<GoogleAuthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Gerar redirect URI automaticamente
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'com.agilizapro.agapp',
    path: 'auth/callback'
  });

  console.log('[GoogleAuth] Redirect URI:', redirectUri);

  // Configurar request OAuth com Google
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: '36227471485-8bogr7vvdga110v3c9ha29gu3khom83c.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile'],
      redirectUri,
    },
    discovery
  );

  // Processar resposta do Google
  useEffect(() => {
    if (response?.type === 'success') {
      const code = response.params.code;
      console.log('[GoogleAuth] Authorization code recebido');
      
      // Trocar code por tokens no backend
      exchangeCodeForTokens(code);
    } else if (response?.type === 'error') {
      console.error('[GoogleAuth] Erro no OAuth:', response.error);
      setAuthResult({ error: response.error?.message || 'Erro desconhecido' });
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      console.log('[GoogleAuth] Usuário cancelou');
      setAuthResult({ error: 'Cancelado pelo usuário' });
    }
  }, [response]);

  const exchangeCodeForTokens = async (code: string) => {
    setIsLoading(true);
    try {
      console.log('[GoogleAuth] Trocando code por tokens no backend...');
      
      const res = await fetch(`${BACKEND_URL}/auth/google/exchange`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          code, 
          redirect_uri: redirectUri 
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Backend error: ${errorText}`);
      }

      const data = await res.json();
      console.log('[GoogleAuth] Tokens recebidos do backend');

      setAuthResult({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      });
    } catch (error) {
      console.error('[GoogleAuth] Erro ao trocar code:', error);
      setAuthResult({ error: String(error) });
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async () => {
    console.log('[GoogleAuth] Iniciando login...');
    setAuthResult(null);
    await promptAsync();
  };

  return {
    request,
    response: authResult,
    signIn,
    isLoading,
  };
}
