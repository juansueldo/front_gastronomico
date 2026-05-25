type StorefrontImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_STOREFRONT_STORE_PATH?: string;
    VITE_STOREFRONT_PRODUCTS_PATH?: string;
    VITE_STOREFRONT_ORDERS_PATH?: string;
    VITE_STOREFRONT_DELIVERY_ZONES_PATH?: string;
  };
};

export interface PublicStoreInfo {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  profileImageUrl?: string;
  logoUrl?: string;
  statusId?: number;
  offersDelivery?: boolean;
  offersPickup?: boolean;
  pickupHeadquarters?: PublicStoreHeadquarter[];
  defaultHeadquarterId?: string;
}

export interface PublicStoreProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
  categoryIds: string[];
}

export interface PublicStoreCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface PublicStoreHeadquarter {
  id: string;
  name: string;
  location?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  schedules?: PublicStoreSchedule[];
}

export interface PublicStoreCatalog {
  products: PublicStoreProduct[];
  categories: PublicStoreCategory[];
  headquarters: PublicStoreHeadquarter[];
  defaultHeadquarterId?: string;
  offersDelivery?: boolean;
  offersPickup?: boolean;
}

export interface PublicStoreSchedule {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface PublicStoreDeliveryZonePoint {
  lat: number;
  lng: number;
}

export interface PublicStoreDeliveryZone {
  id: string;
  name: string;
  active: boolean;
  headquarterId?: string;
  polygon: PublicStoreDeliveryZonePoint[];
}

interface BackendStoreInfo {
  id?: string | number;
  slug?: string;
  slug_url?: string;
  slugUrl?: string;
  name?: string;
  title?: string;
  description?: string;
  logo_url?: string;
  logoUrl?: string;
  profileImageUrl?: string;
  profile_image_url?: string;
  status_id?: string | number;
  statusId?: string | number;
  headquarterId?: string | number;
  headquarter_id?: string | number;
  pickupHeadquarterId?: string | number;
  pickup_headquarter_id?: string | number;
  headquarters?: unknown;
  headquarter?: unknown;
  pickupHeadquarters?: unknown;
  pickup_headquarters?: unknown;
  offers_delivery?: boolean | string | number | null;
  offersDelivery?: boolean | string | number | null;
  delivery_enabled?: boolean | string | number | null;
  deliveryEnabled?: boolean | string | number | null;
  offers_pickup?: boolean | string | number | null;
  offersPickup?: boolean | string | number | null;
  pickup_enabled?: boolean | string | number | null;
  pickupEnabled?: boolean | string | number | null;
}

interface BackendStoreProduct {
  id?: string | number;
  name?: string;
  description?: string;
  price?: string | number;
  image_url?: string;
  imageUrl?: string;
  active?: boolean;
  is_active?: boolean;
  categoryId?: string | number;
  category_id?: string | number;
  categoryIds?: Array<string | number>;
  category_ids?: Array<string | number>;
  categories?: Array<{
    id?: string | number;
    categoryId?: string | number;
    category_id?: string | number;
    name?: string;
    icon?: string;
    iconName?: string;
    icon_name?: string;
    iconUrl?: string;
    icon_url?: string;
    imageUrl?: string;
    image_url?: string;
    emoji?: string;
  }>;
}

interface BackendStoreCategory {
  id?: string | number;
  categoryId?: string | number;
  category_id?: string | number;
  name?: string;
  description?: string;
  icon?: string;
  iconName?: string;
  icon_name?: string;
  iconUrl?: string;
  icon_url?: string;
  imageUrl?: string;
  image_url?: string;
  emoji?: string;
}

interface BackendHeadquarter {
  id?: string | number;
  headquarterId?: string | number;
  headquarter_id?: string | number;
  name?: string;
  title?: string;
  location?: string;
  address?: string;
  phone?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  lat?: number | string | null;
  lng?: number | string | null;
  schedules?: unknown;
}

interface BackendSchedule {
  day_of_week?: string;
  dayOfWeek?: string;
  open_time?: string;
  openTime?: string;
  close_time?: string;
  closeTime?: string;
  is_closed?: boolean;
  isClosed?: boolean;
}

interface BackendDeliveryZone {
  id?: string | number;
  name?: string;
  active?: boolean;
  statusId?: string | number;
  status_id?: string | number;
  headquarterId?: string | number;
  headquarter_id?: string | number;
  polygon?: Array<{ lat?: number; lng?: number }>;
  points?: Array<{ lat?: number; lng?: number }>;
  vertices?: Array<{ lat?: number; lng?: number }>;
  geojson?: {
    type?: string;
    coordinates?: number[][][];
  };
  geometry?: {
    type?: string;
    coordinates?: number[][][];
  };
  zone?: BackendDeliveryZone;
  deliveryZone?: BackendDeliveryZone;
  item?: BackendDeliveryZone;
}

const API_URL = (import.meta as StorefrontImportMeta).env?.VITE_API_URL;
const STOREFRONT_STORE_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_STORE_PATH ?? '/v1/store/:slug';
const STOREFRONT_PRODUCTS_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_PRODUCTS_PATH ?? '/v1/store/:slug/products';
const STOREFRONT_ORDERS_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_ORDERS_PATH ?? '/v1/store/:slug/orders';
const STOREFRONT_DELIVERY_ZONES_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_DELIVERY_ZONES_PATH ?? '/v1/delivery-zone';

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no esta configurada');
  }

  return API_URL;
};

