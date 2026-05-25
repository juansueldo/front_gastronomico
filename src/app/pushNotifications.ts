import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { getAuthSession } from './core/storage/authStorage';

export const APP_NOTIFICATION_EVENT = 'app:notification';
export const APP_NEW_MESSAGE_EVENT = 'app:new-message';
export const APP_CONVERSATIONS_CHANGED_EVENT = 'app:conversations-changed';

type SenderType = 'contact' | 'agent';
type ChannelType = 'whatsapp' | 'facebook' | 'instagram' | 'email';

export interface AppNewMessageDetail {
  conversationId: string;
  messageId: string;
  providerMessageId?: string;
  msgId?: string;
  content: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaFilename?: string;
  messageType?: string;
  sender: SenderType;
  contactName?: string;
  groupAuthorName?: string;
  quotedMessageId?: string;
  quotedMessageContent?: string;
  quotedMsgId?: string;
  quotedContent?: string;
  reactions?: string[] | Record<string, number>;
  reactionEmoji?: string;
  reactionTargetMessageId?: string;
  channel?: ChannelType;
  timestamp: string;
}

export interface AppNotificationDetail {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

let pushInitialized = false;

type PushImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
  };
};

function isNativeMobile() {
  return Capacitor.isNativePlatform();
}

export function dispatchAppNotification(detail: AppNotificationDetail) {
  window.dispatchEvent(new CustomEvent<AppNotificationDetail>(APP_NOTIFICATION_EVENT, { detail }));
}

export function dispatchAppNewMessage(detail: AppNewMessageDetail) {
  window.dispatchEvent(new CustomEvent<AppNewMessageDetail>(APP_NEW_MESSAGE_EVENT, { detail }));
}

function normalizeSender(sender: unknown): SenderType {
  return sender === 'agent' || sender === 'user' ? 'agent' : 'contact';
}

function normalizeChannel(channel: unknown): ChannelType {
  if (channel === 'facebook' || channel === 'instagram' || channel === 'email') {
    return channel;
  }
  return 'whatsapp';
}

function buildMessageDetail(notification: PushNotificationSchema): AppNewMessageDetail | null {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const conversationId = String(data.conversationId ?? data.chatId ?? data.contact_id ?? data.contactId ?? '');

  if (!conversationId) {
    return null;
  }

  const content =
    typeof data.content === 'string'
      ? data.content
      : typeof data.message === 'string'
      ? data.message
      : typeof data.text === 'string'
      ? data.text
      : typeof notification.body === 'string'
      ? notification.body
      : '';

  return {
    conversationId,
    messageId: String(data.messageId ?? data.id ?? `push-${Date.now()}`),
    providerMessageId:
      data.providerMessageId !== undefined
        ? String(data.providerMessageId)
        : data.provider_message_id !== undefined
        ? String(data.provider_message_id)
        : undefined,
    msgId: String(data.msg_id ?? data.msgId ?? data.messageId ?? data.id ?? `push-${Date.now()}`),
    content,
    mediaUrl:
      typeof data.mediaUrl === 'string'
        ? data.mediaUrl
        : typeof data.media_url === 'string'
        ? data.media_url
        : undefined,
    mediaMime:
      typeof data.mediaMime === 'string'
        ? data.mediaMime
        : typeof data.media_mime === 'string'
        ? data.media_mime
        : typeof data.mimetype === 'string'
        ? data.mimetype
        : undefined,
    mediaFilename:
      typeof data.mediaFilename === 'string'
        ? data.mediaFilename
        : typeof data.media_filename === 'string'
        ? data.media_filename
        : typeof data.filename === 'string'
        ? data.filename
        : undefined,
    messageType: typeof data.messageType === 'string' ? data.messageType : typeof data.type === 'string' ? data.type : undefined,
    sender: normalizeSender(data.sender),
    contactName: typeof data.contactName === 'string' ? data.contactName : undefined,
    groupAuthorName:
      typeof data.groupAuthorName === 'string'
        ? data.groupAuthorName
        : typeof data.group_author_name === 'string'
        ? data.group_author_name
        : typeof data.group_author === 'string'
        ? data.group_author
        : typeof data.author_name === 'string'
        ? data.author_name
        : undefined,
    quotedMessageId:
      data.replyToMessageId !== undefined || data.reply_to_message_id !== undefined
        ? String(data.replyToMessageId ?? data.reply_to_message_id)
        : data.quoted_msg_id !== undefined
        ? String(data.quoted_msg_id)
        : undefined,
    quotedMessageContent:
      typeof data.replyToContent === 'string'
        ? data.replyToContent
        : typeof data.reply_to_content === 'string'
        ? data.reply_to_content
        : typeof data.quoted_content === 'string'
        ? data.quoted_content
        : undefined,
    quotedMsgId: data.quoted_msg_id !== undefined ? String(data.quoted_msg_id) : undefined,
    quotedContent: typeof data.quoted_content === 'string' ? data.quoted_content : undefined,
    reactions:
      Array.isArray(data.reactions) || (data.reactions && typeof data.reactions === 'object')
        ? (data.reactions as string[] | Record<string, number>)
        : undefined,
    reactionEmoji:
      typeof data.reactionEmoji === 'string'
        ? data.reactionEmoji
        : typeof data.reaction_emoji === 'string'
        ? data.reaction_emoji
        : undefined,
    reactionTargetMessageId:
      data.reactionTargetMessageId !== undefined || data.reaction_target_msg_id !== undefined
        ? String(data.reactionTargetMessageId ?? data.reaction_target_msg_id)
        : data.reaction_target_id !== undefined
        ? String(data.reaction_target_id)
        : data.reaction_target_msg_id !== undefined
        ? String(data.reaction_target_msg_id)
        : undefined,
    channel: normalizeChannel(data.channel),
    timestamp: typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString(),
  };
}

