import type { DeliveryZoneDto, DeliveryZonePointDto } from '../types/deliveryZones.dto';
import type { DeliveryZone, DeliveryZonePoint } from '../types/deliveryZones.model';

export const normalizeDeliveryZoneId = (value: string | number) => String(value);

const toPoint = (point: DeliveryZonePointDto): DeliveryZonePoint | null => {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  return { lat: Number(point.lat), lng: Number(point.lng) };
};

const normalizeGeoJsonPoints = (coordinates: number[][][] | undefined): DeliveryZonePoint[] => {
  const firstRing = Array.isArray(coordinates) && coordinates.length > 0 && Array.isArray(coordinates[0])
    ? coordinates[0]
    : [];

  return firstRing
    .map((pair) => {
      if (!Array.isArray(pair) || pair.length < 2) return null;
      const [lng, lat] = pair;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return { lat: Number(lat), lng: Number(lng) };
    })
    .filter((point): point is DeliveryZonePoint => point !== null);
};

const normalizePoints = (raw: DeliveryZoneDto): DeliveryZonePoint[] => {
  for (const key of ['polygon', 'points', 'vertices'] as const) {
    const points = Array.isArray(raw[key])
      ? raw[key]!.map((point) => toPoint(point ?? {})).filter((point): point is DeliveryZonePoint => point !== null)
      : [];
    if (points.length > 0) return points;
  }

  return normalizeGeoJsonPoints(raw.geojson?.coordinates ?? raw.geometry?.coordinates);
};

const normalizeDeliveryFee = (raw: DeliveryZoneDto): number => {
  const parsed = Number(raw.deliveryFee ?? raw.delivery_fee ?? 0);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const extractRawZone = (raw: DeliveryZoneDto | null | undefined): DeliveryZoneDto | null => {
  if (!raw || typeof raw !== 'object') return null;
  return raw.zone ?? raw.deliveryZone ?? raw.item ?? raw;
};

export function mapDeliveryZoneDtoToModel(raw: DeliveryZoneDto | null | undefined): DeliveryZone | null {
  const zoneRaw = extractRawZone(raw);
  if (!zoneRaw) return null;

  const polygon = normalizePoints(zoneRaw);
  if (polygon.length === 0) return null;

  const resolvedStatusId = Number(zoneRaw.statusId ?? zoneRaw.status_id ?? zoneRaw.Status?.id ?? (zoneRaw.active === false ? 2 : 1));
  const resolvedActive = typeof zoneRaw.active === 'boolean'
    ? zoneRaw.active
    : String(zoneRaw.Status?.name ?? '').toLowerCase() === 'active'
      ? true
      : resolvedStatusId === 1;
  const metadataHeadquarterId = Number(
    (zoneRaw.metadata as { headquarterId?: unknown; headquarter_id?: unknown } | undefined)?.headquarterId
    ?? (zoneRaw.metadata as { headquarterId?: unknown; headquarter_id?: unknown } | undefined)?.headquarter_id
  );
  const resolvedHeadquarterId = Number(
    zoneRaw.headquarterId
    ?? zoneRaw.headquarter_id
    ?? zoneRaw.Headquarter?.id
    ?? metadataHeadquarterId
  );

  return {
    id: zoneRaw.id !== undefined ? String(zoneRaw.id) : undefined,
    customerId: zoneRaw.customerId ?? zoneRaw.customer_id,
    name: zoneRaw.name,
    active: resolvedActive,
    polygon,
    headquarterId: Number.isInteger(resolvedHeadquarterId) && resolvedHeadquarterId > 0 ? resolvedHeadquarterId : undefined,
    updatedAt: zoneRaw.updatedAt ?? zoneRaw.updated_at,
    zoneid: zoneRaw.zoneid,
    deliveryFee: normalizeDeliveryFee(zoneRaw),
    storeId: zoneRaw.storeId ?? zoneRaw.store_id,
    statusId: resolvedStatusId,
  };
}
