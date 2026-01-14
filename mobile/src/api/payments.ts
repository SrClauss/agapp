import client from './axiosClient';

export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  credits_amount: number;
  price: number;
  currency: string;
  is_active: boolean;
  created_at: string;
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
  return response.data;
};

export const getUserCreditTransactions = async (): Promise<CreditTransaction[]> => {
  const response = await client.get('/api/payments/history');
  return response.data.transactions || [];
};

export const createCreditPackagePayment = async (packageId: string, billingType: string) => {
  const response = await client.post('/api/payments/credits', {
    package_id: packageId,
    billing_type: billingType,
  });
  return response.data;
};