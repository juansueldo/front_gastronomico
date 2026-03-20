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
}

export interface PublicStoreProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  available: boolean;
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
}

const API_URL = (import.meta as StorefrontImportMeta).env?.VITE_API_URL;
const STOREFRONT_STORE_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_STORE_PATH ?? '/store/:slug';
const STOREFRONT_PRODUCTS_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_PRODUCTS_PATH ?? '/store/:slug/products';
const STOREFRONT_ORDERS_PATH = (import.meta as StorefrontImportMeta).env?.VITE_STOREFRONT_ORDERS_PATH ?? '/store/:slug/orders';

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no esta configurada');
  }

  return API_URL;
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

const normalizeStore = (slug: string, item: BackendStoreInfo | null): PublicStoreInfo => {
  const parsedStatusId = Number(item?.status_id ?? item?.statusId ?? 1);

  return {
    id: item?.id !== undefined ? String(item.id) : undefined,
    slug: item?.slug ?? item?.slug_url ?? item?.slugUrl ?? slug,
    name: item?.name ?? item?.title ?? slug,
    description: item?.description ?? undefined,
    logoUrl: item?.logo_url ?? item?.logoUrl ?? undefined,
    statusId: Number.isFinite(parsedStatusId) ? parsedStatusId : 1,
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
  };
};

export const fetchPublicStore = async (slug: string): Promise<PublicStoreInfo> => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_STORE_PATH, slug);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo cargar la tienda');
  }

  return normalizeStore(slug, data as BackendStoreInfo | null);
};

export const fetchPublicStoreProducts = async (slug: string): Promise<PublicStoreProduct[]> => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_PRODUCTS_PATH, slug);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudieron cargar los productos de la tienda');
  }

  const products = Array.isArray(data)
    ? data
    : Array.isArray(data?.products)
      ? data.products
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return products.map(normalizeProduct);
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
}

export const createPublicStoreOrder = async (slug: string, input: CreatePublicOrderInput) => {
  const baseUrl = ensureApiUrl();
  const path = resolveSlugPath(STOREFRONT_ORDERS_PATH, slug);
  const response = await fetch(`${baseUrl}${path}`, {
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
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear la compra');
  }

  return data;
};
