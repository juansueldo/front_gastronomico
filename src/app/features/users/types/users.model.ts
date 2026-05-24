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
