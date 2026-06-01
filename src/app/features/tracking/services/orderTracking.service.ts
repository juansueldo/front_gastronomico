import { io, type Socket } from 'socket.io-client';
import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';

const ENV_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3000';
const SHOULD_USE_DEV_PROXY = (
  (import.meta as any).env?.DEV
  && typeof window !== 'undefined'
  && /^https?:\/\/localhost:3000\/?$/.test(ENV_BASE_URL)
  && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
);
export const TRACKING_API_BASE_URL = SHOULD_USE_DEV_PROXY && typeof window !== 'undefined'
  ? window.location.origin
  : ENV_BASE_URL.replace(/\/$/, '');

export interface PublicOrderTracking {
  token: string;
  expiresAt?: string | null;
  isFinal?: boolean;
  order: {
    number: string;
    status: string;
    statusLabel: string;
    totalAmount?: number;
    deliveryAddress?: string | null;
    destination?: {
      latitude?: number | null;
      longitude?: number | null;
    } | null;
    createdAt?: string | null;
    deliveryDate?: string | null;
  };
  store?: {
    name?: string;
    slug?: string;
  } | null;
  customer?: {
    name?: string;
  } | null;
  deliveryZone?: {
    name?: string;
  } | null;
  route?: {
    status?: string;
    statusLabel?: string | null;
    sequence?: number | null;
    startedAt?: string | null;
    completedAt?: string | null;
  } | null;
  driver?: {
    name?: string;
    vehicleType?: string;
    plate?: string | null;
  } | null;
  driverLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    lastLocationAt?: string | null;
    isFresh?: boolean;
  } | null;
}

export async function getPublicOrderTracking(token: string): Promise<PublicOrderTracking> {
  return apiClient.get(`${API_VERSION}/order-tracking/${encodeURIComponent(token)}`, {
    config: { isPublic: true, cache: 'none' },
  }) as Promise<PublicOrderTracking>;
}

export function createTrackingSocket(token: string): Socket {
  return io(`${TRACKING_API_BASE_URL}/tracking`, {
    auth: { token },
    transports: ['polling', 'websocket'],
  });
}
