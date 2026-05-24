/**
 * apiConnection.ts - Cliente centralizado para peticiones HTTP a la API
 */

import { API_VERSION } from '../core/http/types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, any>;
  config?: Record<string, any>;
}

async function request<T>(
  method: 'GET' | 'POST' | 'DELETE' | 'PUT',
  url: string,
  data?: any,
  options: RequestConfig = {}
): Promise<T> {
  const fullUrl = `${BASE_URL}${url}`;
  const token = localStorage.getItem('token');

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(options.headers || {}),
    },
    ...options.config,
  };

  if (data && method !== 'GET') {
    fetchOptions.body = JSON.stringify(data);
  }

  const response = await fetch(fullUrl, fetchOptions);

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

export const apiConnection = {
  get: <T>(url: string, options?: RequestConfig) => request<T>('GET', url, undefined, options),
  post: <T>(url: string, data?: any, options?: RequestConfig) => request<T>('POST', url, data, options),
  delete: <T>(url: string, options?: RequestConfig) => request<T>('DELETE', url, undefined, options),
  put: <T>(url: string, data?: any, options?: RequestConfig) => request<T>('PUT', url, data, options),
};
