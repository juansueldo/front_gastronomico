import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import { mapTableDtoToModel, mapTablePayloadToRequest } from '../mappers/tables.mapper';
import type { CreateTableRequest, TableDto, UpdateTableRequest } from '../types/tables.dto';
import type { TableItem } from '../types/tables.model';

const extractTables = (data: unknown): TableDto[] => {
  if (Array.isArray(data)) return data as TableDto[];
  if (!data || typeof data !== 'object') return [];

  const candidate = data as Record<string, unknown>;
  const rows = candidate.rows ?? candidate.tables ?? candidate.data;
  return Array.isArray(rows) ? rows as TableDto[] : [];
};

export async function fetchTables(headquarterId?: string | number): Promise<TableItem[]> {
  const parsedHeadquarterId = Number(headquarterId);
  const params = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? {
      headquarterId: parsedHeadquarterId,
      headquarter_id: parsedHeadquarterId,
      headquarter: parsedHeadquarterId,
    }
    : undefined;
  const data = await apiClient.get(`${API_VERSION}/table`, { params, config: { cache: 'short' } });
  const normalizedTables = extractTables(data).map(mapTableDtoToModel);

  if (!Number.isInteger(parsedHeadquarterId) || parsedHeadquarterId <= 0) return normalizedTables;

  const hasHeadquarterInfo = normalizedTables.some((table) => Number.isInteger(Number(table.headquarterId)) && Number(table.headquarterId) > 0);
  if (!hasHeadquarterInfo) return normalizedTables;

  return normalizedTables.filter((table) => Number(table.headquarterId) === parsedHeadquarterId);
}

export async function listTables(params?: Record<string, string | number | boolean | undefined>): Promise<TableItem[]> {
  const data = await apiClient.get(`${API_VERSION}/table`, { params });
  return extractTables(data).map(mapTableDtoToModel);
}

export async function getTable(tableId: string): Promise<TableItem> {
  const data = await apiClient.get(`${API_VERSION}/table/${tableId}`);
  return mapTableDtoToModel(data as TableDto);
}

export function createTable(tableData: CreateTableRequest) {
  return apiClient.post(`${API_VERSION}/table`, mapTablePayloadToRequest(tableData));
}

export function updateTable(tableId: string, data: UpdateTableRequest) {
  return apiClient.patch(`${API_VERSION}/table/${tableId}`, {
    id: tableId,
    ...mapTablePayloadToRequest(data),
  });
}

export function updateTableStatus(tableId: string, statusId: number) {
  return apiClient.patch(`${API_VERSION}/table/${tableId}/status`, { statusId });
}

export function deleteTable(tableId: string) {
  return apiClient.delete(`${API_VERSION}/table/${tableId}`);
}

export const listDiningTableSlash = listTables;
export const fetchDiningTableSlash = () => fetchTables();

export type { CreateTableRequest, TableItem, UpdateTableRequest };
