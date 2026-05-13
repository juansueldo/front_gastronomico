/**
 * API de Mesas - Dining Tables endpoints
 */

import { endpoints } from './endpoints';

export interface TableMetadata {
  waiter?: string;
  area?: string;
  [key: string]: unknown;
}

export interface TableItem {
  id: string;
  name: string;
  tableNumber: number;
  table_number: number;
  description?: string;
  capacity?: number;
  location?: string;
  metadata?: TableMetadata;
  statusId?: number;
  headquarterId?: number;
  active: boolean;
}

export interface CreateTableRequest {
  name: string;
  table_number: number;
  capacity?: number;
  location?: string;
  description?: string;
  metadata?: TableMetadata;
  headquarterId?: string | number;
}

export interface UpdateTableRequest {
  name?: string;
  table_number?: number;
  capacity?: number;
  location?: string;
  description?: string;
  metadata?: TableMetadata;
  headquarterId?: string | number;
}

interface RawTableItem {
  id?: string | number;
  name?: string;
  table_number?: string | number;
  tableNumber?: string | number;
  description?: string;
  capacity?: string | number;
  location?: string;
  metadata?: TableMetadata | null;
  statusId?: string | number;
  status_id?: string | number;
  headquarterId?: string | number;
  headquarter_id?: string | number;
  headquarter?: { id?: string | number } | null;
  Headquarter?: { id?: string | number } | null;
  active?: boolean;
}

const extractTables = (data: any): RawTableItem[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data?.tables)) {
    return data.tables;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  return [];
};

const parseTableNumber = (item: RawTableItem) => {
  const directNumber = Number(item.table_number ?? item.tableNumber);

  if (Number.isInteger(directNumber) && directNumber > 0) {
    return directNumber;
  }

  const fallbackName = String(item.name ?? '');
  const match = fallbackName.match(/\d+/);
  const extractedNumber = Number(match?.[0]);

  if (Number.isInteger(extractedNumber) && extractedNumber > 0) {
    return extractedNumber;
  }

  return 0;
};

const parseStatusId = (item: RawTableItem) => {
  const statusId = Number(item.statusId ?? item.status_id);
  if (Number.isInteger(statusId) && statusId > 0) {
    return statusId;
  }

  return item.active === false ? 2 : 1;
};

const normalizeTable = (item: RawTableItem): TableItem => {
  const tableNumber = parseTableNumber(item);
  const statusId = parseStatusId(item);
  const capacity = Number(item.capacity);
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined;

  return {
    id: String(item.id ?? `table-${Date.now()}-${Math.random()}`),
    name: item.name ?? (tableNumber > 0 ? `Mesa ${tableNumber}` : 'Mesa'),
    tableNumber,
    table_number: tableNumber,
    description: item.description ?? undefined,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
    location: item.location ?? undefined,
    metadata,
    statusId,
    headquarterId: (() => {
      const parsedHeadquarterId = Number(
        item.headquarterId
        ?? item.headquarter_id
        ?? item.headquarter?.id
        ?? item.Headquarter?.id
        ?? item.metadata?.headquarterId
        ?? item.metadata?.headquarter_id
      );
      return Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0 ? parsedHeadquarterId : undefined;
    })(),
    active: item.active ?? statusId === 1,
  };
};

/**
 * Obtiene todas las mesas
 */
export async function fetchTables(headquarterId?: string | number): Promise<TableItem[]> {
  const parsedHeadquarterId = Number(headquarterId);
  const params = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? {
      headquarterId: parsedHeadquarterId,
      headquarter_id: parsedHeadquarterId,
      headquarter: parsedHeadquarterId,
    }
    : undefined;
  const data = await endpoints.fetchTablesLegacy(params);
  const normalizedTables = extractTables(data).map(normalizeTable);

  if (!Number.isInteger(parsedHeadquarterId) || parsedHeadquarterId <= 0) {
    return normalizedTables;
  }

  const hasHeadquarterInfo = normalizedTables.some((table) => Number.isInteger(Number(table.headquarterId)) && Number(table.headquarterId) > 0);
  if (!hasHeadquarterInfo) {
    return normalizedTables;
  }

  return normalizedTables.filter((table) => Number(table.headquarterId) === parsedHeadquarterId);
}

/**
 * Lista todas las mesas con paginacion
 */
export async function listTables(params?: any): Promise<TableItem[]> {
  const data = await endpoints.listTables(params);
  return extractTables(data).map(normalizeTable);
}

/**
 * Obtiene una mesa especifica
 */
export async function getTable(tableId: string): Promise<TableItem> {
  const data = await endpoints.getTable(tableId);
  return normalizeTable(data);
}

/**
 * Crea una nueva mesa
 */
export async function createTable(tableData: CreateTableRequest): Promise<any> {
  const parsedHeadquarterId = Number(tableData.headquarterId);
  const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? parsedHeadquarterId
    : undefined;

  return endpoints.createTable({
    ...tableData,
    headquarterId: normalizedHeadquarterId,
    headquarter_id: normalizedHeadquarterId,
  });
}

/**
 * Actualiza una mesa
 */
export async function updateTable(tableId: string, data: UpdateTableRequest): Promise<any> {
  const parsedHeadquarterId = Number(data.headquarterId);
  const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? parsedHeadquarterId
    : undefined;

  return endpoints.updateTable(tableId, {
    id: tableId,
    ...data,
    headquarterId: normalizedHeadquarterId,
    headquarter_id: normalizedHeadquarterId,
  });
}

/**
 * Actualiza el estado de una mesa
 */
export async function updateTableStatus(tableId: string, statusId: number): Promise<any> {
  return endpoints.updateTableStatus(tableId, statusId);
}

/**
 * Elimina una mesa
 */
export async function deleteTable(tableId: string): Promise<any> {
  return endpoints.deleteTable(tableId);
}

/**
 * Compatibilidad legacy
 */
export async function listDiningTableSlash(params?: any): Promise<TableItem[]> {
  return listTables(params);
}

export async function fetchDiningTableSlash(): Promise<TableItem[]> {
  return fetchTables();
}
