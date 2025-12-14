import { create } from 'zustand';
import useAuthStore from './authStore';
import useLocationStore from './locationStore';
import { Project, getNearbyCombinedProjects } from '../api/projects';

export type ProjectsNearbyState = {
  projectsNearby: Project[]; // DEPRECATED: prefer using projectsAll and projectsNonRemote
  projectsAll: Project[];
  projectsNonRemote: Project[];
  // last used radius (km) from the latest fetch call, if any
  lastRadiusKm?: number;
  loading: boolean;
  error?: string;
  setProjectsNearby: (projects: Project[]) => void;
  setProjectsAll: (projects: Project[]) => void;
  setProjectsNonRemote: (projects: Project[]) => void;
  setLastRadiusKm: (radius?: number) => void;
  fetchProjectsNearby: (options?: {
    token?: string;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    subcategories?: string[];
  }) => Promise<Project[]>;
  clear: () => void;
};

export const useProjectsNearbyStore = create<ProjectsNearbyState>((set, get) => ({
  projectsNearby: [],
  projectsAll: [],
  projectsNonRemote: [],
  lastRadiusKm: undefined,
  loading: false,
  error: undefined,
  setProjectsNearby: (projects: Project[]) => set({ projectsNearby: projects, error: undefined }),
  setProjectsAll: (projects: Project[]) => set({ projectsAll: projects, error: undefined }),
  setProjectsNonRemote: (projects: Project[]) => set({ projectsNonRemote: projects, error: undefined }),
  setLastRadiusKm: (radius?: number) => set({ lastRadiusKm: radius }),
  clear: () => set({ projectsNearby: [], projectsAll: [], projectsNonRemote: [], error: undefined }),
  fetchProjectsNearby: async (options = {}) => {
    console.log('[ProjectsNearbyStore] fetchProjectsNearby chamado com opções:', options);
    console.log('[ProjectsNearbyStore] Estado atual antes da busca:', get());
    console.log('[ProjectsNearbyStore] Token usado na busca:', options.token ?? useAuthStore.getState().token);
    console.log('[ProjectsNearbyStore] Coordenadas usadas na busca:', {
      latitude: options.latitude,
      longitude: options.longitude,
    });
    console.log('[ProjectsNearbyStore] Raio usado na busca (km):', options.radius_km ?? '(não definido — será 50 se houver coords)');

    // Resolve token: prefer explicit option, fallback to auth store. Do NOT
    // read SecureStore directly; other routes rely on the `authStore` and
    // axios interceptors to attach Authorization headers.
    const effectiveToken = options.token ?? useAuthStore.getState().token ?? undefined;

    set({ loading: true, error: undefined });
    const token = effectiveToken;
    try {
      // token already resolved above

      // Resolve coords: prefer explicit options, fallback to locationStore
      let { latitude, longitude, radius_km, subcategories } = options;
      if ((latitude === undefined || longitude === undefined) && useLocationStore.getState().coords) {
        const coords = useLocationStore.getState().coords;
        if (coords) {
          longitude = longitude ?? coords[0];
          latitude = latitude ?? coords[1];
        }
      }

      // If we have coords but no explicit radius, use sensible default (50 km)
      if ((latitude !== undefined && longitude !== undefined) && radius_km === undefined) {
        radius_km = 50;
      }

      // store last used radius (may be undefined)
      set({ lastRadiusKm: radius_km });

      const params: any = {};
      if (latitude !== undefined) params.latitude = latitude;
      if (longitude !== undefined) params.longitude = longitude;
      if (radius_km !== undefined) params.radius_km = radius_km;
      if (subcategories !== undefined) params.subcategories = subcategories;

      if (__DEV__) {
        if (token) {
          console.log('[ProjectsNearbyStore] Fazendo requisição com token (mascarado):', `${token.slice(0,6)}...${token.slice(-6)}`);
        } else {
          console.log('[ProjectsNearbyStore] Fazendo requisição sem token');
        }
      }

      // Use the combined endpoint to fetch both arrays in a single call
      const combined = await getNearbyCombinedProjects(token, Object.keys(params).length ? params : undefined);
      set({ projectsNonRemote: combined.non_remote, projectsAll: combined.all, projectsNearby: combined.non_remote, loading: false });
      return combined.non_remote;
    } catch (err: any) {
      console.warn('Failed to fetch nearby projects:', err);
      set({ error: err?.message || 'failed_fetch', loading: false });
      return [];
    }
  },
}));

export default useProjectsNearbyStore;