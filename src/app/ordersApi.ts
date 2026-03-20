import { getAuthSession } from './authStorage';

type OrdersImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_ORDERS_LIST_PATH?: string;
    VITE_ORDERS_CREATE_PATH?: string;
    VITE_ORDERS_STATUS_PATH?: string;
    VITE_ORDERS_COMPLETE_PATH?: string;
  };
};

const API_URL = (import.meta as OrdersImportMeta).env?.VITE_API_URL;
const ORDERS_LIST_PATH = (import.meta as OrdersImportMeta).env?.VITE_ORDERS_LIST_PATH ?? '/v1/orders/active';
const ORDERS_CREATE_PATH = (import.meta as OrdersImportMeta).env?.VITE_ORDERS_CREATE_PATH ?? '/v1/orders';
const ORDERS_STATUS_PATH = (import.meta as OrdersImportMeta).env?.VITE_ORDERS_STATUS_PATH ?? '/v1/orders/:orderId/status';
const ORDERS_COMPLETE_PATH = (import.meta as OrdersImportMeta).env?.VITE_ORDERS_COMPLETE_PATH ?? '/v1/orders/:orderId/complete';

export interface BackendOrderItem {
  id: string;
  type: 'delivery' | 'salon';
  customerName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: string[];
  detail: string;
  status: string;
  total: string;
  createdAt: string;
  notes?: string;
  contactId: number;
}

const getAuthToken = () => getAuthSession()?.accessToken;

const buildAuthHeaders = () => {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente');
  }

  return {
    Authorization: `Bearer ${authToken}`,
  };
};

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no está configurada');
  }

  return API_URL;
};

export const fetchActiveOrders = async (): Promise<BackendOrderItem[]> => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${ORDERS_LIST_PATH}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || 'No se pudieron obtener las órdenes');
  }

  const data = await response.json() as { ok?: boolean; orders?: BackendOrderItem[] };
  return Array.isArray(data.orders) ? data.orders : [];
};

interface CreateOrderInput {
  contactId: number;
  type: 'delivery' | 'salon';
  detail: string;
  total: string;
  status?: string;
  createdAt?: string;
  notes?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items?: string[];
  productIds?: string[];
}

export const createOrder = async (orderInput: CreateOrderInput) => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${ORDERS_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify(orderInput),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear la orden');
  }

  return data as { ok: boolean; orderId?: string };
};

export const updateOrderStatus = async (orderId: string, status: string) => {
  const baseUrl = ensureApiUrl();
  const path = ORDERS_STATUS_PATH.replace(':orderId', encodeURIComponent(orderId));

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({ status }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo actualizar el estado de la orden');
  }

  return data;
};

export const completeOrder = async (orderId: string) => {
  const baseUrl = ensureApiUrl();
  const path = ORDERS_COMPLETE_PATH.replace(':orderId', encodeURIComponent(orderId));

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: buildAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo completar la orden');
  }

  return data;
};
