import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { getAuthSession } from './authStorage';

export const APP_NOTIFICATION_EVENT = 'app:notification';
export const APP_NEW_MESSAGE_EVENT = 'app:new-message';

type SenderType = 'contact' | 'agent';
type ChannelType = 'whatsapp' | 'facebook' | 'instagram' | 'email';

export interface AppNewMessageDetail {
  conversationId: string;
  messageId: string;
  content: string;
  sender: SenderType;
  contactName?: string;
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
  const conversationId = String(data.conversationId ?? data.chatId ?? '');

  if (!conversationId) {
    return null;
  }

  const content =
    typeof data.content === 'string'
      ? data.content
      : typeof notification.body === 'string'
      ? notification.body
      : 'Nuevo mensaje';

  return {
    conversationId,
    messageId: String(data.messageId ?? data.id ?? `push-${Date.now()}`),
    content,
    sender: normalizeSender(data.sender),
    contactName: typeof data.contactName === 'string' ? data.contactName : undefined,
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
  const authToken = session?.accessToken;

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
