import { getAuthSession } from './authStorage';
import {
  dispatchAppNewMessage,
  dispatchAppNotification,
  type AppNewMessageDetail,
} from './pushNotifications';

type RealtimeMode = 'auto' | 'ws' | 'sse';
type SenderType = 'contact' | 'agent';
type ChannelType = 'whatsapp' | 'facebook' | 'instagram' | 'email';

interface RealtimeEnvelope {
  type?: string;
  event?: string;
  payload?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

type RealtimeImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_REALTIME_URL?: string;
    VITE_REALTIME_MODE?: RealtimeMode;
  };
};

let activeSocket: WebSocket | null = null;
let activeEventSource: EventSource | null = null;
let reconnectTimer: number | null = null;
let shouldReconnect = false;

function getRealtimeConfig() {
  const env = (import.meta as RealtimeImportMeta).env;
  const mode: RealtimeMode = env.VITE_REALTIME_MODE ?? 'auto';

  if (env.VITE_REALTIME_URL) {
    return {
      mode,
      wsUrl: env.VITE_REALTIME_URL,
      sseUrl: env.VITE_REALTIME_URL,
    };
  }

  if (!env.VITE_API_URL) {
    return null;
  }

  const api = env.VITE_API_URL.replace(/\/$/, '');
  const wsBase = api.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');

  return {
    mode,
    wsUrl: `${wsBase}/realtime/ws`,
    sseUrl: `${api}/realtime/sse`,
  };
}

function normalizeSender(sender: unknown): SenderType {
  return sender === 'agent' ? 'agent' : 'contact';
}

function normalizeChannel(channel: unknown): ChannelType {
  if (channel === 'facebook' || channel === 'instagram' || channel === 'email') {
    return channel;
  }

  return 'whatsapp';
}

function buildMessageDetail(payload: Record<string, unknown>): AppNewMessageDetail | null {
  const conversationId = String(payload.conversationId ?? payload.chatId ?? '');
  if (!conversationId) {
    return null;
  }

  return {
    conversationId,
    messageId: String(payload.messageId ?? payload.id ?? `rt-${Date.now()}`),
    content: typeof payload.content === 'string' ? payload.content : 'Nuevo mensaje',
    sender: normalizeSender(payload.sender),
    contactName: typeof payload.contactName === 'string' ? payload.contactName : undefined,
    channel: normalizeChannel(payload.channel),
    timestamp: typeof payload.timestamp === 'string' ? payload.timestamp : new Date().toISOString(),
  };
}

function parseEnvelope(raw: unknown): RealtimeEnvelope | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  return raw as RealtimeEnvelope;
}

function parsePayload(input: string): RealtimeEnvelope | null {
  try {
    const parsed = JSON.parse(input);
    return parseEnvelope(parsed);
  } catch {
    return null;
  }
}

function handleRealtimeEnvelope(envelope: RealtimeEnvelope) {
  const eventType = envelope.type ?? envelope.event ?? 'message';
  const payload = (envelope.payload ?? envelope.data ?? envelope) as Record<string, unknown>;

  if (eventType === 'message.created' || eventType === 'chat.message' || payload.conversationId) {
    const message = buildMessageDetail(payload);
    if (message) {
      dispatchAppNewMessage(message);
      dispatchAppNotification({
        title: 'Nuevo mensaje',
        body: message.content,
        data: payload,
      });
    }
    return;
  }

  if (eventType === 'notification') {
    dispatchAppNotification({
      title: typeof payload.title === 'string' ? payload.title : 'Notificación',
      body: typeof payload.body === 'string' ? payload.body : 'Tienes una notificación nueva',
      data: payload,
    });
  }
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(connectFn: () => void) {
  if (!shouldReconnect || reconnectTimer) {
    return;
  }

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectFn();
  }, 3000);
}

function buildUrl(baseUrl: string, token?: string) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  if (!token) {
    return baseUrl;
  }

  return `${baseUrl}${separator}token=${encodeURIComponent(token)}`;
}

function connectWebSocket(url: string) {
  const token = getAuthSession()?.accessToken;
  const ws = new WebSocket(buildUrl(url, token));
  activeSocket = ws;

  ws.onmessage = (event) => {
    const envelope = parsePayload(String(event.data));
    if (envelope) {
      handleRealtimeEnvelope(envelope);
    }
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onclose = () => {
    if (activeSocket === ws) {
      activeSocket = null;
    }

    scheduleReconnect(() => connectWebSocket(url));
  };
}

function connectSse(url: string) {
  const token = getAuthSession()?.accessToken;
  const eventSource = new EventSource(buildUrl(url, token));
  activeEventSource = eventSource;

  eventSource.addEventListener('message', (event) => {
    const envelope = parsePayload((event as MessageEvent).data);
    if (envelope) {
      handleRealtimeEnvelope(envelope);
    }
  });

  eventSource.addEventListener('message.created', (event) => {
    const envelope = parsePayload((event as MessageEvent).data);
    if (envelope) {
      handleRealtimeEnvelope({ type: 'message.created', ...envelope });
    }
  });

  eventSource.onerror = () => {
    if (activeEventSource === eventSource) {
      activeEventSource = null;
    }

    eventSource.close();
    scheduleReconnect(() => connectSse(url));
  };
}

export function stopRealtimeChannel() {
  shouldReconnect = false;
  clearReconnectTimer();

  if (activeSocket) {
    activeSocket.close();
    activeSocket = null;
  }

  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
}

export function startRealtimeChannel() {
  const session = getAuthSession();
  if (!session) {
    stopRealtimeChannel();
    return;
  }

  const config = getRealtimeConfig();
  if (!config) {
    return;
  }

  stopRealtimeChannel();
  shouldReconnect = true;

  if (config.mode === 'ws') {
    connectWebSocket(config.wsUrl);
    return;
  }

  if (config.mode === 'sse') {
    connectSse(config.sseUrl);
    return;
  }

  try {
    connectWebSocket(config.wsUrl);
  } catch {
    connectSse(config.sseUrl);
  }
}
