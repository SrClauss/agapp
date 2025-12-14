import { create } from 'zustand';
import * as Location from 'expo-location';

type LocationState = {
  coords?: [number, number]; // [lng, lat]
  locationText?: string;
  neighborhood?: string;
  loading: boolean;
  error?: string;
  setLocation: (payload: { coords?: [number, number]; locationText?: string; neighborhood?: string }) => void;
  clear: () => void;
  fetchLocation: () => Promise<void>;
};

export const useLocationStore = create<LocationState>((set, get) => ({
  coords: undefined,
  locationText: undefined,
  neighborhood: undefined,
  loading: false,
  error: undefined,
  setLocation: (payload) => set({ ...payload, loading: false, error: undefined }),
  clear: () => set({ coords: undefined, locationText: undefined, neighborhood: undefined, loading: false, error: undefined }),
  fetchLocation: async () => {
    try {
      set({ loading: true, error: undefined });
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        set({ locationText: 'Localização não permitida', loading: false, error: 'permission_denied' });
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!location) {
        set({ locationText: 'Localização desconhecida', loading: false, error: 'no_location' });
        return;
      }

      const [address] = await Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude });

      const neighborhood = address?.district || undefined;
      const city = address?.city || address?.subregion || '';
      const state = address?.region || '';
      const locationText = city || state ? `${city}${city && state ? ', ' : ''}${state}` : 'Localização desconhecida';

      // store coords as [lng, lat] to match backend convention
      const coords: [number, number] = [location.coords.longitude, location.coords.latitude];

      set({ coords, locationText, neighborhood, loading: false, error: undefined });
    } catch (e: any) {
      console.error('[LocationStore] Erro ao buscar localização', e);
      set({ loading: false, error: e?.message || 'unknown_error', locationText: 'Erro ao obter localização' });
    }
  },
}));

export default useLocationStore;
