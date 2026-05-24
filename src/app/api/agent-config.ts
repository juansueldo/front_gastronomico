import { apiClient } from '../core/http/client';
import { API_VERSION, type ApiResponse } from '../core/http/types';

export interface AgentConfig {
  userId: number;
  geminiApiKey: string;
  context?: string | null;
}

export interface UpsertAgentConfigDto {
  geminiApiKey: string;
  context?: string | null;
}

export async function getAgentConfig(): Promise<AgentConfig | null> {
  const res = await apiClient.get(`${API_VERSION}/messaging/agent-config`);
  return res as AgentConfig;
}

export async function upsertAgentConfig(dto: UpsertAgentConfigDto): Promise<AgentConfig> {
  const res = await apiClient.post(`${API_VERSION}/messaging/agent-config`, dto);
  return res as AgentConfig;
}