import { ApiError } from '../core/http/errors';

const buildApiUrl = (baseUrl: string, path: string) => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
};

const resolveSlugPath = (pathTemplate: string, slug: string) => {
  const encodedSlug = encodeURIComponent(slug);

  if (pathTemplate.includes(':slug')) {
    return pathTemplate.replace(':slug', encodedSlug);
  }

  if (pathTemplate.includes('{slug}')) {
    return pathTemplate.replace('{slug}', encodedSlug);
  }

  return `${pathTemplate.replace(/\/$/, '')}/${encodedSlug}`;
};

const parseEntityId = (...candidates: unknown[]) => {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) {
      continue;
    }

    const value = String(candidate).trim();
    if (value) {
      return value;
    }
  }

  return '';
};

const normalizeBooleanFlag = (value: unknown, fallback = true) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }

  return fallback;
};

const normalizeCategoryIds = (item: BackendStoreProduct): string[] => {
  const collected: unknown[] = [];

  if (Array.isArray(item.categoryIds)) collected.push(...item.categoryIds);
  if (Array.isArray(item.category_ids)) collected.push(...item.category_ids);
  if (item.categoryId !== undefined && item.categoryId !== null) collected.push(item.categoryId);
  if (item.category_id !== undefined && item.category_id !== null) collected.push(item.category_id);

  if (Array.isArray(item.categories)) {
    item.categories.forEach((category) => {
      const categoryRef = category?.id ?? category?.categoryId ?? category?.category_id;
      if (categoryRef !== undefined && categoryRef !== null) {
        collected.push(categoryRef);
      }
    });
  }

  return [...new Set(collected.map((value) => String(value).trim()).filter(Boolean))];
};

const normalizeHeadquarter = (value: unknown): PublicStoreHeadquarter | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as BackendHeadquarter;
  const id = parseEntityId(candidate.id, candidate.headquarterId, candidate.headquarter_id);
  if (!id) {
    return null;
  }
  const latitude = Number(candidate.latitude ?? candidate.lat);
  const longitude = Number(candidate.longitude ?? candidate.lng);

  return {
    id,
    name: String(candidate.name ?? candidate.title ?? `Sede ${id}`).trim(),
    location: candidate.location ?? candidate.address ?? undefined,
    phone: candidate.phone ?? undefined,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
    schedules: normalizeSchedules(candidate.schedules),
  };
};

const normalizeSchedule = (value: unknown): PublicStoreSchedule | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as BackendSchedule;
  const dayOfWeek = String(candidate.day_of_week ?? candidate.dayOfWeek ?? '').trim().toLowerCase();
  const openTime = String(candidate.open_time ?? candidate.openTime ?? '').trim();
  const closeTime = String(candidate.close_time ?? candidate.closeTime ?? '').trim();

  if (!dayOfWeek || !openTime || !closeTime) {
    return null;
  }

  return {
    dayOfWeek,
    openTime,
    closeTime,
    isClosed: Boolean(candidate.is_closed ?? candidate.isClosed ?? false),
  };
};

