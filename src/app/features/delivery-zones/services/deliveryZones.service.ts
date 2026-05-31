import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import { getLoggedUser } from '../../../core/storage/authStorage';
import { listHeadquarters } from '../../headquarters';
import { mapDeliveryZoneDtoToModel } from '../mappers/deliveryZones.mapper';
import type { DeliveryZoneDto } from '../types/deliveryZones.dto';
import type {
  CheckDeliveryZoneRequest,
  CheckDeliveryZoneResponse,
  CreateDeliveryZoneRequest,
  DeliveryZone,
  UpdateDeliveryZoneRequest,
  UpsertDeliveryZoneRequest,
} from '../types/deliveryZones.model';

const getCurrentStoreId = () => {
  const storeId = Number(getLoggedUser()?.storeId);
  return Number.isInteger(storeId) && storeId > 0 ? storeId : null;
};

const extractZoneList = (data: unknown): DeliveryZone[] => {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === 'object'
      ? ((data as Record<string, unknown>).rows ?? (data as Record<string, unknown>).data)
      : [];

  return (Array.isArray(rows) ? rows : [])
    .map((row) => mapDeliveryZoneDtoToModel(row as DeliveryZoneDto))
    .filter((zone): zone is DeliveryZone => zone !== null);
};

const resolveHeadquarterId = async (headquarterId?: number) => {
  if (Number.isInteger(headquarterId) && headquarterId > 0) return headquarterId;

  try {
    const headquarters = await listHeadquarters({ page: 1, pageSize: 1 });
    const firstHeadquarterId = Number(headquarters.rows[0]?.id);
    return Number.isInteger(firstHeadquarterId) && firstHeadquarterId > 0 ? firstHeadquarterId : undefined;
  } catch {
    return undefined;
  }
};

export async function getDeliveryZone(): Promise<DeliveryZone | null> {
  const data = await apiClient.get(`${API_VERSION}/delivery-zone`, { config: { cache: 'short' } });
  return mapDeliveryZoneDtoToModel(data as DeliveryZoneDto | null | undefined);
}

export async function fetchDeliveryZones(storeId?: number): Promise<DeliveryZone[]> {
  const resolvedStoreId = storeId ?? getCurrentStoreId();
  const data = await apiClient.get(`${API_VERSION}/delivery-zone`, {
    params: resolvedStoreId ? { storeId: resolvedStoreId } : undefined,
    config: { cache: 'short' },
  });

  return extractZoneList(data);
}

export async function createDeliveryZone(payload: CreateDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const resolvedStoreId = payload.storeId ?? getCurrentStoreId();
  const data = await apiClient.post(`${API_VERSION}/delivery-zone`, {
    ...payload,
    headquarterId: payload.headquarterId,
    headquarter_id: payload.headquarterId,
    metadata: {
      ...(payload.metadata ?? {}),
      headquarterId: payload.headquarterId,
      headquarter_id: payload.headquarterId,
    },
    deliveryFee: payload.deliveryFee ?? 0,
    delivery_fee: payload.deliveryFee ?? 0,
    storeId: resolvedStoreId,
  });

  return mapDeliveryZoneDtoToModel(data as DeliveryZoneDto | null | undefined);
}

export async function updateDeliveryZone(zoneId: string, payload: UpdateDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const data = await apiClient.patch(`${API_VERSION}/delivery-zone/${zoneId}`, {
    id: zoneId,
    ...payload,
    headquarterId: payload.headquarterId,
    headquarter_id: payload.headquarterId,
    deliveryFee: payload.deliveryFee,
    delivery_fee: payload.deliveryFee,
    metadata: payload.headquarterId
      ? {
        ...(payload.metadata ?? {}),
        headquarterId: payload.headquarterId,
        headquarter_id: payload.headquarterId,
      }
      : payload.metadata,
  });
  return mapDeliveryZoneDtoToModel(data as DeliveryZoneDto | null | undefined);
}

export async function updateDeliveryZoneStatus(zoneId: string, statusId: number): Promise<void> {
  await apiClient.patch(`${API_VERSION}/delivery-zone/${zoneId}/status`, { statusId });
}

export async function deleteDeliveryZoneById(zoneId: string): Promise<void> {
  await apiClient.delete(`${API_VERSION}/delivery-zone/${zoneId}`);
}

export async function upsertDeliveryZone(payload: UpsertDeliveryZoneRequest): Promise<DeliveryZone | null> {
  const data = await apiClient.put(`${API_VERSION}/delivery-zone`, payload);
  return mapDeliveryZoneDtoToModel(data as DeliveryZoneDto | null | undefined);
}

export async function deleteDeliveryZone(): Promise<void> {
  await apiClient.delete(`${API_VERSION}/delivery-zone`);
}

export async function checkDeliveryZonePoint(payload: CheckDeliveryZoneRequest): Promise<CheckDeliveryZoneResponse> {
  const resolvedHeadquarterId = await resolveHeadquarterId(payload.headquarterId);
  const data = await apiClient.post(`${API_VERSION}/delivery-zone/check`, {
    latitude: payload.latitude,
    longitude: payload.longitude,
    headquarterId: resolvedHeadquarterId,
    lat: payload.latitude,
    lng: payload.longitude,
  });

  const candidate = data as {
    inside?: unknown;
    inZone?: unknown;
    allowed?: unknown;
    hasZone?: unknown;
    has_zone?: unknown;
    zoneExists?: unknown;
    zone?: unknown;
    deliveryZone?: unknown;
    matchedZone?: unknown;
  };
  const rawInside = candidate?.inside ?? candidate?.inZone ?? candidate?.allowed;
  const rawHasZone = candidate?.hasZone ?? candidate?.has_zone ?? candidate?.zoneExists;
  const rawZone = candidate?.zone ?? candidate?.deliveryZone ?? candidate?.matchedZone;
  const inside = rawInside === true;

  return {
    inside,
    hasZone: typeof rawHasZone === 'boolean' ? rawHasZone : inside || (typeof rawZone === 'object' && rawZone !== null),
  };
}

export type {
  CheckDeliveryZoneRequest,
  CheckDeliveryZoneResponse,
  CreateDeliveryZoneRequest,
  DeliveryZone,
  DeliveryZonePoint,
  UpdateDeliveryZoneRequest,
  UpsertDeliveryZoneRequest,
} from '../types/deliveryZones.model';
