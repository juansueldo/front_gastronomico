/**
 * Manejo centralizado de errores de API
 */

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static fromResponse(status: number, data: any): ApiError {
    const message = data?.error || data?.detail || data?.message || 'Request failed';
    const code = data?.code || `HTTP_${status}`;
    return new ApiError(code, status, message, data?.details);
  }

  static unauthorized(): ApiError {
    return new ApiError('UNAUTHORIZED', 401, 'Tu sesión expiró. Inicia sesión nuevamente');
  }

  static networkError(): ApiError {
    return new ApiError('NETWORK_ERROR', 0, 'No se pudo conectar al servidor');
  }

  static notFound(resource: string): ApiError {
    return new ApiError('NOT_FOUND', 404, `${resource} no encontrado`);
  }

  isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  isNetworkError(): boolean {
    return this.statusCode === 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function assertOk(response: Response, data?: any): void {
  if (!response.ok) {
    throw ApiError.fromResponse(response.status, data);
  }
}