const normalizeSchedules = (input: unknown): PublicStoreSchedule[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => normalizeSchedule(item))
    .filter((item): item is PublicStoreSchedule => item !== null && !item.isClosed);
};

const normalizeHeadquarters = (input: unknown): PublicStoreHeadquarter[] => {
  if (Array.isArray(input)) {
    const parsed = input
      .map((item) => normalizeHeadquarter(item))
      .filter((item): item is PublicStoreHeadquarter => item !== null);

    const deduped = new Map<string, PublicStoreHeadquarter>();
    parsed.forEach((item) => {
      const existing = deduped.get(item.id);
      if (!existing) {
        deduped.set(item.id, item);
        return;
      }

      const mergedSchedules = existing.schedules?.length
        ? existing.schedules
        : item.schedules;

      deduped.set(item.id, {
        ...existing,
        name: existing.name || item.name,
        location: existing.location ?? item.location,
        phone: existing.phone ?? item.phone,
        schedules: mergedSchedules,
      });
    });

    return Array.from(deduped.values());
  }

  const single = normalizeHeadquarter(input);
  return single ? [single] : [];
};

const collectResponseArray = (payload: unknown, keys: string[]): unknown[] => {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
};

const normalizeCategory = (item: BackendStoreCategory): PublicStoreCategory | null => {
  const id = parseEntityId(item.id, item.categoryId, item.category_id);
  if (!id) {
    return null;
  }

  return {
    id,
    name: String(item.name ?? `Categoria ${id}`).trim(),
    description: item.description ?? undefined,
    icon: parseEntityId(item.icon, item.iconName, item.icon_name, item.iconUrl, item.icon_url, item.imageUrl, item.image_url, item.emoji) || undefined,
  };
};

const getCategoryNameFromProductCategory = (category: BackendStoreProduct['categories'][number]) => {
  if (!category || typeof category !== 'object') {
    return undefined;
  }

  const name = String(category.name ?? '').trim();
  return name || undefined;
};

const getCategoryIconFromProductCategory = (category: BackendStoreProduct['categories'][number]) => {
  if (!category || typeof category !== 'object') {
    return undefined;
  }

  return parseEntityId(
    category.icon,
    category.iconName,
    category.icon_name,
    category.iconUrl,
    category.icon_url,
    category.imageUrl,
    category.image_url,
    category.emoji,
  ) || undefined;
};

const normalizeStore = (slug: string, item: BackendStoreInfo | null): PublicStoreInfo => {
  const parsedStatusId = Number(item?.status_id ?? item?.statusId ?? 1);
  const pickupHeadquarters = normalizeHeadquarters(
    item?.pickupHeadquarters
    ?? item?.pickup_headquarters
    ?? item?.headquarters
    ?? item?.headquarter
  );
  const defaultHeadquarterId = parseEntityId(
    item?.pickupHeadquarterId,
    item?.pickup_headquarter_id,
    item?.headquarterId,
    item?.headquarter_id,
    pickupHeadquarters[0]?.id
  );
  const resolvedProfileImageUrl = (
    item?.profileImageUrl
    ?? item?.profile_image_url
    ?? item?.logoUrl
    ?? item?.logo_url
    ?? undefined
  );

  return {
    id: item?.id !== undefined ? String(item.id) : undefined,
    slug: item?.slug ?? item?.slug_url ?? item?.slugUrl ?? slug,
    name: item?.name ?? item?.title ?? slug,
    description: item?.description ?? undefined,
    profileImageUrl: resolvedProfileImageUrl,
    logoUrl: item?.logoUrl ?? item?.logo_url ?? resolvedProfileImageUrl,
    statusId: Number.isFinite(parsedStatusId) ? parsedStatusId : 1,
    offersDelivery: normalizeBooleanFlag(
      item?.offersDelivery
      ?? item?.offers_delivery
      ?? item?.deliveryEnabled
      ?? item?.delivery_enabled,
      true,
    ),
    offersPickup: normalizeBooleanFlag(
      item?.offersPickup
      ?? item?.offers_pickup
      ?? item?.pickupEnabled
      ?? item?.pickup_enabled,
      true,
    ),
    pickupHeadquarters,
    defaultHeadquarterId: defaultHeadquarterId || undefined,
  };
};

