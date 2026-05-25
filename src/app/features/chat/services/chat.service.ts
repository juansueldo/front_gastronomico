import {
  getCurrentMessagingAccount,
  listConversationMessages,
  listMessagingConversations,
  sendConversationMessage,
  sendDirectWhatsappMessage,
  type MessagingConversation,
  type MessagingMessage,
} from './messaging.service';

export interface ContactItem {
  id: number | string;
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  label?: number;
  last_message?: string | null;
  last_message_date?: string | null;
  instance_id?: number | string;
  instance_description?: string;
  network?: string;
}

export interface CreateContactRequest {
  instance_id?: number;
  phone: string;
  name: string;
  seat_id?: number;
  message?: string;
}

export interface ContactResponse {
  id?: number | string;
  contactId?: number | string;
  contact?: {
    id?: number | string;
  };
  conversation?: MessagingConversation;
  [key: string]: unknown;
}

export interface SendMessageRequest {
  contactId: number | string;
  contact_id?: number | string;
  content?: string;
  media?: {
    data?: string;
    mediaData?: string;
    mediaUrl?: string;
    mediaMime?: string;
    mediaFilename?: string;
    caption?: string;
  };
  [key: string]: unknown;
}

export interface ConnectionItem {
  id: number | string;
  description?: string;
  phone?: string;
  network?: string | number;
  network_name?: string;
  instanceId?: string | number;
}

function mapConversationStatusToLegacyLabel(status?: string): number {
  const normalized = String(status ?? '').toLowerCase();
  if (normalized === 'assigned' || normalized === 'open') return 2;
  if (normalized === 'starred') return 3;
  if (normalized === 'closed') return 4;
  if (normalized === 'deleted') return 5;
  return 1;
}

function normalizePhone(value?: string) {
  return String(value ?? '').replace(/@c\.us$/i, '').trim();
}

function mapConversationToContact(conversation: MessagingConversation): ContactItem {
  const customerName = conversation.customer?.name?.trim();
  const customerPhone = normalizePhone(conversation.customer?.phone);
  const contactIdentifier = normalizePhone(conversation.contact?.identifier);

  return {
    id: conversation.id,
    name: customerName || customerPhone || contactIdentifier || `Conversacion ${conversation.id}`,
    phone: customerPhone || contactIdentifier,
    avatarUrl: conversation.customer?.profileImageUrl ?? null,
    avatar_url: conversation.customer?.profileImageUrl ?? null,
    label: mapConversationStatusToLegacyLabel(conversation.status),
    last_message: conversation.lastMessagePreview ?? 'Sin mensajes',
    last_message_date: conversation.lastMessageAt ?? null,
    instance_description: conversation.channel ?? 'whatsapp',
    network: conversation.channel ?? 'whatsapp',
  };
}

function mapMessagingMessageToLegacyMessage(message: MessagingMessage, conversationId: string | number) {
  const createdAt = message.createdAt ?? message.sentAt ?? new Date().toISOString();
  const ack = message.status === 'read' ? 3 : message.status === 'delivered' ? 2 : message.status === 'sent' ? 1 : undefined;

  return {
    id: message.id,
    msg_id: message.providerMessageId ?? message.id,
    contact_id: conversationId,
    direction: message.direction === 'outbound' ? 'o' : 'i',
    content: message.body,
    message: message.body,
    text: message.body,
    mediaUrl: message.mediaUrl,
    media_url: message.mediaUrl,
    media_mime: message.mediaMime,
    mediaMime: message.mediaMime,
    media_filename: message.mediaFilename,
    mediaFilename: message.mediaFilename,
    media_size: message.mediaSize,
    mediaSize: message.mediaSize,
    created_at: createdAt,
    timestamp: createdAt,
    type: message.type === 'text' ? 1 : undefined,
    ack,
    status: message.status,
  };
}

export async function listInstances(): Promise<ConnectionItem[]> {
  const account = await getCurrentMessagingAccount();
  if (!account) return [];

  return [{
    id: account.instanceId ?? account.id ?? 'whatsapp',
    instanceId: account.instanceId ?? account.id,
    description: account.displayName ?? account.instance?.name ?? 'WhatsApp',
    phone: account.phone ?? account.instance?.phone ?? '',
    network: 'whatsapp',
    network_name: 'WhatsApp',
  }];
}

export async function listContacts(): Promise<ContactItem[]> {
  const result = await listMessagingConversations({ page: 1, limit: 100 });
  return result.rows.map(mapConversationToContact);
}

export async function createContact(payload: CreateContactRequest): Promise<ContactResponse> {
  const result = await sendDirectWhatsappMessage({
    phone: payload.phone,
    body: payload.message?.trim() || `Hola ${payload.name}`.trim(),
  });
  const conversationId = result.conversation?.id;

  return {
    id: conversationId,
    contactId: conversationId,
    contact: { id: conversationId },
    conversation: result.conversation,
  };
}

export async function fetchMessages(contactId: string | number) {
  const result = await listConversationMessages(contactId, { page: 1, limit: 100 });
  return result.rows
    .map((message) => mapMessagingMessageToLegacyMessage(message, contactId))
    .reverse();
}

export async function sendMessage(request: SendMessageRequest) {
  const body = String(request.content ?? '').trim();
  if (!body && !request.media) {
    return { ok: true, skipped: true };
  }

  return sendConversationMessage(request.contact_id ?? request.contactId, { body, media: request.media });
}

export async function updateContact(contactId: number | string, payload: Record<string, unknown>): Promise<ContactResponse> {
  return {
    id: contactId,
    contactId,
    contact: { id: contactId },
    ...payload,
  };
}
