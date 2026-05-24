import type { NotificationDto } from '../types/notifications.dto';
import type { NotificationItem } from '../types/notifications.model';

function buildDescription(item: NotificationDto): string {
  const direct = item.body ?? item.description ?? item.message ?? item.content;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();

  const payload = item.payload ?? item.data;
  if (!payload) return '';

  const content = payload.content;
  if (typeof content === 'string' && content.trim()) return content.trim();

  const status = payload.status;
  if (typeof status === 'string' && status.trim()) return `Estado: ${status.trim()}`;

  return '';
}

function normalizeReceivedAt(item: NotificationDto): string {
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
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  return new Date().toISOString();
}

export function mapNotificationDtoToModel(item: NotificationDto, index = 0): NotificationItem {
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

export const normalizeNotificationId = (value: string | number) => String(value).trim();
