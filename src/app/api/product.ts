/**
 * API de Productos - Product endpoints
 */

import { apiClient } from '../core/http/client';
import { API_VERSION } from '../core/http/types';

export interface ProductItem {
  id: string;
  name: string;
  description?: string;
  image?: string;
  image_url?: string;
  imageUrl?: string;
  categoryId: string;
  price: number;
  type?: 'simple' | 'recipe' | string;
  usesRecipe?: boolean;
  categoryIds?: string[];
  category_ids?: string[];
}

export interface ListProductsRequest {
  query?: string;
  active?: boolean;
  categoryId?: string;
  page?: number;
  limit?: number;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  image?: string;
  categoryId?: string;
  categoryIds?: string[];
  category_ids?: string[];
  active?: boolean;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  image?: string;
  categoryId?: string;
  categoryIds?: string[];
  category_ids?: string[];
  active?: boolean;
}

export interface RecipeIngredient {
  id?: string;
  inventoryItemId?: number | string;
  name: string;
  quantity: number;
  unit: string;
}

export interface ProductRecipeConfig {
  productId: string;
  usesRecipe: boolean;
  ingredients: RecipeIngredient[];
  updatedAt?: string;
}

export interface ProductIngredientOption {
  id?: string;
  productId?: string;
  inventoryItemId: number;
  name: string;
  unit?: string;
  isRemovable: boolean;
  isAddable: boolean;
  defaultIncluded: boolean;
  extraPrice: number;
  extraQuantity: number;
  maxExtraQuantity: number;
}

export interface ProductStockBalance {
  productId: string;
  currentStock: number;
  minStock: number;
  updatedAt?: string;
}

export interface SaveProductRecipeRequest {
  productId: string;
  usesRecipe: boolean;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
}

export interface ConsumeProductRecipeRequest {
  productId: string;
  quantity: number;
}

export interface UpsertIngredientStockRequest {
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
}

export interface CreateIngredientRequest {
  name: string;
  unit: string;
  currentStock?: number;
  minStock?: number;
}

export interface UpsertProductStockRequest {
  productId: string;
  currentStock: number;
  minStock: number;
}

export interface ConsumeProductStockRequest {
  productId: string;
  quantity: number;
}

export interface ConsumeOrderInventoryRequest {
  items: Array<{
    productId: string;
    quantity: number;
  }>;
}

export interface IngredientStockBalance {
  key: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
}

export interface IngredientCatalogItem {
  key: string;
  name: string;
  unit: string;
  currentStock?: number;
  minStock?: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Lista productos (endpoint principal GET /product)
 */
export async function listProducts(params?: ListProductsRequest): Promise<ProductItem[]> {
  const data = await apiClient.get(`${API_VERSION}/product`, {
    params,
    config: { cache: 'none' },
  });

  return Array.isArray(data) ? data : data?.products ?? data?.data ?? [];
}

/**
 * Lista productos (alias legacy GET /product/list)
 */
export async function listProductsLegacy(params?: ListProductsRequest): Promise<ProductItem[]> {
  const data = await apiClient.get(`${API_VERSION}/product`, {
    params,
    config: { cache: 'none' },
  });

  return Array.isArray(data) ? data : data?.products ?? data?.data ?? [];
}

/**
 * Crea un producto
 */
export async function createProduct(payload: CreateProductRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product`, payload);
}

/**
 * Actualiza un producto
 */
export async function updateProduct(productId: string, payload: UpdateProductRequest): Promise<any> {
  return apiClient.patch(`${API_VERSION}/product/${productId}`, {
    id: productId,
    ...payload,
  });
}

/**
 * Elimina un producto
 */
export async function deleteProduct(productId: string): Promise<any> {
  return apiClient.delete(`${API_VERSION}/product/${productId}`);
}

/**
 * Guarda (crea/actualiza) receta de producto
 */
export async function saveProductRecipe(payload: SaveProductRecipeRequest): Promise<ProductRecipeConfig> {
  return apiClient.post(`${API_VERSION}/product/recipe/save`, payload);
}

/**
 * Obtiene receta de un producto
 */
export async function getProductRecipe(productId: string): Promise<ProductRecipeConfig | null> {
  const data = await apiClient.get(`${API_VERSION}/product/recipe`, {
    params: { productId },
    config: { cache: 'short' },
  });

  if (!data) {
    return null;
  }

  const recipe = data?.recipe ?? data?.data ?? data;
  return recipe ?? null;
}

/**
 * Lista recetas de productos
 */
export async function listProductRecipes(): Promise<ProductRecipeConfig[]> {
  const data = await apiClient.get(`${API_VERSION}/product/recipe/list`, {
    config: { cache: 'none' },
  });

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.recipes)
          ? data.recipes
          : Array.isArray(data?.data)
            ? data.data
            : [];

  return rows.map((row: any) => ({
    productId: String(row?.productId ?? row?.product_id ?? ''),
    usesRecipe: Boolean(row?.usesRecipe),
    ingredients: Array.isArray(row?.ingredients)
      ? row.ingredients.map((ingredient: any) => ({
          id: String(ingredient?.id ?? ''),
          inventoryItemId: ingredient?.inventoryItemId ?? ingredient?.inventory_item_id,
          name: String(ingredient?.name ?? ''),
          quantity: Number(ingredient?.quantity ?? 0),
          unit: String(ingredient?.unit ?? 'unidad'),
        }))
      : [],
    updatedAt: row?.updatedAt,
  })).filter((row: ProductRecipeConfig) => row.productId.length > 0);
}

/**
 * Consume receta para descontar ingredientes
 */
export async function consumeProductRecipe(payload: ConsumeProductRecipeRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/recipe/consume`, payload);
}

