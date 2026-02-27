import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import * as SecureStore from 'expo-secure-store';
import useAuthStore from '../stores/authStore';

// Função para obter token: preferir in-memory, mas caso esteja ausente tentar
// recuperar do SecureStore (persistência). Retorna string|null.
const getAuthToken = async (): Promise<string | null> => {
  const inMemory = useAuthStore.getState().token;
  if (inMemory) return inMemory;

  try {
    const raw = await SecureStore.getItemAsync('auth-storage');
    if (!raw) return null;
    let parsed: any = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      try {
        parsed = JSON.parse(JSON.parse(raw));
      } catch (e2) {
        parsed = null;
      }
    }
    const token = parsed?.state?.token ?? parsed?.token ?? null;
    if (token && typeof token === 'string') {
      // update in-memory for future requests
      try {
        await useAuthStore.getState().setToken(token);
      } catch (e) {
        // ignore
      }
      return token;
    }
    return null;
  } catch (e) {
    return null;
  }
};

// Get base URL from environment
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Configure retry logic
axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error: AxiosError) => {
    // Retry on network errors or 5xx server errors
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      (error.response?.status ? error.response.status >= 500 : false)
    );
  },
});

// Request interceptor - add auth token
client.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      // Get token (may read SecureStore if in-memory missing)
      const token = await getAuthToken();

      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
        if (__DEV__) {
          // Masked log for debugging only
          const masked = `${token.slice(0,6)}...${token.slice(-6)}`;
          console.log('[axios] Enviando Authorization (mascarado):', masked);
        }
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
client.interceptors.response.use(
  (response) => {
    // Check for renewed token in response headers
    const newToken = response.headers?.authorization?.replace('Bearer ', '');
    if (newToken) {
      console.log('[axios] Token renewed, updating store');
      useAuthStore.getState().setToken(newToken);
    }
    // Return successful response
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

    // Handle 401 Unauthorized
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

        // Only perform logout if the request actually sent an Authorization
        // header (i.e., we attempted an authenticated request). If the
        // request had no Authorization header, it's an unauthenticated
        // request and we should not clear the user's token (this caused the
        // app to log out users when background/unauthenticated requests got 401).
        const sentAuth = Boolean((originalRequest.headers as any)?.Authorization);
        if (sentAuth) {
          try {
            // Silent refresh: try to get a new token using the current token
            const currentToken = useAuthStore.getState().token;
            if (currentToken) {
              try {
                // Use a direct fetch to avoid triggering this interceptor again (_retry guard)
                const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
                const refreshRes = await fetch(`${BASE}/auth/refresh`, {
                  method: 'POST',
                  headers: {
                    Authorization: `Bearer ${currentToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({}),
                });
                if (refreshRes.ok) {
                  const refreshData = await refreshRes.json();
                  const newAccessToken = refreshData?.access_token;
                  if (newAccessToken) {
                    await useAuthStore.getState().setToken(newAccessToken);
                    // Retry original request with new token
                    if (originalRequest.headers) {
                      (originalRequest.headers as any).Authorization = `Bearer ${newAccessToken}`;
                    }
                    return client(originalRequest);
                  }
                }
              } catch (refreshError) {
                // Refresh failed - perform logout
                console.log('[axios] Silent refresh failed, logging out');
              }
            }
            useAuthStore.getState().logout();
          } catch (refreshError) {
            console.error('Error handling 401:', refreshError);
            return Promise.reject(error);
          }
        } else {
          if (__DEV__) {
            console.log('[axios] Received 401 for unauthenticated request; not logging out');
          }
        }
    }

    return Promise.reject(error);
  }
);

export default client;
