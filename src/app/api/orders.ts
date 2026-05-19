/**
 * API de Ordenes/Pedidos - Orders endpoints
 */

import { getLoggedUser } from '../authStorage';
import {
  getActiveOrders as getStoredActiveOrders,
  removeActiveOrder as removeStoredActiveOrder,
  updateActiveOrder as updateStoredActiveOrder,
} from '../activeOrdersStorage';
import { endpoints } from './endpoints';
import { ApiError } from './errors';
import { listHeadquarters } from './headquarter';

export type BackendOrderStatus = 'pending' | 'processing' | 'ready' | 'completed' | 'cancelled';
export type BackendOrderType = 'dine-in' | 'takeaway' | 'delivery';

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
  headquarterId?: string | number;
  storeId?: number;
  userId: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  type: BackendOrderType;
  items: Array<{
    productId: string | number;
    quantity: number;
  }>;
  tableId?: number;
  waiterId?: number;
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_date?: string;
  scheduled_for?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  is_asap?: boolean;
}

export interface LegacyCreateOrderRequest {
  headquarterId?: string | number;
  contactId?: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  userId?: number;
  type: 'delivery' | 'salon' | BackendOrderType;
  detail?: string;
  total?: string | number;
  status?: string;
  createdAt?: string;
  notes?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items?: string[] | Array<{ productId: string | number; quantity: number }>;
  productIds?: Array<string | number>;
  tableId?: number;
  waiterId?: number;
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_date?: string;
  scheduled_for?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  is_asap?: boolean;
  storeId?: number;
}

type FetchOrdersParams = {
  storeId?: number;
};

type ResolvedCreateOrderPayload = {
  headquarterId: number;
  userId: number;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  type: BackendOrderType;
  items: Array<{
    productId: string | number;
    quantity: number;
  }>;
  tableId?: number;
  waiterId?: number;
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  delivery_date?: string;
  scheduled_for?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  is_asap?: boolean;
};

const FALLBACK_ORDERS_STORAGE_KEY = 'mobile_tomatina.ordersApiFallback';
let useFallbackOrdersCache = false;

const ACTIVE_ORDER_STATUSES = new Set<BackendOrderStatus>(['pending', 'processing', 'ready']);

const UI_TO_BACKEND_STATUS: Record<string, BackendOrderStatus> = {
  nuevo: 'pending',
  pending: 'pending',
  'en preparación': 'processing',
  'en preparacion': 'processing',
  preparing: 'processing',
  processing: 'processing',
  'listo para servir': 'ready',
  ready: 'ready',
  'en camino': 'completed',
  'on-the-way': 'completed',
  completed: 'completed',
  entregado: 'completed',
  delivered: 'completed',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  cancelado: 'cancelled',
};

const BACKEND_TO_UI_STATUS: Record<BackendOrderStatus, string> = {
  pending: 'Nuevo',
  processing: 'En preparación',
  ready: 'Listo para servir',
  completed: 'Entregado',
  cancelled: 'Cancelado',
};

const NEXT_ORDER_STATUSES: Record<BackendOrderStatus, BackendOrderStatus[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const readFallbackOrders = (): any[] => {
  const storedActiveOrders = getStoredActiveOrders();

  if (!canUseStorage()) {
    return storedActiveOrders;
  }

  const rawValue = window.localStorage.getItem(FALLBACK_ORDERS_STORAGE_KEY);
  if (!rawValue) {
    return storedActiveOrders;
  }

  try {
    const parsedValue = JSON.parse(rawValue);
    if (Array.isArray(parsedValue) && parsedValue.length > 0) {
      const mergedOrders = [...parsedValue];

      storedActiveOrders.forEach((storedOrder) => {
        const alreadyIncluded = mergedOrders.some((order) => String(order?.id ?? '') === String(storedOrder.id));
        if (!alreadyIncluded) {
          mergedOrders.push(storedOrder);
        }
      });

      return mergedOrders;
    }

    return storedActiveOrders;
  } catch {
    return storedActiveOrders;
  }
};

const writeFallbackOrders = (orders: any[]) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(FALLBACK_ORDERS_STORAGE_KEY, JSON.stringify(orders));
};

