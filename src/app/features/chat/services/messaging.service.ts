import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import {
  mapMessagingAccountDtoToModel,
  mapMessagingConversationDtoToModel,
  mapMessagingMessageDtoToModel,
  mapPaginatedMessagingResult,
} from '../mappers/messaging.mapper';
import type {
  MessagingAccountDto,
  MessagingConversationDto,
  MessagingMessageDto,
  ReactMessageRequest,
  SendConversationMessageRequest,
  SendDirectMessageRequest,
} from '../types/messaging.dto';
import type {
  MessagingAccount,
  MessagingConversation,
  MessagingMessage,
  PaginatedMessagingResult,
} from '../types/messaging.model';

export async function getCurrentMessagingAccount(): Promise<MessagingAccount | null> {
  const data = await apiClient.get(`${API_VERSION}/messaging/accounts/current`, {
    config: { cache: 'none' },
  });
  const account = data && typeof data === 'object' && 'account' in data
    ? (data as { account?: MessagingAccountDto }).account
    : data;
  return mapMessagingAccountDtoToModel(account as MessagingAccountDto | null | undefined);
}

export async function connectWhatsappAccount(payload: { phone?: string; displayName?: string } = {}): Promise<MessagingAccount | null> {
  const data = await apiClient.post(`${API_VERSION}/messaging/accounts/connect`, payload);
  const account = data && typeof data === 'object' && 'account' in data
    ? (data as { account?: MessagingAccountDto }).account
    : data;
  return mapMessagingAccountDtoToModel(account as MessagingAccountDto | null | undefined);
}

export async function disconnectWhatsappAccount(): Promise<MessagingAccount | null> {
  const data = await apiClient.post(`${API_VERSION}/messaging/accounts/disconnect`, {});
  const account = data && typeof data === 'object' && 'account' in data
    ? (data as { account?: MessagingAccountDto }).account
    : data;
  return mapMessagingAccountDtoToModel(account as MessagingAccountDto | null | undefined);
}

export async function restartWhatsappAccount(): Promise<MessagingAccount | null> {
  const data = await apiClient.post(`${API_VERSION}/messaging/accounts/restart`, {});
  const account = data && typeof data === 'object' && 'account' in data
    ? (data as { account?: MessagingAccountDto }).account
    : data;
  return mapMessagingAccountDtoToModel(account as MessagingAccountDto | null | undefined);
}

export async function listMessagingConversations(params: {
  page?: number;
  limit?: number;
  search?: string;
} = {}): Promise<PaginatedMessagingResult<MessagingConversation>> {
  const data = await apiClient.get(`${API_VERSION}/messaging/conversations`, {
    params,
    config: { cache: 'none' },
  });
  return mapPaginatedMessagingResult<MessagingConversationDto, MessagingConversation>(data, mapMessagingConversationDtoToModel);
}

export async function listConversationMessages(
  conversationId: string | number,
  params: { page?: number; limit?: number } = {},
): Promise<PaginatedMessagingResult<MessagingMessage>> {
  const data = await apiClient.get(`${API_VERSION}/messaging/conversations/${conversationId}/messages`, {
    params,
    config: { cache: 'none' },
  });
  return mapPaginatedMessagingResult<MessagingMessageDto, MessagingMessage>(data, mapMessagingMessageDtoToModel);
}

export async function sendConversationMessage(
  conversationId: string | number,
  payload: SendConversationMessageRequest,
): Promise<{ message?: MessagingMessage; conversation?: MessagingConversation }> {
  const data = await apiClient.post(`${API_VERSION}/messaging/conversations/${conversationId}/messages`, payload);
  const candidate = data as { message?: MessagingMessageDto; conversation?: MessagingConversationDto };
  return {
    message: candidate.message ? mapMessagingMessageDtoToModel(candidate.message) : undefined,
    conversation: candidate.conversation ? mapMessagingConversationDtoToModel(candidate.conversation) : undefined,
  };
}

export async function sendDirectWhatsappMessage(payload: SendDirectMessageRequest) {
  const data = await apiClient.post(`${API_VERSION}/messaging/messages/send`, payload);
  const candidate = data as { message?: MessagingMessageDto; conversation?: MessagingConversationDto };
  return {
    message: candidate.message ? mapMessagingMessageDtoToModel(candidate.message) : undefined,
    conversation: candidate.conversation ? mapMessagingConversationDtoToModel(candidate.conversation) : undefined,
  };
}

export async function markConversationAsRead(conversationId: string | number): Promise<MessagingConversation> {
  const data = await apiClient.patch(`${API_VERSION}/messaging/conversations/${conversationId}/read`, {});
  return mapMessagingConversationDtoToModel(data as MessagingConversationDto);
}

export async function reactMessagingMessage(messageId: string | number, payload: ReactMessageRequest) {
  const data = await apiClient.post(`${API_VERSION}/messaging/messages/${messageId}/reactions`, payload);
  const candidate = data as { message?: MessagingMessageDto };
  return {
    message: candidate.message ? mapMessagingMessageDtoToModel(candidate.message) : undefined,
  };
}

export async function deleteMessagingConversation(conversationId: string | number): Promise<void> {
  await apiClient.delete(`${API_VERSION}/messaging/conversations/${conversationId}`);
}

export type {
  MessagingAccount,
  MessagingConversation,
  MessagingMessage,
  PaginatedMessagingResult,
  ReactMessageRequest,
  SendConversationMessageRequest,
  SendDirectMessageRequest,
};
