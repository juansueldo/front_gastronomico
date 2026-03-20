/**
 * API de Mesas - Dining Tables endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface TableItem {
  id: string;
  name: string;
  description?: string;
  active: boolean;
  capacity?: number;
  location?: string;
}

export interface CreateTableRequest {
  name: string;
  description?: string;
  active?: boolean;
  capacity?: number;
  location?: string;
}

/**
 * Obtiene todas las mesas
 */
export async function fetchTables(): Promise<TableItem[]> {
  const data = await apiClient.get(`${API_VERSION}/dining-tables`, {
    config: { cache: 'short' },
  });
  return Array.isArray(data) ? data : data?.tables ?? [];
}

/**
 * Lista todas las mesas con paginación
 */
export async function listTables(params?: any): Promise<TableItem[]> {
  const data = await apiClient.get(`${API_VERSION}/dining-tables/list`, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
}

/**
 * Obtiene una mesa específica
 */
export async function getTable(tableId: string): Promise<TableItem> {
  return apiClient.get(`${API_VERSION}/dining-tables/${tableId}`);
}

/**
 * Crea una nueva mesa
 */
export async function createTable(tableData: CreateTableRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/dining-tables/create`, tableData);
}

/**
 * Actualiza una mesa
 */
export async function updateTable(tableId: string, data: CreateTableRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/dining-tables/update/${tableId}`, {
    id: tableId,
    ...data,
  });
}

/**
 * Elimina una mesa
 */
export async function deleteTable(tableId: string): Promise<any> {
  return apiClient.delete(`${API_VERSION}/dining-tables/${tableId}`);
}

/**
 * Compatibilidad: endpoints con underscore legacy
 */
export async function listDiningTableSlash(params?: any): Promise<TableItem[]> {
  const data = await apiClient.get(`${API_VERSION}/dining_tables/list`, { params });
  return Array.isArray(data) ? data : data?.data ?? [];
}

export async function fetchDiningTableSlash(): Promise<TableItem[]> {
  const data = await apiClient.get(`${API_VERSION}/dining_tables`, {
    config: { cache: 'short' },
  });
  return Array.isArray(data) ? data : [];
}
