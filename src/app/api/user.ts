import { apiClient } from './client';
import { endpoints } from './endpoints';
import { API_VERSION } from './types';

export interface AppUser {
  id: string;
  username: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  roleId?: number;
  headquarterId?: number;
  headquarterName?: string;
  status?: string;
  active?: boolean;
  profile_image_url?: string;
  profileImageUrl?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  roleId?: number;
  headquarterId?: string | number;
  status?: string;
}

export interface UpdateUserRequest {
  username?: string;
  password?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  role?: string;
  roleId?: number;
  headquarterId?: string | number;
  status?: string;
}

export interface UpdateUserProfileImageResponse {
  profile_image_url?: string;
  profileImageUrl?: string;
}

export interface ListSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: ListSortState | null;
}

export interface UserListResult {
  rows: AppUser[];
  total: number;
}

interface RawUser {
  id?: string | number;
  username?: string;
  firstname?: string;
  firstnamee?: string;
  lastName?: string;
  lastname?: string;
  email?: string;
  role?: unknown;
  Role?: unknown;
  rol?: unknown;
  roleName?: unknown;
  role_name?: unknown;
  userRole?: unknown;
  profile?: unknown;
  profileId?: unknown;
  profile_id?: unknown;
  roleId?: unknown;
  role_id?: unknown;
  headquarterId?: unknown;
  headquarter_id?: unknown;
  headquarter?: unknown;
  Headquarter?: unknown;
  headquarterName?: unknown;
  headquarter_name?: unknown;
  status?: string;
  active?: boolean;
  profile_image_url?: string;
  profileImageUrl?: string;
}

function extractUserRows(payload: unknown): RawUser[] {
  if (Array.isArray(payload)) {
    return payload as RawUser[];
  }

  if (payload && typeof payload === 'object') {
    const candidate = payload as Record<string, unknown>;

    if (Array.isArray(candidate.rows)) {
      return candidate.rows as RawUser[];
    }

    if (Array.isArray(candidate.data)) {
      return candidate.data as RawUser[];
    }

    if (Array.isArray(candidate.users)) {
      return candidate.users as RawUser[];
    }
  }

  return [];
}

function normalizeUser(item: RawUser): AppUser {
  const id = String(item.id ?? '');
  const username = String(item.username ?? '').trim();
  const firstname = String(item.firstname ?? item.firstnamee ?? '').trim();
  const lastname = String(item.lastname ?? item.lastName ?? '').trim();
  const email = String(item.email ?? '').trim();
  const role = extractRoleName(item);
  const roleId = extractRoleId(item);
  const headquarterId = extractHeadquarterId(item);
  const headquarterName = extractHeadquarterName(item);
  const status = String(item.status ?? '').trim();

  return {
    id: id || `user-${Date.now()}-${Math.random()}`,
    username: username || 'Sin usuario',
    firstname: firstname || undefined,
    lastname: lastname || undefined,
    email: email || undefined,
    role: role || undefined,
    roleId,
    headquarterId,
    headquarterName,
    status: status || undefined,
    active: typeof item.active === 'boolean' ? item.active : undefined,
    profile_image_url: item.profile_image_url,
    profileImageUrl: item.profileImageUrl ?? item.profile_image_url,
  };
}

