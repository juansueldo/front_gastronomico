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
  clientMessageId?: string | number | null;
  client_message_id?: string | number | null;
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
  reactions?: Record<string, string> | string[] | null;
  quotedMessageId?: string | number | null;
  quotedMessageContent?: string | null;
  quotedMsgId?: string | number | null;
  quotedContent?: string | null;
  replyToMessageId?: string | number | null;
  reply_to_message_id?: string | number | null;
  replyToContent?: string | null;
  reply_to_content?: string | null;
};

export interface SendConversationMessageRequest {
  body?: string;
  clientMessageId?: string;
  client_message_id?: string;
  media?: {
    data?: string;
    mediaData?: string;
    mediaUrl?: string;
    mediaMime?: string;
    mediaFilename?: string;
    caption?: string;
  };
  replyToMessageId?: string | number;
  reply_to_message_id?: string | number;
  replyToContent?: string;
  reply_to_content?: string;
  quoted_msg_id?: string | number;
  quoted_content?: string;
}

export interface SendDirectMessageRequest {
  body?: string;
  phone?: string;
  customerId?: string | number;
  media?: SendConversationMessageRequest['media'];
}

export interface ReactMessageRequest {
  reaction: string;
}
