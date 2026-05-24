export type UserDto = {
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
};

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
