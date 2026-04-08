import { getAuthSession } from './authStorage';

type CatalogImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_CATEGORIES_LIST_PATH?: string;
    VITE_CATEGORIES_CREATE_PATH?: string;
    VITE_CATEGORIES_UPDATE_PATH?: string;
    VITE_CATEGORIES_DELETE_PATH?: string;
    VITE_PRODUCTS_LIST_PATH?: string;
    VITE_PRODUCTS_CREATE_PATH?: string;
    VITE_PRODUCTS_UPDATE_PATH?: string;
    VITE_PRODUCTS_DELETE_PATH?: string;
  };
};

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
}

interface BackendCategory {
  id?: string | number;
  name?: string;
  description?: string;
  icon?: string;
  icon_name?: string;
}

interface BackendProductCategory {
  id?: string | number;
  categoryId?: string | number;
}

interface BackendProduct {
  id?: string | number;
  name?: string;
  description?: string;
  price?: number | string;
  categoryIds?: Array<string | number>;
  category_ids?: Array<string | number>;
  categories?: BackendProductCategory[];
}

const API_URL = (import.meta as CatalogImportMeta).env?.VITE_API_URL;
const CATEGORIES_LIST_PATH = (import.meta as CatalogImportMeta).env?.VITE_CATEGORIES_LIST_PATH ?? '/v1/category/list';
const CATEGORIES_CREATE_PATH = (import.meta as CatalogImportMeta).env?.VITE_CATEGORIES_CREATE_PATH ?? '/v1/category/create';
const CATEGORIES_UPDATE_PATH = (import.meta as CatalogImportMeta).env?.VITE_CATEGORIES_UPDATE_PATH ?? '/v1/category/update/:id';
const CATEGORIES_DELETE_PATH = (import.meta as CatalogImportMeta).env?.VITE_CATEGORIES_DELETE_PATH ?? '/v1/category/:id';
const PRODUCTS_LIST_PATH = (import.meta as CatalogImportMeta).env?.VITE_PRODUCTS_LIST_PATH ?? '/v1/product/list';
const PRODUCTS_CREATE_PATH = (import.meta as CatalogImportMeta).env?.VITE_PRODUCTS_CREATE_PATH ?? '/v1/product/create';
const PRODUCTS_UPDATE_PATH = (import.meta as CatalogImportMeta).env?.VITE_PRODUCTS_UPDATE_PATH ?? '/v1/product/update/:id';
const PRODUCTS_DELETE_PATH = (import.meta as CatalogImportMeta).env?.VITE_PRODUCTS_DELETE_PATH ?? '/v1/product/:id';

const resolvePathWithId = (pathTemplate: string, id: string) => {
  if (pathTemplate.includes(':id')) {
    return pathTemplate.replace(':id', encodeURIComponent(id));
  }

  if (pathTemplate.includes('{id}')) {
    return pathTemplate.replace('{id}', encodeURIComponent(id));
  }

  return `${pathTemplate.replace(/\/$/, '')}/${encodeURIComponent(id)}`;
};

const getAuthToken = () => getAuthSession()?.user.token;

const buildAuthHeaders = () => {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente');
  }

  return {
    Authorization: `Bearer ${authToken}`,
  };
};

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no está configurada');
  }

  return API_URL;
};

const normalizeCategory = (item: BackendCategory): ProductCategory => ({
  id: String(item.id ?? `cat-${Date.now()}-${Math.random()}`),
  name: item.name ?? 'Categoría',
  description: item.description ?? undefined,
  icon: item.icon ?? item.icon_name ?? undefined,
});

const normalizeProductCategoryIds = (item: BackendProduct): string[] => {
  if (Array.isArray(item.categoryIds)) {
    return item.categoryIds.map((categoryId) => String(categoryId));
  }

  if (Array.isArray(item.category_ids)) {
    return item.category_ids.map((categoryId) => String(categoryId));
  }

  if (Array.isArray(item.categories)) {
    return item.categories
      .map((category) => category.id ?? category.categoryId)
      .filter((categoryId): categoryId is string | number => categoryId !== undefined)
      .map((categoryId) => String(categoryId));
  }

  return [];
};

const normalizeProduct = (item: BackendProduct): ProductItem => {
  const parsedPrice = Number(item.price ?? 0);

  return {
    id: String(item.id ?? `prod-${Date.now()}-${Math.random()}`),
    name: item.name ?? 'Producto',
    description: item.description ?? undefined,
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    categoryIds: normalizeProductCategoryIds(item),
  };
};

export const fetchProductCategories = async (): Promise<ProductCategory[]> => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${CATEGORIES_LIST_PATH}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || 'No se pudieron obtener las categorías');
  }

  const data = await response.json() as {
    categories?: BackendCategory[];
    data?: BackendCategory[];
  };

  const categories = data.categories ?? data.data ?? [];
  return Array.isArray(categories) ? categories.map(normalizeCategory) : [];
};

interface UpsertProductCategoryInput {
  name: string;
  description?: string;
  icon?: string;
}

export const createProductCategory = async (input: UpsertProductCategoryInput) => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${CATEGORIES_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      icon: input.icon,
      icon_name: input.icon,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear la categoría');
  }

  return data;
};

export const updateProductCategory = async (categoryId: string, input: UpsertProductCategoryInput) => {
  const baseUrl = ensureApiUrl();
  const path = resolvePathWithId(CATEGORIES_UPDATE_PATH, categoryId);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      id: categoryId,
      categoryId,
      name: input.name,
      description: input.description,
      icon: input.icon,
      icon_name: input.icon,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo actualizar la categoría');
  }

  return data;
};

export const deleteProductCategory = async (categoryId: string) => {
  const baseUrl = ensureApiUrl();
  const path = resolvePathWithId(CATEGORIES_DELETE_PATH, categoryId);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo eliminar la categoría');
  }

  return data;
};

export const fetchProducts = async (): Promise<ProductItem[]> => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${PRODUCTS_LIST_PATH}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || 'No se pudieron obtener los productos');
  }

  const data = await response.json() as {
    products?: BackendProduct[];
    data?: BackendProduct[];
  };

  const products = data.products ?? data.data ?? [];
  return Array.isArray(products) ? products.map(normalizeProduct) : [];
};

interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
}

export const createProduct = async (input: CreateProductInput) => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${PRODUCTS_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      price: input.price,
      categoryIds: input.categoryIds,
      category_ids: input.categoryIds,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear el producto');
  }

  return data;
};

interface UpdateProductInput {
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
}

export const updateProduct = async (productId: string, input: UpdateProductInput) => {
  const baseUrl = ensureApiUrl();
  const path = resolvePathWithId(PRODUCTS_UPDATE_PATH, productId);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      id: productId,
      productId,
      name: input.name,
      description: input.description,
      price: input.price,
      categoryIds: input.categoryIds,
      category_ids: input.categoryIds,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo actualizar el producto');
  }

  return data;
};

export const deleteProduct = async (productId: string) => {
  const baseUrl = ensureApiUrl();
  const path = resolvePathWithId(PRODUCTS_DELETE_PATH, productId);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo eliminar el producto');
  }

  return data;
};
