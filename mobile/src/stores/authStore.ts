import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

export type User = {
  id: string;
  email: string;
  full_name: string;
  cpf: string;
  phone?: string;
  roles: string[];
  is_active: boolean;
  credits: number;
  created_at: string;
  updated_at: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    country?: string;
  };
  coordinates?: [number, number]; // [longitude, latitude]
  professional_info?: {
    skills?: string[];
    experience?: string;
    portfolio?: string;
    [key: string]: any;
  };
  subscription?: {
    plan?: string;
    credits?: number;
    expires_at?: string;
  };
  evaluations?: Array<{
    [key: string]: any;
  }>;
  average_rating?: number;
};

export type AuthState = {
  token: string | null;
  user: User | null;
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
};

const SECURE_KEY = 'auth_token_v1';

const secureStorage = {
  getItem: async (name: string) => {
    try {
      const value = await SecureStore.getItemAsync(name);
      return value;
    } catch (e) {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (e) {
      // noop
    }
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (e) {
      // noop
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setToken: async (token: string | null) => {
        set({ token });
        if (token) {
          await secureStorage.setItem(SECURE_KEY, token);
        } else {
          await secureStorage.removeItem(SECURE_KEY);
        }
      },
      setUser: (user: User | null) => set({ user }),
      logout: async () => {
        set({ token: null, user: null });
        await secureStorage.removeItem(SECURE_KEY);
      },
    }),
    {
      name: 'auth-storage',
      // override storage to use expo-secure-store
      storage: {
        getItem: (name: string) => secureStorage.getItem(name),
        setItem: (name: string, value: string) => secureStorage.setItem(name, value),
        removeItem: (name: string) => secureStorage.removeItem(name),
      } as any,
    }
  )
);

export default useAuthStore;
