const BACKEND_URL = process.env.BACKEND_URL || 'https://your-backend.example.com';

export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  cpf: string;
  phone?: string;
  roles?: string[];
}

export async function loginWithEmail(email: string, password: string) {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: email,
      password: password,
    }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Login failed');
  }
  const data = await res.json();
  // Buscar dados do usuário se não vieram no token
  if (!data.user) {
    const user = await fetchCurrentUser(data.access_token);
    return { token: data.access_token, user };
  }
  return { token: data.access_token, user: data.user };
}

export async function signUpWithEmail(signUpData: SignUpData) {
  const res = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(signUpData),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Signup failed');
  }
  return res.json(); // Returns User object
}

export async function loginWithGoogle(idToken: string) {
  const res = await fetch(`${BACKEND_URL}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Google login failed');
  }
  const data = await res.json();
  return { token: data.access_token, user: data.user };
}

export async function fetchCurrentUser(token: string) {
  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed fetching user');
  return res.json();
}
