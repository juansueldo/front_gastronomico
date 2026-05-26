import { useState, useEffect, useRef } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { useParams, useNavigate, useLocation } from 'react-router';
import {
  ArrowLeft,
  Send,
  Paperclip,
  Smile,
  MoreVertical,
  Star,
  Archive,
  Trash2,
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  File,
  Download,
  ExternalLink,
} from 'lucide-react';
import { conversations, messages as mockMessages, agents, type Message } from '../data/mockData';
import { Avatar, AvatarFallback } from '../shared/ui/components/avatar';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import { Badge } from '../shared/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../shared/ui/components/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shared/ui/components/select';
import { Checkbox } from '../shared/ui/components/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../shared/ui/components/dialog';
import { APP_NEW_MESSAGE_EVENT, type AppNewMessageDetail } from '../pushNotifications';
import { getLoggedUser } from '../core/storage/authStorage';
import { toast } from 'sonner';
import {
  fetchMessages,
  sendMessage,
  updateContact,
} from '../features/chat/services/chat.service';
import { ApiError } from '../core/http/errors';
import { createOrder } from '../features/orders/services/orders.service';
import {
  fetchProductCategories,
  fetchProducts,
  type ProductCategory,
  type ProductItem,
} from '../features/products';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '../shared/ui/components/carousel';
import {
  geocodeAddress,
  type GeocodedAddressResult,
} from '../shared/services/geocoding.service';


type ChatImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_REALTIME_URL?: string;
    VITE_GOOGLE_MAPS_API_KEY?: string;
  };
};

type ChatChannel = 'whatsapp' | 'facebook' | 'instagram' | 'email';

interface ChatConversation {
  id: string;
  contactName: string;
  contactAvatar: string;
  lastMessage: string;
  phone?: string;
  created_at: Date;
  unreadCount: number;
  status: 'new' | 'assigned' | 'starred' | 'closed' | 'deleted' | 'draft';
  assignedTo?: string;
  channel: ChatChannel;
  instanceId?: string;
}

const API_URL = (import.meta as ChatImportMeta).env?.VITE_API_URL;
const REALTIME_URL = (import.meta as ChatImportMeta).env?.VITE_REALTIME_URL;
const GOOGLE_MAPS_API_KEY = (import.meta as ChatImportMeta).env?.VITE_GOOGLE_MAPS_API_KEY;

interface ApiMessageItem {
  id?: number | string;
  msg_id?: string;
  contact_id?: number | string;
  direction?: 'o' | 'i';
  content?: string;
  message?: string;
  text?: string;
  created_at?: number | string | Date;
  timestamp?: string;
  date?: string;
  type?: number;
  label?: number;
  seat_id?: number;
  ack?: number | string;
  status?: number;
  media_path?: string;
  media_mime?: string;
  media_filename?: string;
  media_size?: number;
  mediaUrl?: string;
  group_author_name?: string;
  groupAuthorName?: string;
  reply_to_message_id?: string | number;
  replyToMessageId?: string | number;
  reply_to_content?: string;
  replyToContent?: string;
  quoted_msg_id?: string | number;
  quoted_content?: string;
  reactions?: string[] | Record<string, number>;
  reaction_emoji?: string;
  reaction_target_msg_id?: string | number;
  reactionEmoji?: string;
  reactionTargetMsgId?: string | number;
  msgId?: string;
}

interface ApiMessagesResponse {
  messages?: ApiMessageItem[];
  contact?: {
    id?: number | string;
    name?: string;
    phone?: string;
  };
  ok?: boolean;
}

interface ChatMessage extends Message {
  msgId?: string;
  ack?: 1 | 2 | 3;
  mediaUrl?: string;
  mediaMime?: string;
  mediaFilename?: string;
  mediaSize?: number;
  groupAuthorName?: string;
  quotedMessageId?: string;
  quotedMessageContent?: string;
  reactions?: Record<string, number>;
  reactionEmoji?: string;
  reactionTargetMessageId?: string;
}

