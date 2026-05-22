/**
 * API de Notificaciones
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface CreateNotificationRequest {
  type?: string;
  title?: string;
  body?: string;
  source?: string;
  payload?: Record<string, unknown>;
  createdAt?: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  receivedAt: string;
  read: boolean;
}

type RawNotification = {
  id?: string | number;
  customer_id?: number;
  type?: string;
  title?: string;
  body?: string;
  description?: string;
  message?: string;
  content?: string;
  source?: string;
  receivedAt?: string;
  received_at?: string | number;
  read_at?: string | number | null;
  readAt?: string | number | null;
  createdAt?: string | number;
  created_at?: string | number;
  read?: boolean;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

function buildDescription(item: RawNotification): string {
  const direct = item.body ?? item.description ?? item.message ?? item.content;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const payload = item.payload ?? item.data;
  if (!payload) {
    return '';
  }

  const content = payload.content;
  if (typeof content === 'string' && content.trim()) {
    return content.trim();
  }

  const status = payload.status;
  if (typeof status === 'string' && status.trim()) {
    return `Estado: ${status.trim()}`;
  }

  return '';
}

function normalizeReceivedAt(item: RawNotification): string {
  const raw = item.receivedAt ?? item.received_at ?? item.createdAt ?? item.created_at;

  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    const millis = raw > 1_000_000_000_000 ? raw : raw * 1000;
    return new Date(millis).toISOString();
  }

  if (typeof raw === 'string' && raw.trim()) {
    const maybeEpoch = Number(raw);
    if (Number.isFinite(maybeEpoch) && maybeEpoch > 0) {
      const millis = maybeEpoch > 1_000_000_000_000 ? maybeEpoch : maybeEpoch * 1000;
      return new Date(millis).toISOString();
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeNotification(item: RawNotification, index: number): NotificationItem {
  const isRead =
    item.read === true ||
    (typeof item.read_at === 'string' && item.read_at.trim().length > 0) ||
    (typeof item.read_at === 'number' && Number.isFinite(item.read_at) && item.read_at > 0) ||
    (typeof item.readAt === 'string' && item.readAt.trim().length > 0) ||
    (typeof item.readAt === 'number' && Number.isFinite(item.readAt) && item.readAt > 0);

  return {
    id: String(item.id ?? `notification-${Date.now()}-${index}`),
    title: String(item.title ?? 'Notificacion'),
    description: buildDescription(item),
    receivedAt: normalizeReceivedAt(item),
    read: isRead,
  };
}

export async function createNotification(payload: CreateNotificationRequest): Promise<NotificationItem> {
  const data = await apiClient.post(`${API_VERSION}/notifications`, payload);
  return normalizeNotification((data ?? {}) as RawNotification, 0);
}

export async function listNotifications(limit?: number, offset?: number): Promise<NotificationItem[]> {
  const data = await apiClient.get(`${API_VERSION}/notifications`, {
    params: {
      ...(limit !== undefined ? { limit } : {}),
      ...(offset !== undefined ? { offset } : {}),
    },
    config: { cache: 'none' },
  });

  const source: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data?.notifications)
    ? data.notifications
    : Array.isArray(data?.items)
    ? data.items
    : Array.isArray(data?.data)
    ? data.data
    : [];

  return source.map((item: unknown, index: number) => normalizeNotification((item ?? {}) as RawNotification, index));
}

export async function markNotificationAsRead(id: string | number): Promise<void> {
  const normalizedId = String(id).trim();
  if (!normalizedId) {
    throw new Error('id de notificacion invalido');
  }

  // El backend expone /:id/read. En algunos controladores legacy se lee id por query param.
  await apiClient.post(`${API_VERSION}/notifications/${encodeURIComponent(normalizedId)}/read`, undefined, {
    params: { id: normalizedId },
  });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.post(`${API_VERSION}/notifications/read-all`, {});
}
