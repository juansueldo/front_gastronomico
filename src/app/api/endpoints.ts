// Centraliza los endpoints de la API
// Puedes importar y usar estas funciones en tus hooks o vistas

import { apiClient } from './client';
import { isApiError } from './errors';
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
  updateCategory: (id: string, data: Payload) => apiClient.put(`${API_VERSION}/category/${id}`, { id, ...data }),
  deleteCategory: (id: string) => apiClient.delete(`${API_VERSION}/category/${id}`),

  // --- PRODUCTS (ejemplo, puedes agregar más) ---
  listProducts: (params?: QueryParams) => apiClient.get(`${API_VERSION}/product`, { params, config: { cache: 'none' } }),
  fetchProducts: () => apiClient.get(`${API_VERSION}/product`, { config: { cache: 'long' } }),
  getProduct: (id: string) => apiClient.get(`${API_VERSION}/product/${id}`),
  createProduct: (data: Payload) => apiClient.post(`${API_VERSION}/product`, data),
  updateProduct: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/product/${id}`, { id, ...data }),
  deleteProduct: (id: string) => apiClient.delete(`${API_VERSION}/product/${id}`),

    // --- TABLES ---
    fetchTablesLegacy: (params?: QueryParams) => apiClient.get(`${API_VERSION}/table`, { params, config: { cache: 'short' } }),
    listTables: (params?: QueryParams) => apiClient.get(`${API_VERSION}/table`, { params }),
    getTable: (id: string) => apiClient.get(`${API_VERSION}/table/${id}`),
    createTable: (data: Payload) => apiClient.post(`${API_VERSION}/table`, data),
    updateTable: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/table/${id}`, { id, ...data }),
    updateTableStatus: (id: string, statusId: number) => apiClient.patch(`${API_VERSION}/table/${id}/status`, { statusId }),
    deleteTable: (id: string) => apiClient.delete(`${API_VERSION}/table/${id}`),

    // --- HEADQUARTERS ---
    fetchHeadquarters: () => apiClient.get(`${API_VERSION}/headquarter`, { config: { cache: 'long' } }),
    getHeadquarter: (id: string) => apiClient.get(`${API_VERSION}/headquarter/${id}`),
    createHeadquarter: (data: Payload) => apiClient.post(`${API_VERSION}/headquarter`, data),
    updateHeadquarter: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/headquarter/${id}`, { id, ...data }),
    updateHeadquarterSchedules: (id: string, schedules: Payload[]) => apiClient.put(`${API_VERSION}/headquarter/${id}/schedules`, {
      id,
      headquarterId: id,
      headquarter_id: id,
      schedules,
    }),
    deleteHeadquarter: (id: string) => apiClient.delete(`${API_VERSION}/headquarter/${id}`),

    // --- STORE ---
    updateStoreProfileImage: (image: string) => apiClient.patch(`${API_VERSION}/store/profile-image`, {
      image,
      profileImage: image,
      profile_image: image,
      logo: image,
      logoUrl: image,
      logo_url: image,
    }),

    // --- DELIVERY ZONE ---
    fetchDeliveryZones: (params?: QueryParams) => apiClient.get(`${API_VERSION}/delivery-zone`, { params, config: { cache: 'short' } }),
    getDeliveryZone: () => apiClient.get(`${API_VERSION}/delivery-zone`, { config: { cache: 'short' } }),
    createDeliveryZone: (data: Payload) => apiClient.post(`${API_VERSION}/delivery-zone`, data),
    updateDeliveryZone: (id: string, data: Payload) => apiClient.patch(`${API_VERSION}/delivery-zone/${id}`, { id, ...data }),
    updateDeliveryZoneStatus: (id: string, statusId: number) => apiClient.patch(`${API_VERSION}/delivery-zone/${id}/status`, { statusId }),
    deleteDeliveryZoneById: (id: string) => apiClient.delete(`${API_VERSION}/delivery-zone/${id}`),
    upsertDeliveryZone: (data: Payload) => apiClient.put(`${API_VERSION}/delivery-zone`, data),
    deleteDeliveryZone: () => apiClient.delete(`${API_VERSION}/delivery-zone`),
    checkDeliveryZonePoint: (data: Payload) => apiClient.post(`${API_VERSION}/delivery-zone/check`, data),


    // --- USER ---
    fetchUsers: () => apiClient.get(`${API_VERSION}/user`, {config: {cache: 'long'}}),
    getUser: (id: string) => apiClient.get(`${API_VERSION}/user/${id}`),
    createUser: (data: Payload) => apiClient.post(`${API_VERSION}/user`, data),
    updateUser: (id: string, data: Payload) => apiClient.put(`${API_VERSION}/user/${id}`, { id, ...data }),
    deleteUser: (id: string) => apiClient.delete(`${API_VERSION}/user/${id}`),

    // -- ORDERS --
    fetchOrders: (params?: QueryParams) => apiClient.get(`${API_VERSION}/order`, { params, config: { cache: 'short' } }),
    fetchActiveOrders: (params?: QueryParams) => apiClient.get(`${API_VERSION}/order`, { params, config: { cache: 'short' } }),
    getOrder: (id: string) => apiClient.get(`${API_VERSION}/order/${id}`),
    createOrder: (data: Payload) => apiClient.post(`${API_VERSION}/order`, data),
    updateOrderStatus: (id: string, status: string) => apiClient.patch(`${API_VERSION}/order/${id}/status`, { status }),
    sendOrderToProduction: (id: string) => apiClient.patch(`${API_VERSION}/order/${id}/production`, {}),
    markOrderReady: (id: string) => apiClient.patch(`${API_VERSION}/order/${id}/ready`, {}),
    finalizeOrder: (id: string) => apiClient.patch(`${API_VERSION}/order/${id}/finalize`, {}),
    completeOrder: (id: string) => apiClient.patch(`${API_VERSION}/order/${id}/finalize`, {}),
    deleteOrder: (id: string) => apiClient.delete(`${API_VERSION}/order/${id}`),
    fetchOrderStatuses: () => Promise.resolve(['pending', 'processing', 'ready', 'completed', 'cancelled']),

    // --- CASH ---
    fetchHeadquarterCashRegister: (id: string, params?: QueryParams) => apiClient.get(`${API_VERSION}/headquarter/${id}/cash-register`, { params, config: { cache: 'short' } }),
    createHeadquarterCashMovement: (id: string, data: Payload) => apiClient.post(`${API_VERSION}/headquarter/${id}/cash-register`, data),
    fetchCashMovements: () => apiClient.get(`${API_VERSION}/cash-movements`, { config: { cache: 'short' } }),
    listCashMovements: (params?: QueryParams) => apiClient.get(`${API_VERSION}/cash-movements/list`, { params }),
    createCashMovement: (data: Payload) => apiClient.post(`${API_VERSION}/cash-movements`, data),
    closeDailyCashMovements: (date: string) => apiClient.post(`${API_VERSION}/cash-movements/close-daily`, { date }),
    fetchFinalizedCashMovementsByDate: (date: string) => apiClient.get(`${API_VERSION}/cash-movements/finalized/by-date`, { params: { date } }),

    // --- NOTIFICATIONS ---
    fetchNotifications: (id: string, params?: QueryParams) => apiClient.get(`${API_VERSION}/notifications/${id}`, { params, config: { cache: 'short' } }),
    listNotifications: (params?: QueryParams) => apiClient.get(`${API_VERSION}/notifications/`, { params }),
    // --- OAUTH / INTEGRATIONS ---
    listOAuthProviders: () => apiClient.get(`${API_VERSION}/integrations/oauth/providers`, { config: { cache: 'short' } }),
    startOAuthProvider: (provider: string) => apiClient.post(`${API_VERSION}/integrations/oauth/${encodeURIComponent(provider)}/start`, {}),

    // Agregar estos dos endpoints a tu archivo api/endpoints.ts

// Busca un cliente por teléfono. Retorna null si no existe.
fetchCustomerByPhone: async (phone: string) => {
  try {
    const payload = await apiClient.get<any>(`${API_VERSION}/customer/search`, {
      params: { phone },
      config: { cache: 'short' },
    });
    const data = payload?.customer ?? payload;

    if (!data) return null;
    const normalizedName = String(
      data.name
      ?? ''
    ).trim();
    const normalizedPhone = String(
      data.phone
      ?? data.phoneNumber
      ?? data.customerPhone
      ?? phone
      ?? ''
    ).trim();

    return {
      id: data.id,
      name: normalizedName || 'Cliente',
      phone: normalizedPhone,
      savedAddress: data.lastDeliveryAddress
        ? {
            street: data.lastDeliveryAddress.street,
            number: data.lastDeliveryAddress.number,
            locality: data.lastDeliveryAddress.locality,
            crossStreets: data.lastDeliveryAddress.crossStreets,
            latitude: data.lastDeliveryAddress.latitude,
            longitude: data.lastDeliveryAddress.longitude,
            formatted: data.lastDeliveryAddress.formatted,
          }
        : undefined,
      orderHistory: (data.Orders ?? data.orders ?? []).slice(0, 5).map((o: any) => ({
        id: String(o.id),
        date: new Date(o.createdAt ?? o.created_at).toLocaleDateString('es-AR'),
        total: new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
          Number(o.total_amount ?? o.total ?? 0)
        ),
        items: (o.OrderItems ?? o.orderItems ?? []).map((i: any) => i.Product?.name ?? i.product?.name ?? 'Producto'),
      })),
    };
  } catch (error) {
    if (isApiError(error) && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
},

// Trae las localidades disponibles para el dropdown
fetchLocalities: async () => {
  const candidates = [
    `${API_VERSION}/localities`,
    '/locality',
    `${API_VERSION}/locality`,
    '/localities',
  ];

  let payload: any = null;
  let lastError: unknown = null;

  for (const path of candidates) {
    try {
      payload = await apiClient.get<any>(path, { config: { cache: 'short' } });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!payload) {
    throw lastError ?? new Error('No se pudieron cargar las localidades');
  }

  const rows = Array.isArray(payload)
    ? payload
    : payload?.rows
      ?? payload?.data
      ?? payload?.localities
      ?? payload?.locality
      ?? [];

  const normalized = rows
    .map((locality: any) => {
      const rawName = locality?.name ?? locality?.locality ?? locality?.label ?? locality?.description ?? '';
      const name = String(rawName ?? '').trim();
      const rawId = locality?.id ?? locality?.localityId ?? locality?.locality_id ?? locality?.code ?? name;
      const id = String(rawId ?? '').trim();
      return { id, name };
    })
    .filter((item: { id: string; name: string }) => item.id.length > 0 && item.name.length > 0);

  const uniqueById = new Map<string, { id: string; name: string }>();
  normalized.forEach((item: { id: string; name: string }) => {
    if (!uniqueById.has(item.id)) {
      uniqueById.set(item.id, item);
    }
  });

  return Array.from(uniqueById.values());
},

};
