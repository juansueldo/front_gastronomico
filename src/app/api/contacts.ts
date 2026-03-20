/**
 * API de Contactos - Contact endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface ContactItem {
  id: number;
  name?: string;
  phone?: string;
  label?: number;
  last_message?: string | null;
  last_message_date?: string | null;
  instance_id?: number | string;
  instance_description?: string;
  network?: string;
}

export interface CreateContactRequest {
  instance_id: number;
  phone: string;
  name: string;
  seat_id?: number;
}

export interface UpdateContactRequest {
  name?: string;
  phone?: string;
  label?: number;
  instance_id?: number;
}

export interface ContactResponse {
  id?: number;
  contactId?: number;
  contact?: {
    id?: number;
  };
  [key: string]: unknown;
}

/**
 * Crea un contacto
 */
export async function createContact(payload: CreateContactRequest): Promise<ContactResponse> {
  return apiClient.post(`${API_VERSION}/contact/create`, payload);
}

/**
 * Lista contactos con instancia y ultimo mensaje
 */
export async function listContacts(): Promise<ContactItem[]> {
  const data = await apiClient.get(`${API_VERSION}/contact/list`, {
    config: { cache: 'short' },
  });

  return Array.isArray(data) ? data : data?.contacts ?? data?.data ?? [];
}

/**
 * Obtiene un contacto por ID
 */
export async function getContactById(contactId: number | string): Promise<ContactItem> {
  return apiClient.get(`${API_VERSION}/contact/${contactId}`);
}

/**
 * Actualiza un contacto por ID
 */
export async function updateContact(
  contactId: number | string,
  payload: UpdateContactRequest,
): Promise<ContactResponse> {
  return apiClient.post(`${API_VERSION}/contact/update/${contactId}`, payload);
}