const upsertFallbackOrder = (order: any) => {
  const currentOrders = readFallbackOrders();
  const orderId = String(order?.id ?? '');

  if (!orderId) {
    return;
  }

  const nextOrders = [
    order,
    ...currentOrders.filter((currentOrder) => String(currentOrder?.id ?? '') !== orderId),
  ];

  writeFallbackOrders(nextOrders);
};

const updateFallbackOrder = (orderId: string, updater: (order: any) => any) => {
  const nextOrders = readFallbackOrders().map((order) => (
    String(order?.id ?? '') === orderId ? updater(order) : order
  ));

  writeFallbackOrders(nextOrders);
};

const isCustomerIdColumnError = (error: unknown) => {
  if (error instanceof ApiError) {
    return /column\s+order\.customerid\s+does not exist/i.test(error.message);
  }

  if (error instanceof Error) {
    return /column\s+order\.customerid\s+does not exist/i.test(error.message);
  }

  return false;
};

const shouldUseFallbackOrders = (error: unknown) => {
  if (isCustomerIdColumnError(error)) {
    return true;
  }

  if (error instanceof ApiError) {
    return error.statusCode >= 500 && error.statusCode < 600;
  }

  return false;
};

const syncStoredActiveOrderStatus = (orderId: string, status: BackendOrderStatus) => {
  if (status === 'completed' || status === 'cancelled') {
    removeStoredActiveOrder(orderId);
    return;
  }

  updateStoredActiveOrder(orderId, (order) => ({
    ...order,
    status: getOrderStatusLabel(status),
  }));
};

const getCurrentUserId = () => {
  const loggedUser = getLoggedUser();
  const userId = Number(loggedUser?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const resolveHeadquarterId = async (headquarterId?: string | number) => {
  const parsedHeadquarterId = Number(headquarterId);
  if (Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0) {
    return parsedHeadquarterId;
  }

  const headquarters = await listHeadquarters({ page: 1, pageSize: 1 });
  const firstHeadquarterId = Number(headquarters.rows[0]?.id);

  if (!Number.isInteger(firstHeadquarterId) || firstHeadquarterId <= 0) {
    throw new Error('No hay sedes configuradas para crear la orden');
  }

  return firstHeadquarterId;
};

const extractOrders = (data: any): any[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.orders)) {
    return data.orders;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const isModernCreateOrderRequest = (
  orderData: CreateOrderRequest | LegacyCreateOrderRequest
): orderData is CreateOrderRequest => {
  return Array.isArray((orderData as CreateOrderRequest).items)
    && typeof (orderData as CreateOrderRequest).userId === 'number';
};

const toBackendOrderType = (type: LegacyCreateOrderRequest['type']): BackendOrderType => {
  if (type === 'delivery') {
    return 'delivery';
  }

  if (type === 'takeaway') {
    return 'takeaway';
  }

  return 'dine-in';
};

const toBackendOrderStatus = (status: string): BackendOrderStatus => {
  const normalizedStatus = status.trim().toLowerCase();
  return UI_TO_BACKEND_STATUS[normalizedStatus] ?? 'pending';
};

const normalizeItems = (
  orderData: CreateOrderRequest | LegacyCreateOrderRequest
): Array<{ productId: string | number; quantity: number }> => {
  if (Array.isArray(orderData.items) && orderData.items.every((item) => typeof item === 'object' && item !== null && 'productId' in item)) {
    return orderData.items
      .map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity ?? 0),
      }))
      .filter((item) => item.quantity > 0);
  }

  if (Array.isArray(orderData.productIds) && orderData.productIds.length > 0) {
    const grouped = new Map<string, { productId: string | number; quantity: number }>();

    orderData.productIds.forEach((productId) => {
      const key = String(productId);
      const existing = grouped.get(key);

      if (existing) {
        existing.quantity += 1;
        return;
      }

      grouped.set(key, {
        productId,
        quantity: 1,
      });
    });

    return Array.from(grouped.values());
  }

  return [];
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
};