const normalizeProduct = (item: BackendStoreProduct): PublicStoreProduct => {
  const parsedPrice = Number(item.price ?? 0);

  return {
    id: String(item.id ?? `store-product-${Date.now()}-${Math.random()}`),
    name: item.name ?? 'Producto',
    description: item.description ?? undefined,
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    imageUrl: item.image_url ?? item.imageUrl ?? undefined,
    available: item.active ?? item.is_active ?? true,
    categoryIds: normalizeCategoryIds(item),
  };
};

const normalizeProductsAndCategories = (payload: unknown): PublicStoreCatalog => {
  const productRowsRaw = Array.isArray(payload)
    ? payload
    : collectResponseArray(payload, ['products', 'rows', 'data', 'items']);

  const products = productRowsRaw.map((product) => normalizeProduct(product as BackendStoreProduct));

  const categoryRowsRaw = collectResponseArray(payload, [
    'categories',
    'productCategories',
    'product_categories',
  ]);

  const categoriesMap = new Map<string, PublicStoreCategory>();

  categoryRowsRaw.forEach((category) => {
    const normalized = normalizeCategory(category as BackendStoreCategory);
    if (normalized) {
      categoriesMap.set(normalized.id, normalized);
    }
  });

  products.forEach((product, index) => {
    const rawProduct = productRowsRaw[index] as BackendStoreProduct | undefined;
    const categoryRows = Array.isArray(rawProduct?.categories) ? rawProduct.categories : [];

    categoryRows.forEach((category) => {
      const categoryId = parseEntityId(category?.id, category?.categoryId, category?.category_id);
      if (!categoryId) {
        return;
      }

      if (!categoriesMap.has(categoryId)) {
        categoriesMap.set(categoryId, {
          id: categoryId,
          name: getCategoryNameFromProductCategory(category) ?? `Categoria ${categoryId}`,
          icon: getCategoryIconFromProductCategory(category),
        });
      } else {
        const existingCategory = categoriesMap.get(categoryId);
        const categoryIcon = getCategoryIconFromProductCategory(category);
        if (existingCategory && !existingCategory.icon && categoryIcon) {
          categoriesMap.set(categoryId, {
            ...existingCategory,
            icon: categoryIcon,
          });
        }
      }
    });
  });

  const categories = Array.from(categoriesMap.values());

  const headquarters = normalizeHeadquarters(
    !Array.isArray(payload) && payload && typeof payload === 'object'
      ? (
        (payload as Record<string, unknown>).pickupHeadquarters
        ?? (payload as Record<string, unknown>).pickup_headquarters
        ?? (payload as Record<string, unknown>).headquarters
        ?? (payload as Record<string, unknown>).headquarter
      )
      : undefined
  );

  const defaultHeadquarterId = !Array.isArray(payload) && payload && typeof payload === 'object'
    ? parseEntityId(
      (payload as Record<string, unknown>).pickupHeadquarterId,
      (payload as Record<string, unknown>).pickup_headquarter_id,
      (payload as Record<string, unknown>).headquarterId,
      (payload as Record<string, unknown>).headquarter_id,
      headquarters[0]?.id
    )
    : parseEntityId(headquarters[0]?.id);
  const recordPayload = !Array.isArray(payload) && payload && typeof payload === 'object'
    ? payload as Record<string, unknown>
    : {};

  return {
    products,
    categories,
    headquarters,
    defaultHeadquarterId: defaultHeadquarterId || undefined,
    offersDelivery: normalizeBooleanFlag(
      recordPayload.offersDelivery
      ?? recordPayload.offers_delivery
      ?? recordPayload.deliveryEnabled
      ?? recordPayload.delivery_enabled,
      true,
    ),
    offersPickup: normalizeBooleanFlag(
      recordPayload.offersPickup
      ?? recordPayload.offers_pickup
      ?? recordPayload.pickupEnabled
      ?? recordPayload.pickup_enabled,
      true,
    ),
  };
};