export async function saveProductIngredientOptions(payload: {
  productId: string;
  options: ProductIngredientOption[];
}): Promise<{ productId: string; options: ProductIngredientOption[] }> {
  return apiClient.post(`${API_VERSION}/product/ingredient-options/save`, payload);
}

export async function getProductIngredientOptions(productId: string): Promise<ProductIngredientOption[]> {
  const data = await apiClient.get(`${API_VERSION}/product/ingredient-options`, {
    params: { productId },
    config: { cache: 'none' },
  });
  const rows = Array.isArray(data) ? data : data?.options ?? data?.data ?? [];
  return rows.map((row: any) => ({
    id: row?.id ? String(row.id) : undefined,
    productId: row?.productId ? String(row.productId) : undefined,
    inventoryItemId: Number(row?.inventoryItemId ?? row?.inventory_item_id),
    name: String(row?.name ?? ''),
    unit: String(row?.unit ?? 'unidad'),
    isRemovable: row?.isRemovable ?? row?.is_removable ?? true,
    isAddable: row?.isAddable ?? row?.is_addable ?? false,
    defaultIncluded: row?.defaultIncluded ?? row?.default_included ?? true,
    extraPrice: Number(row?.extraPrice ?? row?.extra_price ?? 0),
    extraQuantity: Number(row?.extraQuantity ?? row?.extra_quantity ?? 1),
    maxExtraQuantity: Number(row?.maxExtraQuantity ?? row?.max_extra_quantity ?? 1),
  })).filter((row: ProductIngredientOption) => Number.isFinite(row.inventoryItemId));
}

export async function listProductIngredientOptions(params?: { productId?: string }): Promise<ProductIngredientOption[]> {
  const data = await apiClient.get(`${API_VERSION}/product/ingredient-options/list`, {
    params,
    config: { cache: 'none' },
  });
  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.options)
      ? data.options
      : Array.isArray(data?.data)
        ? data.data
        : [];

  return rows.map((row: any) => ({
    id: row?.id ? String(row.id) : undefined,
    productId: row?.productId ? String(row.productId) : undefined,
    inventoryItemId: Number(row?.inventoryItemId ?? row?.inventory_item_id),
    name: String(row?.name ?? ''),
    unit: String(row?.unit ?? 'unidad'),
    isRemovable: row?.isRemovable ?? row?.is_removable ?? true,
    isAddable: row?.isAddable ?? row?.is_addable ?? false,
    defaultIncluded: row?.defaultIncluded ?? row?.default_included ?? true,
    extraPrice: Number(row?.extraPrice ?? row?.extra_price ?? 0),
    extraQuantity: Number(row?.extraQuantity ?? row?.extra_quantity ?? 1),
    maxExtraQuantity: Number(row?.maxExtraQuantity ?? row?.max_extra_quantity ?? 1),
  })).filter((row: ProductIngredientOption) => Number.isFinite(row.inventoryItemId));
}

