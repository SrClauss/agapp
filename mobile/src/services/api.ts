import { getApiUrl } from '../config/api.config';

export interface UserCreateRequest {
  email: string;
  full_name: string;
  cpf: string;
  phone?: string;
  password: string;
  roles?: string[];
}

export interface UserResponse {
  _id: string;
  email: string;
  full_name: string;
  cpf: string;
  phone?: string;
  roles: string[];
  is_active: boolean;
  credits: number;
  created_at: string;
  updated_at: string;
}

export interface LoginRequest {
  username: string; // email
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
}

class ApiService {
  private baseUrl: string;

  constructor(baseUrl: string = getApiUrl()) {
    this.baseUrl = baseUrl;
  }

  async register(userData: UserCreateRequest): Promise<UserResponse> {
    const response = await fetch(`${this.baseUrl}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao criar conta');
    }

    return response.json();
  }

  async login(credentials: LoginRequest): Promise<TokenResponse> {
    // OAuth2 expects form-data
    const formData = new URLSearchParams();
    formData.append('username', credentials.username);
    formData.append('password', credentials.password);

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao fazer login');
    }

    return response.json();
  }

  async getCurrentUser(token: string): Promise<UserResponse> {
    const response = await fetch(`${this.baseUrl}/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.detail || 'Erro ao buscar dados do usuário');
    }

    return response.json();
  }

  async updateUserRoles(token: string, roles: string[]): Promise<UserResponse> {
    console.log('API - Sending PUT /users/me with roles:', roles);

    const response = await fetch(`${this.baseUrl}/users/me`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles }),
    });

    console.log('API - Response status:', response.status);

    if (!response.ok) {
      const error: ApiError = await response.json();
      console.log('API - Error response:', error);
      throw new Error(error.detail || 'Erro ao atualizar roles');
    }

    const userData = await response.json();
    console.log('API - Updated user roles:', userData.roles);
    return userData;
  }
}

export const apiService = new ApiService();
