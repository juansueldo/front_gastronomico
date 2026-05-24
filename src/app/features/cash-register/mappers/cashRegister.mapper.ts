import type {
  BackendCashMovementType,
  CashMovementDto,
  CreateCashMovementRequest,
  LegacyCashMovementType,
  PaymentMethod,
} from '../types/cashRegister.dto';
import type { CashMovement } from '../types/cashRegister.model';

const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'efectivo';

const normalizePaymentMethod = (value: unknown): PaymentMethod => {
  if (value === 'tarjeta' || value === 'transferencia' || value === 'efectivo') return value;
  return DEFAULT_PAYMENT_METHOD;
};

export const toBackendCashMovementType = (
  type: BackendCashMovementType | LegacyCashMovementType
): BackendCashMovementType => {
  if (type === 'venta' || type === 'ingreso') return 'income';
  if (type === 'egreso') return 'expense';
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
  if (type === 'income') return 'ingreso';
  if (type === 'expense') return 'egreso';
  return undefined;
};

const normalizeAmountByType = (amount: number, type: BackendCashMovementType) => {
  if (type === 'adjustment') return amount;
  if (type === 'expense') return -Math.abs(amount);
  return Math.abs(amount);
};

export const toApiAmount = (amount: number, type: BackendCashMovementType) => (
  type === 'adjustment' ? amount : Math.abs(amount)
);

const formatTime = (rawDate: string | undefined) => {
  if (!rawDate) {
    return new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return rawDate;

  return parsedDate.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export function mapCashMovementDtoToModel(movement: CashMovementDto): CashMovement {
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
}

export function mapCashMovementRequestToDto(movementData: CreateCashMovementRequest) {
  const backendType = toBackendCashMovementType(movementData.type);
  const description = movementData.description ?? movementData.concept ?? 'Movimiento';
  const paymentMethod = movementData.paymentMethod ?? DEFAULT_PAYMENT_METHOD;

  return {
    type: backendType,
    amount: toApiAmount(movementData.amount, backendType),
    description,
    reference: movementData.reference,
    movementDate: movementData.movementDate,
    metadata: {
      ...(movementData.metadata ?? {}),
      paymentMethod,
      legacyType: movementData.type,
    },
  };
}