const normalizeGeoJsonZonePoints = (coordinates: number[][][] | undefined): PublicStoreDeliveryZonePoint[] => {
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
    .filter((point): point is PublicStoreDeliveryZonePoint => point !== null);
};

const normalizeDeliveryZonePoints = (zone: BackendDeliveryZone): PublicStoreDeliveryZonePoint[] => {
  const toPoint = (point: { lat?: number; lng?: number }) => {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      return null;
    }
    return { lat: Number(point.lat), lng: Number(point.lng) };
  };

  const polygonPoints = Array.isArray(zone.polygon)
    ? zone.polygon.map((point) => toPoint(point ?? {})).filter((point): point is PublicStoreDeliveryZonePoint => point !== null)
    : [];
  if (polygonPoints.length > 0) return polygonPoints;

  const points = Array.isArray(zone.points)
    ? zone.points.map((point) => toPoint(point ?? {})).filter((point): point is PublicStoreDeliveryZonePoint => point !== null)
    : [];
  if (points.length > 0) return points;

  const vertices = Array.isArray(zone.vertices)
    ? zone.vertices.map((point) => toPoint(point ?? {})).filter((point): point is PublicStoreDeliveryZonePoint => point !== null)
    : [];
  if (vertices.length > 0) return vertices;

  return normalizeGeoJsonZonePoints(zone.geojson?.coordinates ?? zone.geometry?.coordinates);
};

const extractRawPublicDeliveryZone = (input: BackendDeliveryZone | null | undefined): BackendDeliveryZone | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  if (input.zone && typeof input.zone === 'object') return input.zone;
  if (input.deliveryZone && typeof input.deliveryZone === 'object') return input.deliveryZone;
  if (input.item && typeof input.item === 'object') return input.item;
  return input;
};

const normalizePublicDeliveryZone = (input: BackendDeliveryZone | null | undefined): PublicStoreDeliveryZone | null => {
  const zone = extractRawPublicDeliveryZone(input);
  if (!zone) return null;

  const id = parseEntityId(zone.id);
  const polygon = normalizeDeliveryZonePoints(zone);
  if (!id || polygon.length < 3) {
    return null;
  }

  const statusId = Number(zone.statusId ?? zone.status_id ?? (zone.active === false ? 2 : 1));
  const active = typeof zone.active === 'boolean' ? zone.active : statusId === 1;

  return {
    id,
    name: String(zone.name ?? `Zona ${id}`).trim(),
    active,
    headquarterId: parseEntityId(zone.headquarterId, zone.headquarter_id) || undefined,
    polygon,
  };
};

export const fetchPublicStore = async (slug: string): Promise<PublicStoreInfo> => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_STORE_PATH, slug);
  const response = await fetch(buildApiUrl(baseUrl, path), {
    method: 'GET',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.code ?? `HTTP_${response.status}`,
      response.status,
      data?.error || data?.detail || 'No se pudo cargar la tienda',
      data?.details,
    );
  }

  return normalizeStore(slug, data as BackendStoreInfo | null);
};

export const fetchPublicStoreProducts = async (slug: string): Promise<PublicStoreProduct[]> => {
  const catalog = await fetchPublicStoreCatalog(slug);
  return catalog.products;
};

export const fetchPublicStoreCatalog = async (slug: string): Promise<PublicStoreCatalog> => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_PRODUCTS_PATH, slug);
  const response = await fetch(buildApiUrl(baseUrl, path), {
    method: 'GET',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.code ?? `HTTP_${response.status}`,
      response.status,
      data?.error || data?.detail || 'No se pudieron cargar los productos de la tienda',
      data?.details,
    );
  }

  return normalizeProductsAndCategories(data);
};

