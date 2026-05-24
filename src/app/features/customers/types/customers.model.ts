export interface Customer {
  id?: number;
  name: string;
  firstname?: string;
  lastname?: string;
  phone: string;
  email?: string;
  statusId?: number;
  statusName?: string;
  orderCount?: number;
  totalSpent?: number;
  lastOrder?: {
    id?: number | string;
    orderDate?: string;
    status?: string;
    totalAmount?: number;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CustomerLookupResult {
  id?: number;
  name: string;
  phone: string;
  savedAddress?: {
    street?: string;
    number?: string;
    locality?: string;
    crossStreets?: string;
    latitude?: number;
    longitude?: number;
    formatted: string;
  };
  orderHistory?: Array<{
    id: string;
    date: string;
    total: string;
    items: string[];
  }>;
}

export interface ListCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
}

export interface CustomerListResult {
  rows: Customer[];
  total: number;
}
