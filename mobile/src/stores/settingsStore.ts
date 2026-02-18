import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProfessionalSettings, updateProfessionalSettings } from '../api/users';

export type SettingsState = {
  service_radius_km?: number;
  subcategories?: string[];
  loading: boolean;
  error?: string;
  setServiceRadiusKm: (radius?: number) => void;
  setSubcategories: (subs?: string[]) => void;
  loadFromServer: (token: string) => Promise<void>;
  saveToServer: (token: string) => Promise<void>;
  clear: () => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      service_radius_km: undefined,
      loading: false,
      error: undefined,
      setServiceRadiusKm: (radius?: number) => set({ service_radius_km: radius, error: undefined }),
      setSubcategories: (subs?: string[]) => set({ subcategories: subs, error: undefined }),
      loadFromServer: async (token: string) => {
        set({ loading: true, error: undefined });
        try {
          const data = await getProfessionalSettings(token);
          set({ service_radius_km: data?.service_radius_km, subcategories: data?.subcategories || [], loading: false });
        } catch (err: any) {
          console.warn('[SettingsStore] erro ao carregar configurações do servidor', err);
          set({ error: err?.message || 'load_error', loading: false });
        }
      },
      saveToServer: async (token: string) => {
        set({ loading: true, error: undefined });
        try {
          const { service_radius_km, subcategories } = get();
          await updateProfessionalSettings(token, { service_radius_km, subcategories });
          set({ loading: false });
        } catch (err: any) {
          console.warn('[SettingsStore] erro ao salvar configurações no servidor', err);
          set({ error: err?.message || 'save_error', loading: false });
        }
      },
      clear: () => set({ service_radius_km: undefined, subcategories: undefined, loading: false, error: undefined }),
    }),
    {
      name: 'settings-storage',
      storage: {
        getItem: async (name: string) => {
          try {
            return await AsyncStorage.getItem(name);
          } catch (e) {
            return null;
          }
        },
        setItem: async (name: string, value: any) => {
          try {
            // Persist as string; persist middleware may pass objects
            const str = typeof value === 'string' ? value : JSON.stringify(value);
            await AsyncStorage.setItem(name, str);
          } catch (e) {
            // ignore
          }
        },
        removeItem: async (name: string) => {
          try {
            await AsyncStorage.removeItem(name);
          } catch (e) {
            // ignore
          }
        },
      } as any,
    }
  )
);

export default useSettingsStore;
