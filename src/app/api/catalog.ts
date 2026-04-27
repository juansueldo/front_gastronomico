/**
 * API de Catálogo - Products y Categories endpoints
 */

import { endpoints } from './endpoints';

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  icon_name?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  categoryIds?: string[];
  category_ids?: string[];
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  icon?: string;
  icon_name?: string;
}

export interface CreateProductRequest {
  name: string;
  description?: string;
  price: number;
  categoryIds?: string[];
  category_ids?: string[];
}

/**
 * Obtiene todas las categorías
 */
export async function fetchProductCategories(): Promise<ProductCategory[]> {
  const data: any = await endpoints.fetchCategories();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.categories)) return data.categories;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Obtiene una categoría específica
 */
export async function getCategory(categoryId: string): Promise<ProductCategory> {
  return endpoints.getCategory(categoryId);
}

/**
 * Crea una nueva categoría
 */
export async function createCategory(categoryData: CreateCategoryRequest): Promise<any> {
  return endpoints.createCategory(categoryData);
}

/**
 * Actualiza una categoría
 */
export async function updateCategory(categoryId: string, data: CreateCategoryRequest): Promise<any> {
  return endpoints.updateCategory(categoryId, {
    id: categoryId,
    ...data,
  });
}

/**
 * Elimina una categoría
 */
export async function deleteCategory(categoryId: string): Promise<any> {
  return endpoints.deleteCategory(categoryId);
}

/**
 * Obtiene todos los productos
 */
export async function fetchProducts(): Promise<ProductItem[]> {
  const data: any = await endpoints.fetchProducts();
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.products)) return data.products;
  if (data && Array.isArray(data.data)) return data.data;
  return [];
}

/**
 * Obtiene un producto específico
 */
export async function getProduct(productId: string): Promise<ProductItem> {
  return endpoints.getProduct(productId);
}

/**
 * Crea un nuevo producto
 */
export async function createProduct(productData: CreateProductRequest): Promise<any> {
  return endpoints.createProduct(productData);
}

/**
 * Actualiza un producto
 */
export async function updateProduct(productId: string, data: CreateProductRequest): Promise<any> {
  return endpoints.updateProduct(productId, {
    id: productId,
    ...data,
  });
}

/**
 * Elimina un producto
 */
export async function deleteProduct(productId: string): Promise<any> {
  return endpoints.deleteProduct(productId);
}
