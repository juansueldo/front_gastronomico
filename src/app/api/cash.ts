/**
 * API de Caja - Cash Register endpoints
 */

import { listHeadquarters } from './headquarter';
import { endpoints } from './endpoints';

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';
export type BackendCashMovementType = 'opening' | 'income' | 'expense' | 'adjustment' | 'closing';
export type LegacyCashMovementType = 'venta' | 'ingreso' | 'egreso';

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

interface BackendCashMovement {
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
}

interface CashRegisterSummaryResponse {
  balance?: number;
  currentBalance?: number;
  total?: number;
  movements?: BackendCashMovement[];
  rows?: BackendCashMovement[];
  data?: BackendCashMovement[];
}

const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'efectivo';

const normalizePaymentMethod = (value: unknown): PaymentMethod => {
  if (value === 'tarjeta' || value === 'transferencia' || value === 'efectivo') {
    return value;
  }

  return DEFAULT_PAYMENT_METHOD;
};

const toBackendCashMovementType = (
  type: BackendCashMovementType | LegacyCashMovementType
): BackendCashMovementType => {
  if (type === 'venta' || type === 'ingreso') {
    return 'income';
  }

  if (type === 'egreso') {
    return 'expense';
  }

  return type;
};

const toLegacyCashMovementType = (
  type: BackendCashMovementType,
  metadata?: Record<string, unknown>
): LegacyCashMovementType | undefined => {
  const metadataLegacyType = metadata?.legacyType;
  if (metadataLegacyType === 'venta' || metadataLegacyType === 'ingreso' || metadataLegacyType === 'egreso') {
    return metadataLegacyType;
  }

  if (type === 'income') {
    return 'ingreso';
  }

  if (type === 'expense') {
    return 'egreso';
  }

  return undefined;
};

const normalizeAmountByType = (amount: number, type: BackendCashMovementType) => {
  if (type === 'adjustment') {
    return amount;
  }

  if (type === 'expense') {
    return -Math.abs(amount);
  }

  return Math.abs(amount);
};

const toApiAmount = (amount: number, type: BackendCashMovementType) => {
  if (type === 'adjustment') {
    return amount;
  }

  return Math.abs(amount);
};

const formatTime = (rawDate: string | undefined) => {
  if (!rawDate) {
    return new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  const parsedDate = new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) {
    return rawDate;
  }

  return parsedDate.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const extractMovementRows = (data: CashRegisterSummaryResponse | BackendCashMovement[] | unknown): BackendCashMovement[] => {
  if (Array.isArray(data)) {
    return data;
  }

  if (data && typeof data === 'object') {
    const candidate = data as CashRegisterSummaryResponse;

    if (Array.isArray(candidate.movements)) {
      return candidate.movements;
    }

    if (Array.isArray(candidate.rows)) {
      return candidate.rows;
    }

    if (Array.isArray(candidate.data)) {
      return candidate.data;
    }
  }

  return [];
};

const normalizeMovement = (movement: BackendCashMovement): CashMovement => {
  const metadata = movement.metadata && typeof movement.metadata === 'object' ? movement.metadata : undefined;
  const backendType = toBackendCashMovementType(String(movement.type ?? 'income') as BackendCashMovementType | LegacyCashMovementType);
  const parsedAmount = Number(movement.amount ?? 0);
  const movementDate = movement.movementDate ?? movement.movement_date ?? movement.createdAt ?? movement.created_at;
  const description = movement.description ?? movement.concept ?? 'Movimiento';
  const paymentMethod = normalizePaymentMethod(
    metadata?.paymentMethod
      ?? metadata?.payment_method
      ?? metadata?.paymentMethodLabel
  );

  return {
    id: String(movement.id ?? `cash-${Date.now()}-${Math.random()}`),
    time: formatTime(movementDate),
    type: backendType,
    description,
    concept: description,
    amount: Number.isFinite(parsedAmount) ? normalizeAmountByType(parsedAmount, backendType) : 0,
    paymentMethod,
    reference: movement.reference,
    movementDate,
    metadata,
    legacyType: toLegacyCashMovementType(backendType, metadata),
    createdAt: movement.createdAt,
    created_at: movement.created_at,
  };
};

const resolveHeadquarterId = async (headquarterId?: string | number) => {
  if (headquarterId !== undefined && headquarterId !== null && String(headquarterId).trim() !== '') {
    return String(headquarterId);
  }

  const headquarters = await listHeadquarters({ page: 1, pageSize: 1 });
  const firstHeadquarter = headquarters.rows[0];

  if (!firstHeadquarter?.id) {
    throw new Error('No hay sedes configuradas para registrar movimientos de caja');
  }

  return String(firstHeadquarter.id);
};

/**
 * Obtiene todos los movimientos de caja de una sede
 */
export async function fetchCashMovements(headquarterId?: string | number): Promise<CashMovement[]> {
  const resolvedHeadquarterId = await resolveHeadquarterId(headquarterId);
  const data = await endpoints.fetchHeadquarterCashRegister(resolvedHeadquarterId);
  return extractMovementRows(data).map(normalizeMovement);
}

/**
 * Lista movimientos de caja con filtros
 */
export async function listCashMovements(params?: {
  headquarterId?: string | number;
  from?: string;
  to?: string;
  type?: BackendCashMovementType;
  limit?: number;
}): Promise<CashMovement[]> {
  const resolvedHeadquarterId = await resolveHeadquarterId(params?.headquarterId);
  const data = await endpoints.fetchHeadquarterCashRegister(resolvedHeadquarterId, {
    from: params?.from ?? '',
    to: params?.to ?? '',
    type: params?.type ?? '',
    limit: params?.limit ?? '',
  });

  return extractMovementRows(data).map(normalizeMovement);
}

/**
 * Crea un nuevo movimiento de caja
 */
export async function createCashMovement(movementData: CreateCashMovementRequest): Promise<any> {
  const resolvedHeadquarterId = await resolveHeadquarterId(movementData.headquarterId);
  const backendType = toBackendCashMovementType(movementData.type);
  const description = movementData.description ?? movementData.concept ?? 'Movimiento';
  const paymentMethod = movementData.paymentMethod ?? DEFAULT_PAYMENT_METHOD;
  const metadata = {
    ...(movementData.metadata ?? {}),
    paymentMethod,
    legacyType: movementData.type,
  };

  return endpoints.createHeadquarterCashMovement(resolvedHeadquarterId, {
    type: backendType,
    amount: toApiAmount(movementData.amount, backendType),
    description,
    reference: movementData.reference,
    movementDate: movementData.movementDate,
    metadata,
  });
}

/**
 * Registra un cierre de caja como movimiento closing
 */
export async function closeDailyCashMovements(
  date: string,
  headquarterId?: string | number,
  amount = 0
): Promise<any> {
  return createCashMovement({
    headquarterId,
    type: 'closing',
    amount,
    description: `Cierre de caja ${date}`,
    movementDate: date,
  });
}

/**
 * Obtiene movimientos por fecha usando filtros del resumen de caja
 */
export async function getFinalizedCashMovementsByDate(
  date: string,
  headquarterId?: string | number
): Promise<CashMovement[]> {
  return listCashMovements({
    headquarterId,
    from: date,
    to: date,
  });
}
