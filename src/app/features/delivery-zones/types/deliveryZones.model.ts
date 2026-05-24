export interface DeliveryZonePoint {
  lat: number;
  lng: number;
}

export interface DeliveryZone {
  id?: string;
  customerId?: number;
  name?: string;
  active?: boolean;
  polygon: DeliveryZonePoint[];
  headquarterId?: number;
  updatedAt?: string;
  zoneid?: string;
  storeId?: number;
  statusId?: number;
}

export interface UpsertDeliveryZoneRequest {
  name?: string;
  active?: boolean;
  polygon: DeliveryZonePoint[];
}

export interface CreateDeliveryZoneRequest {
  name: string;
  polygon: DeliveryZonePoint[];
  headquarterId?: number;
  metadata?: Record<string, unknown>;
  zoneid?: string;
  storeId?: number;
}

export interface UpdateDeliveryZoneRequest {
  name?: string;
  polygon?: DeliveryZonePoint[];
  headquarterId?: number;
  metadata?: Record<string, unknown>;
  zoneid?: string;
}

export interface CheckDeliveryZoneRequest {
  latitude: number;
  longitude: number;
  headquarterId?: number;
}

export interface CheckDeliveryZoneResponse {
  inside: boolean;
  hasZone: boolean;
}
