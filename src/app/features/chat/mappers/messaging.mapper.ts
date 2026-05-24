import type { MessagingAccountDto, MessagingConversationDto, MessagingMessageDto } from '../types/messaging.dto';
import type { MessagingAccount, MessagingConversation, MessagingMessage, PaginatedMessagingResult } from '../types/messaging.model';

export function mapMessagingAccountDtoToModel(item: MessagingAccountDto | null | undefined): MessagingAccount | null {
  if (!item) return null;
  return {
    id: item.id !== undefined ? String(item.id) : undefined,
    instanceId: item.instanceId !== undefined ? String(item.instanceId) : undefined,
    provider: item.provider,
    status: item.status,
    phone: item.phone,
    displayName: item.displayName,
    qrCode: item.qrCode,
    instance: item.Instance
      ? {
        id: item.Instance.id !== undefined ? String(item.Instance.id) : undefined,
        name: item.Instance.name,
        phone: item.Instance.phone,
        connection: item.Instance.connection,
      }
      : undefined,
  };
}

export function mapMessagingConversationDtoToModel(item: MessagingConversationDto): MessagingConversation {
  return {
    id: String(item.id ?? `conversation-${Date.now()}-${Math.random()}`),
    customerId: item.customerId !== undefined ? String(item.customerId) : undefined,
    contactId: item.contactId !== undefined ? String(item.contactId) : undefined,
    channel: item.channel ?? 'whatsapp',
    externalChatId: item.externalChatId,
    status: item.status,
    unreadCount: Number(item.unreadCount ?? 0),
    lastMessageAt: item.lastMessageAt,
    lastMessagePreview: item.lastMessagePreview,
    customer: item.Customer
      ? {
        id: item.Customer.id !== undefined ? String(item.Customer.id) : undefined,
        name: item.Customer.name,
        phone: item.Customer.phone,
        email: item.Customer.email,
      }
      : undefined,
    contact: item.Contact
      ? {
        id: item.Contact.id !== undefined ? String(item.Contact.id) : undefined,
        identifier: item.Contact.identifier,
        type: item.Contact.type,
      }
      : undefined,
  };
}

export function mapMessagingMessageDtoToModel(item: MessagingMessageDto): MessagingMessage {
  const rawPayload = item.rawPayload ?? {};
  const mediaSize = Number(item.mediaSize ?? item.media_size ?? rawPayload.mediaSize ?? rawPayload.media_size ?? rawPayload.size);

  return {
    id: String(item.id ?? `message-${Date.now()}-${Math.random()}`),
    conversationId: item.conversationId !== undefined ? String(item.conversationId) : undefined,
    direction: item.direction,
    type: item.type,
    body: item.body ?? '',
    mediaUrl: item.mediaUrl ?? item.media_url ?? (typeof rawPayload.mediaUrl === 'string' ? rawPayload.mediaUrl : typeof rawPayload.media_url === 'string' ? rawPayload.media_url : null),
    mediaMime: item.mediaMime ?? item.media_mime ?? (typeof rawPayload.mediaMime === 'string' ? rawPayload.mediaMime : typeof rawPayload.media_mime === 'string' ? rawPayload.media_mime : typeof rawPayload.mimetype === 'string' ? rawPayload.mimetype : null),
    mediaFilename: item.mediaFilename ?? item.media_filename ?? (typeof rawPayload.mediaFilename === 'string' ? rawPayload.mediaFilename : typeof rawPayload.media_filename === 'string' ? rawPayload.media_filename : typeof rawPayload.filename === 'string' ? rawPayload.filename : null),
    mediaSize: Number.isFinite(mediaSize) ? mediaSize : null,
    status: item.status,
    createdAt: item.createdAt,
    sentAt: item.sentAt,
    deliveredAt: item.deliveredAt,
    readAt: item.readAt,
    providerMessageId: item.providerMessageId,
  };
}

export function mapPaginatedMessagingResult<TDto, TModel>(
  payload: unknown,
  mapper: (item: TDto) => TModel,
): PaginatedMessagingResult<TModel> {
  const candidate = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const rows = Array.isArray(candidate.rows) ? candidate.rows as TDto[] : Array.isArray(payload) ? payload as TDto[] : [];
  const count = Number(candidate.count ?? rows.length);

  return {
    rows: rows.map(mapper),
    total: Number.isFinite(count) ? count : rows.length,
    page: Number(candidate.page) || undefined,
    limit: Number(candidate.limit) || undefined,
    totalPages: Number(candidate.totalPages) || undefined,
  };
}
