import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import { mapNotificationDtoToModel, normalizeNotificationId } from '../mappers/notifications.mapper';
import type { CreateNotificationRequest, NotificationDto } from '../types/notifications.dto';
import type { ListNotificationsParams, NotificationItem } from '../types/notifications.model';

function extractNotificationRows(payload: unknown): NotificationDto[] {
  if (Array.isArray(payload)) return payload as NotificationDto[];
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as Record<string, unknown>;
  const rows = candidate.rows ?? candidate.notifications ?? candidate.items ?? candidate.data;
  return Array.isArray(rows) ? rows as NotificationDto[] : [];
}

export async function createNotification(payload: CreateNotificationRequest): Promise<NotificationItem> {
  const data = await apiClient.post(`${API_VERSION}/notifications`, payload);
  return mapNotificationDtoToModel((data ?? {}) as NotificationDto);
}

export async function listNotifications(
  limitOrParams?: number | ListNotificationsParams,
  offset?: number,
): Promise<NotificationItem[]> {
  const params = typeof limitOrParams === 'object'
    ? limitOrParams
    : { limit: limitOrParams, offset };

  const data = await apiClient.get(`${API_VERSION}/notifications`, {
    params: {
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.offset !== undefined ? { offset: params.offset } : {}),
    },
    config: { cache: 'none' },
  });

  return extractNotificationRows(data).map((item, index) => mapNotificationDtoToModel(item, index));
}

export async function markNotificationAsRead(id: string | number): Promise<void> {
  const normalizedId = normalizeNotificationId(id);
  if (!normalizedId) throw new Error('id de notificacion invalido');

  await apiClient.post(`${API_VERSION}/notifications/${encodeURIComponent(normalizedId)}/read`, undefined, {
    params: { id: normalizedId },
  });
}

export async function markAllNotificationsAsRead(): Promise<void> {
  await apiClient.post(`${API_VERSION}/notifications/read-all`, {});
}

export type { CreateNotificationRequest, ListNotificationsParams, NotificationItem };
