export interface TableMetadata {
  waiter?: string;
  area?: string;
  headquarterId?: string | number;
  headquarter_id?: string | number;
  [key: string]: unknown;
}

export type TableDto = {
  id?: string | number;
  name?: string;
  table_number?: string | number;
  tableNumber?: string | number;
  description?: string;
  capacity?: string | number;
  location?: string;
  metadata?: TableMetadata | null;
  statusId?: string | number;
  status_id?: string | number;
  headquarterId?: string | number;
  headquarter_id?: string | number;
  headquarter?: { id?: string | number } | null;
  Headquarter?: { id?: string | number } | null;
  active?: boolean;
};

export interface CreateTableRequest {
  name: string;
  table_number: number;
  capacity?: number;
  location?: string;
  description?: string;
  metadata?: TableMetadata;
  headquarterId?: string | number;
}

export interface UpdateTableRequest {
  name?: string;
  table_number?: number;
  capacity?: number;
  location?: string;
  description?: string;
  metadata?: TableMetadata;
  headquarterId?: string | number;
}
