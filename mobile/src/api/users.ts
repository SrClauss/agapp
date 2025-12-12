import client from './axiosClient';

export interface ProfessionalSettings {
  establishment_name?: string;
  establishment_address?: string;
  establishment_coordinates?: [number, number]; // [longitude, latitude]
  service_radius_km?: number;
  accepts_remote?: boolean;
  portfolio_url?: string;
  skills?: string[];
  bio?: string;
  subcategories?: string[];
}

export interface SubcategoryProjectCount {
  subcategory: string;
  count: number;
}

export interface CategoryProjectCounts {
  category: string;
  total_count: number;
  subcategory_counts: SubcategoryProjectCount[];
}

export async function getProfessionalSettings(token: string): Promise<ProfessionalSettings> {
  const { data } = await client.get('/users/me/professional-settings', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function updateProfessionalSettings(
  token: string,
  settings: Partial<ProfessionalSettings>
): Promise<any> {
  const { data } = await client.put('/users/me/professional-settings', settings, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

export async function getProfessionalProjectCounts(token: string): Promise<CategoryProjectCounts[]> {
  const { data } = await client.get('/users/me/professional/project-counts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}
