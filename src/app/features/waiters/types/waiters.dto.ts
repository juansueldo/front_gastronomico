export interface WaiterDto {
  id?: number | string;
  firstname?: string;
  lastname?: string;
  email?: string | null;
  phone?: string | null;
  identification?: string | null;
  salary?: number | string | null;
  hire_date?: string | null;
  hireDate?: string | null;
  metadata?: Record<string, unknown> | null;
  statusId?: number | string | null;
  headquarterId?: number | string | null;
  Headquarter?: {
    id?: number | string;
    name?: string;
    location?: string | null;
  } | null;
  Status?: {
    id?: number | string;
    name?: string;
  } | null;
  storeId?: number | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWaiterRequest {
  firstname: string;
  lastname: string;
  email?: string;
  phone?: string;
  identification?: string;
  salary?: number | null;
  hireDate?: string;
  headquarterId?: number | null;
}

export type UpdateWaiterRequest = Partial<CreateWaiterRequest>;
