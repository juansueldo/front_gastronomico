/**
 * Tipos comunes para todas las llamadas a la API
 */

export interface ApiResponse<T = any> {
  ok?: boolean;
  data?: T;
  error?: string | null;
  detail?: string | null;
  message?: string | null;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export interface RequestConfig {
  isPublic?: boolean;
  timeout?: number;
  retry?: number;
  cache?: 'short' | 'long' | 'none';
  preserveEnvelope?: boolean;
}

// Versión de API estándar
export const API_VERSION = '/v1';

// Tiempos de cache (en ms)
export const CACHE_TIMES = {
  short: 5 * 60 * 1000, // 5 minutos
  long: 30 * 60 * 1000, // 30 minutos
};

// Headers comunes
export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
} as const;
