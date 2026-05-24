import type { TableMetadata } from './tables.dto';

export interface TableItem {
  id: string;
  name: string;
  tableNumber: number;
  table_number: number;
  description?: string;
  capacity?: number;
  location?: string;
  metadata?: TableMetadata;
  statusId?: number;
  headquarterId?: number;
  active: boolean;
}
