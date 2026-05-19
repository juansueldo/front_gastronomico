import { getLoggedUser } from '../authStorage';
import { listHeadquarters } from './headquarter';
import { endpoints } from './endpoints';

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

type DeliveryZoneApiRaw = {
  id?: string | number;
  customerId?: number;
  customer_id?: number;
  name?: string;
  active?: boolean;
  metadata?: Record<string, unknown>;
  zoneid?: string;
  storeId?: number;
  store_id?: number;
  statusId?: number;
  status_id?: number;
  headquarterId?: number;
  headquarter_id?: number;
  Headquarter?: {
    id?: number;
  };
  Status?: {
    id?: number;
    name?: string;
  };
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
  const resolvedStatusId = Number(zoneRaw.statusId ?? zoneRaw.status_id ?? zoneRaw.Status?.id ?? (zoneRaw.active === false ? 2 : 1));
  const resolvedActive = typeof zoneRaw.active === 'boolean'
    ? zoneRaw.active
    : String(zoneRaw.Status?.name ?? '').toLowerCase() === 'active'
      ? true
      : resolvedStatusId === 1;
  const metadataHeadquarterId = Number((zoneRaw.metadata as { headquarterId?: unknown; headquarter_id?: unknown } | undefined)?.headquarterId
    ?? (zoneRaw.metadata as { headquarterId?: unknown; headquarter_id?: unknown } | undefined)?.headquarter_id);
  const resolvedHeadquarterId = Number(
    zoneRaw.headquarterId
    ?? zoneRaw.headquarter_id
    ?? zoneRaw.Headquarter?.id
    ?? metadataHeadquarterId
  );

  if (polygon.length === 0) {
    return null;
  }

  return {
    id: zoneRaw.id !== undefined ? String(zoneRaw.id) : undefined,
    customerId: zoneRaw.customerId ?? zoneRaw.customer_id,
    name: zoneRaw.name,
    active: resolvedActive,
    polygon,
    headquarterId: Number.isInteger(resolvedHeadquarterId) && resolvedHeadquarterId > 0 ? resolvedHeadquarterId : undefined,
    updatedAt: zoneRaw.updatedAt ?? zoneRaw.updated_at,
    zoneid: zoneRaw.zoneid,
    storeId: zoneRaw.storeId ?? zoneRaw.store_id,
    statusId: resolvedStatusId,
  };
};

const getCurrentStoreId = () => {
  const loggedUser = getLoggedUser();
  const storeId = Number(loggedUser?.storeId);
  return Number.isInteger(storeId) && storeId > 0 ? storeId : null;
};

const resolveHeadquarterId = async (headquarterId?: number) => {
  if (Number.isInteger(headquarterId) && headquarterId > 0) {
    return headquarterId;
  }

  try {
    const headquarters = await listHeadquarters({ page: 1, pageSize: 1 });
    const firstHeadquarterId = Number(headquarters.rows[0]?.id);
    return Number.isInteger(firstHeadquarterId) && firstHeadquarterId > 0
      ? firstHeadquarterId
      : undefined;
  } catch {
    return undefined;
  }
};

const extractZoneList = (data: any): DeliveryZone[] => {
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rows
    .map((row) => normalizeZone(row as DeliveryZoneApiRaw))
    .filter((zone): zone is DeliveryZone => zone !== null);
};

export async function getDeliveryZone(): Promise<DeliveryZone | null> {
  const data = await endpoints.getDeliveryZone();

  return normalizeZone(data as DeliveryZoneApiRaw | null | undefined);
}

export async function fetchDeliveryZones(storeId?: number): Promise<DeliveryZone[]> {
  const resolvedStoreId = storeId ?? getCurrentStoreId();
  const data = await endpoints.fetchDeliveryZones(
    resolvedStoreId ? { storeId: resolvedStoreId } : undefined
  );

  return extractZoneList(data);
}

export async function createDeliveryZone(payload: CreateDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const resolvedStoreId = payload.storeId ?? getCurrentStoreId();
  const data = await endpoints.createDeliveryZone({
    ...payload,
    headquarterId: payload.headquarterId,
    headquarter_id: payload.headquarterId,
    metadata: {
      ...(payload.metadata ?? {}),
      headquarterId: payload.headquarterId,
      headquarter_id: payload.headquarterId,
    },
    storeId: resolvedStoreId,
  });

  return normalizeZone(data as DeliveryZoneApiRaw | null | undefined);
}

export async function updateDeliveryZone(zoneId: string, payload: UpdateDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const data = await endpoints.updateDeliveryZone(zoneId, {
    ...payload,
    headquarterId: payload.headquarterId,
    headquarter_id: payload.headquarterId,
    metadata: payload.headquarterId
      ? {
        ...(payload.metadata ?? {}),
        headquarterId: payload.headquarterId,
        headquarter_id: payload.headquarterId,
      }
      : payload.metadata,
  });
  return normalizeZone(data as DeliveryZoneApiRaw | null | undefined);
}

export async function updateDeliveryZoneStatus(zoneId: string, statusId: number): Promise<void> {
  await endpoints.updateDeliveryZoneStatus(zoneId, statusId);
}

export async function deleteDeliveryZoneById(zoneId: string): Promise<void> {
  await endpoints.deleteDeliveryZoneById(zoneId);
}

export async function upsertDeliveryZone(payload: UpsertDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const data = await endpoints.upsertDeliveryZone(payload);
  return normalizeZone(data as DeliveryZoneApiRaw | null | undefined);
}

export async function deleteDeliveryZone(): Promise<void> {
  await endpoints.deleteDeliveryZone();
}

export async function checkDeliveryZonePoint(payload: CheckDeliveryZoneRequest): Promise<CheckDeliveryZoneResponse> {
  const resolvedHeadquarterId = await resolveHeadquarterId(payload.headquarterId);
  const data = await endpoints.checkDeliveryZonePoint({
    latitude: payload.latitude,
    longitude: payload.longitude,
    headquarterId: resolvedHeadquarterId,
    // Temporary legacy aliases for backends that still accept the old payload.
    lat: payload.latitude,
    lng: payload.longitude,
  });

  const rawInside = (data as { inside?: unknown; inZone?: unknown; allowed?: unknown })?.inside
    ?? (data as { inZone?: unknown; allowed?: unknown })?.inZone
    ?? (data as { allowed?: unknown })?.allowed;

  const rawHasZone = (data as { hasZone?: unknown; has_zone?: unknown; zoneExists?: unknown })?.hasZone
    ?? (data as { has_zone?: unknown; zoneExists?: unknown })?.has_zone
    ?? (data as { zoneExists?: unknown })?.zoneExists;

  const rawZone = (data as { zone?: unknown; deliveryZone?: unknown; matchedZone?: unknown })?.zone
    ?? (data as { deliveryZone?: unknown; matchedZone?: unknown })?.deliveryZone
    ?? (data as { matchedZone?: unknown })?.matchedZone;

  const inside = rawInside === true;
  const hasZone = typeof rawHasZone === 'boolean'
    ? rawHasZone
    : inside || (typeof rawZone === 'object' && rawZone !== null);

  return {
    inside,
    hasZone,
  };
}
