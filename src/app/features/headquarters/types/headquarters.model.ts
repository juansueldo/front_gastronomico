export interface Headquarter {
  id: string;
  name: string;
  phone?: string;
  location?: string;
  latitude?: number | string | null;
  longitude?: number | string | null;
  storeId?: string;
  statusId?: number;
  schedules?: HeadquarterScheduleInput[];
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
