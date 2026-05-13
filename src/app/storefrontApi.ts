type StorefrontImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_STOREFRONT_STORE_PATH?: string;
    VITE_STOREFRONT_PRODUCTS_PATH?: string;
    VITE_STOREFRONT_ORDERS_PATH?: string;
  };
};

export interface PublicStoreInfo {
  id?: string;
  slug: string;
  name: string;
  description?: string;
  logoUrl?: string;
  statusId?: number;
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
}

export interface PublicStoreHeadquarter {
  id: string;
  name: string;
  location?: string;
  phone?: string;
}

export interface PublicStoreCatalog {
  products: PublicStoreProduct[];
  categories: PublicStoreCategory[];
  headquarters: PublicStoreHeadquarter[];
  defaultHeadquarterId?: string;
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
  }>;
}

interface BackendStoreCategory {
  id?: string | number;
  categoryId?: string | number;
  category_id?: string | number;
  name?: string;
  description?: string;
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
}

const API_URL = (import.meta as StorefrontImportMeta).env?.VITE_API_URL;
const STOREFRONT_STORE_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_STORE_PATH ?? '/v1/store/:slug';
const STOREFRONT_PRODUCTS_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_PRODUCTS_PATH ?? '/v1/store/:slug/products';
const STOREFRONT_ORDERS_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_ORDERS_PATH ?? '/v1/store/:slug/orders';

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no esta configurada');
  }

  return API_URL;
};

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

  return {
    id,
    name: String(candidate.name ?? candidate.title ?? `Sede ${id}`).trim(),
    location: candidate.location ?? candidate.address ?? undefined,
    phone: candidate.phone ?? undefined,
  };
};

const normalizeHeadquarters = (input: unknown): PublicStoreHeadquarter[] => {
  if (Array.isArray(input)) {
    const parsed = input
      .map((item) => normalizeHeadquarter(item))
      .filter((item): item is PublicStoreHeadquarter => item !== null);

    const deduped = new Map<string, PublicStoreHeadquarter>();
    parsed.forEach((item) => {
      if (!deduped.has(item.id)) {
        deduped.set(item.id, item);
      }
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
  };
};

const getCategoryNameFromProductCategory = (category: BackendStoreProduct['categories'][number]) => {
  if (!category || typeof category !== 'object') {
    return undefined;
  }

  const name = String(category.name ?? '').trim();
  return name || undefined;
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

  return {
    id: item?.id !== undefined ? String(item.id) : undefined,
    slug: item?.slug ?? item?.slug_url ?? item?.slugUrl ?? slug,
    name: item?.name ?? item?.title ?? slug,
    description: item?.description ?? undefined,
    logoUrl: item?.logo_url ?? item?.logoUrl ?? undefined,
    statusId: Number.isFinite(parsedStatusId) ? parsedStatusId : 1,
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
        });
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

  return {
    products,
    categories,
    headquarters,
    defaultHeadquarterId: defaultHeadquarterId || undefined,
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
    throw new Error(data?.error || data?.detail || 'No se pudo cargar la tienda');
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
    throw new Error(data?.error || data?.detail || 'No se pudieron cargar los productos de la tienda');
  }

  return normalizeProductsAndCategories(data);
};

interface CreatePublicOrderInput {
  customerName: string;
  phone: string;
  type: 'delivery' | 'pickup';
  address?: string;
  notes?: string;
  total: number;
  productIds: string[];
  items: string[];
  headquarterId?: string | number;
}

export const createPublicStoreOrder = async (slug: string, input: CreatePublicOrderInput) => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_ORDERS_PATH, slug);
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
      notes: input.notes,
      total: input.total,
      product_ids: input.productIds,
      productIds: input.productIds,
      items: input.items,
      headquarter_id: input.headquarterId,
      headquarterId: input.headquarterId,
      pickup_headquarter_id: input.headquarterId,
      pickupHeadquarterId: input.headquarterId,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear la compra');
  }

  return data;
};
