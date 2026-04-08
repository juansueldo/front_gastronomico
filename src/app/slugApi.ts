import { getAuthSession, getLoggedUser } from './authStorage';

type SlugImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_SLUG_LIST_PATH?: string;
    VITE_SLUG_CREATE_PATH?: string;
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
  slug_url?: string;
  slugUrl?: string;
  status_id?: string | number;
  statusId?: string | number;
  created_at?: string;
  createdAt?: string;
}

const API_URL = (import.meta as SlugImportMeta).env?.VITE_API_URL;
const SLUG_LIST_PATH = (import.meta as SlugImportMeta).env?.VITE_SLUG_LIST_PATH ?? '/slug';
const SLUG_CREATE_PATH = (import.meta as SlugImportMeta).env?.VITE_SLUG_CREATE_PATH ?? '/slug/create';

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
    id: String(item.id ?? `slug-${Date.now()}-${Math.random()}`),
    customerId: Number.isFinite(customerId) ? customerId : 0,
    slugUrl: item.slug_url ?? item.slugUrl ?? '',
    statusId: Number.isFinite(statusId) ? statusId : 1,
    createdAt: item.created_at ?? item.createdAt,
  };
};

export const fetchCustomerSlugs = async (customerId?: number): Promise<StoreSlug[]> => {
  const resolvedCustomerId = customerId ?? getSessionCustomerId();

  if (!resolvedCustomerId || resolvedCustomerId <= 0) {
    throw new Error('No se encontro customer_id del usuario logueado');
  }

  const baseUrl = ensureApiUrl();
  const query = new URLSearchParams({ customerId: String(resolvedCustomerId) });
  const response = await fetch(`${baseUrl}${SLUG_LIST_PATH}?${query.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudieron obtener los slugs');
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(normalizeSlug);
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
