/**
 * API de Catálogo - Products y Categories endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

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
  const data = await apiClient.get(`${API_VERSION}/category/list`, {
    config: { cache: 'long' },
  });
  return Array.isArray(data) ? data : data?.categories ?? data?.data ?? [];
}

/**
 * Obtiene una categoría específica
 */
export async function getCategory(categoryId: string): Promise<ProductCategory> {
  return apiClient.get(`${API_VERSION}/category/${categoryId}`);
}

/**
 * Crea una nueva categoría
 */
export async function createCategory(categoryData: CreateCategoryRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/category/create`, categoryData);
}

/**
 * Actualiza una categoría
 */
export async function updateCategory(categoryId: string, data: CreateCategoryRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/category/update/${categoryId}`, {
    id: categoryId,
    ...data,
  });
}

/**
 * Elimina una categoría
 */
export async function deleteCategory(categoryId: string): Promise<any> {
  return apiClient.delete(`${API_VERSION}/category/${categoryId}`);
}

/**
 * Obtiene todos los productos
 */
export async function fetchProducts(): Promise<ProductItem[]> {
  const data = await apiClient.get(`${API_VERSION}/product/list`, {
    config: { cache: 'long' },
  });
  return Array.isArray(data) ? data : data?.products ?? data?.data ?? [];
}

/**
 * Obtiene un producto específico
 */
export async function getProduct(productId: string): Promise<ProductItem> {
  return apiClient.get(`${API_VERSION}/product/${productId}`);
}

/**
 * Crea un nuevo producto
 */
export async function createProduct(productData: CreateProductRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/create`, productData);
}

/**
 * Actualiza un producto
 */
export async function updateProduct(productId: string, data: CreateProductRequest): Promise<any> {
  return apiClient.post(`${API_VERSION}/product/update/${productId}`, {
    id: productId,
    ...data,
  });
}

/**
 * Elimina un producto
 */
export async function deleteProduct(productId: string): Promise<any> {
  return apiClient.delete(`${API_VERSION}/product/${productId}`);
}
