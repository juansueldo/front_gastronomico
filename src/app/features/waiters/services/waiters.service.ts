import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import { mapWaiterDtoToModel, mapWaiterPayloadToRequest } from '../mappers/waiters.mapper';
import type { CreateWaiterRequest, UpdateWaiterRequest, WaiterDto } from '../types/waiters.dto';
import type { ListSortState, ListWaitersParams, Waiter, WaiterListResult } from '../types/waiters.model';

function extractWaiterRows(payload: unknown): WaiterDto[] {
  if (Array.isArray(payload)) return payload as WaiterDto[];
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as Record<string, unknown>;
  const rows = candidate.rows ?? candidate.data ?? candidate.waiters;
  return Array.isArray(rows) ? rows as WaiterDto[] : [];
}

function filterWaiters(items: Waiter[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return items;

  return items.filter((item) => [
    item.firstname,
    item.lastname,
    item.email,
    item.phone,
    item.identification,
    item.headquarterName,
    item.headquarterLocation,
    item.statusName,
  ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)));
}

function sortWaiters(items: Waiter[], sort: ListSortState | null) {
  if (!sort) return items;
  const direction = sort.direction === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = String((left as Record<string, unknown>)[sort.key] ?? '').toLowerCase();
    const rightValue = String((right as Record<string, unknown>)[sort.key] ?? '').toLowerCase();
    if (leftValue < rightValue) return -1 * direction;
    if (leftValue > rightValue) return 1 * direction;
    return 0;
  });
}

export async function listWaiters(params: ListWaitersParams = {}): Promise<WaiterListResult> {
  const {
    page = 1,
    pageSize = 10,
    search = '',
    sort = null,
  } = params;

  const response = await apiClient.get(`${API_VERSION}/waiter`, {
    params: {
      page,
      pageSize,
      search,
      sortBy: sort?.key ?? '',
      sortDirection: sort?.direction ?? '',
    },
    config: { cache: 'none' },
  });

  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const result = response as Record<string, unknown>;
    if (Array.isArray(result.rows) && typeof result.count === 'number') {
      return {
        rows: (result.rows as WaiterDto[]).map(mapWaiterDtoToModel),
        total: result.count,
      };
    }

    if (Array.isArray(result.data) && typeof result.total === 'number') {
      return {
        rows: (result.data as WaiterDto[]).map(mapWaiterDtoToModel),
        total: result.total,
      };
    }
  }

  const normalized = extractWaiterRows(response).map(mapWaiterDtoToModel);
  const filtered = filterWaiters(normalized, search);
  const sorted = sortWaiters(filtered, sort);
  const start = (page - 1) * pageSize;

  return {
    rows: sorted.slice(start, start + pageSize),
    total: sorted.length,
  };
}

export async function createWaiter(data: CreateWaiterRequest): Promise<Waiter> {
  const response = await apiClient.post(`${API_VERSION}/waiter`, mapWaiterPayloadToRequest(data));
  return mapWaiterDtoToModel((response ?? data) as WaiterDto);
}

export async function updateWaiter(id: string, data: UpdateWaiterRequest): Promise<Waiter> {
  const response = await apiClient.patch(`${API_VERSION}/waiter/${id}`, mapWaiterPayloadToRequest(data));
  return mapWaiterDtoToModel((response ?? { id, ...data }) as WaiterDto);
}

export function deleteWaiter(id: string) {
  return apiClient.delete(`${API_VERSION}/waiter/${id}`);
}

export async function updateWaiterStatus(id: string, statusId: number): Promise<Waiter> {
  const response = await apiClient.patch(`${API_VERSION}/waiter/${id}/status`, { statusId });
  return mapWaiterDtoToModel(response as WaiterDto);
}

export type {
  CreateWaiterRequest,
  ListWaitersParams,
  UpdateWaiterRequest,
  Waiter,
  WaiterListResult,
};
