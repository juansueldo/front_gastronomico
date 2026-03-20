/**
 * API de Mensajes - Messages endpoints
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export interface Message {
  id: string;
  msg_id?: string;
  contact_id: string | number;
  content: string;
  sender: 'contact' | 'agent';
  timestamp: string;
  media_type?: string;
  media_url?: string;
  media_path?: string;
  [key: string]: unknown;
}

export interface SendMessageRequest {
  contactId: number | string;
  contact_id?: number | string;
  content: string;
  direction?: 'i' | 'o';
  type?: number;
  id?: number | string;
  msg_id?: string;
  seatId?: number | string;
  seat_id?: number | string;
  ack?: number;
  created_at?: number;
  status?: number;
  label?: number;
  mediaUrl?: string;
  mediaType?: string;
  media_url?: string;
  media_type?: string;
  media_path?: string;
  media_mime?: string;
  media_filename?: string;
  media_size?: number;
  group_author_waid?: string;
  group_author_phone?: string;
  group_author_name?: string;
  replyToMessageId?: string | number;
  reply_to_message_id?: string | number;
  replyToContent?: string;
  reply_to_content?: string;
  quoted_msg_id?: string | number;
  quoted_content?: string;
  reaction_emoji?: string;
  reactionEmoji?: string;
  reaction_target_msg_id?: string | number;
  reactionTargetMsgId?: string | number;
  source_type?: string;
  source_name?: string;
  rich_response_json?: string;
  [key: string]: unknown;
}

type CreateMessagePayload = {
  contactId: number;
  contact_id: number;
  direction: 'i' | 'o';
  content: string;
  type: number;
  id?: number;
  msg_id?: string;
  label?: number;
  seat_id?: number;
  ack?: number;
  created_at?: number;
  status?: number;
  media_path?: string;
  media_mime?: string;
  media_filename?: string;
  media_size?: number;
  group_author_waid?: string;
  group_author_phone?: string;
  group_author_name?: string;
  quoted_msg_id?: string;
  quoted_content?: string;
  reaction_emoji?: string;
  reaction_target_msg_id?: string;
  source_type?: string;
  source_name?: string;
  rich_response_json?: string;
};

/**
 * Obtiene los mensajes de un contacto
 */
export async function fetchMessages(
  contactId: string | number,
  sourceType?: string,
): Promise<Message[] | { messages?: Message[]; [key: string]: unknown }> {
  const data = await apiClient.get(`${API_VERSION}/message/contact/${encodeURIComponent(String(contactId))}`, {
    params: sourceType ? { sourceType } : undefined,
    config: { cache: 'short' },
  });
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.messages)) {
    return data as { messages: Message[]; [key: string]: unknown };
  }

  return [];
}

/**
 * Envía un mensaje a un contacto
 */
export async function sendMessage(request: SendMessageRequest): Promise<any> {
  const parsedContactId = Number(request.contact_id ?? request.contactId);
  if (!Number.isFinite(parsedContactId) || parsedContactId < 1) {
    throw new Error('contactId debe ser un numero entero mayor a 0');
  }

  const payload: CreateMessagePayload = {
    contactId: parsedContactId,
    contact_id: parsedContactId,
    direction: request.direction ?? 'o',
    content: request.content ?? '',
    type: request.type ?? 1,
  };

  const parsedId = Number(request.id);
  if (Number.isFinite(parsedId) && parsedId > 0) {
    payload.id = parsedId;
  }

  const parsedSeatId = Number(request.seat_id ?? request.seatId);
  if (Number.isFinite(parsedSeatId) && parsedSeatId >= 0) {
    payload.seat_id = parsedSeatId;
  }

  const parsedLabel = Number(request.label);
  if (Number.isFinite(parsedLabel)) {
    payload.label = parsedLabel;
  }

  const parsedAck = Number(request.ack);
  if (Number.isFinite(parsedAck)) {
    payload.ack = parsedAck;
  }

  const parsedCreatedAt = Number(request.created_at);
  if (Number.isFinite(parsedCreatedAt) && parsedCreatedAt > 0) {
    payload.created_at = parsedCreatedAt;
  }

  const parsedStatus = Number(request.status);
  if (Number.isFinite(parsedStatus)) {
    payload.status = parsedStatus;
  }

  const parsedMediaSize = Number(request.media_size);
  if (Number.isFinite(parsedMediaSize) && parsedMediaSize >= 0) {
    payload.media_size = parsedMediaSize;
  }

  payload.msg_id = request.msg_id;
  payload.media_path = request.media_path ?? request.media_url ?? request.mediaUrl;
  payload.media_mime = request.media_mime ?? request.media_type ?? request.mediaType;
  payload.media_filename = request.media_filename;
  payload.group_author_waid = request.group_author_waid;
  payload.group_author_phone = request.group_author_phone;
  payload.group_author_name = request.group_author_name;
  payload.quoted_msg_id = String(request.quoted_msg_id ?? request.reply_to_message_id ?? request.replyToMessageId ?? '');
  payload.quoted_content = request.quoted_content ?? request.reply_to_content ?? request.replyToContent;
  payload.reaction_emoji = request.reaction_emoji ?? request.reactionEmoji;
  payload.reaction_target_msg_id = String(request.reaction_target_msg_id ?? request.reactionTargetMsgId ?? '');
  payload.source_type = request.source_type;
  payload.source_name = request.source_name;
  payload.rich_response_json = request.rich_response_json;

  Object.keys(payload).forEach((key) => {
    const typedKey = key as keyof CreateMessagePayload;
    const value = payload[typedKey];
    if (value === undefined || value === null || value === '') {
      delete payload[typedKey];
    }
  });

  return apiClient.post(`${API_VERSION}/message/create`, payload);
}

/**
 * Crea un nuevo mensaje en el módulo Message
 */
export async function createMessage(data: any): Promise<any> {
  return apiClient.post(`${API_VERSION}/message/create`, data);
}

/**
 * Lista todos los mensajes
 */
export async function listMessages(payload?: any): Promise<Message[]> {
  const data = await apiClient.post(`${API_VERSION}/message/list`, payload ?? {});
  return Array.isArray(data) ? data : data?.data ?? [];
}

/**
 * Obtiene un mensaje específico
 */
export async function getMessage(messageId: string): Promise<Message> {
  return apiClient.get(`${API_VERSION}/message/${messageId}`);
}

/**
 * Actualiza un mensaje
 */
export async function updateMessage(messageId: string, data: any): Promise<any> {
  return apiClient.post(`${API_VERSION}/message/update/${messageId}`, data);
}
