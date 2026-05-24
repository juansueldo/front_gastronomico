import type { CreateUserRequest, UpdateUserRequest, UserDto } from '../types/users.dto';
import type { AppUser } from '../types/users.model';

export const normalizeUserId = (value: string | number) => String(value);

function extractNestedNumber(item: UserDto, keys: Array<keyof UserDto>, nestedKeys: string[]) {
  for (const key of keys) {
    const parsed = Number(item[key]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  for (const key of nestedKeys) {
    const nestedCandidate = (item as Record<string, unknown>)[key];
    if (!nestedCandidate || typeof nestedCandidate !== 'object') continue;
    const nestedObject = nestedCandidate as Record<string, unknown>;
    const parsed = Number(nestedObject.id ?? nestedObject[`${key}Id`] ?? nestedObject[`${key}_id`]);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }

  return undefined;
}

function extractHeadquarterName(item: UserDto): string | undefined {
  const directName = [item.headquarterName, item.headquarter_name]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);
  if (typeof directName === 'string') return directName.trim();

  for (const key of ['headquarter', 'Headquarter']) {
    const nestedCandidate = (item as Record<string, unknown>)[key];
    if (!nestedCandidate || typeof nestedCandidate !== 'object') continue;
    const nestedObject = nestedCandidate as Record<string, unknown>;
    const nameCandidate = nestedObject.name ?? nestedObject.description;
    if (typeof nameCandidate === 'string' && nameCandidate.trim()) return nameCandidate.trim();
  }

  return undefined;
}

function extractRoleName(item: UserDto): string {
  const roleCandidate = item.role;
  if (typeof roleCandidate === 'string' && roleCandidate.trim()) return roleCandidate.trim().toLowerCase();

  if (roleCandidate && typeof roleCandidate === 'object') {
    const roleObject = roleCandidate as Record<string, unknown>;
    const roleFromObject = [roleObject.name, roleObject.role, roleObject.description, roleObject.label]
      .find((value) => typeof value === 'string' && String(value).trim().length > 0);
    if (typeof roleFromObject === 'string') return roleFromObject.trim().toLowerCase();
  }

  const directRoleCandidate = [item.rol, item.roleName, item.role_name, item.userRole]
    .find((value) => typeof value === 'string' && String(value).trim().length > 0);
  if (typeof directRoleCandidate === 'string') return directRoleCandidate.trim().toLowerCase();

  for (const key of ['Role', 'profile']) {
    const nestedCandidate = (item as Record<string, unknown>)[key];
    if (!nestedCandidate || typeof nestedCandidate !== 'object') continue;
    const nestedObject = nestedCandidate as Record<string, unknown>;
    const nestedName = [nestedObject.name, nestedObject.role, nestedObject.description, nestedObject.label]
      .find((value) => typeof value === 'string' && String(value).trim().length > 0);
    if (typeof nestedName === 'string') return nestedName.trim().toLowerCase();
  }

  return '';
}

export function mapUserDtoToModel(item: UserDto): AppUser {
  const id = String(item.id ?? '');
  const username = String(item.username ?? '').trim();
  const firstname = String(item.firstname ?? item.firstnamee ?? '').trim();
  const lastname = String(item.lastname ?? item.lastName ?? '').trim();
  const email = String(item.email ?? '').trim();
  const status = String(item.status ?? '').trim();

  return {
    id: id || `user-${Date.now()}-${Math.random()}`,
    username: username || 'Sin usuario',
    firstname: firstname || undefined,
    lastname: lastname || undefined,
    email: email || undefined,
    role: extractRoleName(item) || undefined,
    roleId: extractNestedNumber(item, ['roleId', 'role_id', 'profileId', 'profile_id'], ['role', 'Role', 'profile']),
    headquarterId: extractNestedNumber(item, ['headquarterId', 'headquarter_id'], ['headquarter', 'Headquarter']),
    headquarterName: extractHeadquarterName(item),
    status: status || undefined,
    active: typeof item.active === 'boolean' ? item.active : undefined,
    profile_image_url: item.profile_image_url,
    profileImageUrl: item.profileImageUrl ?? item.profile_image_url,
  };
}

export function mapUserPayloadToRequest(data: CreateUserRequest | UpdateUserRequest) {
  const parsedHeadquarterId = Number(data.headquarterId);
  const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? parsedHeadquarterId
    : undefined;

  return {
    ...data,
    rol: data.role,
    roleName: data.role,
    role_id: data.roleId,
    headquarterId: normalizedHeadquarterId,
    headquarter_id: normalizedHeadquarterId,
  };
}
