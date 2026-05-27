export interface Waiter {
  id: string;
  firstname: string;
  lastname: string;
  email?: string | null;
  phone?: string | null;
  identification?: string | null;
  salary?: number | null;
  hireDate?: string | null;
  headquarterId?: number | null;
  headquarterName?: string | null;
  headquarterLocation?: string | null;
  statusId?: number | null;
  statusName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface ListWaitersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: ListSortState | null;
}

export interface WaiterListResult {
  rows: Waiter[];
  total: number;
}
