import type { BackendCashMovementType, LegacyCashMovementType, PaymentMethod } from './cashRegister.dto';

export interface CashMovement {
  id: string;
  time: string;
  type: BackendCashMovementType;
  description: string;
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
  reference?: string;
  movementDate?: string;
  metadata?: Record<string, unknown>;
  legacyType?: LegacyCashMovementType;
  createdAt?: string;
  created_at?: string;
}

export interface FetchCashMovementsOptions {
  sinceLastClosing?: boolean;
}

export interface ListCashMovementsParams {
  headquarterId?: string | number;
  from?: string;
  to?: string;
  type?: BackendCashMovementType;
  limit?: number;
}
