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
  is_profile_complete: boolean;  // Novo campo
  credits: number;
  created_at: string;
  updated_at: string;
  photo?: string;  // Novo campo para photo do Google
  photo_local?: string; // Caminho local cacheado do avatar / Local cached file URI for profile photo
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
  activeRole: string | null;
  isHydrated: boolean;
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  setActiveRole: (role: string) => void;
  setHydrated: () => void;
  logout: () => Promise<void>;
  getToken: () => string | null;
};

const SECURE_KEY = 'auth_token_v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      activeRole: null,
      isHydrated: false,
      setToken: async (token: string | null) => {
        console.log(`[AuthStore] setToken chamado com token: ${token ? 'Presente' : 'Null'}`);
        set({ token });
        // O middleware persist vai salvar automaticamente no SecureStore
        console.log(`[AuthStore] Token definido no estado (persistirá automaticamente)`);
      },
      setUser: (user: User | null) => set({ user }),
      setActiveRole: (role: string) => set({ activeRole: role }),
      setHydrated: () => set({ isHydrated: true }),
      getToken: () => get().token,
      logout: async () => {
        console.log(`[AuthStore] Fazendo logout`);
        set({ token: null, user: null, activeRole: null });
        // O middleware persist vai limpar automaticamente do SecureStore
        console.log(`[AuthStore] Logout completo`);
      },
    }),
    {
      name: 'auth-storage',
      // override storage to use expo-secure-store with JSON serialization
      storage: {
        getItem: async (name: string) => {
          try {
            console.log(`[AuthStore] Tentando recuperar ${name} do SecureStore`);
            const value = await SecureStore.getItemAsync(name);
            if (value) {
              const parsed = JSON.parse(value);
              console.log(`[AuthStore] Valor recuperado e parseado:`, {
                hasToken: !!parsed.state?.token,
                hasUser: !!parsed.state?.user,
                activeRole: parsed.state?.activeRole
              });
              return parsed;
            }
            console.log(`[AuthStore] Nenhum valor encontrado`);
            return null;
          } catch (e) {
            console.error(`[AuthStore] Erro ao recuperar ${name}:`, e);
            return null;
          }
        },
        setItem: async (name: string, value: any) => {
          try {
            console.log(`[AuthStore] Salvando ${name} no SecureStore`);
            const serialized = JSON.stringify(value);
            await SecureStore.setItemAsync(name, serialized);
            console.log(`[AuthStore] ${name} salvo com sucesso`);
          } catch (e) {
            console.error(`[AuthStore] Erro ao salvar ${name}:`, e);
          }
        },
        removeItem: async (name: string) => {
          try {
            console.log(`[AuthStore] Removendo ${name} do SecureStore`);
            await SecureStore.deleteItemAsync(name);
            console.log(`[AuthStore] ${name} removido com sucesso`);
          } catch (e) {
            console.error(`[AuthStore] Erro ao remover ${name}:`, e);
          }
        },
      } as any,
      onRehydrateStorage: () => (state) => {
        console.log(`[AuthStore] Rehidratação iniciada`);
        if (state) {
          console.log(`[AuthStore] Estado rehidratado:`, {
            hasToken: !!state.token,
            hasUser: !!state.user,
            activeRole: state.activeRole
          });
          state.setHydrated();
          console.log(`[AuthStore] Hidratação marcada como completa`);
        } else {
          console.log(`[AuthStore] Nenhum estado para rehidratar`);
        }
      },
    }
  )
);

export default useAuthStore;
