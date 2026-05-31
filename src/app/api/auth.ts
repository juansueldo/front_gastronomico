/**
 * API de Autenticación - Auth endpoints
 */

import { endpoints } from './endpoints';
import type { ApiResponse } from '../core/http/types';
import type { AuthUser } from '../core/storage/authStorage';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  token?: string;
  user?: AuthUser;
  refreshToken?: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
  firstname: string;
  lastname: string;
  storename: string;
  slug: string;
  timezone?: string;
  location?: string;
}

/**
 * Inicia sesión con credenciales
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  return endpoints.login(credentials);
}

export async function logout(): Promise<void> {
  await endpoints.logout();
}

/**
 * Registra un nuevo usuario
 */
export async function register(data: RegisterRequest): Promise<ApiResponse> {
  return endpoints.register(data);
}

/**
 * Valida el token actual
 */
export async function validateToken(): Promise<AuthUser> {
  return endpoints.validateToken();
}
