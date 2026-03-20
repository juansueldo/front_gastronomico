import { apiClient } from './client';
import { API_VERSION } from './types';

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
  updatedAt?: string;
}

export interface UpsertDeliveryZoneRequest {
  name?: string;
  active?: boolean;
  polygon: DeliveryZonePoint[];
}

export interface CheckDeliveryZoneRequest {
  lat: number;
  lng: number;
}

export interface CheckDeliveryZoneResponse {
  inside: boolean;
  hasZone: boolean;
}

type DeliveryZoneApiRaw = {
  id?: string | number;
  customerId?: number;
  customer_id?: number;
  name?: string;
  active?: boolean;
  polygon?: Array<{ lat?: number; lng?: number }>;
  geojson?: {
    type?: string;
    coordinates?: number[][][];
  };
  geometry?: {
    type?: string;
    coordinates?: number[][][];
  };
  points?: Array<{ lat?: number; lng?: number }>;
  vertices?: Array<{ lat?: number; lng?: number }>;
  updatedAt?: string;
  updated_at?: string;
  zone?: DeliveryZoneApiRaw;
  deliveryZone?: DeliveryZoneApiRaw;
  item?: DeliveryZoneApiRaw;
};

const toPoint = (point: { lat?: number; lng?: number }): DeliveryZonePoint | null => {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
    return null;
  }

  return {
    lat: Number(point.lat),
    lng: Number(point.lng),
  };
};

const normalizeGeoJsonPoints = (coordinates: number[][][] | undefined): DeliveryZonePoint[] => {
  const firstRing = Array.isArray(coordinates) && coordinates.length > 0 && Array.isArray(coordinates[0])
    ? coordinates[0]
    : [];

  return firstRing
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) {
        return null;
      }

      const [lng, lat] = pair;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return { lat: Number(lat), lng: Number(lng) };
    })
    .filter((point): point is DeliveryZonePoint => point !== null);
};

const normalizePoints = (raw: DeliveryZoneApiRaw): DeliveryZonePoint[] => {
  const fromPolygonArray = Array.isArray(raw.polygon)
    ? raw.polygon
        .map((point) => toPoint(point ?? {}))
        .filter((point): point is DeliveryZonePoint => point !== null)
    : [];

  if (fromPolygonArray.length > 0) {
    return fromPolygonArray;
  }

  const fromPointsArray = Array.isArray(raw.points)
    ? raw.points
        .map((point) => toPoint(point ?? {}))
        .filter((point): point is DeliveryZonePoint => point !== null)
    : [];

  if (fromPointsArray.length > 0) {
    return fromPointsArray;
  }

  const fromVerticesArray = Array.isArray(raw.vertices)
    ? raw.vertices
        .map((point) => toPoint(point ?? {}))
        .filter((point): point is DeliveryZonePoint => point !== null)
    : [];

  if (fromVerticesArray.length > 0) {
    return fromVerticesArray;
  }

  const fromGeoJson = normalizeGeoJsonPoints(raw.geojson?.coordinates ?? raw.geometry?.coordinates);
  return fromGeoJson;
};

const extractRawZone = (raw: DeliveryZoneApiRaw | null | undefined): DeliveryZoneApiRaw | null => {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  if (raw.zone && typeof raw.zone === 'object') {
    return raw.zone;
  }

  if (raw.deliveryZone && typeof raw.deliveryZone === 'object') {
    return raw.deliveryZone;
  }

  if (raw.item && typeof raw.item === 'object') {
    return raw.item;
  }

  return raw;
};

const normalizeZone = (raw: DeliveryZoneApiRaw | null | undefined): DeliveryZone | null => {
  const zoneRaw = extractRawZone(raw);

  if (!zoneRaw) {
    return null;
  }

  const polygon = normalizePoints(zoneRaw);

  if (polygon.length === 0) {
    return null;
  }

  return {
    id: zoneRaw.id !== undefined ? String(zoneRaw.id) : undefined,
    customerId: zoneRaw.customerId ?? zoneRaw.customer_id,
    name: zoneRaw.name,
    active: zoneRaw.active ?? true,
    polygon,
    updatedAt: zoneRaw.updatedAt ?? zoneRaw.updated_at,
  };
};

export async function getDeliveryZone(): Promise<DeliveryZone | null> {
  const data = await apiClient.get(`${API_VERSION}/delivery-zone`, {
    config: { cache: 'short' },
  });

  return normalizeZone(data as DeliveryZoneApiRaw | null | undefined);
}

export async function upsertDeliveryZone(payload: UpsertDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const data = await apiClient.put(`${API_VERSION}/delivery-zone`, payload);
  return normalizeZone(data as DeliveryZoneApiRaw | null | undefined);
}

export async function deleteDeliveryZone(): Promise<void> {
  await apiClient.delete(`${API_VERSION}/delivery-zone`);
}

export async function checkDeliveryZonePoint(payload: CheckDeliveryZoneRequest): Promise<CheckDeliveryZoneResponse> {
  const data = await apiClient.post(`${API_VERSION}/delivery-zone/check`, payload);

  const rawInside = (data as { inside?: unknown; inZone?: unknown; allowed?: unknown })?.inside
    ?? (data as { inZone?: unknown; allowed?: unknown })?.inZone
    ?? (data as { allowed?: unknown })?.allowed;

  const rawHasZone = (data as { hasZone?: unknown; has_zone?: unknown; zoneExists?: unknown })?.hasZone
    ?? (data as { has_zone?: unknown; zoneExists?: unknown })?.has_zone
    ?? (data as { zoneExists?: unknown })?.zoneExists;

  return {
    inside: rawInside === true,
    hasZone: rawHasZone === true,
  };
}
