// Centraliza los endpoints de la API
// Puedes importar y usar estas funciones en tus hooks o vistas

import { apiClient } from './client';
import { API_VERSION } from './types';

type Payload = Record<string, unknown>;
type QueryParams = Record<string, string | number | boolean>;

// --- AUTH ---
export const endpoints = {
  login: (credentials: Payload) => apiClient.post(`${API_VERSION}/auth/login`, credentials, { config: { isPublic: true } }),
  register: (data: Payload) => apiClient.post(`${API_VERSION}/auth/register`, data, { config: { isPublic: true } }),
  validateToken: () => apiClient.get(`${API_VERSION}/auth/validate`, { config: { cache: 'short' } }),

  // --- CATEGORIES ---
  listCategories: (params?: QueryParams) => apiClient.get(`${API_VERSION}/category`, { params, config: { cache: 'none' } }),
  fetchCategories: () => apiClient.get(`${API_VERSION}/category`, { config: { cache: 'long' } }),
  getCategory: (id: string) => apiClient.get(`${API_VERSION}/category/${id}`),
  createCategory: (data: Payload) => apiClient.post(`${API_VERSION}/category`, data),
  updateCategory: (id: string, data: Payload) => apiClient.post(`${API_VERSION}/category/${id}`, { id, ...data }),
  deleteCategory: (id: string) => apiClient.delete(`${API_VERSION}/category/${id}`),

  // --- PRODUCTS (ejemplo, puedes agregar más) ---
  listProducts: (params?: QueryParams) => apiClient.get(`${API_VERSION}/product`, { params, config: { cache: 'none' } }),
  fetchProducts: () => apiClient.get(`${API_VERSION}/product`, { config: { cache: 'long' } }),
  getProduct: (id: string) => apiClient.get(`${API_VERSION}/product/${id}`),
  createProduct: (data: Payload) => apiClient.post(`${API_VERSION}/product`, data),
  updateProduct: (id: string, data: Payload) => apiClient.post(`${API_VERSION}/product/${id}`, { id, ...data }),
  deleteProduct: (id: string) => apiClient.delete(`${API_VERSION}/product/${id}`),

    // --- TABLES ---
    fetchTables: () => apiClient.get(`${API_VERSION}/table`, { config: { cache: 'short' } }),
    listTables: (params?: QueryParams) => apiClient.get(`${API_VERSION}/table`, { params }),
    getTable: (id: string) => apiClient.get(`${API_VERSION}/table/${id}`),
    createTable: (data: Payload) => apiClient.post(`${API_VERSION}/table`, data),
    updateTable: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/table/${id}`, { id, ...data }),
    deleteTable: (id: string) => apiClient.delete(`${API_VERSION}/table/${id}`),

    // --- HEADQUARTERS ---
    fetchHeadquarters: () => apiClient.get(`${API_VERSION}/headquarter`, { config: { cache: 'long' } }),
    getHeadquarter: (id: string) => apiClient.get(`${API_VERSION}/headquarter/${id}`),
    createHeadquarter: (data: Payload) => apiClient.post(`${API_VERSION}/headquarter`, data),
    updateHeadquarter: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/headquarter/${id}`, { id, ...data }),
    deleteHeadquarter: (id: string) => apiClient.delete(`${API_VERSION}/headquarter/${id}`),

    // --- DELIVERY ZONE ---
    fetchDeliveryZones: () => apiClient.get(`${API_VERSION}/delivery-zone`, { config: { cache: 'long' } }),
    getDeliveryZone: (id: string) => apiClient.get(`${API_VERSION}/delivery-zone/${id}`),
    createDeliveryZone: (data: Payload) => apiClient.post(`${API_VERSION}/delivery-zone`, data),
    updateDeliveryZone: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/delivery-zone/${id}`, { id, ...data }),
    deleteDeliveryZone: (id: string) => apiClient.delete(`${API_VERSION}/delivery-zone/${id}`),


    // --- USER ---
    fetchUsers: () => apiClient.get(`${API_VERSION}/user`, {config: {cache: 'long'}}),
    getUser: (id: string) => apiClient.get(`${API_VERSION}/user/${id}`),
    createUser: (data: Payload) => apiClient.post(`${API_VERSION}/user`, data),
    updateUser: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/user/${id}`, { id, ...data }),
    deleteUser: (id: string) => apiClient.delete(`${API_VERSION}/user/${id}`),

    // -- ORDERS --
    fetchOrders: () => apiClient.get(`${API_VERSION}/order`, {config: {cache: 'long'}}),
    fetchActiveOrders: () => apiClient.get(`${API_VERSION}/orders/active`, { config: { cache: 'short' } }),
    createOrder: (data: Payload) => apiClient.post(`${API_VERSION}/order`, data),
    updateOrderStatus: (id: string, status: string) => apiClient.post(`${API_VERSION}/orders/${id}/status`, { status }),
    completeOrder: (id: string) => apiClient.post(`${API_VERSION}/orders/${id}/complete`, {}),
    fetchOrderStatuses: () => apiClient.get(`${API_VERSION}/orders/statuses`, { config: { cache: 'long' } }),

};
