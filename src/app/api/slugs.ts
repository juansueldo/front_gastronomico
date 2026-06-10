import { getAuthSession, getLoggedUser } from '../core/storage/authStorage';

type SlugImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_SLUG_LIST_PATH?: string;
    VITE_SLUG_CREATE_PATH?: string;
    VITE_SLUG_UPDATE_PATH?: string;
  };
};

export interface StoreSlug {
  id: string;
  customerId: number;
  slugUrl: string;
  statusId: number;
  createdAt?: string;
}

interface BackendSlug {
  id?: string | number;
  customer_id?: string | number;
  customerId?: string | number;
  slug?: string;
  slug_url?: string;
  slugUrl?: string;
  status_id?: string | number;
  statusId?: string | number;
  created_at?: string;
  createdAt?: string;
}

const API_URL = (import.meta as SlugImportMeta).env?.VITE_API_URL;
const SLUG_LIST_PATH = (import.meta as SlugImportMeta).env?.VITE_SLUG_LIST_PATH ?? '/v1/slug';
const SLUG_CREATE_PATH = (import.meta as SlugImportMeta).env?.VITE_SLUG_CREATE_PATH ?? '/v1/slug/create';
const SLUG_UPDATE_PATH = (import.meta as SlugImportMeta).env?.VITE_SLUG_UPDATE_PATH ?? '/v1/slug/update/:id';

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no esta configurada');
  }

  return API_URL;
};

const getAuthToken = () => getAuthSession()?.user.token;

const buildAuthHeaders = () => {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Tu sesion expiro. Inicia sesion nuevamente');
  }

  return {
    Authorization: `Bearer ${authToken}`,
  };
};

const getSessionCustomerId = () => {
  const loggedUser = getLoggedUser() as {
    customerId?: number;
    customer_id?: number;
    id?: number;
  } | null;

  return loggedUser?.customerId ?? loggedUser?.customer_id ?? loggedUser?.id;
};

const normalizeSlug = (item: BackendSlug): StoreSlug => {
  const customerId = Number(item.customer_id ?? item.customerId ?? 0);
  const statusId = Number(item.status_id ?? item.statusId ?? 1);

  return {
    id: item.id == null ? '' : String(item.id),
    customerId: Number.isFinite(customerId) ? customerId : 0,
    slugUrl: item.slug_url ?? item.slugUrl ?? item.slug ?? '',
    statusId: Number.isFinite(statusId) ? statusId : 1,
    createdAt: item.created_at ?? item.createdAt,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const looksLikeSlug = (value: Record<string, unknown>) => (
  'slug' in value
  || 'slug_url' in value
  || 'slugUrl' in value
  || 'customer_id' in value
  || 'customerId' in value
);

const extractSlugRows = (data: unknown): BackendSlug[] => {
  if (Array.isArray(data)) {
    return data as BackendSlug[];
  }

  if (!isRecord(data)) {
    return [];
  }

  const candidates = [data.rows, data.data, data.slugs, data.slug];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as BackendSlug[];
    }

    if (isRecord(candidate)) {
      return [candidate as BackendSlug];
    }
  }

  return looksLikeSlug(data) ? [data as BackendSlug] : [];
};

export const fetchCustomerSlugs = async (customerId?: number): Promise<StoreSlug[]> => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${SLUG_LIST_PATH}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudieron obtener los slugs');
  }

  const rows = extractSlugRows(data);

  return rows.map((item) => normalizeSlug(item as BackendSlug));
};

interface CreateSlugInput {
  slugUrl: string;
  statusId?: number;
  customerId?: number;
}

export const createCustomerSlug = async (input: CreateSlugInput) => {
  const resolvedCustomerId = input.customerId ?? getSessionCustomerId();

  if (!resolvedCustomerId || resolvedCustomerId <= 0) {
    throw new Error('No se encontro customer_id del usuario logueado');
  }

  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${SLUG_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      customer_id: resolvedCustomerId,
      slug_url: input.slugUrl,
      status_id: input.statusId ?? 1,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear el slug');
  }

  return normalizeSlug(data as BackendSlug);
};

interface UpdateSlugInput {
  slugId: string;
  slugUrl: string;
  statusId?: number;
  customerId?: number;
}

const resolveSlugUpdatePath = (slugId: string) => (
  SLUG_UPDATE_PATH.includes(':id')
    ? SLUG_UPDATE_PATH.replace(':id', encodeURIComponent(slugId))
    : `${SLUG_UPDATE_PATH.replace(/\/$/, '')}/${encodeURIComponent(slugId)}`
);

export const updateCustomerSlug = async (input: UpdateSlugInput) => {
  const resolvedCustomerId = input.customerId ?? getSessionCustomerId();

  if (!resolvedCustomerId || resolvedCustomerId <= 0) {
    throw new Error('No se encontro customer_id del usuario logueado');
  }

  const baseUrl = ensureApiUrl();
  const path = resolveSlugUpdatePath(input.slugId);
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      id: input.slugId,
      customer_id: resolvedCustomerId,
      slug_url: input.slugUrl,
      status_id: input.statusId ?? 1,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo actualizar el slug');
  }

  return normalizeSlug(data as BackendSlug);
};
