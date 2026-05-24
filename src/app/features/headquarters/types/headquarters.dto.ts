export type HeadquarterDto = {
  id?: string | number;
  name?: string;
  phone?: string;
  location?: string;
  address?: string;
  latitude?: number | string | null;
  lat?: number | string | null;
  longitude?: number | string | null;
  lng?: number | string | null;
  storeId?: string | number;
  store_id?: string | number;
  statusId?: number | string;
  status_id?: number | string;
  schedules?: HeadquarterScheduleDto[];
};

export type HeadquarterScheduleDto = {
  dayOfWeek?: string;
  day_of_week?: string;
  openTime?: string;
  open_time?: string;
  closeTime?: string;
  close_time?: string;
  isClosed?: boolean;
  is_closed?: boolean;
};

export interface CreateHeadquarterRequest {
  name: string;
  phone?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface UpdateHeadquarterRequest {
  name?: string;
  phone?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}