export const fetchPublicStoreDeliveryZones = async (params: {
  storeId?: string | number;
  headquarterId?: string | number;
  activeOnly?: boolean;
}): Promise<PublicStoreDeliveryZone[]> => {
  const baseUrl = ensureApiUrl();
  const storeId = parseEntityId(params.storeId);
  if (!storeId) {
    return [];
  }

  const path = STOREFRONT_DELIVERY_ZONES_PATH;
  const url = new URL(buildApiUrl(baseUrl, path));
  url.searchParams.set('storeId', storeId);
  url.searchParams.set('store_id', storeId);

  const headquarterId = parseEntityId(params.headquarterId);
  if (headquarterId) {
    url.searchParams.set('headquarterId', headquarterId);
    url.searchParams.set('headquarter_id', headquarterId);
  }

  if (params.activeOnly !== false) {
    url.searchParams.set('statusId', '1');
    url.searchParams.set('status_id', '1');
    url.searchParams.set('active', 'true');
  }

  const response = await fetch(url.toString(), { method: 'GET' });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.code ?? `HTTP_${response.status}`,
      response.status,
      data?.error || data?.detail || 'No se pudieron cargar las zonas de entrega',
      data?.details,
    );
  }

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rows
    .map((row) => normalizePublicDeliveryZone(row as BackendDeliveryZone))
    .filter((zone): zone is PublicStoreDeliveryZone => zone !== null)
    .filter((zone) => (params.activeOnly === false ? true : zone.active));
};

interface CreatePublicOrderInput {
  customerName: string;
  phone: string;
  type: 'delivery' | 'pickup';
  address?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  notes?: string;
  total: number;
  productIds: string[];
  items: string[];
  headquarterId?: string | number;
  scheduledFor?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  isAsap?: boolean;
}

export const createPublicStoreOrder = async (slug: string, input: CreatePublicOrderInput) => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_ORDERS_PATH, slug);
  const fallbackDateTime = input.scheduledFor ? new Date(input.scheduledFor) : null;
  const fallbackScheduledDate = (
    fallbackDateTime && !Number.isNaN(fallbackDateTime.getTime())
      ? `${fallbackDateTime.getFullYear()}-${String(fallbackDateTime.getMonth() + 1).padStart(2, '0')}-${String(fallbackDateTime.getDate()).padStart(2, '0')}`
      : undefined
  );
  const fallbackScheduledTime = (
    fallbackDateTime && !Number.isNaN(fallbackDateTime.getTime())
      ? `${String(fallbackDateTime.getHours()).padStart(2, '0')}:${String(fallbackDateTime.getMinutes()).padStart(2, '0')}:00`
      : undefined
  );
  const scheduledDate = input.scheduledDate ?? fallbackScheduledDate;
  const scheduledTime = input.scheduledTime ?? fallbackScheduledTime;

  const response = await fetch(buildApiUrl(baseUrl, path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      customer_name: input.customerName,
      customerName: input.customerName,
      phone: input.phone,
      type: input.type,
      address: input.address,
      delivery_latitude: input.deliveryLatitude,
      deliveryLatitude: input.deliveryLatitude,
      latitude: input.deliveryLatitude,
      delivery_longitude: input.deliveryLongitude,
      deliveryLongitude: input.deliveryLongitude,
      longitude: input.deliveryLongitude,
      notes: input.notes,
      total: input.total,
      product_ids: input.productIds,
      productIds: input.productIds,
      items: input.items,
      headquarter_id: input.headquarterId,
      headquarterId: input.headquarterId,
      pickup_headquarter_id: input.headquarterId,
      pickupHeadquarterId: input.headquarterId,
      scheduled_for: input.scheduledFor,
      scheduledFor: input.scheduledFor,
      scheduled_date: scheduledDate,
      scheduledDate,
      requested_date: scheduledDate,
      requestedDate: scheduledDate,
      delivery_date: scheduledDate,
      deliveryDate: scheduledDate,
      pickup_date: scheduledDate,
      pickupDate: scheduledDate,
      scheduled_time: scheduledTime,
      scheduledTime,
      requested_time: scheduledTime,
      requestedTime: scheduledTime,
      delivery_time: scheduledTime,
      deliveryTime: scheduledTime,
      pickup_time: scheduledTime,
      pickupTime: scheduledTime,
      is_asap: input.isAsap,
      isAsap: input.isAsap,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      data?.code ?? `HTTP_${response.status}`,
      response.status,
      data?.error || data?.detail || 'No se pudo crear la compra',
      data?.details,
    );
  }

  return data;
};
