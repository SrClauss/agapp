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
