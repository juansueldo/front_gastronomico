/**
 * API de Órdenes/Pedidos - Orders endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface OrderItem {
  id: string;
  type: 'delivery' | 'salon';
  customerName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: string[];
  detail: string;
  status: string;
  total: string | number;
  createdAt: string;
  notes?: string;
  contactId: number;
}

export interface CreateOrderRequest {
  contactId: number;
  type: 'delivery' | 'salon';
  detail: string;
  total: string | number;
  status?: string;
  createdAt?: string;
  notes?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items?: string[];
  productIds?: string[];
}

/**
 * Obtiene las órdenes activas
 */
export async function fetchActiveOrders(): Promise<OrderItem[]> {
  const data = await apiClient.get(`${API_VERSION}/orders/active`, {
    config: { cache: 'short' },
  });
  return Array.isArray(data) ? data : data?.orders ?? [];
}

/**
 * Crea una nueva orden
 */
export async function createOrder(orderData: CreateOrderRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/orders/create`, orderData);
}

/**
 * Actualiza el estado de una orden
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<any> {
  return apiClient.post(`${API_VERSION}/orders/${orderId}/status`, { status });
}

/**
 * Marca una orden como completada
 */
export async function completeOrder(orderId: string): Promise<any> {
  return apiClient.post(`${API_VERSION}/orders/${orderId}/complete`, {});
}

/**
 * Obtiene los estados disponibles
 */
export async function fetchOrderStatuses(): Promise<any[]> {
  const data = await apiClient.get(`${API_VERSION}/orders/statuses`, {
    config: { cache: 'long' },
  });
  return Array.isArray(data) ? data : [];
}
