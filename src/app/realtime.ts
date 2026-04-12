import { io, Socket } from 'socket.io-client';
import { useEffect, useState } from 'react';
import { getAuthSession, getStoreIdFromToken } from './authStorage';
import {
  dispatchAppNewMessage,
  dispatchAppNotification,
  type AppNewMessageDetail,
} from './pushNotifications';

export interface UseWebSocketResult {
  socket: Socket | null;
  connected: boolean;
}

export const APP_WHATSAPP_INSTANCE_EVENT = 'app:whatsapp-instance';

export interface AppWhatsappInstanceDetail {
  instanceId: string;
  status: string;
  connected: boolean;
  eventType: string;
  payload: Record<string, unknown>;
}

type SenderType = 'contact' | 'agent';
type ChannelType = 'whatsapp' | 'facebook' | 'instagram' | 'email';

const ALL_CHANNELS = ['products', 'orders', 'tables', 'waiters', 'segments', 'subscriptions'] as const;
type Channel = (typeof ALL_CHANNELS)[number];

// ─── Singleton global ────────────────────────────────────────────────────────
let globalSocket: Socket | null = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function normalizeSender(sender: unknown): SenderType {
  return sender === 'agent' || sender === 'user' ? 'agent' : 'contact';
}

function normalizeChannel(channel: unknown): ChannelType {
  if (channel === 'facebook' || channel === 'instagram' || channel === 'email') return channel;
  return 'whatsapp';
}

function getStringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function getInstanceId(payload: Record<string, unknown>) {
  const raw = payload.instanceId ?? payload.instance_id ?? payload.id;
  if (raw === undefined || raw === null) return null;
  return String(raw).trim() || null;
}

function buildMessageDetail(payload: Record<string, unknown>): AppNewMessageDetail | null {
  const conversationId = String(
    payload.conversationId ?? payload.chatId ?? payload.contact_id ?? payload.contactId ?? ''
  );
  if (!conversationId) return null;

  return {
    conversationId,
    messageId: String(payload.messageId ?? payload.id ?? `rt-${Date.now()}`),
    msgId: String(payload.msg_id ?? payload.msgId ?? payload.messageId ?? payload.id ?? `rt-${Date.now()}`),
    content:
      typeof payload.content === 'string' ? payload.content :
      typeof payload.message === 'string' ? payload.message :
      typeof payload.text === 'string' ? payload.text : '',
    sender: normalizeSender(payload.sender),
    contactName: typeof payload.contactName === 'string' ? payload.contactName : undefined,
    channel: normalizeChannel(payload.channel),
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString(),
  };
}

// ─── Handlers de eventos ──────────────────────────────────────────────────────
function handleWhatsappEvent(eventType: string, payload: Record<string, unknown>) {
  if (!eventType.startsWith('whatsapp.')) return false;

  const instanceId = getInstanceId(payload);
  const status = getStringValue(payload.status, eventType.replace('whatsapp.', ''));
  const connected =
    payload.connected === true ||
    eventType === 'whatsapp.ready' ||
    eventType === 'whatsapp.login.success';

  if (instanceId) {
    window.dispatchEvent(
      new CustomEvent<AppWhatsappInstanceDetail>(APP_WHATSAPP_INSTANCE_EVENT, {
        detail: { instanceId, status, connected, eventType, payload },
      })
    );
  }

  const isReady =
    eventType === 'whatsapp.ready' ||
    eventType === 'whatsapp.login.success' ||
    (eventType === 'whatsapp.status' && connected && (status === 'ready' || status === 'authenticated'));

  if (isReady) {
    dispatchAppNotification({
      title: 'WhatsApp conectado',
      body: `La instancia ${instanceId ?? '-'} quedó lista (${getStringValue(payload.phone, 'sin teléfono')}).`,
      data: payload,
    });
  }

  return true;
}

