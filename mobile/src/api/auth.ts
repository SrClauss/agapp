import client from './axiosClient';
import { AxiosError } from 'axios';

export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  cpf: string;
  phone?: string;
  roles?: string[];
}

export async function loginWithEmail(email: string, password: string, turnstileToken?: string, authToken?: string) {
  try {
    const params = new URLSearchParams({
      username: email,
      password: password,
    });

    if (turnstileToken) {
      params.append('turnstile_token', turnstileToken);
    }

    const headers: any = { 'Content-Type': 'application/x-www-form-urlencoded' };
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    console.log('[loginWithEmail] Enviando requisição para /auth/login');
    console.log('[loginWithEmail] Headers:', JSON.stringify(headers));
    console.log('[loginWithEmail] Params:', params.toString());

    const { data } = await client.post('/auth/login', params, {
      headers,
    });

    console.log('[loginWithEmail] Login bem-sucedido, access_token recebido');

    // Buscar dados do usuário se não vieram no token
    if (!data.user) {
      const user = await fetchCurrentUser(data.access_token);
      return { token: data.access_token, user };
    }
    return { token: data.access_token, user: data.user };
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    console.error('[loginWithEmail] Erro:', axiosError.response?.status, axiosError.response?.data);
    
    // Mensagens mais amigáveis baseadas no erro
    if (axiosError.response?.status === 401) {
      throw new Error('E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.');
    } else if (axiosError.response?.status === 404) {
      throw new Error('Usuário não encontrado. Verifique o e-mail digitado.');
    } else if (axiosError.response?.status === 400) {
      throw new Error(axiosError.response?.data?.detail || 'Dados inválidos. Verifique os campos e tente novamente.');
    } else if (axiosError.response?.status && axiosError.response.status >= 500) {
      throw new Error('Erro no servidor. Tente novamente em alguns instantes.');
    }
    
    throw new Error(axiosError.response?.data?.detail || 'Erro ao fazer login. Verifique sua conexão e tente novamente.');
  }
}

export async function signUpWithEmail(signUpData: SignUpData) {
  try {
    const { data } = await client.post('/auth/register', signUpData);
    return data; // Returns User object
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Signup failed');
  }
}

export async function loginWithGoogle(idToken: string) {
  try {
    const { data } = await client.post('/auth/google', { idToken });
    console.log('📦 Resposta do backend /auth/google:', JSON.stringify(data, null, 2));
    console.log('🔑 access_token:', data.access_token ? 'Existe ✓' : 'NULL ✗');
    console.log('👤 user:', data.user ? 'Existe ✓' : 'NULL ✗');
    return { token: data.access_token, user: data.user };
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Google login failed');
  }
}

export async function fetchCurrentUser(token: string) {
  try {
    console.log('[fetchCurrentUser] Tentando buscar usuário com token:', token?.substring(0, 30) + '...');
    const { data } = await client.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log('[fetchCurrentUser] Usuário obtido:', data?.email);
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    console.error('[fetchCurrentUser] Erro ao buscar usuário:', axiosError.response?.data || axiosError.message);
    throw new Error(axiosError.response?.data?.detail || 'Failed fetching user');
  }
}

export async function registerFcmToken(token: string, fcmToken: string, deviceId?: string, deviceName?: string) {
  try {
    const { data } = await client.post(
      '/users/me/fcm-token',
      { fcm_token: fcmToken, device_id: deviceId, device_name: deviceName },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Register FCM token failed');
  }
}

export async function completeProfile(token: string, profileData: { phone: string; cpf: string; full_name: string; password: string; roles: string[] }) {
  try {
    const { data } = await client.put(
      '/auth/complete-profile',
      profileData,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return data;
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    const errorMessage = axiosError.response?.data?.detail ||
      (axiosError.response?.status ? `Erro ${axiosError.response.status}: ${axiosError.response.statusText}` : 'Complete profile failed');
    throw new Error(errorMessage);
  }
}
