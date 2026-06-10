import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';

export type DriverStatus = 'active' | 'inactive' | 'busy';
export type VehicleType = 'motorcycle' | 'bicycle' | 'car' | 'other';
export type RouteStatus = 'planning' | 'assigned' | 'in_transit' | 'completed' | 'cancelled';

export interface DeliveryDriver {
  id: number | string;
  name: string;
  phone?: string | null;
  vehicleType: VehicleType;
  plate?: string | null;
  status: DriverStatus;
  notes?: string | null;
  hasInviteCode?: boolean;
  inviteCodeExpiresAt?: string | null;
  mobileSessionVersion?: number;
  lastLoginAt?: string | null;
}

export interface DeliveryOrder {
  id: number | string;
  order_number?: string;
  total_amount?: number;
  status?: string;
  type?: string;
  delivery_address?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  delivery_fee?: number | null;
  tracking_token?: string | null;
  trackingToken?: string | null;
  tracking_token_expires_at?: string | null;
  delivery_date?: string | null;
  order_date?: string | null;
  Customer?: {
    id?: number | string;
    name?: string;
    phone?: string;
    email?: string;
  } | null;
  DeliveryZone?: {
    id?: number | string;
    name?: string;
    zoneid?: string;
    deliveryFee?: number;
  } | null;
  OrderItems?: Array<{
    id?: number | string;
    quantity?: number;
    price?: number;
    Product?: {
      id?: number | string;
      name?: string;
    } | null;
  }>;
  DeliveryRouteOrder?: {
    id?: number | string;
    routeId?: number | string;
    sequence?: number;
    status?: string;
    printedAt?: string | null;
  } | null;
}

export interface DeliveryRouteOrder {
  id: number | string;
  sequence: number;
  status: string;
  printedAt?: string | null;
  Order?: DeliveryOrder | null;
}

export interface DeliveryRoute {
  id: number | string;
  name?: string | null;
  status: RouteStatus;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastLatitude?: number | null;
  lastLongitude?: number | null;
  lastLocationAccuracy?: number | null;
  lastLocationAt?: string | null;
  notes?: string | null;
  DeliveryDriver?: DeliveryDriver;
  DeliveryRouteOrders?: DeliveryRouteOrder[];
}

export interface DeliveryBoard {
  drivers: DeliveryDriver[];
  orders: DeliveryOrder[];
  routes: DeliveryRoute[];
}

export interface CreateDriverInput {
  name: string;
  phone?: string;
  vehicleType?: VehicleType;
  plate?: string;
  status?: DriverStatus;
  notes?: string;
}

export async function listDeliveryDrivers(): Promise<DeliveryDriver[]> {
  const data = await apiClient.get(`${API_VERSION}/delivery-logistics/drivers`, {
    config: { cache: 'none' },
  });
  const record = data as { rows?: DeliveryDriver[] };
  return Array.isArray(record.rows) ? record.rows : Array.isArray(data) ? data as DeliveryDriver[] : [];
}

export async function createDeliveryDriver(payload: CreateDriverInput): Promise<DeliveryDriver> {
  return apiClient.post(`${API_VERSION}/delivery-logistics/drivers`, payload) as Promise<DeliveryDriver>;
}

export async function updateDeliveryDriver(driverId: string | number, payload: Partial<CreateDriverInput>): Promise<DeliveryDriver> {
  return apiClient.patch(`${API_VERSION}/delivery-logistics/drivers/${driverId}`, payload) as Promise<DeliveryDriver>;
}

export async function regenerateDeliveryDriverInvite(driverId: string | number): Promise<{
  driver: DeliveryDriver;
  inviteCode: string;
  inviteCodeExpiresAt?: string | null;
}> {
  return apiClient.post(`${API_VERSION}/delivery-logistics/drivers/${driverId}/invite`, {}) as Promise<{
    driver: DeliveryDriver;
    inviteCode: string;
    inviteCodeExpiresAt?: string | null;
  }>;
}

export async function deleteDeliveryDriver(driverId: string | number): Promise<void> {
  await apiClient.delete(`${API_VERSION}/delivery-logistics/drivers/${driverId}`);
}

export async function fetchDeliveryBoard(): Promise<DeliveryBoard> {
  const data = await apiClient.get(`${API_VERSION}/delivery-logistics/board`, {
    config: { cache: 'none' },
  });
  const record = data as Partial<DeliveryBoard>;
  return {
    drivers: Array.isArray(record.drivers) ? record.drivers : [],
    orders: Array.isArray(record.orders) ? record.orders : [],
    routes: Array.isArray(record.routes) ? record.routes : [],
  };
}

export async function assignDeliveryRoute(payload: {
  driverId: string | number;
  orderIds: Array<string | number>;
  name?: string;
  notes?: string;
  scheduledAt?: string;
}): Promise<DeliveryRoute> {
  return apiClient.post(`${API_VERSION}/delivery-logistics/routes`, payload) as Promise<DeliveryRoute>;
}

export async function updateDeliveryRouteStatus(routeId: string | number, status: RouteStatus): Promise<DeliveryRoute> {
  return apiClient.patch(`${API_VERSION}/delivery-logistics/routes/${routeId}/status`, { status }) as Promise<DeliveryRoute>;
}

export async function updateDeliveryRouteLocation(routeId: string | number, payload: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): Promise<DeliveryRoute> {
  return apiClient.patch(`${API_VERSION}/delivery-logistics/routes/${routeId}/location`, payload) as Promise<DeliveryRoute>;
}

export async function markDeliveryRoutePrinted(routeId: string | number): Promise<DeliveryRoute> {
  return apiClient.post(`${API_VERSION}/delivery-logistics/routes/${routeId}/print`, {}) as Promise<DeliveryRoute>;
}
