import { apiClient } from '../core/http/client';
import { API_VERSION } from '../core/http/types';

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
  provider?: string | null;
  providerSubscriptionId?: string | null;
  providerStatus?: string | null;
  initPoint?: string | null;
  payerEmail?: string | null;
  Plan?: PlanOption;
  Status?: {
    id?: number;
    name?: string;
  };
}

export interface MercadoPagoPreapprovalResponse {
  subscription: StoreSubscription;
  initPoint?: string | null;
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
  const data = await apiClient.post<StoreSubscription | MercadoPagoPreapprovalResponse>(`${API_VERSION}/subscription`, {
    planId,
    ...(billingCycleId ? { billingCycleId } : {}),
  });

  if ('subscription' in data) return data.subscription;
  return data;
}

export async function createMercadoPagoPreapproval(
  planId: number,
  billingCycleId?: number,
): Promise<MercadoPagoPreapprovalResponse> {
  return apiClient.post<MercadoPagoPreapprovalResponse>(`${API_VERSION}/subscription/mercadopago/preapproval`, {
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
