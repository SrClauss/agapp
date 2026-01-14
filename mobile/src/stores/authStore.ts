import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

export type CreditPackage = {
  id: string;
  name: string;
  description: string;
  credits_amount: number;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
};

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
  avatar_url?: string;  // Novo campo para url do avatar do Google
  avatar_local?: string; // Caminho local cacheado do avatar / Local cached file URI for profile photo
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
  credit_transactions?: Array<{
    id: string;
    user_id: string;
    type: string;
    credits: number;
    price: number;
    currency: string;
    package_name?: string;
    payment_id?: string;
    metadata?: any;
    status: string;
    created_at: string;
  }>;
};

export type AuthState = {
  token: string | null;
  user: User | null;
  activeRole: string | null;
  creditPackages: CreditPackage[] | null;
  isHydrated: boolean;
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  setCreditPackages: (packages: CreditPackage[]) => void;
  setActiveRole: (role: string) => void;
  setHydrated: () => void;
  logout: () => Promise<void>;
  getToken: () => string | null;
  // DEV helper to inspect persisted storage (may be undefined in production)
  debugCheckPersisted?: () => Promise<any>;
};

const SECURE_KEY = 'auth_token_v1';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      activeRole: null,
      creditPackages: null,
      isHydrated: false,
      setToken: async (token: string | null) => {
        set({ token });
        // O middleware persist vai salvar automaticamente no SecureStore
        },
      setUser: (user: User | null) => set({ user }),
      setCreditPackages: (packages: CreditPackage[]) => set({ creditPackages: packages }),
      // projectsNearby moved to dedicated store `useProjectsNearbyStore`
      setActiveRole: (role: string) => set({ activeRole: role }),
      setHydrated: () => set({ isHydrated: true }),
      getToken: () => get().token,
      logout: async () => {
        set({ token: null, user: null, activeRole: null, creditPackages: null });
      },
      // DEV helper: inspect what's stored in SecureStore under the persist key
      // This is a safe, masked debug helper only intended for development.
      debugCheckPersisted: async () => {
        try {
          const raw = await SecureStore.getItemAsync('auth-storage');
          if (!raw) {
            console.log('[AuthStore][debug] Nenhum valor em SecureStore para key "auth-storage"');
            return null;
          }
          let parsed: any = null;
          try {
            parsed = JSON.parse(raw);
          } catch (e) {
            console.log('[AuthStore][debug] Conteúdo não é JSON válido; length:', raw.length);
            return { rawLength: raw.length };
          }
          const maskedToken = parsed?.state?.token ? `${parsed.state.token.slice(0, 6)}...${parsed.state.token.slice(-6)}` : null;
          console.log('[AuthStore][debug] persisted state found. token (masked):', maskedToken, 'userPresent:', !!parsed?.state?.user);
          return parsed;
        } catch (e) {
          console.log('[AuthStore][debug] Erro ao acessar SecureStore:', e);
          return null;
        }
      },
    }),
    {
      name: 'auth-storage',
      // override storage to use expo-secure-store with JSON serialization
      storage: {
        // The persist middleware expects getItem to return the raw string (or null).
        // SecureStore stores strings, so we should return the value as-is and
        // let the middleware parse it. Returning an already-parsed object
        // causes hard-to-debug runtime errors / TransformErrors.
        getItem: async (name: string) => {
          try {
            return await SecureStore.getItemAsync(name);
          } catch (e) {
            return null;
          }
        },
        setItem: async (name: string, value: any) => {
          try {
            // persist passes a stringified value; store it directly
            await SecureStore.setItemAsync(name, value);
          } catch (e) {
            // swallow: persist will retry later if necessary
          }
        },
        removeItem: async (name: string) => {
          try {
            await SecureStore.deleteItemAsync(name);
          } catch (e) {
            // ignore
          }
        },
      } as any,
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Log succinctly so we can audit hydration without noisy debug spam
          console.log('[AuthStore] Estado rehidratado do storage');
          state.setHydrated();
          console.log('[AuthStore] Hidratação marcada como completa');
        } else {
          console.log('[AuthStore] Nenhum estado para rehidratar');
        }
      },
    }
  )
);

export default useAuthStore;
