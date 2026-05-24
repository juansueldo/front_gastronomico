/**
 * API de Conexiones/Instancias - Instances endpoints
 */

import { apiClient } from '../core/http/client';
import { API_VERSION } from '../core/http/types';

export interface ConnectionItem {
  id: string | number;
  description?: string;
  phone?: string;
  network?: string | number;
  network_name?: string;
  instanceId?: string | number;
}

export interface NetworkOption {
  id?: string | number;
  value?: string;
  label?: string;
  name?: string;
  code?: string;
  key?: string;
  status?: number;
  description?: string;
}

export interface LoginInstanceResponse {
  ok?: boolean;
  message?: string;
  instanceId?: number | string;
  provider?: string;
  network_name?: string;
  qr?: string | null;
  status?: string;
  snapshot?: {
    status?: string;
    qr?: string | null;
    qrDataUrl?: string | null;
    connected?: boolean;
    wid?: string | null;
    phone?: string | null;
    pushname?: string | null;
  };
  whatsapp?: {
    status?: string;
    qr?: string | null;
  };
  error?: string;
}

/**
 * Lista todas las instancias de mensajería
 */
export async function listInstances(): Promise<ConnectionItem[]> {
  const data = await apiClient.get(`${API_VERSION}/instance/list`, {
    config: { cache: 'long' },
  });
  return Array.isArray(data) ? data : data?.instances ?? [];
}

/**
 * Crea una nueva instancia
 */
export async function createInstance(connectionData: {
  customer_id?: number;
  customerId?: number;
  description: string;
  phone: string;
  network: number | string;
}): Promise<ConnectionItem> {
  return apiClient.post(`${API_VERSION}/instance/create`, connectionData);
}

/**
 * Inicia sesión en una instancia (obtiene QR)
 */
export async function loginInstance(instanceId: string | number): Promise<LoginInstanceResponse> {
  return apiClient.post(`${API_VERSION}/instance/${instanceId}/login`, {});
}

/**
 * Lista todas las redes disponibles
 */
export async function listNetworks(): Promise<NetworkOption[]> {
  const data = await apiClient.get(`${API_VERSION}/network/list`, {
    config: {  cache: 'long' },
  });
  return Array.isArray(data) ? data : data?.networks ?? [];
}

/**
 * Obtiene una red específica
 */
export async function getNetwork(networkId: string | number): Promise<NetworkOption> {
  return apiClient.get(`${API_VERSION}/network/${networkId}`);
}

/**
 * Compatibilidad: endpoints WhatsApp legacy alias
 */
export async function listWhatsappInstances(): Promise<ConnectionItem[]> {
  const data = await apiClient.get(`${API_VERSION}/whatsapp/instances`, {
    config: { cache: 'short' },
  });
  return Array.isArray(data) ? data : [];
}

export async function loginWhatsappInstance(
  instanceId: string | number
): Promise<LoginInstanceResponse> {
  return apiClient.post(`${API_VERSION}/whatsapp/instances/${instanceId}/login`, {});
}
