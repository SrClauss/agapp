import { create } from 'zustand';
import useAuthStore from './authStore';
import useLocationStore from './locationStore';
import { Project, getNearbyNonRemoteProjects } from '../api/projects';

export type ProjectsNearbyState = {
  projectsNearby: Project[];
  loading: boolean;
  error: string | null;
  setProjectsNearby: (projects: Project[]) => void;
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
  loading: false,
  error: null,
  setProjectsNearby: (projects: Project[]) => set({ projectsNearby: projects, error: null }),
  clear: () => set({ projectsNearby: [], error: null }),
  fetchProjectsNearby: async (options = {}) => {
    set({ loading: true, error: null });
    try {
      // Resolve token: prefer explicit option, fallback to auth store
      const token = options.token ?? useAuthStore.getState().token ?? undefined;

      // Resolve coords: prefer explicit options, fallback to locationStore
      let { latitude, longitude, radius_km, subcategories } = options;
      if ((latitude === undefined || longitude === undefined) && useLocationStore.getState().coords) {
        const coords = useLocationStore.getState().coords;
        if (coords) {
          longitude = longitude ?? coords[0];
          latitude = latitude ?? coords[1];
        }
      }

      const params: any = {};
      if (latitude !== undefined) params.latitude = latitude;
      if (longitude !== undefined) params.longitude = longitude;
      if (radius_km !== undefined) params.radius_km = radius_km;
      if (subcategories !== undefined) params.subcategories = subcategories;

      const data = await getNearbyNonRemoteProjects(token, Object.keys(params).length ? params : undefined);
      set({ projectsNearby: data, loading: false });
      return data;
    } catch (err: any) {
      console.warn('Failed to fetch nearby projects:', err);
      set({ error: err?.message || 'failed_fetch', loading: false });
      return [];
    }
  },
}));

export default useProjectsNearbyStore;