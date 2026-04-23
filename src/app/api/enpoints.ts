// Centraliza los endpoints de la API
// Puedes importar y usar estas funciones en tus hooks o vistas

import { apiClient } from './client';
import { API_VERSION } from './types';

// --- AUTH ---
export const endpoints = {
  login: (credentials: any) => apiClient.post(`${API_VERSION}/auth/login`, credentials, { config: { isPublic: true } }),
  register: (data: any) => apiClient.post(`${API_VERSION}/auth/register`, data, { config: { isPublic: true } }),
  validateToken: () => apiClient.get(`${API_VERSION}/auth/validate`, { config: { cache: 'short' } }),

  // --- CATEGORIES ---
  fetchCategories: () => apiClient.get(`${API_VERSION}/category/list`, { config: { cache: 'long' } }),
  getCategory: (id: string) => apiClient.get(`${API_VERSION}/category/${id}`),
  createCategory: (data: any) => apiClient.post(`${API_VERSION}/category/create`, data),
  updateCategory: (id: string, data: any) => apiClient.post(`${API_VERSION}/category/update/${id}`, { id, ...data }),
  deleteCategory: (id: string) => apiClient.delete(`${API_VERSION}/category/${id}`),

  // --- PRODUCTS (ejemplo, puedes agregar más) ---
  fetchProducts: () => apiClient.get(`${API_VERSION}/product/list`, { config: { cache: 'long' } }),
  getProduct: (id: string) => apiClient.get(`${API_VERSION}/product/${id}`),
  createProduct: (data: any) => apiClient.post(`${API_VERSION}/product/create`, data),
  updateProduct: (id: string, data: any) => apiClient.post(`${API_VERSION}/product/update/${id}`, { id, ...data }),
  deleteProduct: (id: string) => apiClient.delete(`${API_VERSION}/product/${id}`),

    // --- TABLES ---
    fetchTables: () => apiClient.get(`${API_VERSION}/table`, { config: { cache: 'short' } }),
    listTables: (params?: any) => apiClient.get(`${API_VERSION}/table`, { params }),
    getTable: (id: string) => apiClient.get(`${API_VERSION}/table/${id}`),
    createTable: (data: any) => apiClient.post(`${API_VERSION}/table`, data),
    updateTable: (id: string, data: any) => apiClient.post(`${API_VERSION}/table/${id}`, { id, ...data }),
    deleteTable: (id: string) => apiClient.delete(`${API_VERSION}/table/${id}`),

    // --- HEADQUARTERS ---
    fetchHeadquarters: () => apiClient.get(`${API_VERSION}/headquarter`, { config: { cache: 'long' } }),
    getHeadquarter: (id: string) => apiClient.get(`${API_VERSION}/headquarter/${id}`),
    createHeadquarter: (data: any) => apiClient.post(`${API_VERSION}/headquarter`, data),
    updateHeadquarter: (id: string, data: any) => apiClient.post(`${API_VERSION}/headquarter/${id}`, { id, ...data }),
    deleteHeadquarter: (id: string) => apiClient.delete(`${API_VERSION}/headquarter/${id}`),

    // --- DELIVERY ZONE ---
    fetchDeliveryZones: () => apiClient.get(`${API_VERSION}/delivery-zone`, { config: { cache: 'long' } }),
    getDeliveryZone: (id: string) => apiClient.get(`${API_VERSION}/delivery-zone/${id}`),
    createDeliveryZone: (data: any) => apiClient.post(`${API_VERSION}/delivery-zone`, data),
    updateDeliveryZone: (id: string, data: any) => apiClient.post(`${API_VERSION}/delivery-zone/${id}`, { id, ...data }),
    deleteDeliveryZone: (id: string) => apiClient.delete(`${API_VERSION}/delivery-zone/${id}`),

};
