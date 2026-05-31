import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import { mapUserDtoToModel, mapUserPayloadToRequest } from '../mappers/users.mapper';
import type {
  CreateUserRequest,
  UpdateUserProfileImageResponse,
  UpdateUserRequest,
  UserPresenceStatus,
  UserDto,
} from '../types/users.dto';
import type { AppUser, ListSortState, ListUsersParams, UserListResult } from '../types/users.model';

function extractUserRows(payload: unknown): UserDto[] {
  if (Array.isArray(payload)) return payload as UserDto[];
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as Record<string, unknown>;
  const rows = candidate.rows ?? candidate.data ?? candidate.users;
  return Array.isArray(rows) ? rows as UserDto[] : [];
}

function filterUsers(items: AppUser[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return items;

  return items.filter((item) => [
    item.username,
    item.firstname,
    item.lastname,
    item.email,
    item.role,
    item.status,
  ].some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch)));
}

function sortUsers(items: AppUser[], sort: ListSortState | null) {
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

export async function listUsers(params: ListUsersParams = {}): Promise<UserListResult> {
  const {
    page = 1,
    pageSize = 10,
    search = '',
    sort = null,
  } = params;

  const response = await apiClient.get(`${API_VERSION}/user`, {
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
        rows: (result.rows as UserDto[]).map(mapUserDtoToModel),
        total: result.count,
      };
    }

    if (Array.isArray(result.data) && typeof result.total === 'number') {
      return {
        rows: (result.data as UserDto[]).map(mapUserDtoToModel),
        total: result.total,
      };
    }
  }

  const normalized = extractUserRows(response).map(mapUserDtoToModel);
  const filtered = filterUsers(normalized, search);
  const sorted = sortUsers(filtered, sort);
  const start = (page - 1) * pageSize;

  return {
    rows: sorted.slice(start, start + pageSize),
    total: sorted.length,
  };
}

export function createUser(data: CreateUserRequest) {
  return apiClient.post(`${API_VERSION}/user`, mapUserPayloadToRequest(data));
}

export function updateUser(id: string, data: UpdateUserRequest) {
  return apiClient.put(`${API_VERSION}/user/${id}`, {
    id,
    ...mapUserPayloadToRequest(data),
  });
}

export async function updateCurrentUserPresence(status: UserPresenceStatus): Promise<AppUser> {
  const response = await apiClient.patch(`${API_VERSION}/user/me/presence`, {
    status,
    presenceStatus: status,
    presence_status: status,
  });
  const userPayload = response && typeof response === 'object'
    ? ((response as Record<string, unknown>).user ?? response)
    : response;
  return mapUserDtoToModel(userPayload as UserDto);
}

export function deleteUser(id: string) {
  return apiClient.delete(`${API_VERSION}/user/${id}`);
}

export function updateUserProfileImage(image: string): Promise<UpdateUserProfileImageResponse> {
  return apiClient.patch(`${API_VERSION}/user/profile-image`, {
    image,
    profileImage: image,
    profile_image: image,
    avatar: image,
  });
}

export type {
  AppUser,
  CreateUserRequest,
  ListUsersParams,
  UpdateUserProfileImageResponse,
  UpdateUserRequest,
  UserPresenceStatus,
  UserListResult,
};
