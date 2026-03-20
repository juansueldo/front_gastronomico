/**
 * API de Storefront - Public Store endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface PublicStoreInfo {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  statusId?: number;
}

export interface PublicStoreProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
}

export interface CreatePublicOrderRequest {
  customerName: string;
  phone: string;
  type: 'delivery' | 'pickup';
  address?: string;
  items?: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
}

/**
 * Obtiene información pública de una tienda por slug
 */
export async function fetchPublicStore(slug: string): Promise<PublicStoreInfo> {
  return apiClient.get(`/store/${slug}`, {
    config: { isPublic: true, cache: 'long' },
  });
}

/**
 * Obtiene los productos de una tienda pública
 */
export async function fetchPublicStoreProducts(slug: string): Promise<PublicStoreProduct[]> {
  const data = await apiClient.get(`/store/${slug}/products`, {
    config: { isPublic: true, cache: 'long' },
  });
  return Array.isArray(data) ? data : data?.products ?? data?.data ?? [];
}

/**
 * Crea una orden en una tienda pública
 */
export async function createPublicOrder(
  slug: string,
  orderData: CreatePublicOrderRequest
): Promise<any> {
  return apiClient.post(`/store/${slug}/orders`, orderData, {
    config: { isPublic: true },
  });
}
