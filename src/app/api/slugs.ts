/**
 * API de Slugs - Store slugs endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface StoreSlug {
  id: string;
  customerId: number;
  slugUrl: string;
  statusId: number;
  createdAt?: string;
}

export interface CreateSlugRequest {
  slugUrl: string;
  statusId?: number;
  customerId?: number;
  customer_id?: number;
}

/**
 * Obtiene los slugs de un cliente
 */
export async function fetchCustomerSlugs(customerId?: number): Promise<StoreSlug[]> {
  const params = customerId ? { customerId: String(customerId) } : undefined;
  const data = await apiClient.get(`${API_VERSION}/slug`, {
    params,
    config: { cache: 'long' },
  });
  return Array.isArray(data) ? data : [];
}

/**
 * Crea un nuevo slug
 */
export async function createCustomerSlug(slugData: CreateSlugRequest): Promise<StoreSlug> {
  return apiClient.post(`${API_VERSION}/slug/create`, slugData);
}

/**
 * Obtiene un slug específico
 */
export async function getSlug(slugId: string): Promise<StoreSlug> {
  return apiClient.get(`${API_VERSION}/slug/${slugId}`);
}

/**
 * Actualiza un slug
 */
export async function updateSlug(slugId: string, data: CreateSlugRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/slug/update/${slugId}`, {
    id: slugId,
    ...data,
  });
}
