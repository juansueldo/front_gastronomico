import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import {
  mapHeadquarterDtoToModel,
  mapScheduleModelToDto,
} from '../mappers/headquarters.mapper';
import type {
  CreateHeadquarterRequest,
  HeadquarterDto,
  UpdateHeadquarterRequest,
} from '../types/headquarters.dto';
import type {
  Headquarter,
  HeadquarterListResult,
  HeadquarterScheduleInput,
  ListHeadquartersParams,
  ListSortState,
} from '../types/headquarters.model';

function extractHeadquarterRows(payload: unknown): HeadquarterDto[] {
  if (Array.isArray(payload)) return payload as HeadquarterDto[];
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as Record<string, unknown>;
  const rows = candidate.rows ?? candidate.data ?? candidate.headquarters;
  return Array.isArray(rows) ? rows as HeadquarterDto[] : [];
}

function filterHeadquarters(items: Headquarter[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return items;

  return items.filter((item) => [item.name, item.phone, item.location]
    .some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)));
}

function sortHeadquarters(items: Headquarter[], sort: ListSortState | null) {
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

export async function listHeadquarters(params: ListHeadquartersParams = {}): Promise<HeadquarterListResult> {
  const {
    page = 1,
    pageSize = 10,
    search = '',
    sort = null,
  } = params;

  const response = await apiClient.get(`${API_VERSION}/headquarter`, {
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
        rows: (result.rows as HeadquarterDto[]).map(mapHeadquarterDtoToModel),
        total: result.count,
      };
    }

    if (Array.isArray(result.data) && typeof result.total === 'number') {
      return {
        rows: (result.data as HeadquarterDto[]).map(mapHeadquarterDtoToModel),
        total: result.total,
      };
    }
  }

  const normalizedItems = extractHeadquarterRows(response).map(mapHeadquarterDtoToModel);
  const filteredItems = filterHeadquarters(normalizedItems, search);
  const sortedItems = sortHeadquarters(filteredItems, sort);
  const start = (page - 1) * pageSize;

  return {
    rows: sortedItems.slice(start, start + pageSize),
    total: sortedItems.length,
  };
}

export async function createHeadquarter(data: CreateHeadquarterRequest): Promise<Headquarter> {
  const response = await apiClient.post(`${API_VERSION}/headquarter`, data);
  return mapHeadquarterDtoToModel((response ?? data) as HeadquarterDto);
}

export async function updateHeadquarter(id: string, data: UpdateHeadquarterRequest): Promise<Headquarter> {
  const response = await apiClient.patch(`${API_VERSION}/headquarter/${id}`, {
    id,
    ...data,
  });
  return mapHeadquarterDtoToModel((response ?? { id, ...data }) as HeadquarterDto);
}

export function updateHeadquarterSchedules(id: string, schedules: HeadquarterScheduleInput[]) {
  const normalizedSchedules = schedules.map(mapScheduleModelToDto);

  return apiClient.put(`${API_VERSION}/headquarter/${id}/schedules`, {
    id,
    headquarterId: id,
    headquarter_id: id,
    schedules: normalizedSchedules,
  });
}

export type {
  CreateHeadquarterRequest,
  Headquarter,
  HeadquarterListResult,
  HeadquarterScheduleInput,
  ListHeadquartersParams,
  UpdateHeadquarterRequest,
};
