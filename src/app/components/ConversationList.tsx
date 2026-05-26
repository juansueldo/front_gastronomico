import { type ClipboardEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Bike,
  Bold,
  ChevronDown,
  Code,
  Filter,
  Italic,
  Link,
  List,
  ListOrdered,
  Mail,
  MessageSquareText,
  Mic,
  PackageCheck,
  Paperclip,
  Quote,
  Phone,
  Plus,
  Search,
  Send,
  Smile,
  Star,
  Strikethrough,
  Tag,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Toaster } from '../shared/ui/components/sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../shared/ui/components/avatar';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { DeleteConfirmDialog } from '../shared/ui/components/delete-confirm-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../shared/ui/components/dialog';
import { Input } from '../shared/ui/components/input';
import { Label } from '../shared/ui/components/label';
import { CreateOrderDialog } from './orders/CreateOrderDialog';
import {
  createContact,
  fetchMessages,
  listContacts,
  sendMessage,
  type ContactItem,
} from '../features/chat/services/chat.service';
import {
  deleteMessagingConversation,
  markConversationAsRead,
  type MessagingMessage,
} from '../features/chat';
import { fetchProductCategories, fetchProducts, type ProductCategory, type ProductItem } from '../features/products';
import { findCustomerByPhone, listCustomerOrders, type CustomerLookupResult } from '../features/customers';
import { APP_CONVERSATIONS_CHANGED_EVENT, APP_NEW_MESSAGE_EVENT, type AppNewMessageDetail } from '../pushNotifications';
import { ApiError } from '../core/http/errors';

type ConversationFilter = 'all' | 'unread' | 'assigned';

const COMPACT_DIALOG_CONTENT_CLASS = 'w-[calc(100vw-2rem)] max-w-[620px] gap-0 overflow-visible p-0';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';

type ConversationItem = {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string | null;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
  status?: string;
  channel?: string;
};

type ChatMessage = {
  id: string;
  providerMessageId?: string;
  body: string;
  direction: 'inbound' | 'outbound';
  createdAt: Date;
  status?: string;
  messageType?: string;
  mediaUrl?: string;
  mediaMime?: string;
  mediaFilename?: string;
};

type CustomerOrderSummary = {
  id?: string | number;
  orderNumber?: string | number;
  status?: string;
  total?: string | number;
  createdAt?: string;
};

type PendingAttachment = {
  id: string;
  file: File;
  url: string;
  mime: string;
  name: string;
};

type CustomerChatNavigation = {
  id?: number | string;
  name?: string;
  phone: string;
};

const filterLabels: Record<ConversationFilter, string> = {
  all: 'Todos',
  unread: 'No leidos',
  assigned: 'Asignados',
};

const customerTags = ['Cliente frecuente', 'VIP'];
const quickReplies = [
  { label: 'Confirmar pedido', icon: PackageCheck, text: 'Tu pedido esta confirmado.' },
  { label: 'Ya salio', icon: Bike, text: 'Tu pedido ya salio.' },
  { label: 'Enviar link', icon: Link, text: 'Te comparto el link del pedido.' },
  { label: 'Gracias', icon: Smile, text: 'Gracias por contactarnos.' },
];
const activeOrderStatuses = ['pending', 'preparing', 'in_preparation', 'ready', 'delivery', 'in_delivery', 'en preparación', 'en preparacion'];

function getOrderStatus(order: CustomerOrderSummary) {
  return String(order.status ?? '').trim();
}

function isActiveOrder(order: CustomerOrderSummary) {
  return activeOrderStatuses.includes(getOrderStatus(order).toLowerCase());
}

function getOrderNumber(order: CustomerOrderSummary) {
  return order.orderNumber ?? (order as Record<string, unknown>).order_number ?? order.id ?? '-';
}

function getOrderTotal(order: CustomerOrderSummary) {
  return order.total ?? (order as Record<string, unknown>).total_amount ?? (order as Record<string, unknown>).totalAmount ?? 0;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'CL';
}

