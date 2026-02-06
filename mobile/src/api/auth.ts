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

    const { data } = await client.post('/auth/login', params, {
      headers,
    });

    // Buscar dados do usuário se não vieram no token
    if (!data.user) {
      const user = await fetchCurrentUser(data.access_token);
      return { token: data.access_token, user };
    }
    return { token: data.access_token, user: data.user };
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    throw new Error(axiosError.response?.data?.detail || 'Login failed');
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
    const { data } = await client.get('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data;
  } catch (error) {
    throw new Error('Failed fetching user');
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
