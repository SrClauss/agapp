import client from './axiosClient';

export interface CreditPackage {
  id: string;
  name: string;
  description?: string;
  credits: number;
  bonus_credits: number;
  price: number;
  sort_order: number;
  currency?: string;
  is_active: boolean;
  created_at?: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  type: string;
  credits: number;
  price: number;
  currency: string;
  package_name?: string;
  payment_id?: string;
  metadata?: any;
  status: string;
  created_at: string;
}

export const getCreditPackages = async (): Promise<CreditPackage[]> => {
  const response = await client.get('/api/payments/credit-packages');
  const packages: any[] = response.data || [];
  // Garantir que cada pacote tenha `id` (pode vir como `_id` do backend)
  return packages.map((pkg) => ({
    ...pkg,
    id: pkg.id || pkg._id,
  }));
};

export const getUserCreditTransactions = async (): Promise<CreditTransaction[]> => {
  const response = await client.get('/api/payments/history');
  return response.data.transactions || [];
};

export const createCreditPackagePayment = async (packageId: string, billingType: string) => {
  const payload = {
    package_id: packageId,
    billing_type: billingType,
  };
  if (__DEV__) {
    console.log('[API] createCreditPackagePayment payload:', payload);
  }
  try {
    const response = await client.post('/api/payments/credits', payload);
    return response.data;
  } catch (error: any) {
    const responseData = error?.response?.data;
    console.error('[API] Erro na API de pagamento:', responseData);
    if (responseData) {
      console.error('[API] Erro completo:', JSON.stringify(responseData, null, 2));
    }
    throw error;
  }
};

export const getFeaturedPricing = async () => {
  const response = await client.get('/api/payments/featured-pricing');
  return response.data;
};

export const createFeaturedProjectPayment = async (
  projectId: string,
  durationDays: number,
  billingType: string
) => {
  const response = await client.post('/api/payments/featured-project', {
    project_id: projectId,
    duration_days: durationDays,
    billing_type: billingType,
  });
  return response.data;
};