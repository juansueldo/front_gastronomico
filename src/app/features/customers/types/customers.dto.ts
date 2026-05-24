export type CustomerDto = {
  id?: string | number;
  name?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  phoneNumber?: string;
  customerPhone?: string;
  email?: string;
  statusId?: number | string;
  status_id?: number | string;
  status?: {
    id?: number | string;
    name?: string;
  } | null;
  Status?: {
    id?: number | string;
    name?: string;
  } | null;
  orderCount?: number | string;
  totalSpent?: number | string;
  lastOrder?: {
    id?: string | number;
    order_date?: string;
    orderDate?: string;
    status?: string;
    total_amount?: number | string;
    totalAmount?: number | string;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  lastDeliveryAddress?: {
    street?: string;
    number?: string;
    locality?: string;
    crossStreets?: string;
    latitude?: number;
    longitude?: number;
    formatted?: string;
  };
  Orders?: CustomerOrderDto[];
  orders?: CustomerOrderDto[];
};

export type CustomerOrderDto = {
  id?: string | number;
  createdAt?: string;
  created_at?: string;
  total_amount?: number | string;
  total?: number | string;
  OrderItems?: CustomerOrderItemDto[];
  orderItems?: CustomerOrderItemDto[];
};

export type CustomerOrderItemDto = {
  Product?: { name?: string };
  product?: { name?: string };
};

export interface CreateCustomerRequest {
  name?: string;
  firstname?: string;
  lastname?: string;
  phone: string;
  email?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateCustomerRequest {
  name?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  email?: string;
  metadata?: Record<string, unknown>;
}
