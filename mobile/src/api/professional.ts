import client from './axiosClient';

export type ProfessionalStats = {
  active_subscriptions: number;
  credits_available: number;
  contacts_received: number;
  projects_completed: number;
};

export async function getProfessionalStats(): Promise<ProfessionalStats> {
  const res = await client.get('/api/professional/stats');
  return res.data as ProfessionalStats;
}

export async function getContactedProjects(skip = 0, limit = 50) {
  const res = await client.get('/api/professional/contacted-projects', { params: { skip, limit } });
  return res.data as any[];
}
