import client from './axiosClient';
import useAuthStore from '../stores/authStore';
import { LocationGeocodedAddress } from 'expo-location';

// Geocoded address used on the client: LocationGeocodedAddress extended
// with common provider fields that we may receive (formatted, display_name, name)
export type GeocodedAddress = LocationGeocodedAddress & {
  formatted?: string;
  display_name?: string;
  name?: string;
  formattedAddress?: string;
};

/**
 * A custom address type that unifies geocoded addresses and simple formatted addresses
 * used when the user types an address manually.
 */
export interface CustomAddress {
  formatted: string;
  city?: string;
  region?: string;
  postalCode?: string;
}

// Use only LocationGeocodedAddress on the client for address representation
export type ProjectAddress = LocationGeocodedAddress;

export interface ProjectLocation {
  /**
   * Prefer GeoJSON Point shape for coordinates (type + coordinates array) for compatibility with backend.
   * We keep the older array form for compatibility, but new code should use `geojson`.
   */
  coordinates?: { type: 'Point'; coordinates: [number, number] } | [number, number];
  /**
   * `address` may be a geocoded object (from expo-location) or a small
   * custom object with formatted text and optional city/region/postalCode.
   */
  address?: ProjectAddress;
  geocode_source?: string;
  geocode_confidence?: number;
  approximate?: boolean;
  confirmed_at?: string; // ISO timestamp when user confirmed location on map
  city?: string;
  state?: string;
  zip_code?: string;
}

export interface ProjectCategory {
  main: string;
  sub: string;
}

export interface ProjectCreateData {
  title: string;
  description: string;
  category: ProjectCategory;
  skills_required?: string[];
  budget_min?: number;
  budget_max?: number;
  location: ProjectLocation;
  attachments?: string[];
  deadline?: string; // ISO date string
  remote_execution?: boolean;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  category: ProjectCategory | string;
  skills_required: string[];
  budget_min?: number;
  budget_max?: number;
  location: ProjectLocation;
  attachments: string[];
  deadline?: string;
  remote_execution: boolean;
  client_id: string;
  client_name?: string;
  status: string;
  created_at: string;
  updated_at: string;
  liberado_por: string[];
  liberado_por_profiles?: Array<{
    id: string;
    full_name?: string;
    avatar_url?: string;
  }>;
  chat: any[];
  closed_at?: string;
  final_budget?: number;
  closed_by?: string;
  closed_by_name?: string;
  // Note: featured fields exist on backend but are omitted here for compatibility
}

/**
 * Create a new project
 */
export async function createProject(data: ProjectCreateData): Promise<Project> {
  // Ensure Authorization header present in case axios interceptor didn't run or token not set
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const response = await client.post('/projects/', data, config);
  return response.data;
}

/**
 * Get projects with optional filters
 */
export async function getProjects(params?: {
  skip?: number;
  limit?: number;
  category?: string;
  status?: string;
  subcategories?: string[];
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}): Promise<Project[]> {
  const response = await client.get('/projects/', { params });
  return response.data;
}

/**
 * Get current user's projects (as client)
 */
export async function getMyProjects(status?: string): Promise<Project[]> {
  const params: { status?: string } = {};
  if (status) {
    params.status = status;
  }
  const response = await client.get('/projects/my/projects', { params });
  return response.data;
}

/**
 * Get a specific project by ID
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await client.get(`/projects/${projectId}`);
  return response.data;
}

export async function geocodeAddress(address: string): Promise<{ address: string; coordinates: [number, number]; provider?: string; raw?: any }> {
  const response = await client.post('/users/address/geocode', { address });
  return response.data;
}

/**
 * Get recommended categories based on user's last projects
 * Note: Backend endpoint uses 'recomended' spelling
 */
export async function getRecommendedCategories(): Promise<string[]> {
  const response = await client.get('/projects/recomended-categories');
  return response.data;
}


export async function getNearbyCombinedProjects(token?: string, params?: { latitude?: number; longitude?: number; radius_km?: number; subcategories?: string[] }): Promise<{ all: Project[]; non_remote: Project[] }> {
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const response = await client.get('/projects/nearby/combined', {
    ...config,
    params,
  });
  return response.data as { all: Project[]; non_remote: Project[] };
}

