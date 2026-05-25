export type MessagingAccountDto = {
  id?: string | number;
  storeId?: string | number;
  instanceId?: string | number;
  provider?: string;
  status?: string;
  phone?: string | null;
  displayName?: string | null;
  qrCode?: string | null;
  Instance?: {
    id?: string | number;
    name?: string;
    phone?: string | null;
    connection?: number;
  };
};

export type MessagingConversationDto = {
  id?: string | number;
  customerId?: string | number;
  contactId?: string | number;
  channel?: string;
  externalChatId?: string;
  status?: string;
  unreadCount?: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  Customer?: {
    id?: string | number;
    name?: string;
    phone?: string;
    email?: string;
    metadata?: Record<string, unknown> | null;
  };
  Contact?: {
    id?: string | number;
    identifier?: string;
    type?: string;
  };
};

export type MessagingMessageDto = {
  id?: string | number;
  conversationId?: string | number;
  direction?: 'inbound' | 'outbound';
  type?: string;
  body?: string;
  mediaUrl?: string | null;
  media_url?: string | null;
  mediaMime?: string | null;
  media_mime?: string | null;
  mediaFilename?: string | null;
  media_filename?: string | null;
  mediaSize?: number | string | null;
  media_size?: number | string | null;
  rawPayload?: Record<string, unknown> | null;
  status?: string;
  createdAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  providerMessageId?: string;
};

export interface SendConversationMessageRequest {
  body?: string;
  media?: {
    data?: string;
    mediaData?: string;
    mediaUrl?: string;
    mediaMime?: string;
    mediaFilename?: string;
    caption?: string;
  };
}

export interface SendDirectMessageRequest {
  body?: string;
  phone?: string;
  customerId?: string | number;
  media?: SendConversationMessageRequest['media'];
}
