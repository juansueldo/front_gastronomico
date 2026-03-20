/**
 * API de Caja - Cash Movements endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

export interface CashMovement {
  id: string;
  time: string;
  type: 'venta' | 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
  createdAt?: string;
  created_at?: string;
}

export interface CreateCashMovementRequest {
  type: 'venta' | 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

/**
 * Obtiene todos los movimientos de caja
 */
export async function fetchCashMovements(): Promise<CashMovement[]> {
  const data = await apiClient.get(`${API_VERSION}/cash-movements`, {
    config: { cache: 'short' },
  });
  return Array.isArray(data)
    ? data
    : Array.isArray(data?.movements)
    ? data.movements
    : Array.isArray(data?.cashMovements)
    ? data.cashMovements
    : [];
}

/**
 * Lista movimientos de caja con paginación
 */
export async function listCashMovements(params?: any): Promise<CashMovement[]> {
  const data = await apiClient.get(`${API_VERSION}/cash-movements/list`, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
}

/**
 * Crea un nuevo movimiento de caja
 */
export async function createCashMovement(movementData: CreateCashMovementRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/cash-movements`, movementData);
}

/**
 * Cierra la caja del día
 */
export async function closeDailyCashMovements(date: string): Promise<any> {
  return apiClient.post(`${API_VERSION}/cash-movements/close-daily`, { date });
}

/**
 * Obtiene movimientos finalizados por fecha
 */
export async function getFinalizedCashMovementsByDate(date: string): Promise<CashMovement[]> {
  const data = await apiClient.get(`${API_VERSION}/cash-movements/finalized/by-date`, {
    params: { date },
  });
  return Array.isArray(data) ? data : data?.data ?? [];
}