const toCreateOrderPayload = async (
  orderData: CreateOrderRequest | LegacyCreateOrderRequest
): Promise<ResolvedCreateOrderPayload> => {
  const userId = Number(orderData.userId ?? getCurrentUserId());
  const headquarterId = await resolveHeadquarterId(orderData.headquarterId);
  const customerName = normalizeOptionalString(orderData.customerName);
  const customerPhone = normalizeOptionalString(orderData.customerPhone);

  if (isModernCreateOrderRequest(orderData)) {
    return {
      headquarterId,
      userId,
      customerId: orderData.customerId,
      customerName,
      customerPhone,
      type: orderData.type,
      items: normalizeItems(orderData),
      tableId: orderData.tableId,
      waiterId: orderData.waiterId,
      delivery_address: orderData.delivery_address,
      delivery_latitude: orderData.delivery_latitude,
      delivery_longitude: orderData.delivery_longitude,
      delivery_date: orderData.delivery_date,
      scheduled_for: orderData.scheduled_for,
      scheduled_date: orderData.scheduled_date,
      scheduled_time: orderData.scheduled_time,
      is_asap: orderData.is_asap,
    };
  }

  return {
    headquarterId,
    userId,
    customerId: orderData.customerId ?? orderData.contactId,
    customerName,
    customerPhone,
    type: toBackendOrderType(orderData.type),
    items: normalizeItems(orderData),
    tableId: orderData.tableId,
    waiterId: orderData.waiterId,
    delivery_address: orderData.delivery_address ?? orderData.address,
    delivery_latitude: orderData.delivery_latitude ?? orderData.latitude,
    delivery_longitude: orderData.delivery_longitude ?? orderData.longitude,
    delivery_date: orderData.delivery_date,
    scheduled_for: orderData.scheduled_for,
    scheduled_date: orderData.scheduled_date,
    scheduled_time: orderData.scheduled_time,
    is_asap: orderData.is_asap,
  };
};

export const getOrderStatusLabel = (status: string): string => {
  const backendStatus = toBackendOrderStatus(status);
  return BACKEND_TO_UI_STATUS[backendStatus] ?? status;
};

export const getBackendOrderStatus = (status: string): BackendOrderStatus => {
  return toBackendOrderStatus(status);
};

export const isActiveOrderStatus = (status: string): boolean => {
  const backendStatus = toBackendOrderStatus(status);
  return ACTIVE_ORDER_STATUSES.has(backendStatus);
};

export const getAvailableOrderStatusTargets = (currentStatus: string): BackendOrderStatus[] => {
  const backendStatus = toBackendOrderStatus(currentStatus);
  return NEXT_ORDER_STATUSES[backendStatus] ?? [];
};

export async function fetchOrders(params?: FetchOrdersParams): Promise<any[]> {
  const queryParams = params?.storeId ? { storeId: params.storeId } : undefined;
  try {
    const data = await endpoints.fetchOrders(queryParams);
    useFallbackOrdersCache = false;
    return extractOrders(data);
  } catch (error) {
    if (shouldUseFallbackOrders(error)) {
      useFallbackOrdersCache = true;
      return readFallbackOrders();
    }

    throw error;
  }
}

/**
 * Obtiene las ordenes activas
 */
export async function fetchActiveOrders(params?: FetchOrdersParams): Promise<OrderItem[]> {
  const orders = await fetchOrders(params);
  return orders.filter((order) => isActiveOrderStatus(String(order?.status ?? order?.Status?.name ?? 'pending')));
}

/**
 * Crea una nueva orden
 */
