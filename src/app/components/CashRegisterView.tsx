import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from './ui/dialog';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from './ui/select';
import { toast } from 'sonner';
import { ApiError, closeDailyCashMovements, createCashMovement, fetchCashMovements, getCashMovementsByDate, type CashMovement, type PaymentMethod } from '../api';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const getTypeBadgeClass = (type: CashMovement['type']) => {
  if (type === 'income' || type === 'opening') {
    return 'bg-label-success text-xs';
  }

  if (type === 'adjustment' || type === 'closing') {
    return 'bg-label-info  text-xs';
  }

  return 'bg-label-danger  text-xs';
};

const getTypeLabel = (type: CashMovement['type']) => {
  if (type === 'opening') return 'Apertura';
  if (type === 'income') return 'Ingreso';
  if (type === 'expense') return 'Egreso';
  if (type === 'adjustment') return 'Ajuste';
  return 'Cierre';
};

const getPaymentMethodLabel = (paymentMethod: PaymentMethod) => {
  if (paymentMethod === 'efectivo') {
    return 'Efectivo';
  }

  if (paymentMethod === 'tarjeta') {
    return 'Tarjeta';
  }

  return 'Transferencia';
};

export function CashRegisterView() {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);
  const [movementFilterMode, setMovementFilterMode] = useState<'current-shift' | 'date'>('current-shift');
  const [selectedMovementDate, setSelectedMovementDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualType, setManualType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [manualConcept, setManualConcept] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<PaymentMethod>('efectivo');

  const loadMovements = async (options?: {
    mode?: 'current-shift' | 'date';
    date?: string;
  }) => {
    const mode = options?.mode ?? movementFilterMode;
    const date = options?.date ?? selectedMovementDate;

    setIsLoadingMovements(true);
    try {
      if (mode === 'date') {
        const backendMovements = await getCashMovementsByDate(date);
        setMovements(backendMovements);
      } else {
        const backendMovements = await fetchCashMovements(undefined, { sinceLastClosing: true });
        setMovements(backendMovements);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudieron cargar los movimientos de caja');
      }
    } finally {
      setIsLoadingMovements(false);
    }
  };

  useEffect(() => {
    void loadMovements({ mode: 'current-shift' });
  }, []);

  const totalSales = movements
    .filter((movement) => movement.legacyType === 'venta' || movement.description.toLowerCase().startsWith('orden ') || movement.description.toLowerCase().startsWith('mesa '))
    .reduce((accumulator, movement) => accumulator + movement.amount, 0);

  const totalIncomes = movements
    .filter((movement) => movement.type === 'income' || (movement.type === 'adjustment' && movement.amount > 0) || movement.type === 'opening')
    .reduce((accumulator, movement) => accumulator + Math.abs(movement.amount), 0);

  const totalExpenses = movements
    .filter((movement) => movement.type === 'expense' || (movement.type === 'adjustment' && movement.amount < 0))
    .reduce((accumulator, movement) => accumulator + Math.abs(movement.amount), 0);

  const expectedCash = movements
    .filter((movement) => movement.paymentMethod === 'efectivo')
    .reduce((accumulator, movement) => accumulator + movement.amount, 0);

  const handleAddManualMovement = async () => {
    const trimmedConcept = manualConcept.trim();
    const parsedAmount = Number(manualAmount.replace(',', '.'));

    if (!trimmedConcept) {
      toast.error('Ingresá un concepto para el movimiento');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Ingresá un importe válido');
      return;
    }

    const normalizedAmount = manualType === 'egreso'
      ? -Math.abs(parsedAmount)
      : Math.abs(parsedAmount);

    try {
      await createCashMovement({
        type: manualType,
        concept: trimmedConcept,
        amount: normalizedAmount,
        paymentMethod: manualPaymentMethod,
      });

      await loadMovements();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo registrar el movimiento');
      }
      return;
    }

    toast.success(`${manualType === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`);
    setManualConcept('');
    setManualAmount('');
    setIsManualDialogOpen(false);
  };

  const handleCloseCashRegister = async () => {
    try {
      await closeDailyCashMovements(new Date().toISOString(), undefined, Math.max(expectedCash, 0));
      await loadMovements();
      toast.success('Cierre de caja registrado');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo registrar el cierre de caja');
      }
    }
  };

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-white">Caja</h1>
            <p className="text-sm text-gray-400">
              {movementFilterMode === 'current-shift'
                ? 'Mostrando movimientos desde el último cierre'
                : `Mostrando movimientos del ${new Date(`${selectedMovementDate}T00:00:00`).toLocaleDateString('es-AR')}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-success text-white">Caja abierta</Badge>
            <Button size="sm" variant="secondary" onClick={() => setIsManualDialogOpen(true)}>
              Registrar movimiento
            </Button>
            <Button size="sm" onClick={() => void handleCloseCashRegister()}>Cierre de caja</Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={movementFilterMode}
            onValueChange={(value) => {
              const nextMode = value as 'current-shift' | 'date';
              setMovementFilterMode(nextMode);
              if (nextMode === 'current-shift') {
                void loadMovements({ mode: nextMode });
              }
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Filtrar movimientos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current-shift">Desde último cierre</SelectItem>
              <SelectItem value="date">Por fecha</SelectItem>
            </SelectContent>
          </Select>

          {movementFilterMode === 'date' && (
            <Input
              type="date"
              value={selectedMovementDate}
              onChange={(event) => setSelectedMovementDate(event.target.value)}
              className="w-[190px]"
            />
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => void loadMovements()}
            disabled={isLoadingMovements || (movementFilterMode === 'date' && !selectedMovementDate)}
          >
            {isLoadingMovements ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border card bg-blue-500/10 border-blue-500/70">
            <p className="text-xs text-gray-400">Ventas</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(totalSales)}</p>
          </div>
          <div className="p-3 rounded-lg border card bg-green-500/10 border-green-500/70">
            <p className="text-xs text-gray-400">Ingresos</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(totalIncomes)}</p>
          </div>
          <div className="p-3 rounded-lg border card bg-red-500/10 border-red-500/70">
            <p className="text-xs text-gray-400">Egresos</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(totalExpenses)}</p>
          </div>
          <div className="p-3 rounded-lg border border-yellow-500/70 card bg-yellow-500/10">
            <p className="text-xs text-gray-300">Efectivo esperado</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(expectedCash)}</p>
          </div>
        </div>

        <div className="rounded-lg border card bg-card">
          <div className="px-4 py-3 border-b border-[--border] flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">
              {movementFilterMode === 'current-shift' ? 'Movimientos del turno' : 'Movimientos por fecha'}
            </h2>
            <Badge variant="secondary" className="bg-label-secondary text-white text-xs">
              {movements.length} movimientos
            </Badge>
          </div>

          <div className="divide-y divide-gray-700">
            {movements.map((movement) => (
              <div key={movement.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">{movement.time}</span>
                    <Badge variant="secondary" className={getTypeBadgeClass(movement.type)}>
                      {getTypeLabel(movement.type)}
                    </Badge>
                  </div>
                  <p className="text-sm text-white truncate">{movement.concept}</p>
                  <p className="text-xs text-gray-400">{getPaymentMethodLabel(movement.paymentMethod)}</p>
                </div>

                <span className={`text-sm font-medium ${movement.amount >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {movement.amount >= 0 ? '+' : '-'}{currencyFormatter.format(Math.abs(movement.amount))}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
          <DialogContent className="bg-card card text-white">
            <DialogHeader>
              <DialogTitle>Registrar ingreso/egreso</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={manualType} onValueChange={(value) => setManualType(value as 'ingreso' | 'egreso')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={manualPaymentMethod} onValueChange={(value) => setManualPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  placeholder="Concepto"
                  value={manualConcept}
                  onChange={(event) => setManualConcept(event.target.value)}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Importe"
                  value={manualAmount}
                  onChange={(event) => setManualAmount(event.target.value)}
                />
              </div>

              <Button className="w-full" onClick={handleAddManualMovement}>
                Guardar movimiento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
