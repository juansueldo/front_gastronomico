/**
 * Exporta centralizadamente todas las funciones de API
 * Usar: import { login, fetchProducts, createOrder } from '../api'
 */

// Cliente base
export { apiClient, ApiClient } from './client';

// Errores y tipos
export { ApiError, assertOk, isApiError } from './errors';
export type { ApiResponse, PaginatedResponse, RequestConfig } from './types';

// Auth API
export * from './auth';

// Messages API
export * from './messages';

// Connections API
export * from './connections';

// Orders API
export * from './orders';

// Cash API
export * from './cash';

// Catalog API (Products & Categories)
export * from './catalog';

// Product API (new module based on /product endpoints)
export * as productApi from './product';

// Tables API
export * from './tables';

// Slugs API
export * from './slugs';

// Storefront API
export * from './storefront';

// Contacts API
export * from './contacts';

// Notifications API
export * from './notifications';

// OAuth Integrations API
export * from './oauth';

// Delivery Zone API
export * from './delivery-zone';

// Users API
export * from './user';

// Agent Config API
export * from './agent-config';

// Endpoints map (legacy centralized object)
export * from './endpoints';