export function ChatView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routeContactName = (location.state as { contactName?: string } | null)?.contactName;
  const routeChannel = (location.state as { channel?: ChatChannel } | null)?.channel;
  const routePhone = (location.state as { phone?: string } | null)?.phone;
  const routeInstanceId = (location.state as { instanceId?: string | number } | null)?.instanceId;
  const queryPhone = new URLSearchParams(location.search).get('phone');
  const queryInstanceId = new URLSearchParams(location.search).get('instanceId');
  const storageInstanceId = id ? window.sessionStorage.getItem(`chat:instance:${id}`) : null;
  const storagePhone = id ? window.sessionStorage.getItem(`chat:phone:${id}`) : null;
  const resolvedInstanceId =
    routeInstanceId !== undefined && routeInstanceId !== null
      ? String(routeInstanceId)
      : queryInstanceId || storageInstanceId || undefined;
  const resolvedPhone = routePhone ?? queryPhone ?? storagePhone ?? '';

  const mockConversation = conversations.find((c) => c.id === id) as (ChatConversation | undefined);
  const conversation =
    mockConversation ||
    (id
      ? {
          id,
          contactName: routeContactName ?? 'Nuevo contacto',
          contactAvatar: '',
          lastMessage: '',
          phone: resolvedPhone,
          timestamp: new Date(),
          unreadCount: 0,
          status: 'new' as const,
          assignedTo: '',
          channel: routeChannel ?? 'whatsapp',
          instanceId: resolvedInstanceId,
        }
      : undefined);
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages[id || ''] || []);
  const [newMessage, setNewMessage] = useState('');
  const [assignedAgent, setAssignedAgent] = useState(conversation?.assignedTo || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingContactData, setIsLoadingContactData] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isScheduleOrderDialogOpen, setIsScheduleOrderDialogOpen] = useState(false);
  const [contactData, setContactData] = useState<unknown>(null);
  const [contactPhone, setContactPhone] = useState(conversation?.phone ?? resolvedPhone);
  const [scheduledOrderType, setScheduledOrderType] = useState<'delivery' | 'salon'>('delivery');
  const [scheduledOrderAddress, setScheduledOrderAddress] = useState('');
  const [scheduledOrderDetail, setScheduledOrderDetail] = useState('');
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);
  const [scheduledProductFilter, setScheduledProductFilter] = useState('');
  const [scheduledCategoryFilter, setScheduledCategoryFilter] = useState('all');
  const [scheduledSelectedProductIds, setScheduledSelectedProductIds] = useState<string[]>([]);
  const [scheduledOrderNotes, setScheduledOrderNotes] = useState('');
  const [isValidatingScheduledAddress, setIsValidatingScheduledAddress] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<Pick<ChatMessage, 'id' | 'msgId' | 'content' | 'groupAuthorName'> | null>(null);
  const [localMessageReactions, setLocalMessageReactions] = useState<Record<string, string | undefined>>({});
  const [messageActionsMessage, setMessageActionsMessage] = useState<ChatMessage | null>(null);
  const [showReactionPickerFor, setShowReactionPickerFor] = useState<string | null>(null);

  const quickEmojis = ['😀', '😂', '😍', '🙏', '👍', '🎉', '❤️', '🤖'];
  const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });
  const scheduledSelectedProducts = availableProducts.filter((product) => scheduledSelectedProductIds.includes(product.id));
  const scheduledOrderTotal = scheduledSelectedProducts.reduce((accumulator, product) => accumulator + product.price, 0);
  const categoriesById = availableCategories.reduce((accumulator, category) => {
    accumulator[category.id] = category;
    return accumulator;
  }, {} as Record<string, ProductCategory>);

  const filteredProducts = availableProducts.filter((product) => {
    const normalizedFilter = scheduledProductFilter.trim().toLowerCase();
    const matchesName = normalizedFilter.length === 0
      || product.name.toLowerCase().includes(normalizedFilter)
      || (product.description ?? '').toLowerCase().includes(normalizedFilter);
    const matchesCategory = scheduledCategoryFilter === 'all'
      || (product.categoryIds ?? []).includes(scheduledCategoryFilter);

    return matchesName && matchesCategory;
  });

  const groupedFilteredProducts = filteredProducts.reduce((accumulator, product) => {
    const categoryIds = (product.categoryIds ?? []).length > 0 ? (product.categoryIds as string[]) : ['uncategorized'];

    categoryIds.forEach((categoryId) => {
      const categoryLabel = categoryId === 'uncategorized'
        ? 'Sin categoría'
        : categoriesById[categoryId]?.name ?? 'Sin categoría';

      if (!accumulator[categoryLabel]) {
        accumulator[categoryLabel] = [];
      }

      accumulator[categoryLabel].push(product);
    });

    return accumulator;
  }, {} as Record<string, ProductItem[]>);

  const groupedFilteredProductEntries = Object.entries(groupedFilteredProducts)
    .map(([categoryName, products]) => [
      categoryName,
      products.filter((product, index, productList) => (
        productList.findIndex((candidate) => candidate.id === product.id) === index
      )),
    ] as const)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'));

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const [products, categories] = await Promise.all([
          fetchProducts(),
          fetchProductCategories(),
        ]);
        setAvailableProducts(products);
        setAvailableCategories(categories);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los productos');
      }
    };

    void loadProducts();
  }, []);

  const toggleScheduledProduct = (productId: string) => {
    setScheduledSelectedProductIds((prev) => (
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    ));
  };

  const getGroupAuthorColor = (authorName: string) => {
    const palette = ['#f59e0b', '#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fb7185', '#60a5fa', '#f97316'];
    let hash = 0;

    for (let index = 0; index < authorName.length; index += 1) {
      hash = ((hash << 5) - hash) + authorName.charCodeAt(index);
      hash |= 0;
    }

    return palette[Math.abs(hash) % palette.length];
  };

  const parseApiTimestamp = (rawTimestamp?: number | string | Date) => {
    if (!rawTimestamp) {
      return new Date();
    }

    if (rawTimestamp instanceof Date) {
      return Number.isNaN(rawTimestamp.getTime()) ? new Date() : rawTimestamp;
    }

    if (typeof rawTimestamp === 'number') {
      const timestampMs = rawTimestamp < 10_000_000_000 ? rawTimestamp * 1000 : rawTimestamp;
      const parsedDate = new Date(timestampMs);
      return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
    }

    const numericTimestamp = Number(rawTimestamp);
    if (!Number.isNaN(numericTimestamp) && rawTimestamp.trim() !== '') {
      const timestampMs = numericTimestamp < 10_000_000_000 ? numericTimestamp * 1000 : numericTimestamp;
      const parsedNumericDate = new Date(timestampMs);
      if (!Number.isNaN(parsedNumericDate.getTime())) {
        return parsedNumericDate;
      }
    }

    const parsedDate = new Date(rawTimestamp);
    return Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  };

  const normalizeMediaBaseUrl = (url: string) => {
    const trimmedUrl = url.trim();

    if (trimmedUrl.startsWith('ws://')) {
      return `http://${trimmedUrl.slice(5)}`;
    }

    if (trimmedUrl.startsWith('wss://')) {
      return `https://${trimmedUrl.slice(6)}`;
    }

    return trimmedUrl;
  };

  const resolveMediaUrl = (messageItem: ApiMessageItem) => {
    if (messageItem.media_path) {
      if (messageItem.media_path.startsWith('http://') || messageItem.media_path.startsWith('https://')) {
        return messageItem.media_path;
      }

      const mediaBaseUrl = REALTIME_URL ?? API_URL;

      if (!mediaBaseUrl) {
        return messageItem.media_path;
      }

      const normalizedMediaBaseUrl = normalizeMediaBaseUrl(mediaBaseUrl);
      const normalizedBaseUrl = normalizedMediaBaseUrl.endsWith('/')
        ? normalizedMediaBaseUrl.slice(0, -1)
        : normalizedMediaBaseUrl;
      const normalizedPath = messageItem.media_path.startsWith('/')
        ? messageItem.media_path
        : `/${messageItem.media_path}`;

      return `${normalizedBaseUrl}${normalizedPath}`;
    }

    if (messageItem.mediaUrl) {
      return messageItem.mediaUrl;
    }

    return undefined;
  };

  const stripMediaPrefix = (content: string) => content.replace(/^\[media:[^\]]+\]\s*/i, '').trim();

  useEffect(() => {
    if (!id || !resolvedInstanceId) {
      return;
    }

    window.sessionStorage.setItem(`chat:instance:${id}`, resolvedInstanceId);
  }, [id, resolvedInstanceId]);

  useEffect(() => {
    if (!id || !contactPhone?.trim()) {
      return;
    }

    window.sessionStorage.setItem(`chat:phone:${id}`, contactPhone.trim());
  }, [id, contactPhone]);

  useEffect(() => {
    const loadMessages = async () => {
      if (!id) {
        setMessages([]);
        return;
      }

      setIsLoadingMessages(true);
      try {
        const data = await fetchMessages(id) as unknown;
        const apiMessages: ApiMessageItem[] = Array.isArray(data)
          ? (data as ApiMessageItem[])
          : Array.isArray((data as ApiMessagesResponse)?.messages)
          ? ((data as ApiMessagesResponse).messages as ApiMessageItem[])
          : [];
        const mappedMessages: ChatMessage[] = apiMessages.map((messageItem, index) => {
        const rawTimestamp = messageItem.created_at ?? messageItem.timestamp ?? messageItem.date;
        const normalizedDate = parseApiTimestamp(rawTimestamp);
        const rawContent = messageItem.content ?? messageItem.message ?? messageItem.text ?? '';
        const normalizedContent = stripMediaPrefix(rawContent);
        const parsedAck = Number(messageItem.ack);
        const normalizedAck = parsedAck === 1 || parsedAck === 2 || parsedAck === 3
          ? (parsedAck as 1 | 2 | 3)
          : undefined;

          return {
            id: String(messageItem.id ?? messageItem.msg_id ?? `${id}-${index}`),
            msgId: String(messageItem.msg_id ?? messageItem.msgId ?? messageItem.id ?? `${id}-${index}`),
            conversationId: String(messageItem.contact_id ?? id),
            sender: messageItem.direction === 'o' ? 'agent' : 'contact',
            content: normalizedContent,
            timestamp: normalizedDate,
            ack: normalizedAck,
            mediaUrl: resolveMediaUrl(messageItem),
            mediaMime: messageItem.media_mime,
            mediaFilename: messageItem.media_filename,
            mediaSize: messageItem.media_size,
            groupAuthorName: messageItem.group_author_name ?? messageItem.groupAuthorName,
            quotedMessageId: messageItem.reply_to_message_id !== undefined || messageItem.replyToMessageId !== undefined
              ? String(messageItem.reply_to_message_id ?? messageItem.replyToMessageId)
              : messageItem.quoted_msg_id !== undefined
              ? String(messageItem.quoted_msg_id)
              : undefined,
            quotedMessageContent: messageItem.reply_to_content ?? messageItem.replyToContent ?? messageItem.quoted_content,
            reactions: normalizeReactions(messageItem.reactions),
            reactionEmoji: messageItem.reaction_emoji ?? messageItem.reactionEmoji,
            reactionTargetMessageId:
              messageItem.reaction_target_msg_id !== undefined || messageItem.reactionTargetMsgId !== undefined
                ? String(messageItem.reaction_target_msg_id ?? messageItem.reactionTargetMsgId)
                : undefined,
          };
        });

        const mergedMessages = mappedMessages.reduce((accumulator, currentMessage) => {
          if (currentMessage.reactionTargetMessageId && currentMessage.reactionEmoji) {
            return accumulator.map((message) => {
              if (message.msgId !== currentMessage.reactionTargetMessageId && message.id !== currentMessage.reactionTargetMessageId) {
                return message;
              }

              const baseReactions = message.reactions ?? {};
              return {
                ...message,
                reactions: {
                  ...baseReactions,
                  [currentMessage.reactionEmoji as string]: (baseReactions[currentMessage.reactionEmoji as string] ?? 0) + 1,
                },
              };
            });
          }

          return [...accumulator, currentMessage];
        }, [] as ChatMessage[]);

        mergedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setMessages(mergedMessages);
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        }
        setMessages(mockMessages[id] || []);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    void loadMessages();
  }, [id]);

  useEffect(() => {
    setAssignedAgent(conversation?.assignedTo || '');
  }, [conversation?.assignedTo, id]);

  useEffect(() => {
    const handleIncomingMessage = (event: Event) => {
      const customEvent = event as CustomEvent<AppNewMessageDetail>;
      const payload = customEvent.detail;

      if (payload.conversationId !== id) {
        return;
      }

      setMessages((prev) => {
        if (prev.some((message) => message.id === payload.messageId)) {
          return prev;
        }

        const timestamp = new Date(payload.timestamp);
        const normalizedDate = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

        const nextMessage: ChatMessage = {
          id: payload.messageId,
          msgId: payload.msgId ?? payload.messageId,
          conversationId: payload.conversationId,
          sender: payload.sender,
          content: payload.content,
          timestamp: normalizedDate,
          groupAuthorName: payload.groupAuthorName,
          quotedMessageId: payload.quotedMessageId ?? payload.quotedMsgId,
          quotedMessageContent: payload.quotedMessageContent ?? payload.quotedContent,
          reactions: normalizeReactions(payload.reactions),
          reactionEmoji: payload.reactionEmoji,
          reactionTargetMessageId: payload.reactionTargetMessageId,
        };

        if (nextMessage.reactionTargetMessageId && nextMessage.reactionEmoji) {
          return prev.map((message) => {
            if (message.msgId !== nextMessage.reactionTargetMessageId && message.id !== nextMessage.reactionTargetMessageId) {
              return message;
            }

            const baseReactions = message.reactions ?? {};
            return {
              ...message,
              reactions: {
                ...baseReactions,
                [nextMessage.reactionEmoji as string]: (baseReactions[nextMessage.reactionEmoji as string] ?? 0) + 1,
              },
            };
          });
        }

        const existingMessageIndex = prev.findIndex((message) => (
          message.id === nextMessage.id
          || (nextMessage.msgId !== undefined && message.msgId === nextMessage.msgId)
        ));

        if (existingMessageIndex >= 0) {
          const existingMessage = prev[existingMessageIndex];
          const mergedMessage: ChatMessage = {
            ...existingMessage,
            groupAuthorName: nextMessage.groupAuthorName ?? existingMessage.groupAuthorName,
            quotedMessageId: nextMessage.quotedMessageId ?? existingMessage.quotedMessageId,
            quotedMessageContent: nextMessage.quotedMessageContent ?? existingMessage.quotedMessageContent,
            reactions: {
              ...(existingMessage.reactions ?? {}),
              ...(nextMessage.reactions ?? {}),
            },
          };

          return prev.map((message, index) => (index === existingMessageIndex ? mergedMessage : message));
        }

        // Ignore reaction-only events that do not target an existing message.
        if (nextMessage.reactionEmoji && !nextMessage.content) {
          return prev;
        }

        return [...prev, nextMessage];
      });
    };

    window.addEventListener(APP_NEW_MESSAGE_EVENT, handleIncomingMessage);
    return () => {
      window.removeEventListener(APP_NEW_MESSAGE_EVENT, handleIncomingMessage);
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen bg-body text-white">
        <div className="text-center">
          <p className="mb-4">Conversación no encontrada</p>
          <Button onClick={() => navigate('/')}>Volver a la lista</Button>
        </div>
      </div>
    );
  }

  const handleSendMessage = async () => {
    const cleanedMessage = newMessage.trim();
    if (!cleanedMessage && attachedFiles.length === 0) {
      return;
    }
    if (!id) {
      return;
    }

    const attachmentText = attachedFiles.length > 0
      ? attachedFiles.map((file) => `📎 ${file.name}`).join('\n')
      : '';
    const fullContent = [cleanedMessage, attachmentText].filter(Boolean).join('\n\n');
    setIsSending(true);
    setNewMessage('');
    setAttachedFiles([]);
    setShowEmojiPicker(false);

    try {
      await sendMessage({
        contactId: id,
        content: fullContent,
        replyToMessageId: quotedMessage?.msgId ?? quotedMessage?.id,
        reply_to_message_id: quotedMessage?.msgId ?? quotedMessage?.id,
        replyToContent: quotedMessage?.content,
        reply_to_content: quotedMessage?.content,
        quoted_msg_id: quotedMessage?.msgId ?? quotedMessage?.id,
        quoted_content: quotedMessage?.content,
        seatId: getLoggedUser()?.seat_id ?? getLoggedUser()?.seatId ?? getLoggedUser()?.id,
      } as any);

      clearQuotedMessage();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo conectar al servidor');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected || selected.length === 0) {
      return;
    }

    const nextFiles = Array.from(selected);
    setAttachedFiles((prev) => [...prev, ...nextFiles]);
    event.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const addEmoji = (emoji: string) => {
    setNewMessage((prev) => `${prev}${emoji}`);
  };

  function normalizeReactions(rawReactions: ApiMessageItem['reactions']): Record<string, number> {
    if (Array.isArray(rawReactions)) {
      return rawReactions.reduce((accumulator, emoji) => {
        if (!emoji) {
          return accumulator;
        }

        return {
          ...accumulator,
          [emoji]: (accumulator[emoji] ?? 0) + 1,
        };
      }, {} as Record<string, number>);
    }

    if (rawReactions && typeof rawReactions === 'object') {
      return Object.entries(rawReactions).reduce((accumulator, [emoji, count]) => {
        const parsedCount = Number(count);

        if (!Number.isFinite(parsedCount) || parsedCount <= 0) {
          return accumulator;
        }

        return {
          ...accumulator,
          [emoji]: parsedCount,
        };
      }, {} as Record<string, number>);
    }

    return {};
  }

  const getDisplayedReactions = (message: ChatMessage) => {
    const baseReactions = message.reactions ?? {};
    const localReaction = localMessageReactions[message.id];

    if (!localReaction) {
      return baseReactions;
    }

    return {
      ...baseReactions,
      [localReaction]: (baseReactions[localReaction] ?? 0) + 1,
    };
  };

  const handleQuoteMessage = (message: ChatMessage) => {
    setQuotedMessage({
      id: message.id,
      msgId: message.msgId,
      content: message.content || '[Adjunto]',
      groupAuthorName: message.groupAuthorName,
    });
  };

  const clearQuotedMessage = () => {
    setQuotedMessage(null);
  };

  const handleToggleReaction = async (message: ChatMessage, emoji: string) => {
    const nextReaction = localMessageReactions[message.id] === emoji ? undefined : emoji;

    setLocalMessageReactions((prev) => ({
      ...prev,
      [message.id]: nextReaction,
    }));

    if (!nextReaction || !id) {
      return;
    }

    try {
      await sendMessage({
        contactId: id,
        content: '',
        reaction_emoji: nextReaction,
        reactionEmoji: nextReaction,
        reaction_target_msg_id: message.msgId ?? message.id,
        reactionTargetMsgId: message.msgId ?? message.id,
        id: message.id,
        seatId: getLoggedUser()?.seat_id ?? getLoggedUser()?.seatId ?? getLoggedUser()?.id,
      } as any);
    } catch {
      // Keep optimistic reaction in UI even if transport fails.
    }
  };

  const handleOpenMessageActions = (message: ChatMessage) => {
    setMessageActionsMessage(message);
  };

  const handleMessageLongPressStart = (message: ChatMessage) => {
    messageLongPressTimerRef.current = setTimeout(() => {
      handleOpenMessageActions(message);
    }, 450);
  };

  const handleMessageLongPressEnd = () => {
    if (messageLongPressTimerRef.current) {
      clearTimeout(messageLongPressTimerRef.current);
      messageLongPressTimerRef.current = null;
    }
  };

  const handleMessageContextMenu = (event: React.MouseEvent, message: ChatMessage) => {
    event.preventDefault();
    handleOpenMessageActions(message);
  };

  const handleLoadWhatsappContactData = async () => {
    const contactId = Number(id);
    const instanceIdRaw = conversation.instanceId;
    const parsedInstanceId = Number(instanceIdRaw);
    const phone = contactPhone?.trim() || '';
    const name = conversation.contactName?.trim() || undefined;

    if (!Number.isInteger(contactId) || contactId <= 0) {
      toast.error('No se encontró contactId válido para esta conversación');
      return;
    }

    if (!phone) {
      toast.error('No se encontró phone para esta conversación');
      return;
    }

    setIsLoadingContactData(true);
    try {
      const data = await updateContact(contactId, {
        phone,
        name,
        instance_id: Number.isFinite(parsedInstanceId) && parsedInstanceId > 0
          ? parsedInstanceId
          : undefined,
      });

      setContactData(data);
      setIsContactDialogOpen(true);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo conectar al servidor');
      }
    } finally {
      setIsLoadingContactData(false);
    }
  };

  const handleScheduleOrder = async () => {
    const contactId = Number(id);
    const orderAddress = scheduledOrderAddress.trim();
    const selectedProductNames = scheduledSelectedProducts.map((product) => product.name);
    const orderDetail = scheduledOrderDetail.trim() || selectedProductNames.join(', ');
    const normalizedCustomerName = conversation.contactName?.trim() || undefined;
    const normalizedCustomerPhone = contactPhone?.trim() || undefined;

    if (!Number.isInteger(contactId) || contactId <= 0) {
      toast.error('No se encontró un contactId válido para esta conversación');
      return;
    }

    if (scheduledOrderType === 'delivery' && !orderAddress) {
      toast.error('Ingresá la dirección para el delivery');
      return;
    }

    if (!orderDetail) {
      toast.error('Ingresá el detalle de la orden');
      return;
    }

    if (scheduledSelectedProductIds.length === 0) {
      toast.error('Seleccioná al menos un producto');
      return;
    }

    if (!Number.isFinite(scheduledOrderTotal) || scheduledOrderTotal <= 0) {
      toast.error('No se pudo calcular el total de la orden');
      return;
    }

    let geocodedAddress: GeocodedAddressResult | null = null;

    if (scheduledOrderType === 'delivery') {
      setIsValidatingScheduledAddress(true);
      geocodedAddress = await geocodeAddress(orderAddress, { googleMapsApiKey: GOOGLE_MAPS_API_KEY });
      setIsValidatingScheduledAddress(false);

      if (!geocodedAddress) {
        toast.error('No se pudo validar la dirección. Revisá la dirección o intentá más tarde.');
        return;
      }
    }

    try {
      await createOrder({
        contactId,
        customerName: normalizedCustomerName,
        customerPhone: normalizedCustomerPhone,
        type: scheduledOrderType,
        detail: orderDetail,
        status: 'pending',
        total: String(scheduledOrderTotal),
        createdAt: new Date().toISOString(),
        notes: scheduledOrderNotes.trim() || undefined,
        address: geocodedAddress?.formattedAddress,
        latitude: geocodedAddress?.latitude,
        longitude: geocodedAddress?.longitude,
        items: selectedProductNames,
        productIds: scheduledSelectedProductIds,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo agendar la orden');
      return;
    }

    setIsScheduleOrderDialogOpen(false);
    setScheduledOrderType('delivery');
    setScheduledOrderAddress('');
    setScheduledOrderDetail('');
    setScheduledProductFilter('');
    setScheduledCategoryFilter('all');
    setScheduledSelectedProductIds([]);
    setScheduledOrderNotes('');
    toast.success(`Orden agendada para ${conversation.contactName}`);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (size?: number) => {
    if (!size || size <= 0) {
      return null;
    }

    if (size < 1024) {
      return `${size} B`;
    }

    const units = ['KB', 'MB', 'GB'];
    let value = size / 1024;
    let unitIndex = 0;

    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex += 1;
    }

    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const getFileExtension = (filename?: string, fallbackUrl?: string) => {
    const source = (filename ?? fallbackUrl ?? '').split('?')[0];
    const pieces = source.split('.');

    if (pieces.length < 2) {
      return '';
    }

    return pieces[pieces.length - 1].toLowerCase();
  };

  const isPdfFile = (mime?: string, filename?: string, fallbackUrl?: string) => {
    const extension = getFileExtension(filename, fallbackUrl);
    return mime === 'application/pdf' || extension === 'pdf';
  };

  const getDocumentIcon = (mime?: string, filename?: string, fallbackUrl?: string) => {
    const extension = getFileExtension(filename, fallbackUrl);
    const normalizedMime = (mime ?? '').toLowerCase();

    if (
      normalizedMime.includes('spreadsheet')
      || ['xls', 'xlsx', 'csv'].includes(extension)
    ) {
      return FileSpreadsheet;
    }

    if (
      normalizedMime.includes('zip')
      || normalizedMime.includes('rar')
      || ['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)
    ) {
      return FileArchive;
    }

    if (
      normalizedMime.includes('json')
      || normalizedMime.includes('xml')
      || normalizedMime.includes('javascript')
      || normalizedMime.includes('typescript')
      || ['json', 'xml', 'js', 'ts', 'tsx', 'html', 'css'].includes(extension)
    ) {
      return FileCode;
    }

    if (
      normalizedMime.includes('pdf')
      || normalizedMime.includes('word')
      || normalizedMime.includes('document')
      || ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt'].includes(extension)
    ) {
      return FileText;
    }

    return File;
  };

  const getAckIndicator = (ack?: 1 | 2 | 3) => {
    if (ack === 1) {
      return { symbol: '✓', className: 'text-indigo-200' };
    }

    if (ack === 2) {
      return { symbol: '✓✓', className: 'text-indigo-200' };
    }

    if (ack === 3) {
      return { symbol: '✓✓', className: 'text-sky-300' };
    }

    return null;
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    
    return messageDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const avatarFallbackColors = [
    'bg-label-primary',
    'bg-label-info',
    'bg-label-success',
    'bg-label-danger',
    'bg-label-warning',
    'bg-label-secondary',
  ];

  const getAvatarFallbackClass = (contactId: string) => {
    let hash = 0;

    for (let i = 0; i < contactId.length; i += 1) {
      hash = (hash << 5) - hash + contactId.charCodeAt(i);
      hash |= 0;
    }

    const index = Math.abs(hash) % avatarFallbackColors.length;
    return avatarFallbackColors[index];
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, ChatMessage[]>);

  return (
    <div className="flex flex-col h-screen bg-body">
      {/* Header */}
      <div className="bg-card p-4 border-b border-orange-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-white shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className={getAvatarFallbackClass(conversation.id)}>
                {getInitials(conversation.contactName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-white truncate">
                {conversation.contactName}
              </h2>
              <p className="text-xs text-gray-400">
                {conversation.phone}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex size-9 items-center justify-center rounded-md text-white hover:bg-accent hover:text-accent-foreground">
                <span className="sr-only">Abrir menú</span>
                <span aria-hidden="true">
                  <MoreVertical className="h-5 w-5" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className='bg-card'>
                <DropdownMenuItem
                  disabled={isLoadingContactData}
                  onSelect={() => {
                    void handleLoadWhatsappContactData();
                  }}
                >
                  <Star className="mr-2 h-4 w-4" />
                  {isLoadingContactData ? 'Consultando contacto...' : 'Obtener datos del contacto'}
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Star className="mr-2 h-4 w-4" />
                  Destacar
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    setIsScheduleOrderDialogOpen(true);
                  }}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Agendar orden
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {isLoadingMessages && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p>Cargando mensajes...</p>
          </div>
        ) : null}
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center justify-center mb-4">
              <div className="bg-card px-3 py-1 rounded-full">
                <span className="text-xs text-gray-400">{date}</span>
              </div>
            </div>

            {/* Messages for this date */}
            <div className="space-y-3">
              {dateMessages.map((message) => {
                const isAgent = message.sender === 'agent';
                const ackIndicator = getAckIndicator(message.ack);
                const hasMedia = !!message.mediaUrl;
                const isImage = hasMedia && !!message.mediaMime?.startsWith('image/');
                const isVideo = hasMedia && !!message.mediaMime?.startsWith('video/');
                const isAudio = hasMedia && !!message.mediaMime?.startsWith('audio/');
                const isPdf = hasMedia && isPdfFile(message.mediaMime, message.mediaFilename, message.mediaUrl);
                const isDocument = hasMedia && !isImage && !isVideo && !isAudio;
                const documentExtension = getFileExtension(message.mediaFilename, message.mediaUrl).toUpperCase();
                const documentSize = formatFileSize(message.mediaSize);
                const DocumentIcon = getDocumentIcon(message.mediaMime, message.mediaFilename, message.mediaUrl);
                const displayedReactions = getDisplayedReactions(message);
                const reactionEntries = Object.entries(displayedReactions).filter(([, count]) => count > 0);
                const quotedPreview = message.quotedMessageContent
                  ?? (message.quotedMessageId
                    ? messages.find((candidate) => candidate.id === message.quotedMessageId)?.content
                    : undefined);

                return (
                  <div
                    key={message.id}
                    className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} max-w-[75%]`}>
                      <div
                        className={`rounded-2xl px-1 py-2 w-fit ${
                          isAgent
                            ? 'bg-primary'
                            : 'bg-card text-white'
                        }`}
                        onContextMenu={(event) => handleMessageContextMenu(event, message)}
                        onTouchStart={() => handleMessageLongPressStart(message)}
                        onTouchEnd={handleMessageLongPressEnd}
                        onTouchCancel={handleMessageLongPressEnd}
                        onMouseDown={() => handleMessageLongPressStart(message)}
                        onMouseUp={handleMessageLongPressEnd}
                        onMouseLeave={handleMessageLongPressEnd}
                      >
                        {message.groupAuthorName ? (
                          <p
                            className="mb-1 px-2 text-xs font-medium"
                            style={{ color: getGroupAuthorColor(message.groupAuthorName) }}
                          >
                            {message.groupAuthorName}
                          </p>
                        ) : null}

                        {quotedPreview ? (
                          <div className={`bg-body border-left-success mb-2 rounded-md border px-2 py-1 text-xs ${isAgent ? 'border-indigo-300/40 bg-indigo-300/10 text-indigo-100' : 'border-orange-600 bg-black/20 text-gray-300'}`}>
                            <p className="line-clamp-2">{quotedPreview}</p>
                          </div>
                        ) : null}

                        {hasMedia ? (
                          <div className="mb-2">
                            {isImage ? (
                              <img
                                src={message.mediaUrl}
                                alt={message.mediaFilename ?? 'Imagen adjunta'}
                                className="max-w-64 rounded-lg border border-black/20"
                                loading="lazy"
                              />
                            ) : null}

                            {isVideo ? (
                              <video
                                src={message.mediaUrl}
                                controls
                                className="max-w-64 rounded-lg border border-black/20"
                              />
                            ) : null}

                            {isAudio ? (
                              <audio src={message.mediaUrl} controls className="max-w-64" />
                            ) : null}

                            {isDocument ? (
                              <div className="w-full max-w-72 space-y-2 rounded-xl border border-white/10 bg-black/20 p-2 bg-body">
                                <div className="flex items-start gap-2">
                                  <div className="mt-0.5 rounded-md bg-white/10 p-1.5">
                                    <DocumentIcon className="h-4 w-4 text-white/90" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm text-white break-all line-clamp-2">
                                      {message.mediaFilename ?? 'Archivo adjunto'}
                                    </p>
                                    <p className="text-[11px] text-gray-300">
                                      {[documentExtension || null, documentSize].filter(Boolean).join(' • ') || 'Documento'}
                                    </p>
                                  </div>
                                </div>

                                {isPdf ? (
                                  <iframe
                                    src={message.mediaUrl}
                                    title={message.mediaFilename ?? 'Vista previa PDF'}
                                    className="h-48 w-full rounded-md border border-white/10 bg-white"
                                    loading="lazy"
                                  />
                                ) : null}

                                <div className="flex items-center gap-2">
                                  <a
                                    href={message.mediaUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-xs text-white hover:bg-white/20"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Abrir
                                  </a>
                                  <a
                                    href={message.mediaUrl}
                                    download={message.mediaFilename}
                                    className="inline-flex items-center gap-1 rounded-md border border-white/20 px-2 py-1 text-xs text-white hover:bg-white/10"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Descargar
                                  </a>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {message.content ? (
                          <p className="text-sm px-2 break-words">{message.content}</p>
                        ) : null}
                      </div>
                      {/* Reactions below message */}
                      {reactionEntries.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {reactionEntries.map(([emoji, count]) => (
                            <span key={`${message.id}-${emoji}`} className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-xs text-white">
                              <span>{emoji}</span>
                              <span>{count}</span>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {/* Reaction button and picker */}
                      <div className="flex items-center gap-2 mt-1 relative">
                        <Button
                          size="xs"
                          variant="ghost"
                          className="text-gray-400 hover:text-white px-1 py-0 h-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowReactionPickerFor(message.id);
                          }}
                          type="button"
                          aria-label="Reaccionar"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                        {showReactionPickerFor === message.id && (
                          <div className="absolute left-0 top-8 z-50">
                            <EmojiPicker
                              onEmojiClick={(emojiData) => {
                                void handleToggleReaction(message, emojiData.emoji);
                                setShowReactionPickerFor(null);
                              }}
                              theme="dark"
                              height={350}
                              width={300}
                            />
                            <div className="flex justify-end mt-1">
                              <Button size="xs" variant="ghost" onClick={() => setShowReactionPickerFor(null)}>Cerrar</Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs ${isAgent ? 'text-indigo-200' : 'text-gray-400'}`}>{formatTime(message.timestamp)}</span>
                        {isAgent && ackIndicator ? (
                          <span className={`text-xs leading-none ${ackIndicator.className}`}>
                            {ackIndicator.symbol}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-card p-4 border-t border-orange-700">
        {quotedMessage ? (
          <div className="mb-3 rounded-md border border-indigo-400/40 bg-indigo-500/10 px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-indigo-200">Respondiendo a {quotedMessage.groupAuthorName ?? 'mensaje'}</p>
                <p className="text-xs text-gray-300 truncate">{quotedMessage.content}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-gray-300 hover:text-white"
                onClick={clearQuotedMessage}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {/* Emoji picker modal para input */}
        {showEmojiPicker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-card rounded-lg p-2 border border-orange-700 shadow-lg">
              <EmojiPicker
                onEmojiClick={(emojiData) => {
                  addEmoji(emojiData.emoji);
                  setShowEmojiPicker(false);
                }}
                theme="dark"
                height={400}
                width={350}
              />
              <div className="flex justify-end mt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowEmojiPicker(false)}>Cerrar</Button>
              </div>
            </div>
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <button
                key={`${file.name}-${index}`}
                onClick={() => removeAttachedFile(index)}
                className="text-xs px-2 py-1 rounded-full bg-body border border-orange-600 text-gray-300 hover:bg-gray-700"
                type="button"
              >
                {file.name} ×
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white shrink-0"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleAttachFiles}
          />

          <div className="flex-1 bg-body rounded-lg border border-orange-600 p-0">
            <Input
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-0 p-2 text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white shrink-0"
            onClick={() => setShowEmojiPicker(true)}
            type="button"
            aria-label="Abrir selector de emoji"
          >
            <Smile className="h-5 w-5" />
          </Button>

          <Button
            onClick={handleSendMessage}
            size="icon"
            className="shrink-0"
            disabled={isSending || (!newMessage.trim() && attachedFiles.length === 0)}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Dialog open={!!messageActionsMessage} onOpenChange={() => setMessageActionsMessage(null)}>
        <DialogContent className="bg-card text-white border-orange-700 max-w-sm">
          <DialogHeader>
            <DialogTitle>Acciones del mensaje</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {messageActionsMessage ? (
              <div className="rounded-md border border-orange-700 bg-body p-2">
                <p className="text-xs text-gray-400">Mensaje seleccionado</p>
                <p className="text-sm text-white break-words line-clamp-3">
                  {messageActionsMessage.content || '[Adjunto]'}
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={() => {
                if (messageActionsMessage) {
                  handleQuoteMessage(messageActionsMessage);
                }
                setMessageActionsMessage(null);
              }}
            >
              Citar mensaje
            </Button>

            <div className="space-y-2">
              <p className="text-xs text-gray-400">Reaccionar</p>
              <div className="grid grid-cols-4 gap-2">
                {['👍', '❤️', '😂', '🔥', '😮', '🙏', '😢', '👏'].map((emoji) => (
                  <Button
                    key={`menu-react-${emoji}`}
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => {
                      if (messageActionsMessage) {
                        void handleToggleReaction(messageActionsMessage, emoji);
                      }
                      setMessageActionsMessage(null);
                    }}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] border-orange-700 bg-card text-white sm:w-[70vw] sm:!max-w-[70vw]">
          <DialogHeader>
            <DialogTitle>Datos del contacto</DialogTitle>
          </DialogHeader>
          <div className="max-h-[55vh] overflow-auto rounded-md border border-orange-700 bg-body p-3">
            <pre className="text-xs text-gray-200 whitespace-pre-wrap break-all">
              {contactData ? JSON.stringify(contactData, null, 2) : 'Sin datos'}
            </pre>
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setIsContactDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isScheduleOrderDialogOpen} onOpenChange={setIsScheduleOrderDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] border-orange-700 bg-card text-white sm:w-[70vw] sm:!max-w-[70vw]">
          <DialogHeader>
            <DialogTitle>Agendar orden para {conversation.contactName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Select value={scheduledOrderType} onValueChange={(value) => setScheduledOrderType(value as 'delivery' | 'salon')}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de orden" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="salon">Salón</SelectItem>
              </SelectContent>
            </Select>

            {scheduledOrderType === 'delivery' ? (
              <Input
                placeholder="Dirección de entrega"
                value={scheduledOrderAddress}
                onChange={(event) => setScheduledOrderAddress(event.target.value)}
              />
            ) : null}

            <Input
              placeholder="Detalle de la orden"
              value={scheduledOrderDetail}
              onChange={(event) => setScheduledOrderDetail(event.target.value)}
            />

            <div className="space-y-2 rounded-md border border-orange-700 bg-body p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">Productos</p>
                <span className="text-xs text-gray-400">Total: {currencyFormatter.format(scheduledOrderTotal)}</span>
              </div>

              <Input
                placeholder="Buscar producto por nombre..."
                value={scheduledProductFilter}
                onChange={(event) => setScheduledProductFilter(event.target.value)}
                className="h-9"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={scheduledCategoryFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setScheduledCategoryFilter('all')}
                >
                  Todas
                </Button>
                {availableCategories.map((category) => (
                  <Button
                    key={category.id}
                    type="button"
                    size="sm"
                    variant={scheduledCategoryFilter === category.id ? 'default' : 'outline'}
                    onClick={() => setScheduledCategoryFilter(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              {availableProducts.length === 0 ? (
                <p className="text-xs text-gray-500">No hay productos cargados</p>
              ) : groupedFilteredProductEntries.length === 0 ? (
                <p className="text-xs text-gray-500">No se encontraron productos con ese filtro</p>
              ) : (
                <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                  {groupedFilteredProductEntries.map(([categoryName, categoryProducts]) => (
                    <div key={categoryName} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-300 uppercase tracking-wide">{categoryName}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryProducts.length}
                        </Badge>
                      </div>

                      <Carousel opts={{ align: 'start', dragFree: true }} className="px-10">
                        <CarouselContent className="-ml-2">
                          {categoryProducts.map((product) => {
                            const isSelected = scheduledSelectedProductIds.includes(product.id);

                            return (
                              <CarouselItem key={product.id} className="pl-2 basis-[78%] sm:basis-1/2">
                                <button
                                  type="button"
                                  onClick={() => toggleScheduledProduct(product.id)}
                                  className={`w-full rounded-md border px-3 py-2 text-left transition ${
                                    isSelected
                                      ? 'border-emerald-500 bg-emerald-500/10'
                                      : 'border-orange-700 bg-card hover:border-orange-500'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate text-sm text-white">{product.name}</p>
                                      {product.description ? (
                                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{product.description}</p>
                                      ) : null}
                                    </div>
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleScheduledProduct(product.id)}
                                      className="mt-0.5"
                                    />
                                  </div>
                                  <p className="mt-2 text-xs font-medium text-gray-200">
                                    {currencyFormatter.format(product.price)}
                                  </p>
                                </button>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>
                        <CarouselPrevious className="-left-1 h-7 w-7 border-orange-600 bg-body text-white hover:bg-card" />
                        <CarouselNext className="-right-1 h-7 w-7 border-orange-600 bg-body text-white hover:bg-card" />
                      </Carousel>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Input
              placeholder="Observaciones (opcional)"
              value={scheduledOrderNotes}
              onChange={(event) => setScheduledOrderNotes(event.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setIsScheduleOrderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleScheduleOrder()} disabled={isValidatingScheduledAddress}>
              {isValidatingScheduledAddress ? 'Validando dirección...' : 'Guardar orden'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