export async function createOrder(orderData: CreateOrderRequest | LegacyCreateOrderRequest): Promise<any> {
  const payload = await toCreateOrderPayload(orderData);

  if (!Number.isInteger(payload.headquarterId) || payload.headquarterId <= 0) {
    throw new Error('No se encontro una sede valida para crear la orden');
  }

  if (!Number.isInteger(payload.userId) || payload.userId <= 0) {
    throw new Error('No se encontro un userId valido para crear la orden');
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('La orden debe incluir al menos un producto');
  }

  const response = await endpoints.createOrder(payload);

  if (useFallbackOrdersCache) {
    const normalizedItems = Array.isArray(payload.items)
      ? payload.items.map((item) => {
          const quantity = Number(item.quantity ?? 0);
          const baseLabel = `Producto #${item.productId}`;
          return quantity > 1 ? `${baseLabel} x${quantity}` : baseLabel;
        })
      : [];

    const backendType = payload.type === 'delivery' ? 'delivery' : 'salon';
    const orderId = String(response?.id ?? response?.order?.id ?? response?.order_number ?? `fallback-${Date.now()}`);
    const customerId = payload.customerId;
    const fallbackOrder = {
      id: orderId,
      customerId,
      contactId: customerId,
      type: payload.type,
      customerName: payload.customerName ?? (customerId ? `Cliente #${customerId}` : `Orden ${response?.order_number ?? orderId}`),
      customerPhone: payload.customerPhone,
      phone: payload.customerPhone,
      address: payload.delivery_address,
      delivery_address: payload.delivery_address,
      latitude: payload.delivery_latitude,
      delivery_latitude: payload.delivery_latitude,
      longitude: payload.delivery_longitude,
      delivery_longitude: payload.delivery_longitude,
      items: normalizedItems,
      detail: (orderData as LegacyCreateOrderRequest).detail ?? response?.order_number ?? 'Sin detalle',
      status: 'pending',
      total: (orderData as LegacyCreateOrderRequest).total ?? response?.total_amount ?? 0,
      total_amount: response?.total_amount ?? (orderData as LegacyCreateOrderRequest).total ?? 0,
      createdAt: new Date().toISOString(),
      order_date: new Date().toISOString(),
      notes: (orderData as LegacyCreateOrderRequest).notes ?? undefined,
      order_number: response?.order_number,
      userId: payload.userId,
      headquarterId: payload.headquarterId,
      tableId: payload.tableId,
      waiterId: payload.waiterId,
      type_ui: backendType,
    };

    upsertFallbackOrder(fallbackOrder);
  }

  return response;
}

/**
 * Actualiza el estado de una orden
 */
export async function updateOrderStatus(orderId: string, status: string): Promise<any> {
  const response = await endpoints.updateOrderStatus(orderId, toBackendOrderStatus(status));

  if (useFallbackOrdersCache) {
    updateFallbackOrder(orderId, (order) => ({
      ...order,
      status: toBackendOrderStatus(status),
    }));
    syncStoredActiveOrderStatus(orderId, toBackendOrderStatus(status));
  }

  return response;
}

export async function sendOrderToProduction(orderId: string): Promise<any> {
  const response = await endpoints.sendOrderToProduction(orderId);

  if (useFallbackOrdersCache) {
    updateFallbackOrder(orderId, (order) => ({
      ...order,
      status: 'processing',
    }));
    syncStoredActiveOrderStatus(orderId, 'processing');
  }

  return response;
}

export async function markOrderReady(orderId: string): Promise<any> {
  const response = await endpoints.markOrderReady(orderId);

  if (useFallbackOrdersCache) {
    updateFallbackOrder(orderId, (order) => ({
      ...order,
      status: 'ready',
    }));
    syncStoredActiveOrderStatus(orderId, 'ready');
  }

  return response;
}

export async function finalizeOrder(orderId: string): Promise<any> {
  const response = await endpoints.finalizeOrder(orderId);

  if (useFallbackOrdersCache) {
    updateFallbackOrder(orderId, (order) => ({
      ...order,
      status: 'completed',
    }));
    syncStoredActiveOrderStatus(orderId, 'completed');
  }

  return response;
}

export async function transitionOrderStatus(
  orderId: string,
  currentStatus: string,
  nextStatus: string
): Promise<any> {
  const currentBackendStatus = toBackendOrderStatus(currentStatus);
  const nextBackendStatus = toBackendOrderStatus(nextStatus);

  if (currentBackendStatus === nextBackendStatus) {
    return null;
  }

  if (currentBackendStatus === 'pending' && nextBackendStatus === 'processing') {
    return sendOrderToProduction(orderId);
  }

  if (currentBackendStatus === 'processing' && nextBackendStatus === 'ready') {
    return markOrderReady(orderId);
  }

  if (currentBackendStatus === 'ready' && nextBackendStatus === 'completed') {
    return finalizeOrder(orderId);
  }

  return updateOrderStatus(orderId, nextBackendStatus);
}

/**
 * Alias legacy para finalizar una orden
 */
export async function completeOrder(orderId: string): Promise<any> {
  return finalizeOrder(orderId);
}

/**
 * Obtiene los estados disponibles
 */
export async function fetchOrderStatuses(): Promise<string[]> {
  return ['pending', 'processing', 'ready', 'completed', 'cancelled'];
}
