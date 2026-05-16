/**
 * Cliente HTTP centralizado para todas las llamadas a la API
 * Maneja autenticación, caché, deduplicación de requests, y errores
 */

import { expireAuthSession, getAuthSession } from '../authStorage';
import { ApiError, assertOk } from './errors';
import { API_VERSION, CACHE_TIMES, COMMON_HEADERS, type RequestConfig } from './types';

interface CacheEntry {
  data: any;
  timestamp: number;
}

export class ApiClient {
  private baseUrl: string;
  private tokenGetter: () => string | undefined;
  private requestCache = new Map<string, CacheEntry>();
  private pendingRequests = new Map<string, Promise<any>>();
  private defaultTimeout = 30000; // 30 segundos

  constructor(
    baseUrl: string,
    tokenGetter?: () => string | undefined
  ) {
    this.baseUrl = baseUrl?.replace(/\/$/, '') || '';
    this.tokenGetter = tokenGetter || (() => getAuthSession()?.accessToken);
  }

  /**
   * Construye la URL completa con parámetros query
   */
  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${cleanPath}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    
    return url.toString();
  }

  /**
   * Construye headers con autenticación
   */
  private buildHeaders(isPublic?: boolean): Record<string, string> {
    const headers: Record<string, string> = { ...COMMON_HEADERS };
    
    if (!isPublic) {
      const token = this.tokenGetter();
      if (!token) {
        expireAuthSession();
        throw ApiError.unauthorized();
      }
      headers.Authorization = `Bearer ${token}`;
    }
    
    return headers;
  }

  /**
   * Obtiene datos del caché si están disponibles y válidos
   */
  private getCachedData(key: string, cacheType?: 'short' | 'long' | 'none'): any {
    if (cacheType === 'none') return null;
    
    const entry = this.requestCache.get(key);
    if (!entry) return null;
    
    const cacheDuration = cacheType === 'long' ? CACHE_TIMES.long : CACHE_TIMES.short;
    const isExpired = Date.now() - entry.timestamp > cacheDuration;
    
    if (isExpired) {
      this.requestCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Almacena datos en caché
   */
  private setCachedData(key: string, data: any): void {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Limpia el caché (útil después de operaciones mutativas)
   */
  clearCache(): void {
    this.requestCache.clear();
  }

  /**
   * Ejecuta la solicitud HTTP
   */
  private async _executeRequest<T = any>(
    method: string,
    url: string,
    body?: any,
    config?: RequestConfig
  ): Promise<T> {
    const headers = this.buildHeaders(config?.isPublic);
    const timeout = config?.timeout || this.defaultTimeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => null);
      assertOk(response, data);
      
      // Retorna data si existe, sino el objeto completo
      return (data?.data ?? data) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw ApiError.networkError();
      }
      if (error instanceof ApiError) {
        if (error.isUnauthorized()) {
          expireAuthSession();
        }
        throw error;
      }
      throw ApiError.networkError();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Realiza una solicitud HTTP genérica con deduplicación y caché
   */
  async request<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    options?: {
      body?: any;
      params?: Record<string, string | number | boolean>;
      config?: RequestConfig;
    }
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const cacheKey = `${method}:${url}`;
    
    // Verifica caché para GET requests
    if (method === 'GET' && options?.config?.cache !== 'none') {
      const cached = this.getCachedData(cacheKey, options?.config?.cache);
      if (cached !== null) return cached as T;
    }
    
    // Evita requests duplicados (request deduplication)
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey)!;
    }
    
    const requestPromise = this._executeRequest<T>(
      method,
      url,
      options?.body,
      options?.config
    );
    
    this.pendingRequests.set(cacheKey, requestPromise);
    
    try {
      const result = await requestPromise;
      
      // Cachea GET responses exitosos
      if (method === 'GET' && options?.config?.cache !== 'none') {
        this.setCachedData(cacheKey, result);
      }
      
      return result;
    } finally {
      this.pendingRequests.delete(cacheKey);
    }
  }

  /**
   * GET request
   */
  get<T = any>(
    path: string,
    options?: Omit<Parameters<typeof this.request>[2], 'body'>
  ): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  /**
   * POST request
   */
  post<T = any>(
    path: string,
    body?: any,
    options?: Omit<Parameters<typeof this.request>[2], 'body'>
  ): Promise<T> {
    // Limpia caché después de POST
    this.clearCache();
    return this.request<T>('POST', path, { body, ...options });
  }

  /**
   * PUT request
   */
  put<T = any>(
    path: string,
    body?: any,
    options?: Omit<Parameters<typeof this.request>[2], 'body'>
  ): Promise<T> {
    // Limpia caché después de PUT
    this.clearCache();
    return this.request<T>('PUT', path, { body, ...options });
  }

  /**
   * DELETE request
   */
  delete<T = any>(
    path: string,
    options?: Omit<Parameters<typeof this.request>[2], 'body'>
  ): Promise<T> {
    // Limpia caché después de DELETE
    this.clearCache();
    return this.request<T>('DELETE', path, options);
  }

  /**
   * PATCH request
   */
  patch<T = any>(
    path: string,
    body?: any,
    options?: Omit<Parameters<typeof this.request>[2], 'body'>
  ): Promise<T> {
    // Limpia caché después de PATCH
    this.clearCache();
    return this.request<T>('PATCH', path, { body, ...options });
  }
}

/**
 * Instancia global del cliente con la URL base del ambiente
 */
const ENV_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
const SHOULD_USE_DEV_PROXY = (
  (import.meta as any).env?.DEV
  && typeof window !== 'undefined'
  && /^https?:\/\/localhost:3000\/?$/.test(ENV_BASE_URL)
  && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
);
const BASE_URL = SHOULD_USE_DEV_PROXY ? window.location.origin : ENV_BASE_URL;
export const apiClient = new ApiClient(BASE_URL);
