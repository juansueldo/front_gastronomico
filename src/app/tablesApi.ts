import { getAuthSession } from './authStorage';

type TablesImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_TABLES_LIST_PATH?: string;
    VITE_TABLES_CREATE_PATH?: string;
  };
};

export interface BackendTableItem {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

interface RawBackendTableItem {
  id?: string | number;
  name?: string;
  description?: string;
  active?: boolean;
}

const API_URL = (import.meta as TablesImportMeta).env?.VITE_API_URL;
const TABLES_LIST_PATH = (import.meta as TablesImportMeta).env?.VITE_TABLES_LIST_PATH ?? '/v1/dining-tables/list';
const TABLES_CREATE_PATH = (import.meta as TablesImportMeta).env?.VITE_TABLES_CREATE_PATH ?? '/v1/dining-tables/create';

const getAuthToken = () => getAuthSession()?.accessToken;

const buildAuthHeaders = () => {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente');
  }

  return {
    Authorization: `Bearer ${authToken}`,
  };
};

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no está configurada');
  }

  return API_URL;
};

const normalizeTable = (item: RawBackendTableItem): BackendTableItem => ({
  id: String(item.id ?? `table-${Date.now()}-${Math.random()}`),
  name: item.name ?? 'Mesa',
  description: item.description ?? undefined,
  active: item.active ?? true,
});

export const fetchTables = async (): Promise<BackendTableItem[]> => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${TABLES_LIST_PATH}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || 'No se pudieron obtener las mesas');
  }

  const data = await response.json() as {
    tables?: RawBackendTableItem[];
    data?: RawBackendTableItem[];
  };

  const tables = data.tables ?? data.data ?? [];
  return Array.isArray(tables) ? tables.map(normalizeTable) : [];
};

interface CreateTableInput {
  name: string;
  description?: string;
  active?: boolean;
}

export const createTable = async (input: CreateTableInput) => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${TABLES_CREATE_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      name: input.name,
      description: input.description,
      active: input.active ?? true,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo crear la mesa');
  }

  return data;
};
