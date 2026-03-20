/**
 * API de integraciones OAuth
 */

import { apiClient } from './client';
import { API_VERSION } from './types';

export type OAuthProviderId = 'mercadopago' | 'mercadolibre' | 'google_calendar';

export interface OAuthProvider {
  id: OAuthProviderId;
  name: string;
  description: string;
  enabled: boolean;
  connected: boolean;
  accountLabel?: string;
  scopes?: string[];
}

type OAuthProviderRaw = {
  id?: string;
  provider?: string;
  key?: string;
  name?: string;
  label?: string;
  description?: string;
  enabled?: boolean;
  active?: boolean;
  connected?: boolean;
  isConnected?: boolean;
  accountLabel?: string;
  account_name?: string;
  scopes?: string[];
};

type OAuthStartResponse = {
  authUrl?: string;
  url?: string;
  redirectUrl?: string;
  oauthUrl?: string;
  authorizeUrl?: string;
};

const DEFAULT_PROVIDERS: OAuthProvider[] = [
  {
    id: 'mercadopago',
    name: 'MercadoPago',
    description: 'Vincula cobros y estados de pago con tu cuenta de MercadoPago.',
    enabled: true,
    connected: false,
  },
  {
    id: 'mercadolibre',
    name: 'MercadoLibre',
    description: 'Sincroniza publicaciones, ventas y mensajeria desde MercadoLibre.',
    enabled: false,
    connected: false,
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Sincroniza eventos, reservas y recordatorios con Google Calendar.',
    enabled: false,
    connected: false,
  },
];

function normalizeProviderId(raw: unknown): OAuthProviderId | null {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'mercadopago' || value === 'mercado_pago') {
    return 'mercadopago';
  }
  if (value === 'mercadolibre' || value === 'mercado_libre') {
    return 'mercadolibre';
  }
  if (value === 'google_calendar' || value === 'googlecalendar' || value === 'google-calendar') {
    return 'google_calendar';
  }
  return null;
}

function normalizeProvider(item: OAuthProviderRaw): OAuthProvider | null {
  const id = normalizeProviderId(item.id ?? item.provider ?? item.key);
  if (!id) {
    return null;
  }

  return {
    id,
    name: String(item.name ?? item.label ?? DEFAULT_PROVIDERS.find((p) => p.id === id)?.name ?? id),
    description: String(
      item.description ?? DEFAULT_PROVIDERS.find((p) => p.id === id)?.description ?? 'Integracion OAuth',
    ),
    enabled: item.enabled ?? item.active ?? true,
    connected: item.connected ?? item.isConnected ?? false,
    accountLabel: item.accountLabel ?? item.account_name,
    scopes: Array.isArray(item.scopes) ? item.scopes : undefined,
  };
}

function mergeProviders(remote: OAuthProvider[]): OAuthProvider[] {
  const map = new Map<OAuthProviderId, OAuthProvider>();

  DEFAULT_PROVIDERS.forEach((provider) => {
    map.set(provider.id, provider);
  });

  remote.forEach((provider) => {
    map.set(provider.id, {
      ...(map.get(provider.id) ?? provider),
      ...provider,
    });
  });

  return Array.from(map.values());
}

export async function listOAuthProviders(): Promise<OAuthProvider[]> {
  try {
    const data = await apiClient.get(`${API_VERSION}/integrations/oauth/providers`, {
      config: { cache: 'short' },
    });

    const rows: unknown[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.rows)
      ? data.rows
      : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.providers)
      ? data.providers
      : [];

    const parsed = rows
      .map((item) => normalizeProvider((item ?? {}) as OAuthProviderRaw))
      .filter((item): item is OAuthProvider => item !== null);

    if (parsed.length === 0) {
      return DEFAULT_PROVIDERS;
    }

    return mergeProviders(parsed);
  } catch {
    return DEFAULT_PROVIDERS;
  }
}

function buildFallbackAuthorizeUrl(provider: OAuthProviderId): string {
  const base = (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:3000';
  const normalizedBase = base.replace(/\/$/, '');
  return `${normalizedBase}${API_VERSION}/integrations/oauth/${encodeURIComponent(provider)}/authorize`;
}

export async function getOAuthAuthorizeUrl(provider: OAuthProviderId): Promise<string> {
  try {
    const data = await apiClient.post<OAuthStartResponse>(
      `${API_VERSION}/integrations/oauth/${encodeURIComponent(provider)}/start`,
      {},
    );

    const url = data?.authUrl ?? data?.url ?? data?.redirectUrl ?? data?.oauthUrl ?? data?.authorizeUrl;
    if (typeof url === 'string' && url.trim()) {
      return url;
    }
  } catch {
    // fallback below
  }

  return buildFallbackAuthorizeUrl(provider);
}
