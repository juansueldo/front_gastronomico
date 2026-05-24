export type BackendCashMovementType = 'opening' | 'income' | 'expense' | 'adjustment' | 'closing';
export type LegacyCashMovementType = 'venta' | 'ingreso' | 'egreso';
export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

export type CashMovementDto = {
  id?: string | number;
  type?: string;
  amount?: number | string;
  description?: string;
  concept?: string;
  reference?: string;
  movementDate?: string;
  movement_date?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  created_at?: string;
};

export interface CashRegisterSummaryDto {
  balance?: number;
  currentBalance?: number;
  total?: number;
  movements?: CashMovementDto[];
  rows?: CashMovementDto[];
  data?: CashMovementDto[];
}

export interface CreateCashMovementRequest {
  type: BackendCashMovementType | LegacyCashMovementType;
  amount: number;
  description?: string;
  concept?: string;
  paymentMethod?: PaymentMethod;
  reference?: string;
  movementDate?: string;
  metadata?: Record<string, unknown>;
  headquarterId?: string | number;
}