function extractHeadquarterId(item: RawUser): number | undefined {
  const directCandidates = [item.headquarterId, item.headquarter_id];
  for (const candidate of directCandidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const nestedCandidates = [item.headquarter, item.Headquarter];
  for (const nestedCandidate of nestedCandidates) {
    if (!nestedCandidate || typeof nestedCandidate !== 'object') {
      continue;
    }

    const nestedObject = nestedCandidate as Record<string, unknown>;
    const parsed = Number(nestedObject.id ?? nestedObject.headquarterId ?? nestedObject.headquarter_id);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function extractHeadquarterName(item: RawUser): string | undefined {
  const directName = [item.headquarterName, item.headquarter_name]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);
  if (typeof directName === 'string') {
    return directName.trim();
  }

  const nestedCandidates = [item.headquarter, item.Headquarter];
  for (const nestedCandidate of nestedCandidates) {
    if (!nestedCandidate || typeof nestedCandidate !== 'object') {
      continue;
    }

    const nestedObject = nestedCandidate as Record<string, unknown>;
    const nameCandidate = nestedObject.name ?? nestedObject.description;

    if (typeof nameCandidate === 'string' && nameCandidate.trim()) {
      return nameCandidate.trim();
    }
  }

  return undefined;
}

function extractRoleName(item: RawUser): string {
  const roleCandidate = item.role;
  if (typeof roleCandidate === 'string' && roleCandidate.trim()) {
    return roleCandidate.trim().toLowerCase();
  }

  if (roleCandidate && typeof roleCandidate === 'object') {
    const roleObject = roleCandidate as Record<string, unknown>;
    const roleFromObject = [
      roleObject.name,
      roleObject.role,
      roleObject.description,
      roleObject.label,
    ].find((value) => typeof value === 'string' && String(value).trim().length > 0);

    if (typeof roleFromObject === 'string') {
      return roleFromObject.trim().toLowerCase();
    }
  }

  const directRoleCandidate = [item.rol, item.roleName, item.role_name, item.userRole]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);
  if (typeof directRoleCandidate === 'string') {
    return directRoleCandidate.trim().toLowerCase();
  }

  const nestedRoleCandidates = [item.Role, item.profile];
  for (const nestedCandidate of nestedRoleCandidates) {
    if (!nestedCandidate || typeof nestedCandidate !== 'object') {
      continue;
    }

    const nestedObject = nestedCandidate as Record<string, unknown>;
    const nestedName = [
      nestedObject.name,
      nestedObject.role,
      nestedObject.description,
      nestedObject.label,
    ].find((value) => typeof value === 'string' && String(value).trim().length > 0);

    if (typeof nestedName === 'string') {
      return nestedName.trim().toLowerCase();
    }
  }

  return '';
}

function extractRoleId(item: RawUser): number | undefined {
  const directRoleIdCandidates = [item.roleId, item.role_id, item.profileId, item.profile_id];
  for (const candidate of directRoleIdCandidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  const nestedRoleCandidates = [item.role, item.Role, item.profile];
  for (const nestedCandidate of nestedRoleCandidates) {
    if (!nestedCandidate || typeof nestedCandidate !== 'object') {
      continue;
    }

    const nestedObject = nestedCandidate as Record<string, unknown>;
    const parsed = Number(nestedObject.id ?? nestedObject.roleId ?? nestedObject.role_id);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return undefined;
}

function filterUsers(items: AppUser[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return items;
  }

  return items.filter((item) => {
    const values = [
      item.username,
      item.firstname,
      item.lastname,
      item.email,
      item.role,
      item.status,
    ];

    return values.some((value) => String(value ?? '').toLowerCase().includes(normalizedSearch));
  });
}

function sortUsers(items: AppUser[], sort: ListSortState | null) {
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
        rows: (result.rows as RawUser[]).map(normalizeUser),
        total: result.count,
      };
    }

    if (Array.isArray(result.data) && typeof result.total === 'number') {
      return {
        rows: (result.data as RawUser[]).map(normalizeUser),
        total: result.total,
      };
    }
  }

  const normalized = extractUserRows(response).map(normalizeUser);
  const filtered = filterUsers(normalized, search);
  const sorted = sortUsers(filtered, sort);
  const start = (page - 1) * pageSize;

  return {
    rows: sorted.slice(start, start + pageSize),
    total: sorted.length,
  };
}

export function createUser(data: CreateUserRequest) {
  const parsedHeadquarterId = Number(data.headquarterId);
  const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? parsedHeadquarterId
    : undefined;

  return endpoints.createUser({
    ...data,
    rol: data.role,
    roleName: data.role,
    role_id: data.roleId,
    headquarterId: normalizedHeadquarterId,
    headquarter_id: normalizedHeadquarterId,
  });
}

export function updateUser(id: string, data: UpdateUserRequest) {
  const parsedHeadquarterId = Number(data.headquarterId);
  const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? parsedHeadquarterId
    : undefined;

  return endpoints.updateUser(id, {
    id,
    ...data,
    rol: data.role,
    roleName: data.role,
    role_id: data.roleId,
    headquarterId: normalizedHeadquarterId,
    headquarter_id: normalizedHeadquarterId,
  });
}

export function deleteUser(id: string) {
  return endpoints.deleteUser(id);
}

export function updateUserProfileImage(image: string): Promise<UpdateUserProfileImageResponse> {
  return apiClient.patch(`${API_VERSION}/user/profile-image`, {
    image,
    profileImage: image,
    profile_image: image,
    avatar: image,
  });
}