function parseDate(value?: string | null) {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatConversationTime(date: Date) {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';

  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function truncateConversationPreview(value: string, maxLength = 30) {
  const normalizedValue = value.replace(/\s+/g, ' ').trim();
  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength).trimEnd()}...`;
}

function formatMessageTime(date: Date) {
  return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatRecordingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function mapContactToConversation(contact: ContactItem): ConversationItem {
  return {
    id: String(contact.id),
    name: contact.name || contact.phone || `Conversacion ${contact.id}`,
    phone: contact.phone,
    avatarUrl: contact.avatar_url ?? contact.avatarUrl ?? null,
    lastMessage: contact.last_message || 'Sin mensajes',
    lastMessageAt: parseDate(contact.last_message_date),
    unreadCount: Number(contact.label) === 1 ? 1 : 0,
    status: Number(contact.label) === 2 ? 'assigned' : undefined,
    channel: contact.network ?? contact.instance_description ?? 'whatsapp',
  };
}

function getRecordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function getConversationField(payload: Record<string, unknown>, key: string) {
  return payload[key] ?? payload[key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)];
}

function mapConversationUpdatePayload(payload: Record<string, unknown>, fallback?: ConversationItem): ConversationItem | null {
  const conversation = getRecordValue(payload.conversation) ?? payload;
  const id = conversation.id !== undefined ? String(conversation.id) : fallback?.id;
  if (!id) return null;

  const customer = getRecordValue(conversation.Customer) ?? getRecordValue(conversation.customer) ?? {};
  const contact = getRecordValue(conversation.Contact) ?? getRecordValue(conversation.contact) ?? {};
  const lastMessageAt = getConversationField(conversation, 'lastMessageAt');
  const lastMessagePreview = getConversationField(conversation, 'lastMessagePreview');
  const unreadCount = getConversationField(conversation, 'unreadCount');
  const customerName = typeof customer.name === 'string' ? customer.name : undefined;
  const customerPhone = typeof customer.phone === 'string' ? customer.phone : undefined;
  const contactIdentifier = typeof contact.identifier === 'string' ? contact.identifier : undefined;
  const channel = typeof conversation.channel === 'string' ? conversation.channel : undefined;
  const profileImageUrl = getRecordValue(customer.metadata)?.whatsappProfileImageUrl;

  return {
    id,
    name: customerName || fallback?.name || customerPhone || contactIdentifier || `Conversacion ${id}`,
    phone: customerPhone || fallback?.phone || contactIdentifier,
    avatarUrl: typeof profileImageUrl === 'string' ? profileImageUrl : fallback?.avatarUrl ?? null,
    lastMessage: typeof lastMessagePreview === 'string' && lastMessagePreview.trim()
      ? lastMessagePreview
      : fallback?.lastMessage ?? 'Sin mensajes',
    lastMessageAt: typeof lastMessageAt === 'string'
      ? parseDate(lastMessageAt)
      : fallback?.lastMessageAt ?? new Date(),
    unreadCount: Number.isFinite(Number(unreadCount)) ? Number(unreadCount) : fallback?.unreadCount ?? 0,
    status: typeof conversation.status === 'string' ? conversation.status : fallback?.status,
    channel: channel || fallback?.channel || 'whatsapp',
  };
}

function mapMessagePayload(message: Record<string, unknown>, fallbackConversationId: string): ChatMessage {
  const createdAt = parseDate(String(message.timestamp ?? message.created_at ?? message.createdAt ?? message.sentAt ?? new Date().toISOString()));
  const legacyDirection = message.direction === 'o' ? 'outbound' : message.direction === 'i' ? 'inbound' : undefined;

  return {
    id: String(message.id ?? message.msg_id ?? `${fallbackConversationId}-${Date.now()}`),
    providerMessageId: message.providerMessageId !== undefined
      ? String(message.providerMessageId)
      : message.provider_message_id !== undefined
        ? String(message.provider_message_id)
        : message.msg_id !== undefined
          ? String(message.msg_id)
          : undefined,
    body: String(message.content ?? message.message ?? message.text ?? message.body ?? ''),
    direction: (message.direction === 'outbound' || message.direction === 'inbound')
      ? message.direction
      : legacyDirection ?? 'inbound',
    createdAt,
    status: typeof message.status === 'string' ? message.status : undefined,
    messageType: typeof message.messageType === 'string' ? message.messageType : typeof message.type === 'string' ? message.type : undefined,
    mediaUrl: typeof message.mediaUrl === 'string' ? message.mediaUrl : typeof message.media_url === 'string' ? message.media_url : undefined,
    mediaMime: typeof message.mediaMime === 'string' ? message.mediaMime : typeof message.media_mime === 'string' ? message.media_mime : undefined,
    mediaFilename: typeof message.mediaFilename === 'string' ? message.mediaFilename : typeof message.media_filename === 'string' ? message.media_filename : undefined,
  };
}

function mergeMessageByIdentity(messages: ChatMessage[], incoming: ChatMessage) {
  const incomingBody = incoming.body.trim();
  const incomingTime = incoming.createdAt.getTime();
  let wasMerged = false;

  const merged = messages.map((message) => {
    const sameId = message.id === incoming.id;
    const sameProviderId = Boolean(message.providerMessageId && incoming.providerMessageId && message.providerMessageId === incoming.providerMessageId);
    const sameRecentOptimistic =
      message.status === 'pending'
      && message.direction === incoming.direction
      && message.body.trim() === incomingBody
      && Math.abs(message.createdAt.getTime() - incomingTime) < 30000;

    if (!sameId && !sameProviderId && !sameRecentOptimistic) return message;

    wasMerged = true;
    return {
      ...message,
      ...incoming,
      providerMessageId: incoming.providerMessageId ?? message.providerMessageId,
      mediaUrl: incoming.mediaUrl ?? message.mediaUrl,
      mediaMime: incoming.mediaMime ?? message.mediaMime,
      mediaFilename: incoming.mediaFilename ?? message.mediaFilename,
      status: incoming.status ?? message.status,
    };
  });

  return wasMerged ? merged : [...messages, incoming];
}

function getMediaKind(message: ChatMessage) {
  const source = `${message.messageType ?? ''} ${message.mediaMime ?? ''}`.toLowerCase();
  if (source.includes('image')) return 'image';
  if (source.includes('video')) return 'video';
  if (source.includes('audio')) return 'audio';
  if (source.includes('document') || source.includes('pdf') || source.includes('application')) return 'document';
  return message.mediaUrl ? 'document' : null;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return fallback;
}

function normalizePhoneDigits(value?: string | null) {
  return String(value ?? '').replace(/@c\.us$/i, '').replace(/\D/g, '');
}

function phonesMatch(left?: string, right?: string) {
  const leftDigits = normalizePhoneDigits(left);
  const rightDigits = normalizePhoneDigits(right);
  if (!leftDigits || !rightDigits) return false;
  if (leftDigits === rightDigits) return true;
  return (leftDigits.length >= 8 && rightDigits.endsWith(leftDigits))
    || (rightDigits.length >= 8 && leftDigits.endsWith(rightDigits));
}

function getCustomerChatNavigation(state: unknown): CustomerChatNavigation | null {
  if (!state || typeof state !== 'object') return null;
  const candidate = (state as { customerChat?: unknown }).customerChat;
  if (!candidate || typeof candidate !== 'object') return null;

  const raw = candidate as Record<string, unknown>;
  const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
  if (!phone) return null;

  return {
    id: typeof raw.id === 'string' || typeof raw.id === 'number' ? raw.id : undefined,
    name: typeof raw.name === 'string' ? raw.name.trim() : undefined,
    phone,
  };
}

function htmlToWhatsappMarkdown(html: string) {
  const root = document.createElement('div');
  root.innerHTML = html;

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const element = node as HTMLElement;
    const content = Array.from(element.childNodes).map(walk).join('');
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'br') return '\n';
    if (tagName === 'b' || tagName === 'strong') return `*${content}*`;
    if (tagName === 'i' || tagName === 'em') return `_${content}_`;
    if (tagName === 's' || tagName === 'strike') return `~${content}~`;
    if (tagName === 'code' || tagName === 'pre') return `\`${content}\``;
    if (tagName === 'blockquote') return content.split('\n').map((line) => `> ${line}`).join('\n');
    if (tagName === 'li') return `- ${content}\n`;
    if (tagName === 'div' || tagName === 'p') return `${content}\n`;

    return content;
  };

  return Array.from(root.childNodes).map(walk).join('').replace(/\n{3,}/g, '\n\n').trim();
}

