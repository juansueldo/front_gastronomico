import { apiClient } from './client';
import { API_VERSION } from './types';

export interface PlanOption {
  id: number;
  name: string;
  description?: string | null;
  isFree?: boolean;
  billingCycleId?: number;
  PlanPrices?: Array<{
    id?: number;
    price?: number | string;
    currency?: string;
  }>;
  PlanFeatures?: Array<{
    id?: number;
    name?: string;
    description?: string;
    value?: string;
  }>;
}

export interface StoreSubscription {
  id: number;
  storeId: number;
  planId: number;
  startDate?: string;
  endDate?: string;
  payment?: number;
  statusId?: number;
  Plan?: PlanOption;
  Status?: {
    id?: number;
    name?: string;
  };
}

type PlanListResponse = {
  rows?: PlanOption[];
  data?: PlanOption[];
  plans?: PlanOption[];
};

export async function listPlans(): Promise<PlanOption[]> {
  const data = await apiClient.get<PlanListResponse | PlanOption[]>(`${API_VERSION}/plan`, {
    config: { isPublic: true, cache: 'short' },
  });

  if (Array.isArray(data)) return data;
  return data.rows ?? data.data ?? data.plans ?? [];
}

export async function createSubscription(planId: number, billingCycleId?: number): Promise<StoreSubscription> {
  return apiClient.post<StoreSubscription>(`${API_VERSION}/subscription`, {
    planId,
    ...(billingCycleId ? { billingCycleId } : {}),
  });
}

export async function listStoreSubscriptions(): Promise<StoreSubscription[]> {
  const data = await apiClient.get<{ rows?: StoreSubscription[]; data?: StoreSubscription[] } | StoreSubscription[]>(
    `${API_VERSION}/subscription`,
    { config: { cache: 'none' } },
  );

  if (Array.isArray(data)) return data;
  return data.rows ?? data.data ?? [];
}
