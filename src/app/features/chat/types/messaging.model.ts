export interface MessagingAccount {
  id?: string;
  instanceId?: string;
  provider?: string;
  status?: string;
  phone?: string | null;
  displayName?: string | null;
  qrCode?: string | null;
  instance?: {
    id?: string;
    name?: string;
    phone?: string | null;
    connection?: number;
  };
}

export interface MessagingConversation {
  id: string;
  customerId?: string;
  contactId?: string;
  channel: string;
  externalChatId?: string;
  status?: string;
  unreadCount: number;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  customer?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
  };
  contact?: {
    id?: string;
    identifier?: string;
    type?: string;
  };
}

export interface MessagingMessage {
  id: string;
  conversationId?: string;
  direction?: 'inbound' | 'outbound';
  type?: string;
  body: string;
  mediaUrl?: string | null;
  mediaMime?: string | null;
  mediaFilename?: string | null;
  mediaSize?: number | null;
  status?: string;
  createdAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  providerMessageId?: string;
}

export interface PaginatedMessagingResult<T> {
  rows: T[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
