import { endpoints } from './api/endpoints';

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
  categoryId: number;
}

export interface ListProductCategoriesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: {
    key: string;
    direction: 'asc' | 'desc';
  } | null;
}

export interface ProductCategoryListResult {
  rows: ProductCategory[];
  total: number;
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

interface UpsertProductCategoryInput {
  name: string;
  description?: string;
  icon?: string;
}

interface CreateProductInput {
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
}

interface UpdateProductInput {
  name: string;
  description?: string;
  price: number;
  categoryIds: string[];
}

function normalizeCategory(item: BackendCategory): ProductCategory {
  return {
    id: String(item.id ?? `cat-${Date.now()}-${Math.random()}`),
    name: item.name ?? 'Categoria',
    description: item.description ?? undefined,
    icon: item.icon ?? item.icon_name ?? undefined,
  };
}

function normalizeProductCategoryIds(item: BackendProduct): string[] {
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
}

function normalizeProduct(item: BackendProduct): ProductItem {
  const parsedPrice = Number(item.price ?? 0);

  return {
    id: String(item.id ?? `prod-${Date.now()}-${Math.random()}`),
    name: item.name ?? 'Producto',
    description: item.description ?? undefined,
    price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
    categoryIds: normalizeProductCategoryIds(item),
  };
}

function unwrapListPayload<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) {
    return data as T[];
  }

  if (!data || typeof data !== 'object') {
    return [];
  }

  const candidate = data as Record<string, unknown>;

  for (const key of keys) {
    const value = candidate[key];
    if (Array.isArray(value)) {
      return value as T[];
    }
  }

  return [];
}

function sortCategories(items: ProductCategory[], sort: ListProductCategoriesParams['sort']) {
  if (!sort) {
    return items;
  }

  const direction = sort.direction === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = String((left as Record<string, unknown>)[sort.key] ?? '').toLowerCase();
    const rightValue = String((right as Record<string, unknown>)[sort.key] ?? '').toLowerCase();

    if (leftValue < rightValue) {
      return -1 * direction;
    }

    if (leftValue > rightValue) {
      return 1 * direction;
    }

    return 0;
  });
}

export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const payload = await endpoints.fetchCategories();
  const rows = unwrapListPayload<BackendCategory>(payload, ['rows', 'categories', 'data']);
  return rows.map(normalizeCategory);
}

export async function listProductCategories(
  params: ListProductCategoriesParams = {},
): Promise<ProductCategoryListResult> {
  const {
    page = 1,
    pageSize = 10,
    search = '',
    sort = null,
  } = params;

  const payload = await endpoints.listCategories({
    page,
    pageSize,
    search,
    sortBy: sort?.key ?? '',
    sortDirection: sort?.direction ?? '',
  });

  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const candidate = payload as Record<string, unknown>;

    if (Array.isArray(candidate.rows) && typeof candidate.count === 'number') {
      return {
        rows: (candidate.rows as BackendCategory[]).map(normalizeCategory),
        total: candidate.count,
      };
    }

    if (Array.isArray(candidate.data) && typeof candidate.total === 'number') {
      return {
        rows: (candidate.data as BackendCategory[]).map(normalizeCategory),
        total: candidate.total,
      };
    }
  }

  const normalizedCategories = unwrapListPayload<BackendCategory>(payload, ['rows', 'categories', 'data']).map(normalizeCategory);
  const normalizedSearch = search.trim().toLowerCase();
  const filteredCategories = normalizedSearch
    ? normalizedCategories.filter((category) => (
      category.name.toLowerCase().includes(normalizedSearch)
      || String(category.description ?? '').toLowerCase().includes(normalizedSearch)
    ))
    : normalizedCategories;
  const sortedCategories = sortCategories(filteredCategories, sort);
  const start = (page - 1) * pageSize;

  return {
    rows: sortedCategories.slice(start, start + pageSize),
    total: sortedCategories.length,
  };
}

export async function createProductCategory(input: UpsertProductCategoryInput) {
  return endpoints.createCategory({
    name: input.name,
    description: input.description,
    icon: input.icon,
    icon_name: input.icon,
  });
}

export async function updateProductCategory(categoryId: string, input: UpsertProductCategoryInput) {
  return endpoints.updateCategory(categoryId, {
    id: categoryId,
    categoryId,
    name: input.name,
    description: input.description,
    icon: input.icon,
    icon_name: input.icon,
  });
}

export async function deleteProductCategory(categoryId: string) {
  return endpoints.deleteCategory(categoryId);
}

export async function fetchProducts(): Promise<ProductItem[]> {
  const payload = await endpoints.fetchProducts();
  const rows = unwrapListPayload<BackendProduct>(payload, ['rows', 'products', 'data']);
  return rows.map(normalizeProduct);
}

export async function createProduct(input: CreateProductInput) {
  return endpoints.createProduct({
    name: input.name,
    description: input.description,
    price: input.price,
    categoryIds: input.categoryIds,
    category_ids: input.categoryIds,
  });
}

export async function updateProduct(productId: string, input: UpdateProductInput) {
  return endpoints.updateProduct(productId, {
    id: productId,
    productId,
    name: input.name,
    description: input.description,
    price: input.price,
    categoryIds: input.categoryIds,
    category_ids: input.categoryIds,
  });
}

export async function deleteProduct(productId: string) {
  return endpoints.deleteProduct(productId);
}