async function registerTokenInBackend(token: string) {
  const apiUrl = (import.meta as PushImportMeta).env.VITE_API_URL;
  if (!apiUrl) {
    return;
  }

  const session = getAuthSession();
  const authToken = session?.user.token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  await fetch(`${apiUrl}/devices/push/register`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      token,
      platform: Capacitor.getPlatform(),
    }),
  });
}

async function onTokenReceived(token: Token) {
  try {
    await registerTokenInBackend(token.value);
  } catch {
    dispatchAppNotification({
      title: 'Push',
      body: 'No se pudo registrar el token de notificaciones en el backend',
    });
  }
}

function onPushReceived(notification: PushNotificationSchema) {
  dispatchAppNotification({
    title: notification.title ?? 'Notificación',
    body: notification.body ?? 'Tienes una notificación nueva',
    data: (notification.data ?? {}) as Record<string, unknown>,
  });

  const newMessage = buildMessageDetail(notification);
  if (newMessage) {
    dispatchAppNewMessage(newMessage);
  }
}

function onPushAction(action: ActionPerformed) {
  const notification = action.notification;
  const newMessage = buildMessageDetail(notification);

  if (newMessage) {
    dispatchAppNewMessage(newMessage);
  }
}

export async function initializePushNotifications() {
  if (pushInitialized || !isNativeMobile()) {
    return;
  }

  pushInitialized = true;

  const permissionStatus = await PushNotifications.checkPermissions();
  let receive = permissionStatus.receive;

  if (receive === 'prompt') {
    const requestStatus = await PushNotifications.requestPermissions();
    receive = requestStatus.receive;
  }

  if (receive !== 'granted') {
    dispatchAppNotification({
      title: 'Notificaciones',
      body: 'Permiso de notificaciones no otorgado',
    });
    return;
  }

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener('registration', onTokenReceived);
  await PushNotifications.addListener('registrationError', () => {
    dispatchAppNotification({
      title: 'Push',
      body: 'Error registrando notificaciones push',
    });
  });
  await PushNotifications.addListener('pushNotificationReceived', onPushReceived);
  await PushNotifications.addListener('pushNotificationActionPerformed', onPushAction);
  await PushNotifications.register();
}
