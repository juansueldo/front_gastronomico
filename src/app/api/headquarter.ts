import { apiClient } from './client';
import { API_VERSION } from './types';

export interface Headquarter {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  storeId?: string;
  statusId?: number;
  schedules?: HeadquarterScheduleInput[];
}

export interface CreateHeadquarterRequest {
  name: string;
  phone?: string;
  location?: string;
}

export interface UpdateHeadquarterRequest {
  name?: string;
  phone?: string;
  location?: string;
}

export interface HeadquarterScheduleInput {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

export interface ListSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface ListHeadquartersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: ListSortState | null;
}

export interface HeadquarterListResult {
  rows: Headquarter[];
  total: number;
}

function normalizeHeadquartersPayload(payload: unknown): Headquarter[] {
  if (Array.isArray(payload)) {
    return payload as Headquarter[];
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;

    if (Array.isArray(candidate.rows)) {
      return candidate.rows as Headquarter[];
    }

    if (Array.isArray(candidate.data)) {
      return candidate.data as Headquarter[];
    }

    if (Array.isArray(candidate.headquarters)) {
      return candidate.headquarters as Headquarter[];
    }
  }

  return [];
}

function filterHeadquarters(items: Headquarter[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return items;
  }

  return items.filter((item) => {
    const searchableValues = [item.name, item.phone, item.location];
    return searchableValues.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
  });
}

function sortHeadquarters(items: Headquarter[], sort: ListSortState | null) {
  if (!sort) {
    return items;
  }

  const direction = sort.direction === 'asc' ? 1 : -1;

  return [...items].sort((left, right) => {
    const leftValue = String((left as Record<string, unknown>)[sort.key] ?? '').toLowerCase();
    const rightValue = String((right as Record<string, unknown>)[sort.key] ?? '').toLowerCase();

    if (leftValue < rightValue) {
      return -1 * direction;
    }

    if (leftValue > rightValue) {
      return 1 * direction;
    }

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
        rows: result.rows as Headquarter[],
        total: result.count,
      };
    }

    if (Array.isArray(result.data) && typeof result.total === 'number') {
      return {
        rows: result.data as Headquarter[],
        total: result.total,
      };
    }
  }

  const normalizedItems = normalizeHeadquartersPayload(response);
  const filteredItems = filterHeadquarters(normalizedItems, search);
  const sortedItems = sortHeadquarters(filteredItems, sort);
  const start = (page - 1) * pageSize;

  return {
    rows: sortedItems.slice(start, start + pageSize),
    total: sortedItems.length,
  };
}

export function createHeadquarter(data: CreateHeadquarterRequest) {
  return apiClient.post(`${API_VERSION}/headquarter`, data);
}

export function updateHeadquarter(id: string, data: UpdateHeadquarterRequest) {
  return apiClient.patch(`${API_VERSION}/headquarter/${id}`, {
    id,
    ...data,
  });
}

export function updateHeadquarterSchedules(id: string, schedules: HeadquarterScheduleInput[]) {
  const normalizedSchedules = schedules.map((schedule) => ({
    dayOfWeek: schedule.dayOfWeek.trim().toLowerCase(),
    day_of_week: schedule.dayOfWeek.trim().toLowerCase(),
    openTime: schedule.openTime.trim(),
    open_time: schedule.openTime.trim(),
    closeTime: schedule.closeTime.trim(),
    close_time: schedule.closeTime.trim(),
    isClosed: Boolean(schedule.isClosed),
    is_closed: Boolean(schedule.isClosed),
  }));

  return apiClient.put(`${API_VERSION}/headquarter/${id}/schedules`, {
    id,
    headquarterId: id,
    headquarter_id: id,
    schedules: normalizedSchedules,
  });
}
