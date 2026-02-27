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
  // Additional address details collected from user
  number?: string; // house number
  complement?: string;
  reference?: string;
}

// Use only LocationGeocodedAddress on the client for address representation
export type ProjectAddress = LocationGeocodedAddress | CustomAddress;

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
  _id: string;
  id?: string; // Alias para compatibilidade
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
  // Contacts array (project-scoped) — may be present when fetching a full project
  contacts?: ContactSummary[];
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

  // Defensive normalization: ensure coordinates are sent as GeoJSON Point when provided as legacy array
  const payload: any = { ...data };
  if (payload.location && Array.isArray((payload.location as any).coordinates)) {
    payload.location = {
      ...payload.location,
      coordinates: { type: 'Point', coordinates: (payload.location as any).coordinates },
    };
  }

  // Debug logging: masked token and payload (non-sensitive)
  if (__DEV__) {
    const masked = token ? `${token.slice(0,6)}...${token.slice(-6)}` : null;
    console.log('[projects.createProject] POST /projects/ token=', masked, 'payload=', {
      title: payload.title,
      category: payload.category,
      remote_execution: payload.remote_execution,
      location: payload.location ? (payload.location.coordinates ? '[geo-point]' : '[no-coords]') : '[no-location]',
    });
  }

  const response = await client.post('/projects/', payload, config);
  return response.data;
}

export async function updateProject(projectId: string, data: ProjectCreateData): Promise<Project> {
  // Ensure Authorization header present in case axios interceptor didn't run or token not set
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  // Defensive normalization for update: convert legacy coordinate arrays to GeoJSON
  const payload: any = { ...data };
  if (payload.location && Array.isArray((payload.location as any).coordinates)) {
    payload.location = {
      ...payload.location,
      coordinates: { type: 'Point', coordinates: (payload.location as any).coordinates },
    };
  }

  if (__DEV__) {
    const masked = token ? `${token.slice(0,6)}...${token.slice(-6)}` : null;
    console.log('[projects.updateProject] PUT /projects/' + projectId + ' token=', masked, 'payload=', {
      title: payload.title,
      category: payload.category,
      location: payload.location ? (payload.location.coordinates ? '[geo-point]' : '[no-coords]') : '[no-location]',
    });
  }

  const response = await client.put(`/projects/${projectId}`, payload, config);
  return response.data;
}

/**
 * Delete a project by ID
 */
export async function deleteProject(projectId: string): Promise<void> {
  // Ensure Authorization header present in case axios interceptor didn't run or token not set
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  if (__DEV__) {
    const masked = token ? `${token.slice(0,6)}...${token.slice(-6)}` : null;
    console.log('[projects.deleteProject] DELETE /projects/' + projectId + ' token=', masked);
  }

  await client.delete(`/projects/${projectId}`, config);
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

export async function reverseGeocode(latitude: number, longitude: number): Promise<{ address: string }> {
  const response = await client.post('/users/address/reverse', { latitude, longitude });
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

/**
 * Evaluate a project after completion
 */
export interface ProjectEvaluation {
  rating: number;
  comment?: string;
  would_recommend?: boolean;
}

export async function evaluateProject(
  projectId: string,
  evaluation: ProjectEvaluation
): Promise<{ message: string; evaluation_id: string }> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const response = await client.post(
    `/projects/${projectId}/evaluate`,
    evaluation,
    config
  );
  return response.data;
}

/**
 * Close a project, optionally selecting the winning professional and final value
 */
export async function closeProject(
  projectId: string,
  data: { professional_id?: string; final_budget?: number }
): Promise<{ message: string }> {
  const token = useAuthStore.getState().token;
  const config = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : undefined;

  const response = await client.post(`/projects/${projectId}/close`, data, config);
  return response.data;
}

/**
 * Contact summary for listing contacts in project details
 */
export interface ContactSummary {
  id: string;
  professional_id: string;
  professional_name: string;
  professional_avatar?: string;
  status: string;
  created_at: string;
  last_message?: {
    id: string;
    sender_id: string;
    content: string;
    created_at: string;
  };
  unread_count: number;
  contact_details: {
    message?: string;
    proposal_price?: number;
    [key: string]: any;
  };
}

/**
 * Get all contacts for a project (client view)
 */
export async function getProjectContacts(projectId: string): Promise<ContactSummary[]> {
  const token = useAuthStore.getState().token;
  const config = token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
  
  const response = await client.get(`/projects/${projectId}/contacts`, config);
  return response.data;
}


