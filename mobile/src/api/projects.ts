import client from './axiosClient';

export interface ProjectLocation {
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  coordinates?: [number, number]; // [longitude, latitude]
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
  chat: any[];
  closed_at?: string;
  final_budget?: number;
  closed_by?: string;
  closed_by_name?: string;
}

/**
 * Create a new project
 */
export async function createProject(data: ProjectCreateData): Promise<Project> {
  const response = await client.post('/projects/', data);
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
  latitude?: number;
  longitude?: number;
  radius_km?: number;
}): Promise<Project[]> {
  const response = await client.get('/projects/', { params });
  return response.data;
}

/**
 * Get a specific project by ID
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await client.get(`/projects/${projectId}`);
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