/**
 * Ajusta stock directo de producto
 */
export async function upsertProductStock(payload: UpsertProductStockRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/stock/upsert`, payload);
}

/**
 * Lista stock directo por producto
 */
export async function listProductStock(): Promise<ProductStockBalance[]> {
  const data = await apiClient.get(`${API_VERSION}/product/stock`, {
    config: { cache: 'short' },
  });

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.stock)
          ? data.stock
          : Array.isArray(data?.data)
            ? data.data
            : [];

  return rows.map((row: any) => ({
    productId: String(row?.productId ?? row?.product_id ?? ''),
    currentStock: Number(row?.currentStock ?? row?.stock ?? row?.quantity ?? 0),
    minStock: Number(row?.minStock ?? row?.minimumStock ?? 0),
    updatedAt: row?.updatedAt,
  })).filter((row: ProductStockBalance) => row.productId.length > 0);
}

/**
 * Consume stock directo de producto
 */
export async function consumeProductStock(payload: ConsumeProductStockRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/stock/consume`, payload);
}

/**
 * Consume inventario por orden
 */
export async function consumeOrderInventory(payload: ConsumeOrderInventoryRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/inventory/consume-order`, payload);
}

/**
 * Ajusta stock de ingrediente
 */
export async function upsertIngredientStock(payload: UpsertIngredientStockRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/ingredient/stock/upsert`, payload);
}

/**
 * Crea un ingrediente con stock inicial opcional
 */
export async function createIngredient(payload: CreateIngredientRequest): Promise<IngredientCatalogItem> {
  const data = await apiClient.post(`${API_VERSION}/product/ingredient/create`, payload);
  const row = data?.ingredient ?? data?.data ?? data;

  return {
    key: String(row?.key ?? ''),
    name: String(row?.name ?? payload.name),
    unit: String(row?.unit ?? payload.unit),
    currentStock: Number(row?.currentStock ?? payload.currentStock ?? 0),
    minStock: Number(row?.minStock ?? payload.minStock ?? 0),
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
  };
}

export async function deleteIngredient(ingredientId: string): Promise<any> {
  return apiClient.delete(`${API_VERSION}/product/ingredient/${ingredientId}`);
}

/**
 * Lista catálogo de ingredientes
 */
export async function listIngredients(): Promise<IngredientCatalogItem[]> {
  const data = await apiClient.get(`${API_VERSION}/product/ingredient/list`, {
    config: { cache: 'short' },
  });

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.ingredients)
          ? data.ingredients
          : Array.isArray(data?.data)
            ? data.data
            : [];

  return rows.map((row: any) => ({
    key: String(row?.key ?? ''),
    name: String(row?.name ?? row?.ingredientName ?? row?.ingredient ?? ''),
    unit: String(row?.unit ?? row?.measureUnit ?? 'unidad'),
    currentStock: Number(row?.currentStock ?? row?.stock ?? row?.quantity ?? 0),
    minStock: Number(row?.minStock ?? row?.minimumStock ?? 0),
    createdAt: row?.createdAt,
    updatedAt: row?.updatedAt,
  })).filter((row: IngredientCatalogItem) => row.key.length > 0 || row.name.length > 0);
}

/**
 * Lista stock de ingredientes
 */
export async function listIngredientStock(): Promise<IngredientStockBalance[]> {
  const data = await apiClient.get(`${API_VERSION}/product/ingredient/stock`, {
    config: { cache: 'short' },
  });

  const rows = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.stock)
          ? data.stock
          : Array.isArray(data?.data)
            ? data.data
            : [];

  return rows.map((row: any) => ({
    key: String(row?.key ?? ''),
    name: String(row?.name ?? row?.ingredientName ?? row?.ingredient ?? ''),
    unit: String(row?.unit ?? row?.measureUnit ?? 'unidad'),
    currentStock: Number(row?.currentStock ?? row?.stock ?? row?.quantity ?? 0),
    minStock: Number(row?.minStock ?? row?.minimumStock ?? 0),
  }));
}