function registerEventHandlers(socket: Socket) {
  // ── Confirmaciones del servidor ──
  socket.on('connected', (data) => {
    console.log('[WS] connected:', data);
  });

  socket.on('subscribed', (data) => {
    console.log('[WS] suscrito a canal:', data.channel);
  });

  socket.on('unsubscribed', (data) => {
    console.log('[WS] desuscrito de canal:', data.channel);
  });

  socket.on('pong', () => {
    console.log('[WS] pong recibido');
  });

  // ── Productos ──
  socket.on('product_created', (data) => {
    console.log('[WS] product_created', data);
  });

  socket.on('product_updated', (data) => {
    console.log('[WS] product_updated', data);
  });

  socket.on('product_deleted', (data) => {
    console.log('[WS] product_deleted', data);
  });

  // ── Órdenes ──
  socket.on('order_created', (data) => {
    console.log('[WS] order_created', data);
    dispatchAppNotification({
      title: 'Nueva orden',
      body: `Orden ${data?.data?.order?.order_number ?? ''}`,
      data: data?.data ?? {},
    });
  });

  socket.on('order_status_changed', (data) => {
    console.log('[WS] order_status_changed', data);
  });

  // ── Mesas ──
  socket.on('table_created', (data) => {
    console.log('[WS] table_created', data);
  });

  socket.on('table_status_changed', (data) => {
    console.log('[WS] table_status_changed', data);
  });

  // ── Mozos ──
  socket.on('waiter_created', (data) => {
    console.log('[WS] waiter_created', data);
  });

  // ── Segmentos / Suscripciones ──
  socket.on('segment_updated', (data) => {
    console.log('[WS] segment_updated', data);
  });

  socket.on('subscription_updated', (data) => {
    console.log('[WS] subscription_updated', data);
  });

  // ── Mensajes / WhatsApp ──
  socket.on('message.created', (data) => {
    const payload = data?.data ?? data ?? {};
    if (handleWhatsappEvent('message.created', payload)) return;
    const message = buildMessageDetail(payload);
    if (message) {
      dispatchAppNewMessage(message);
      dispatchAppNotification({
        title: `Nuevo mensaje de ${payload.sourceName ?? 'desconocido'}`,
        body: message.content,
        data: payload,
      });
    }
  });

  // ── Errores ──
  socket.on('error', (err) => {
    console.error('[WS] error:', err);
  });
}

// ─── startRealtimeChannel ─────────────────────────────────────────────────────
export function startRealtimeChannel() {
  const session = getAuthSession();
  console.log(session?.user.token, 'session realtime');
  if (!session?.user.token) {
    console.warn('[WS] No hay sesión activa');
    return;
  }

  let storeId: number | null = null;
  if (session.user && 'storeId' in session.user && typeof session.user.storeId === 'number') {
    storeId = session.user.storeId;
  } else {
    storeId = getStoreIdFromToken(session?.user.token);
  }

  if (!storeId) {
    console.warn('[WS] No se pudo obtener storeId');
    return;
  }

  // Si ya está conectado con el mismo storeId, no reconectar
  if (globalSocket?.connected) {
    console.log('[WS] Ya conectado, omitiendo reconexión');
    return;
  }

  // Limpiar socket anterior si existe
  if (globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }

  console.log('[WS] Conectando...', { storeId, url: import.meta.env.VITE_API_URL });

  globalSocket = io(import.meta.env.VITE_API_URL, {
    auth: {
      token: session?.user.token,
      storeId,
    },
    // polling primero, igual que el ejemplo que funciona
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    timeout: 20000,
  });

  // Registrar todos los handlers de eventos
  registerEventHandlers(globalSocket);

  globalSocket.on('connect', () => {

    // Suscribirse a todos los canales DESPUÉS de conectar
    ALL_CHANNELS.forEach((channel) => {
      globalSocket!.emit('subscribe', { channel });
    });
  });

  globalSocket.on('disconnect', () => {
    console.log('[WS] Desconectado');
  });
}

// ─── stopRealtimeChannel ──────────────────────────────────────────────────────
export function stopRealtimeChannel() {
  if (globalSocket) {
    ALL_CHANNELS.forEach((ch) => globalSocket!.emit('unsubscribe', { channel: ch }));
    globalSocket.disconnect();
    globalSocket = null;
    console.log('[WS] Canal detenido');
  }
}

// ─── Hook para componentes React ──────────────────────────────────────────────
export function useWebSocket(
  token: string,
  storeId: number,
  channels: Channel[] = [...ALL_CHANNELS]
): UseWebSocketResult {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !storeId) return;

    const newSocket = io(import.meta.env.VITE_API_URL, {
      auth: { token, storeId },
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    registerEventHandlers(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      channels.forEach((channel) => newSocket.emit('subscribe', { channel }));
    });

    newSocket.on('disconnect', () => setConnected(false));

    setSocket(newSocket);

    return () => {
      channels.forEach((ch) => newSocket.emit('unsubscribe', { channel: ch }));
      newSocket.disconnect();
    };
  }, [token, storeId]);

  return { socket, connected };
}

// ─── Hook con auth automática ─────────────────────────────────────────────────
export function useAuthWebSocket(channels?: Channel[]): UseWebSocketResult {
  const session = getAuthSession();
  const token = session?.user.token ?? '';

  let storeId: number | null = null;
  if (session?.user && 'storeId' in session.user && typeof session.user.storeId === 'number') {
    storeId = session.user.storeId;
  } else if (token) {
    storeId = getStoreIdFromToken(token);
  }

  return useWebSocket(token, storeId ?? 0, channels);
}