function renderInlineWhatsappText(text: string, keyPrefix: string) {
  const nodes: ReactNode[] = [];
  const pattern = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|`[^`\n]+`)/g;
  let lastIndex = 0;
  let tokenIndex = 0;

  text.replace(pattern, (match, _token, offset: number) => {
    if (offset > lastIndex) nodes.push(text.slice(lastIndex, offset));

    const content = match.slice(1, -1);
    const key = `${keyPrefix}-${tokenIndex}`;
    tokenIndex += 1;

    if (match.startsWith('*')) nodes.push(<strong key={key}>{content}</strong>);
    else if (match.startsWith('_')) nodes.push(<em key={key}>{content}</em>);
    else if (match.startsWith('~')) nodes.push(<span key={key} className="line-through">{content}</span>);
    else nodes.push(<code key={key} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">{content}</code>);

    lastIndex = offset + match.length;
    return match;
  });

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function renderWhatsappText(text: string) {
  const lines = text.split('\n');

  return lines.map((line, index) => {
    const isQuote = line.trimStart().startsWith('>');
    const content = isQuote ? line.replace(/^\s*>\s?/, '') : line;

    return (
      <span
        key={`${index}-${line}`}
        className={isQuote ? 'my-1 block border-l-2 border-[var(--primary)]/70 pl-2 text-[var(--app-muted)]' : 'block'}
      >
        {renderInlineWhatsappText(content, `line-${index}`)}
        {index < lines.length - 1 ? <br /> : null}
      </span>
    );
  });
}

export function ConversationList() {
  const location = useLocation();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ConversationFilter>('all');
  const [newMessage, setNewMessage] = useState('');
  const [isSelectionToolbarVisible, setIsSelectionToolbarVisible] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<ConversationItem | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingWaveform, setRecordingWaveform] = useState<number[]>(() => Array.from({ length: 42 }, () => 10));
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isCustomerPanelOpen, setIsCustomerPanelOpen] = useState(false);
  const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);
  const [isOrderDialogMinimized, setIsOrderDialogMinimized] = useState(false);
  const [customerLookup, setCustomerLookup] = useState<CustomerLookupResult | null>(null);
  const [customerOrders, setCustomerOrders] = useState<CustomerOrderSummary[]>([]);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);
  const [newChatName, setNewChatName] = useState('');
  const [newChatPhone, setNewChatPhone] = useState('');
  const [pendingCustomerChat, setPendingCustomerChat] = useState<CustomerChatNavigation | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousConversationIdRef = useRef<string | null>(null);
  const shouldStickToBottomRef = useRef(true);
  const editorRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const localAudioUrlsRef = useRef<string[]>([]);
  const pendingAttachmentUrlsRef = useRef<string[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const recordingAnimationRef = useRef<number | null>(null);
  const recordingAudioContextRef = useRef<AudioContext | null>(null);
  const cancelRecordingRef = useRef(false);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? conversations[0],
    [conversations, selectedConversationId],
  );

  const filteredConversations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      const matchesSearch = !normalizedSearch
        || conversation.name.toLowerCase().includes(normalizedSearch)
        || (conversation.phone ?? '').toLowerCase().includes(normalizedSearch)
        || conversation.lastMessage.toLowerCase().includes(normalizedSearch);
      const matchesFilter =
        filter === 'all'
        || (filter === 'unread' && conversation.unreadCount > 0)
        || (filter === 'assigned' && conversation.status === 'assigned');

      return matchesSearch && matchesFilter;
    });
  }, [conversations, filter, search]);

  const unreadTotal = conversations.reduce((total, conversation) => total + (conversation.unreadCount > 0 ? 1 : 0), 0);
  const assignedTotal = conversations.filter((conversation) => conversation.status === 'assigned').length;
  const activeOrder = customerOrders.find(isActiveOrder);

  const scrollToConversationEnd = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const viewport = messagesViewportRef.current;

    if (viewport) {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior });
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }

    shouldStickToBottomRef.current = true;
    setShowScrollToBottom(false);
  }, []);

  const scheduleScrollToConversationEnd = useCallback((behavior: ScrollBehavior = 'auto') => {
    shouldStickToBottomRef.current = true;
    setShowScrollToBottom(false);

    const scroll = () => scrollToConversationEnd(behavior);
    const firstFrame = window.requestAnimationFrame(() => {
      scroll();
      window.requestAnimationFrame(scroll);
    });
    const shortDelay = window.setTimeout(scroll, 80);
    const longDelay = window.setTimeout(scroll, 220);

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.clearTimeout(shortDelay);
      window.clearTimeout(longDelay);
    };
  }, [scrollToConversationEnd]);

  const handleMessagesScroll = useCallback(() => {
    const viewport = messagesViewportRef.current;
    if (!viewport) return;

    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    const isNearBottom = distanceToBottom < 80;

    shouldStickToBottomRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    try {
      const data = await listContacts();
      const mapped = data.map(mapContactToConversation);
      setConversations(mapped);
      setSelectedConversationId((current) => current ?? mapped[0]?.id ?? null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los chats'));
    } finally {
      setIsLoadingConversations(false);
      setHasLoadedConversations(true);
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const data = await fetchMessages(conversationId) as unknown;
      const rows = Array.isArray(data)
        ? data
        : Array.isArray((data as { messages?: unknown[] })?.messages)
          ? (data as { messages: unknown[] }).messages
          : [];
      setMessages(rows.map((row) => mapMessagePayload(row as Record<string, unknown>, conversationId)));
      scheduleScrollToConversationEnd('auto');
      await markConversationAsRead(conversationId).catch(() => undefined);
      setConversations((current) => current.map((conversation) => (
        conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
      )));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudieron cargar los mensajes'));
    } finally {
      setIsLoadingMessages(false);
      scheduleScrollToConversationEnd('auto');
    }
  }, [scheduleScrollToConversationEnd]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    const customerChat = getCustomerChatNavigation(location.state);
    if (!customerChat) return;

    setPendingCustomerChat(customerChat);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [products, categories] = await Promise.all([fetchProducts(), fetchProductCategories()]);
        setAvailableProducts(products);
        setAvailableCategories(categories);
      } catch {
        // El pedido se puede abrir igual; el dialog mostrara su propio estado si faltan productos.
      }
    };

    void loadCatalog();
  }, []);

  useEffect(() => {
    if (selectedConversation?.id) {
      shouldStickToBottomRef.current = true;
      setShowScrollToBottom(false);
      setMessages([]);
      scheduleScrollToConversationEnd('auto');
      void loadMessages(selectedConversation.id);
    }
  }, [loadMessages, scheduleScrollToConversationEnd, selectedConversation?.id]);

  useEffect(() => {
    const loadCustomerContext = async () => {
      const phone = selectedConversation?.phone?.trim();
      setCustomerLookup(null);
      setCustomerOrders([]);

      if (!phone) return;

      try {
        const customer = await findCustomerByPhone(phone);
        setCustomerLookup(customer);

        if (customer?.id) {
          const orders = await listCustomerOrders(customer.id);
          setCustomerOrders(Array.isArray(orders) ? orders as CustomerOrderSummary[] : []);
        }
      } catch {
        // La ficha del cliente no debe bloquear el chat.
      }
    };

    void loadCustomerContext();
  }, [selectedConversation?.phone, selectedConversation?.id]);

  useEffect(() => {
    const conversationChanged = previousConversationIdRef.current !== (selectedConversation?.id ?? null);
    previousConversationIdRef.current = selectedConversation?.id ?? null;

    if (!conversationChanged && !shouldStickToBottomRef.current) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      scrollToConversationEnd(conversationChanged ? 'auto' : 'smooth');
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [messages, scrollToConversationEnd, selectedConversation?.id]);

  useEffect(() => {
    if (!selectedConversation?.id || isLoadingMessages) return undefined;
    return scheduleScrollToConversationEnd('auto');
  }, [isLoadingMessages, messages.length, scheduleScrollToConversationEnd, selectedConversation?.id]);

  useEffect(() => () => {
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    if (recordingAnimationRef.current) window.cancelAnimationFrame(recordingAnimationRef.current);
    void recordingAudioContextRef.current?.close();
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    localAudioUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    pendingAttachmentUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const handleNewMessage = (event: Event) => {
      const payload = (event as CustomEvent<AppNewMessageDetail>).detail;
      const timestamp = parseDate(payload.timestamp);

      setConversations((current) => {
        const existing = current.find((conversation) => conversation.id === payload.conversationId);
        const nextConversation: ConversationItem = existing
          ? {
            ...existing,
            name: payload.contactName ?? existing.name,
            lastMessage: payload.content,
            lastMessageAt: timestamp,
            unreadCount: payload.sender === 'contact' && payload.conversationId !== selectedConversationId
              ? existing.unreadCount + 1
              : existing.unreadCount,
          }
          : {
            id: payload.conversationId,
            name: payload.contactName ?? 'Nuevo contacto',
            lastMessage: payload.content,
            lastMessageAt: timestamp,
            unreadCount: payload.sender === 'contact' ? 1 : 0,
            channel: payload.channel,
          };

        return [nextConversation, ...current.filter((conversation) => conversation.id !== payload.conversationId)];
      });

      if (payload.conversationId === selectedConversationId) {
        setMessages((current) => mergeMessageByIdentity(
          current,
          {
            id: payload.messageId,
            providerMessageId: payload.providerMessageId,
            body: payload.content,
            direction: payload.sender === 'agent' ? 'outbound' : 'inbound',
            createdAt: timestamp,
            status: payload.sender === 'agent' ? 'sent' : 'received',
            messageType: payload.messageType,
            mediaUrl: payload.mediaUrl,
            mediaMime: payload.mediaMime,
            mediaFilename: payload.mediaFilename,
          },
        ));
      }
    };

    window.addEventListener(APP_NEW_MESSAGE_EVENT, handleNewMessage);
    return () => window.removeEventListener(APP_NEW_MESSAGE_EVENT, handleNewMessage);
  }, [selectedConversationId]);

  useEffect(() => {
    const handleConversationsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{
        conversation?: {
          id?: string | number;
          lastMessageAt?: string | null;
          lastMessagePreview?: string | null;
        };
      }>).detail;
      const updatedConversation = detail?.conversation;
      const updatedConversationId = updatedConversation?.id !== undefined ? String(updatedConversation.id) : null;
      const currentConversation = updatedConversationId
        ? conversations.find((conversation) => conversation.id === updatedConversationId)
        : null;
      const updatedLastMessageAt = updatedConversation?.lastMessageAt
        ? parseDate(updatedConversation.lastMessageAt).getTime()
        : null;
      const currentLastMessageAt = currentConversation?.lastMessageAt.getTime() ?? null;
      const didLastMessageChange = Boolean(
        updatedConversationId
        && updatedConversationId === selectedConversationId
        && (
          (updatedLastMessageAt !== null && updatedLastMessageAt !== currentLastMessageAt)
          || (
            typeof updatedConversation?.lastMessagePreview === 'string'
            && updatedConversation.lastMessagePreview !== currentConversation?.lastMessage
          )
        ),
      );

      if (updatedConversationId) {
        const status = typeof updatedConversation?.status === 'string' ? updatedConversation.status : '';
        if (status === 'archived' || status === 'deleted') {
          setConversations((current) => current.filter((conversation) => conversation.id !== updatedConversationId));
          if (selectedConversationId === updatedConversationId) {
            setSelectedConversationId(null);
            setMessages([]);
            setIsMobileChatOpen(false);
          }
          return;
        }

        setConversations((current) => {
          const currentItem = current.find((conversation) => conversation.id === updatedConversationId);
          const payloadRecord = detail && typeof detail === 'object'
            ? detail as unknown as Record<string, unknown>
            : {};
          const nextConversation = mapConversationUpdatePayload(
            payloadRecord,
            currentItem,
          );

          if (!nextConversation) return current;
          return [nextConversation, ...current.filter((conversation) => conversation.id !== nextConversation.id)];
        });
      } else {
        void loadConversations();
      }

      if (selectedConversationId && didLastMessageChange) {
        void loadMessages(selectedConversationId);
      }
    };

    window.addEventListener(APP_CONVERSATIONS_CHANGED_EVENT, handleConversationsChanged);
    return () => window.removeEventListener(APP_CONVERSATIONS_CHANGED_EVENT, handleConversationsChanged);
  }, [conversations, loadConversations, loadMessages, selectedConversationId]);

  const handleSelectConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setIsMobileChatOpen(true);
  }, []);

  const handleDeleteConversation = async () => {
    if (!conversationToDelete) return;

    setIsDeletingConversation(true);
    try {
      await deleteMessagingConversation(conversationToDelete.id);
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationToDelete.id));
      if (selectedConversationId === conversationToDelete.id) {
        const nextConversation = conversations.find((conversation) => conversation.id !== conversationToDelete.id);
        setSelectedConversationId(nextConversation?.id ?? null);
        setMessages([]);
        setIsMobileChatOpen(false);
      }
      setConversationToDelete(null);
      toast.success('Contacto eliminado del chat');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el contacto'));
    } finally {
      setIsDeletingConversation(false);
    }
  };

  useEffect(() => {
    if (!pendingCustomerChat || !hasLoadedConversations || isLoadingConversations) return;

    const existingConversation = conversations.find((conversation) => (
      phonesMatch(conversation.phone, pendingCustomerChat.phone)
    ));

    if (existingConversation) {
      handleSelectConversation(existingConversation.id);
      setPendingCustomerChat(null);
      return;
    }

    setNewChatName(pendingCustomerChat.name || pendingCustomerChat.phone);
    setNewChatPhone(pendingCustomerChat.phone);
    setIsNewChatOpen(true);
    setPendingCustomerChat(null);
  }, [conversations, handleSelectConversation, hasLoadedConversations, isLoadingConversations, pendingCustomerChat]);

  const handleSendMessage = async () => {
    const body = htmlToWhatsappMarkdown(editorRef.current?.innerHTML ?? newMessage);
    if ((!body && pendingAttachments.length === 0) || !selectedConversation) return;

    if (pendingAttachments.length > 0) {
      const mediaMessages: ChatMessage[] = pendingAttachments.map((attachment, index) => ({
        id: `local-image-${Date.now()}-${index}`,
        body: index === 0 ? body : '',
        direction: 'outbound',
        createdAt: new Date(),
        status: 'pending',
        messageType: 'image',
        mediaUrl: attachment.url,
        mediaMime: attachment.mime,
        mediaFilename: attachment.name,
      }));

      setMessages((current) => [...current, ...mediaMessages]);
      localAudioUrlsRef.current.push(...pendingAttachments.map((attachment) => attachment.url));
      pendingAttachmentUrlsRef.current = pendingAttachmentUrlsRef.current.filter(
        (url) => !pendingAttachments.some((attachment) => attachment.url === url),
      );
      setPendingAttachments([]);
      setNewMessage('');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setConversations((current) => current.map((conversation) => (
        conversation.id === selectedConversation.id
          ? { ...conversation, lastMessage: body || 'Imagen', lastMessageAt: new Date() }
          : conversation
      )));

      await Promise.all(mediaMessages.map(async (localMessage, index) => {
        const attachment = pendingAttachments[index];
        try {
          const sent = await sendMessage({
            contactId: selectedConversation.id,
            content: localMessage.body,
            media: {
              data: await blobToDataUrl(attachment.file),
              mediaMime: attachment.mime,
              mediaFilename: attachment.name,
              caption: localMessage.body,
            },
          });
          const sentMessage = sent?.message as MessagingMessage | undefined;
          setMessages((current) => current.map((message) => (
            message.id === localMessage.id
              ? {
                ...message,
                id: sentMessage?.id ?? message.id,
                providerMessageId: sentMessage?.providerMessageId ?? message.providerMessageId,
                status: sentMessage?.status ?? 'sent',
                mediaUrl: sentMessage?.mediaUrl ?? message.mediaUrl,
                createdAt: parseDate(sentMessage?.createdAt ?? sentMessage?.sentAt),
              }
              : message
          )));
        } catch (error) {
          toast.error(getApiErrorMessage(error, 'No se pudo enviar la imagen'));
          setMessages((current) => current.map((message) => (
            message.id === localMessage.id ? { ...message, status: 'failed' } : message
          )));
        }
      }));
      return;
    }

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      body,
      direction: 'outbound',
      createdAt: new Date(),
      status: 'pending',
    };

    setMessages((current) => [...current, optimisticMessage]);
    setNewMessage('');
    if (editorRef.current) {
      editorRef.current.innerHTML = '';
    }
    setIsSending(true);

    try {
      const result = await sendMessage({ contactId: selectedConversation.id, content: body });
      const sentMessage = result?.message as MessagingMessage | undefined;
      setMessages((current) => current.map((message) => (
        message.id === optimisticMessage.id
          ? {
            ...message,
            id: sentMessage?.id ?? message.id,
            providerMessageId: sentMessage?.providerMessageId ?? message.providerMessageId,
            status: sentMessage?.status ?? 'sent',
            createdAt: parseDate(sentMessage?.createdAt ?? sentMessage?.sentAt),
          }
          : message
      )));
      setConversations((current) => current.map((conversation) => (
        conversation.id === selectedConversation.id
          ? { ...conversation, lastMessage: body, lastMessageAt: new Date() }
          : conversation
      )));
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo enviar el mensaje'));
      setMessages((current) => current.map((message) => (
        message.id === optimisticMessage.id ? { ...message, status: 'failed' } : message
      )));
    } finally {
      setIsSending(false);
    }
  };

  const stopRecording = (shouldSend: boolean) => {
    cancelRecordingRef.current = !shouldSend;
    mediaRecorderRef.current?.stop();
    setIsRecordingAudio(false);
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (recordingAnimationRef.current) {
      window.cancelAnimationFrame(recordingAnimationRef.current);
      recordingAnimationRef.current = null;
    }
    void recordingAudioContextRef.current?.close();
    recordingAudioContextRef.current = null;
  };

  const handleStartRecording = async () => {
    if (!selectedConversation) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Tu navegador no permite grabar audio desde esta vista');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      const audioContext = AudioContextCtor ? new AudioContextCtor() : null;
      audioChunksRef.current = [];
      cancelRecordingRef.current = false;
      mediaRecorderRef.current = recorder;

      if (audioContext) {
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.7;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        recordingAudioContextRef.current = audioContext;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const updateWaveform = () => {
          analyser.getByteFrequencyData(dataArray);
          const bucketSize = Math.max(1, Math.floor(dataArray.length / 42));
          const bars = Array.from({ length: 42 }).map((_, index) => {
            const start = index * bucketSize;
            const bucket = dataArray.slice(start, start + bucketSize);
            const average = bucket.reduce((total, value) => total + value, 0) / Math.max(bucket.length, 1);
            return Math.max(6, Math.min(36, 6 + (average / 255) * 32));
          });
          setRecordingWaveform(bars);
          recordingAnimationRef.current = window.requestAnimationFrame(updateWaveform);
        };

        updateWaveform();
      }

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecordingElapsed(0);
        setRecordingWaveform(Array.from({ length: 42 }, () => 10));

        if (cancelRecordingRef.current) {
          audioChunksRef.current = [];
          toast.info('Grabacion cancelada');
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        audioChunksRef.current = [];
        if (!blob.size) return;

        const audioUrl = URL.createObjectURL(blob);
        localAudioUrlsRef.current.push(audioUrl);
        const audioMessage: ChatMessage = {
          id: `local-audio-${Date.now()}`,
          body: '',
          direction: 'outbound',
          createdAt: new Date(),
          status: 'pending',
          messageType: 'audio',
          mediaUrl: audioUrl,
          mediaMime: blob.type || 'audio/webm',
          mediaFilename: 'audio.webm',
        };

        setMessages((current) => [...current, audioMessage]);
        setConversations((current) => current.map((conversation) => (
          conversation.id === selectedConversation.id
            ? { ...conversation, lastMessage: 'Audio', lastMessageAt: new Date() }
            : conversation
        )));

        try {
          const sent = await sendMessage({
            contactId: selectedConversation.id,
            content: '',
            media: {
              data: await blobToDataUrl(blob),
              mediaMime: blob.type || 'audio/webm',
              mediaFilename: 'audio.webm',
            },
          });
          const sentMessage = sent?.message as MessagingMessage | undefined;
          setMessages((current) => current.map((message) => (
            message.id === audioMessage.id
              ? {
                ...message,
                id: sentMessage?.id ?? message.id,
                status: sentMessage?.status ?? 'sent',
                mediaUrl: sentMessage?.mediaUrl ?? message.mediaUrl,
                createdAt: parseDate(sentMessage?.createdAt ?? sentMessage?.sentAt),
              }
              : message
          )));
        } catch (error) {
          toast.error(getApiErrorMessage(error, 'No se pudo enviar el audio'));
          setMessages((current) => current.map((message) => (
            message.id === audioMessage.id ? { ...message, status: 'failed' } : message
          )));
        }
      };

      recorder.start();
      setIsRecordingAudio(true);
      setRecordingElapsed(0);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingElapsed((current) => current + 1);
      }, 1000);
    } catch (error) {
      setIsRecordingAudio(false);
      toast.error(getApiErrorMessage(error, 'No se pudo iniciar la grabacion de audio'));
    }
  };

  const handlePasteAttachment = (event: ClipboardEvent<HTMLDivElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0) return;

    event.preventDefault();
    const nextAttachments = files.map((file) => {
      const url = URL.createObjectURL(file);
      pendingAttachmentUrlsRef.current.push(url);

      return {
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        url,
        mime: file.type,
        name: file.name || 'imagen-pegada.png',
      };
    });

    setPendingAttachments((current) => [...current, ...nextAttachments]);
  };

  const removePendingAttachment = (attachmentId: string) => {
    setPendingAttachments((current) => {
      const attachment = current.find((item) => item.id === attachmentId);
      if (attachment) {
        URL.revokeObjectURL(attachment.url);
        pendingAttachmentUrlsRef.current = pendingAttachmentUrlsRef.current.filter((url) => url !== attachment.url);
      }
      return current.filter((item) => item.id !== attachmentId);
    });
  };

  const applyEditorCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setIsSelectionToolbarVisible(false);
    setNewMessage(editorRef.current?.innerText ?? '');
  };

  const handleEditorSelection = () => {
    const selection = window.getSelection();
    const editor = editorRef.current;
    if (!selection || !editor || selection.isCollapsed || selection.rangeCount === 0) {
      setIsSelectionToolbarVisible(false);
      return;
    }

    const anchorNode = selection.anchorNode;
    setIsSelectionToolbarVisible(Boolean(anchorNode && editor.contains(anchorNode)));
  };

  const insertQuickReply = (text: string) => {
    setNewMessage(text);
    if (editorRef.current) {
      editorRef.current.innerText = text;
      editorRef.current.focus();
    }
  };

  const handleCreateChat = async () => {
    if (!newChatName.trim() || !newChatPhone.trim()) {
      toast.error('Completa nombre y telefono');
      return;
    }

    setIsSending(true);
    try {
      const result = await createContact({
        name: newChatName.trim(),
        phone: newChatPhone.trim(),
        message: `Hola ${newChatName.trim()}`,
      });
      const conversationId = String(result.contactId ?? result.id ?? result.conversation?.id ?? '');
      if (!conversationId) throw new Error('El backend no devolvio la conversacion creada');

      const nextConversation: ConversationItem = {
        id: conversationId,
        name: newChatName.trim(),
        phone: newChatPhone.trim(),
        lastMessage: `Hola ${newChatName.trim()}`,
        lastMessageAt: new Date(),
        unreadCount: 0,
        status: 'assigned',
        channel: 'whatsapp',
      };

      setConversations((current) => [nextConversation, ...current]);
      setSelectedConversationId(conversationId);
      setIsNewChatOpen(false);
      setNewChatName('');
      setNewChatPhone('');
      toast.success('Chat iniciado');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo iniciar el chat'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-body p-3 text-[var(--app-strong)] md:p-5">
      <Toaster />

      <section className="grid h-[calc(100dvh-110px)] min-h-0 flex-none overflow-hidden rounded-lg border border-[var(--app-line)] bg-[var(--app-surface)] shadow-sm md:h-[calc(100dvh-130px)] 2xl:grid-cols-[390px_minmax(0,1fr)]">
        <aside className={`${isMobileChatOpen ? 'hidden 2xl:flex' : 'flex'} min-h-0 flex-col border-b border-[var(--app-line)] bg-[var(--app-panel)] 2xl:border-b-0 2xl:border-r`}>
          <div className="shrink-0 border-b border-[var(--app-line)] p-4">
            <Button className="mb-3 w-full justify-center" onClick={() => setIsNewChatOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo chat
            </Button>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar conversaciones..."
                  className="h-11 rounded-lg border border-[var(--app-line)] bg-[var(--app-surface)] pl-9 focus:border-[var(--app-line)] focus:ring-0"
                />
              </div>
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 border-[var(--app-line)] bg-[var(--app-surface)]">
                <Filter className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-1 text-sm">
              {(['all', 'unread', 'assigned'] as ConversationFilter[]).map((item) => {
                const count = item === 'all' ? conversations.length : item === 'unread' ? unreadTotal : assignedTotal;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    className={`flex items-center justify-center gap-2 border-b-2 px-2 py-2 font-medium transition ${
                      filter === item
                        ? 'border-[var(--primary)] text-[var(--primary)]'
                        : 'border-transparent text-[var(--app-muted)] hover:text-[var(--app-strong)]'
                    }`}
                  >
                    <span>{filterLabels[item]}</span>
                    <span className="rounded-full bg-[var(--app-soft)] px-2 py-0.5 text-xs text-[var(--app-strong)]">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoadingConversations ? (
              <div className="p-5 text-sm text-[var(--app-muted)]">Cargando conversaciones...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-5 text-sm text-[var(--app-muted)]">No hay conversaciones.</div>
            ) : filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`group flex w-full items-start gap-3 border-b border-[var(--app-line)] p-4 text-left transition hover:bg-[var(--app-soft)] ${
                  selectedConversation?.id === conversation.id ? 'bg-[var(--app-soft)]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectConversation(conversation.id)}
                  className="flex min-w-0 flex-1 items-start gap-3 text-left"
                >
                  <Avatar className="h-12 w-12">
                    {conversation.avatarUrl ? <AvatarImage src={conversation.avatarUrl} alt={conversation.name} /> : null}
                    <AvatarFallback className="bg-[var(--app-soft)] text-[var(--app-strong)]">
                      {getInitials(conversation.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold">{conversation.name}</p>
                      <span className="text-xs text-[var(--app-muted)]">{formatConversationTime(conversation.lastMessageAt)}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-[var(--app-muted)]">
                      {truncateConversationPreview(conversation.lastMessage)}
                    </p>
                  </div>
                </button>
                {conversation.unreadCount > 0 ? (
                  <span className="mt-7 flex size-5 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-bold text-white">
                    {conversation.unreadCount}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setConversationToDelete(conversation)}
                  className="mt-6 flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--app-muted)] opacity-100 transition hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
                  title="Eliminar contacto"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <button type="button" className="flex h-14 w-full shrink-0 items-center justify-center gap-2 border-t border-[var(--app-line)] text-sm text-[var(--app-muted)] hover:text-[var(--app-strong)]">
            Cargar mas conversaciones
            <ChevronDown className="h-4 w-4" />
          </button>
        </aside>

        <main className={`${isMobileChatOpen ? 'flex' : 'hidden 2xl:flex'} h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--app-surface)]`}>
          {selectedConversation ? (
            <>
              <header className="flex min-h-[78px] shrink-0 items-center justify-between gap-3 border-b border-[var(--app-line)] bg-[var(--app-panel)] px-3 sm:min-h-[86px] sm:px-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Button type="button" variant="ghost" size="icon" className="2xl:hidden" onClick={() => setIsMobileChatOpen(false)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <Avatar className="h-12 w-12">
                    {selectedConversation.avatarUrl ? <AvatarImage src={selectedConversation.avatarUrl} alt={selectedConversation.name} /> : null}
                    <AvatarFallback className="bg-[var(--app-soft)] text-[var(--app-strong)]">
                      {getInitials(selectedConversation.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{selectedConversation.name}</h2>
                    <p className="text-xs text-[var(--app-muted)]">
                      Pedido #1042 · <span className="font-medium text-[var(--primary)]">En preparacion</span>
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                  <Button variant="outline" className="hidden border-[var(--app-line)] bg-[var(--app-surface)] sm:inline-flex">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Asignar
                  </Button>
                  <Button variant="outline" size="icon" className="hidden border-[var(--app-line)] bg-[var(--app-surface)] md:inline-flex">
                    <Tag className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="hidden border-[var(--app-line)] bg-[var(--app-surface)] md:inline-flex">
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="hidden border-[var(--app-line)] bg-[var(--app-surface)] sm:inline-flex">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="border-[var(--app-line)] bg-[var(--app-surface)]"
                    onClick={() => setIsCustomerPanelOpen(true)}
                    title="Informacion del cliente"
                  >
                    <MessageSquareText className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              <div className="shrink-0 border-b border-[var(--app-line)] bg-[var(--app-panel)] px-4 py-3">
                <div className="flex flex-col gap-3 rounded-lg border border-[var(--app-line)] bg-[var(--app-surface)] p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/15 text-[var(--primary)]">
                      <PackageCheck className="h-5 w-5" />
                    </div>
                    <p className="truncate">
                      {activeOrder
                        ? `Pedido #${getOrderNumber(activeOrder)} · Total $${getOrderTotal(activeOrder)}`
                        : 'Sin pedido activo'}
                    </p>
                  </div>
                  <Button className="w-full shrink-0 sm:w-auto" onClick={() => setIsCreateOrderOpen(true)}>
                    Crear pedido
                  </Button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1">
                <div
                  ref={messagesViewportRef}
                  onScroll={handleMessagesScroll}
                  className="h-full max-h-[554px] min-h-0 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(249,115,22,0.10)_1px,transparent_0)] [background-size:22px_22px] p-4"
                >
                  <div className="mx-auto mb-4 w-fit rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-4 py-1 text-sm font-medium">
                    Hoy
                  </div>
                  {isLoadingMessages ? (
                    <div className="text-sm text-[var(--app-muted)]">Cargando mensajes...</div>
                  ) : messages.length === 0 ? (
                    <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4 text-sm text-[var(--app-muted)]">
                      Todavia no hay mensajes en esta conversacion.
                    </div>
                  ) : messages.map((message) => {
                    const outbound = message.direction === 'outbound';
                    const mediaKind = getMediaKind(message);
                    return (
                      <div key={message.id} className={`mb-3 flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[78%] rounded-xl px-4 py-3 shadow-sm ${
                          outbound
                            ? 'rounded-tr-sm bg-emerald-100 text-slate-950 dark:bg-emerald-950/70 dark:text-white'
                            : 'rounded-tl-sm border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]'
                        }`}
                        >
                          {message.mediaUrl ? (
                            <div className={message.body ? 'mb-2' : ''}>
                              {mediaKind === 'image' ? (
                                <img src={message.mediaUrl} alt={message.mediaFilename ?? 'Imagen adjunta'} className="max-h-72 w-full rounded-lg object-cover" />
                              ) : mediaKind === 'video' ? (
                                <video src={message.mediaUrl} controls className="max-h-72 w-full rounded-lg" />
                              ) : mediaKind === 'audio' ? (
                                <audio src={message.mediaUrl} controls className="w-64 max-w-full" />
                              ) : (
                                <a href={message.mediaUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-soft)] p-3 text-sm underline">
                                  <Paperclip className="h-4 w-4" />
                                  {message.mediaFilename || 'Abrir adjunto'}
                                </a>
                              )}
                            </div>
                          ) : null}
                          {message.body ? (
                            <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                              {renderWhatsappText(message.body)}
                            </div>
                          ) : null}
                          <div className="mt-2 flex items-center justify-end gap-1 text-[11px] opacity-70">
                            <span>{formatMessageTime(message.createdAt)}</span>
                            {outbound ? <span className="text-sky-500">✓✓</span> : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
                {showScrollToBottom ? (
                  <Button
                    type="button"
                    size="icon"
                    className="absolute bottom-4 right-4 z-10 size-11 rounded-full border border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)] shadow-lg hover:bg-[var(--app-soft)]"
                    onClick={() => scrollToConversationEnd('smooth')}
                    title="Ir al final de la conversación"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </Button>
                ) : null}
              </div>

              <footer className="shrink-0 p-3 sm:p-4">
                <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                  {quickReplies.map((reply) => {
                    const Icon = reply.icon;
                    return (
                      <Button
                        key={reply.label}
                        type="button"
                        variant="outline"
                        className="shrink-0 border-[var(--app-line)] bg-[var(--app-surface)]"
                        onClick={() => insertQuickReply(reply.text)}
                      >
                        <Icon className="mr-2 h-4 w-4" />
                        {reply.label}
                      </Button>
                    );
                  })}
                </div>
                {pendingAttachments.length > 0 ? (
                  <div className="mb-3 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--app-line)] bg-[var(--app-panel)] p-2">
                    {pendingAttachments.map((attachment) => (
                      <div key={attachment.id} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                        <img src={attachment.url} alt={attachment.name} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removePendingAttachment(attachment.id)}
                          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-md bg-black/70 text-white hover:bg-black"
                          title="Quitar imagen"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="relative flex items-end gap-2 rounded-[28px] border border-[var(--app-line)] bg-[var(--app-panel)] px-3 py-1 text-[var(--app-strong)] shadow-sm">
                  {isSelectionToolbarVisible ? (
                    <div className="absolute bottom-[calc(100%+10px)] left-12 z-20 flex items-center gap-1 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel)] p-2 text-[var(--app-strong)] shadow-xl">
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('bold')}><Bold className="h-4 w-4" /></button>
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('italic')}><Italic className="h-4 w-4" /></button>
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('strikeThrough')}><Strikethrough className="h-4 w-4" /></button>
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('formatBlock', 'pre')}><Code className="h-4 w-4" /></button>
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('insertOrderedList')}><ListOrdered className="h-4 w-4" /></button>
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('insertUnorderedList')}><List className="h-4 w-4" /></button>
                      <button type="button" className="rounded-md p-2 hover:bg-[var(--app-soft)]" onMouseDown={(event) => event.preventDefault()} onClick={() => applyEditorCommand('formatBlock', 'blockquote')}><Quote className="h-4 w-4" /></button>
                    </div>
                  ) : null}
                  {isRecordingAudio ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mb-1 size-10 shrink-0 rounded-full text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
                        onClick={() => stopRecording(false)}
                        title="Cancelar audio"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                      <div className="flex min-h-[48px] flex-1 items-center gap-4 overflow-hidden py-2">
                        <span className="size-2.5 shrink-0 rounded-full bg-rose-400" />
                        <span className="min-w-[48px] text-lg font-semibold text-[var(--app-strong)]">
                          {formatRecordingTime(recordingElapsed)}
                        </span>
                        <div className="flex h-9 min-w-0 flex-1 items-center gap-1 overflow-hidden">
                          {recordingWaveform.map((height, index) => (
                            <span
                              key={index}
                              className="w-1 shrink-0 rounded-full bg-[var(--app-muted)] transition-[height] duration-75"
                              style={{ height: `${height}px` }}
                            />
                          ))}
                        </div>
                        <span className="flex items-center gap-1 text-rose-300">
                          <span className="h-4 w-1.5 rounded-full bg-current" />
                          <span className="h-4 w-1.5 rounded-full bg-current" />
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" className="mb-1 size-10 shrink-0 rounded-full text-[var(--app-strong)] hover:bg-[var(--app-soft)]">
                        <Paperclip className="h-5 w-5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="mb-1 size-10 shrink-0 rounded-full text-[var(--app-strong)] hover:bg-[var(--app-soft)]">
                        <Smile className="h-5 w-5" />
                      </Button>
                      <div className="relative flex max-h-40 min-h-[32px] mb-1 flex-1 flex-col justify-end overflow-hidden py-2">
                        {!newMessage.trim() ? (
                          <span className="pointer-events-none absolute left-0 mb-1 bottom-2 text-sm text-[var(--app-muted)]">Escribe un mensaje</span>
                        ) : null}
                        <div
                          ref={editorRef}
                          contentEditable
                          role="textbox"
                          aria-label="Escribe un mensaje"
                          suppressContentEditableWarning
                          onPaste={handlePasteAttachment}
                          onInput={() => setNewMessage(editorRef.current?.innerText ?? '')}
                          onMouseUp={handleEditorSelection}
                          onKeyUp={handleEditorSelection}
                          onBlur={() => setTimeout(() => setIsSelectionToolbarVisible(false), 160)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void handleSendMessage();
                            }
                          }}
                          className="max-h-36 min-h-[26px] w-full overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 outline-none"
                        />
                      </div>
                    </>
                  )}
                  <Button
                    type="button"
                    onClick={isRecordingAudio ? () => stopRecording(true) : newMessage.trim() || pendingAttachments.length > 0 ? handleSendMessage : handleStartRecording}
                    disabled={isSending || ((!newMessage.trim() && pendingAttachments.length === 0) && !selectedConversation)}
                    size="icon"
                    className={`mb-1 size-12 shrink-0 rounded-full text-black disabled:opacity-50 ${
                      isRecordingAudio
                        ? 'bg-emerald-500 hover:bg-emerald-400'
                        : 'bg-emerald-500 hover:bg-emerald-400'
                    }`}
                    title={newMessage.trim() || pendingAttachments.length > 0 ? 'Enviar mensaje' : isRecordingAudio ? 'Enviar audio' : 'Grabar audio'}
                  >
                    {newMessage.trim() || pendingAttachments.length > 0 || isRecordingAudio ? (
                      <Send className="h-5 w-5 fill-current" />
                    ) : (
                      <Mic className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-[var(--app-muted)]">
              Selecciona una conversacion para comenzar.
            </div>
          )}
        </main>

        {isCustomerPanelOpen ? (
        <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-sm overflow-y-auto border-l border-[var(--app-line)] bg-[var(--app-panel)] p-5 shadow-2xl">
          {selectedConversation ? (
            <div className="space-y-6">
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="font-semibold">Informacion del cliente</h3>
                  <Button variant="ghost" size="icon" onClick={() => setIsCustomerPanelOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    {selectedConversation.avatarUrl ? <AvatarImage src={selectedConversation.avatarUrl} alt={selectedConversation.name} /> : null}
                    <AvatarFallback className="bg-[var(--app-soft)] text-[var(--app-strong)]">
                      {getInitials(selectedConversation.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{customerLookup?.name ?? selectedConversation.name}</p>
                    <p className="text-sm text-[var(--app-muted)]">{selectedConversation.channel ?? 'whatsapp'}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-[var(--app-muted)]" />{customerLookup?.phone || selectedConversation.phone || '-'}</p>
                  <p className="flex items-center gap-3"><Mail className="h-4 w-4 text-[var(--app-muted)]" />{selectedConversation.email || '-'}</p>
                  <p className="flex items-center gap-3"><Bell className="h-4 w-4 text-[var(--app-muted)]" />{customerLookup?.savedAddress?.formatted || '-'}</p>
                </div>
              </section>

              <section className="border-t border-[var(--app-line)] pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">{activeOrder ? 'Pedido activo' : 'Pedidos recientes'}</h3>
                  <button type="button" className="text-sm font-semibold text-[var(--primary)]" onClick={() => setIsCreateOrderOpen(true)}>Crear pedido</button>
                </div>
                <div className="space-y-4 text-sm">
                  {(activeOrder ? [activeOrder] : customerOrders.slice(0, 3)).map((order) => (
                    <div key={String(order.id ?? getOrderNumber(order))} className="flex justify-between gap-3 rounded-lg border border-[var(--app-line)] p-3">
                      <div><p className="font-semibold">#{getOrderNumber(order)}</p><p className="text-[var(--app-muted)]">{order.createdAt ? formatConversationTime(parseDate(order.createdAt)) : '-'}</p></div>
                      <div className="text-right"><p className="font-semibold text-[var(--primary)]">{getOrderStatus(order) || 'Activo'}</p><p>$ {getOrderTotal(order)}</p></div>
                    </div>
                  ))}
                  {customerOrders.length === 0 ? (
                    <p className="text-sm text-[var(--app-muted)]">No hay pedidos registrados para este cliente.</p>
                  ) : null}
                </div>
              </section>

              <section className="border-t border-[var(--app-line)] pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">Etiquetas</h3>
                  <button type="button" className="text-[var(--primary)]"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {customerTags.map((tag, index) => (
                    <Badge key={tag} className={index === 0 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'}>
                      {tag}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  ))}
                </div>
              </section>

              <section className="border-t border-[var(--app-line)] pt-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold">Notas</h3>
                  <button type="button" className="text-sm font-semibold text-[var(--primary)]">+ Agregar nota</button>
                </div>
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-slate-800 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-100">
                  <p>Cliente prefiere retiro en local. Muy amable.</p>
                  <p className="mt-4 text-xs opacity-70">Guardado por el equipo</p>
                </div>
              </section>
            </div>
          ) : null}
        </aside>
        ) : null}
      </section>

      <DeleteConfirmDialog
        open={Boolean(conversationToDelete)}
        onOpenChange={(open) => {
          if (!open) setConversationToDelete(null);
        }}
        itemLabel="Contacto"
        itemName={conversationToDelete?.name ?? ''}
        itemIcon={conversationToDelete ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)]">
            {getInitials(conversationToDelete.name)}
          </span>
        ) : null}
        loading={isDeletingConversation}
        onConfirm={handleDeleteConversation}
      />

      {isOrderDialogMinimized && isCreateOrderOpen ? (
        <button
          type="button"
          onClick={() => setIsOrderDialogMinimized(false)}
          className="fixed bottom-24 right-5 z-50 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white shadow-xl"
        >
          Nueva orden minimizada
        </button>
      ) : null}

      <CreateOrderDialog
        open={isCreateOrderOpen && !isOrderDialogMinimized}
        onClose={() => {
          setIsCreateOrderOpen(false);
          setIsOrderDialogMinimized(false);
        }}
        onMinimize={() => setIsOrderDialogMinimized(true)}
        onCreated={() => {
          setIsCreateOrderOpen(false);
          setIsOrderDialogMinimized(false);
        }}
        availableProducts={availableProducts}
        availableCategories={availableCategories}
      />

      <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <UserPlus size={18} />
            </div>
            <DialogTitle>Nuevo chat</DialogTitle>
            <DialogDescription>Inicia una conversación de WhatsApp con un contacto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div>
              <Label>Nombre</Label>
              <Input value={newChatName} onChange={(event) => setNewChatName(event.target.value)} placeholder="Ej: Maria Lopez" className={`mt-2 ${FORM_CONTROL_CLASS}`} />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input value={newChatPhone} onChange={(event) => setNewChatPhone(event.target.value)} placeholder="Ej: +54 9 11 1234 5678" className={`mt-2 ${FORM_CONTROL_CLASS}`} />
            </div>
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsNewChatOpen(false)}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleCreateChat} disabled={isSending}>Iniciar chat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
