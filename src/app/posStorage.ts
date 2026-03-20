export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';
export type CashMovementType = 'venta' | 'ingreso' | 'egreso';

export interface CashMovement {
  id: string;
  time: string;
  type: CashMovementType;
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

const CASH_MOVEMENTS_STORAGE_KEY = 'mobile_tomatina.cashMovements';
export const CASH_MOVEMENTS_UPDATED_EVENT = 'mobile_tomatina.cashMovementsUpdated';

const defaultMovements: CashMovement[] = [
  { id: 'm1', time: '20:05', type: 'venta', concept: 'Ticket #2301', amount: 28500, paymentMethod: 'efectivo' },
  { id: 'm2', time: '20:26', type: 'venta', concept: 'Ticket #2302', amount: 12400, paymentMethod: 'tarjeta' },
  { id: 'm3', time: '20:41', type: 'egreso', concept: 'Compra de insumos', amount: -8500, paymentMethod: 'efectivo' },
  { id: 'm4', time: '21:10', type: 'ingreso', concept: 'Ajuste de caja', amount: 2000, paymentMethod: 'efectivo' },
  { id: 'm5', time: '21:22', type: 'venta', concept: 'Ticket #2303', amount: 9600, paymentMethod: 'transferencia' },
];

const getCurrentTime = () => new Date().toLocaleTimeString('es-AR', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const canUseStorage = () => typeof window !== 'undefined' && !!window.localStorage;

const notifyMovementsUpdated = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(CASH_MOVEMENTS_UPDATED_EVENT));
};

const saveCashMovements = (movements: CashMovement[]) => {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(CASH_MOVEMENTS_STORAGE_KEY, JSON.stringify(movements));
  notifyMovementsUpdated();
};

export const getCashMovements = (): CashMovement[] => {
  if (!canUseStorage()) {
    return defaultMovements;
  }

  const rawValue = window.localStorage.getItem(CASH_MOVEMENTS_STORAGE_KEY);

  if (!rawValue) {
    saveCashMovements(defaultMovements);
    return defaultMovements;
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return defaultMovements;
    }

    return parsedValue;
  } catch {
    return defaultMovements;
  }
};

interface AddCashMovementInput {
  type: CashMovementType;
  concept: string;
  amount: number;
  paymentMethod: PaymentMethod;
}

export const addCashMovement = ({ type, concept, amount, paymentMethod }: AddCashMovementInput) => {
  const movements = getCashMovements();

  const nextMovement: CashMovement = {
    id: `m-${Date.now()}`,
    time: getCurrentTime(),
    type,
    concept,
    amount,
    paymentMethod,
  };

  saveCashMovements([nextMovement, ...movements]);

  return nextMovement;
};
