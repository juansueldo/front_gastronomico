import { getAuthSession } from './authStorage';

type CashImportMeta = ImportMeta & {
  env: {
    VITE_API_URL?: string;
    VITE_CASH_MOVEMENTS_LIST_PATH?: string;
    VITE_CASH_MOVEMENTS_CREATE_PATH?: string;
    VITE_CASH_MOVEMENTS_CLOSE_DAILY_PATH?: string;
  };
};

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

export interface CashMovement {
  id: string;
  time: string;
  type: 'venta' | 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

interface BackendCashMovement {
  id?: string | number;
  time?: string;
  type?: string;
  concept?: string;
  amount?: number | string;
  paymentMethod?: string;
  payment_method?: string;
  createdAt?: string;
  created_at?: string;
}

const API_URL = (import.meta as CashImportMeta).env?.VITE_API_URL;
const CASH_MOVEMENTS_LIST_PATH = (import.meta as CashImportMeta).env?.VITE_CASH_MOVEMENTS_LIST_PATH ?? '/v1/cash-movements';
const CASH_MOVEMENTS_CREATE_PATH = (import.meta as CashImportMeta).env?.VITE_CASH_MOVEMENTS_CREATE_PATH ?? '/v1/cash-movements';
const CASH_MOVEMENTS_CLOSE_DAILY_PATH = (import.meta as CashImportMeta).env?.VITE_CASH_MOVEMENTS_CLOSE_DAILY_PATH ?? '/v1/cash-movements/close-daily';

const getAuthToken = () => getAuthSession()?.accessToken;

const buildAuthHeaders = () => {
  const authToken = getAuthToken();

  if (!authToken) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente');
  }

  return {
    Authorization: `Bearer ${authToken}`,
  };
};

const ensureApiUrl = () => {
  if (!API_URL) {
    throw new Error('VITE_API_URL no está configurada');
  }

  return API_URL;
};

const normalizePaymentMethod = (value: string | undefined): PaymentMethod => {
  if (value === 'tarjeta' || value === 'transferencia') {
    return value;
  }

  return 'efectivo';
};

const normalizeType = (value: string | undefined): CashMovement['type'] => {
  if (value === 'ingreso' || value === 'egreso') {
    return value;
  }

  return 'venta';
};

const normalizeAmountByType = (amount: number, type: CashMovement['type']) => {
  const normalizedAmount = Math.abs(amount);

  if (type === 'egreso') {
    return -normalizedAmount;
  }

  return normalizedAmount;
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

const normalizeMovement = (movement: BackendCashMovement): CashMovement => {
  const parsedAmount = Number(movement.amount ?? 0);
  const normalizedType = normalizeType(movement.type);
  const normalizedAmount = Number.isFinite(parsedAmount)
    ? normalizeAmountByType(parsedAmount, normalizedType)
    : 0;

  return {
    id: String(movement.id ?? `cash-${Date.now()}-${Math.random()}`),
    time: movement.time ?? formatTime(movement.createdAt ?? movement.created_at),
    type: normalizedType,
    concept: movement.concept ?? 'Movimiento',
    amount: normalizedAmount,
    paymentMethod: normalizePaymentMethod(movement.paymentMethod ?? movement.payment_method),
  };
};

export const fetchCashMovements = async (): Promise<CashMovement[]> => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${CASH_MOVEMENTS_LIST_PATH}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || 'No se pudieron obtener los movimientos de caja');
  }

  const data = await response.json() as {
    movements?: BackendCashMovement[];
    cashMovements?: BackendCashMovement[];
    data?: BackendCashMovement[];
  };

  const movements = data.movements ?? data.cashMovements ?? data.data ?? [];
  return Array.isArray(movements) ? movements.map(normalizeMovement) : [];
};

interface CreateCashMovementInput {
  type: 'venta' | 'ingreso' | 'egreso';
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export const createCashMovement = async (movementInput: CreateCashMovementInput) => {
  const baseUrl = ensureApiUrl();
  const normalizedAmount = normalizeAmountByType(movementInput.amount, movementInput.type);

  const response = await fetch(`${baseUrl}${CASH_MOVEMENTS_LIST_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({
      type: movementInput.type,
      concept: movementInput.concept,
      amount: normalizedAmount,
      paymentMethod: movementInput.paymentMethod,
      payment_method: movementInput.paymentMethod,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo registrar el movimiento de caja');
  }

  return data;
};

export const closeDailyCashMovements = async (date: string) => {
  const baseUrl = ensureApiUrl();
  const response = await fetch(`${baseUrl}${CASH_MOVEMENTS_CLOSE_DAILY_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(),
    },
    body: JSON.stringify({ date }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || data?.detail || 'No se pudo cerrar la caja del día');
  }

  return data;
};

export const getFinalizedCashMovementsByDate = async (date: string) => {
  const baseUrl = ensureApiUrl();
  const query = new URLSearchParams({ date });
  const response = await fetch(`${baseUrl}/v1/cash-movements/finalized/by-date?${query.toString()}`, {
    method: 'GET',
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || 'No se pudieron obtener los movimientos finalizados');
  }

  const data = await response.json() as {
    movements?: BackendCashMovement[];
    cashMovements?: BackendCashMovement[];
    data?: BackendCashMovement[];
  };

  const movements = data.movements ?? data.cashMovements ?? data.data ?? [];
  return Array.isArray(movements) ? movements.map(normalizeMovement) : [];
};
