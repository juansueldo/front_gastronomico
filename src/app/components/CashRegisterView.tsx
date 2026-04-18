import { useEffect, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from './ui/dialog';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from './ui/select';
import { toast } from 'sonner';
import { ApiError, createCashMovement, fetchCashMovements, type CashMovement, type PaymentMethod } from '../api';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const getTypeBadgeClass = (type: CashMovement['type']) => {
  if (type === 'venta') {
    return 'bg-label-success text-xs';
  }

  if (type === 'ingreso') {
    return 'bg-label-info  text-xs';
  }

  return 'bg-label-danger  text-xs';
};

const getTypeLabel = (type: CashMovement['type']) => {
  if (type === 'venta') {
    return 'Venta';
  }

  if (type === 'ingreso') {
    return 'Ingreso';
  }

  return 'Egreso';
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
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualType, setManualType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [manualConcept, setManualConcept] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<PaymentMethod>('efectivo');

  useEffect(() => {
    const loadMovements = async () => {
      try {
        const backendMovements = await fetchCashMovements();
        setMovements(backendMovements);
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        } else {
          toast.error('No se pudo cargar la caja');
        }
      }
    };

    void loadMovements();
  }, []);

  const totalSales = movements
    .filter((movement) => movement.type === 'venta')
    .reduce((accumulator, movement) => accumulator + movement.amount, 0);

  const totalIncomes = movements
    .filter((movement) => movement.type === 'ingreso')
    .reduce((accumulator, movement) => accumulator + movement.amount, 0);

  const totalExpenses = movements
    .filter((movement) => movement.type === 'egreso')
    .reduce((accumulator, movement) => accumulator + movement.amount, 0);

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

      const backendMovements = await fetchCashMovements();
      setMovements(backendMovements);
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

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-white">Caja</h1>
            <p className="text-sm text-gray-400">Turno actual abierto desde 18:00</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-success text-white">Caja abierta</Badge>
            <Button size="sm" variant="secondary" onClick={() => setIsManualDialogOpen(true)}>
              Registrar movimiento
            </Button>
            <Button size="sm">Cierre de caja</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-orange-700 bg-card">
            <p className="text-xs text-gray-400">Ventas</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(totalSales)}</p>
          </div>
          <div className="p-3 rounded-lg border border-orange-700 bg-card">
            <p className="text-xs text-gray-400">Ingresos</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(totalIncomes)}</p>
          </div>
          <div className="p-3 rounded-lg border border-orange-700 bg-card">
            <p className="text-xs text-gray-400">Egresos</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(totalExpenses)}</p>
          </div>
          <div className="p-3 rounded-lg border border-green-500/70 bg-green-500/10">
            <p className="text-xs text-gray-300">Efectivo esperado</p>
            <p className="text-lg font-semibold text-white">{currencyFormatter.format(expectedCash)}</p>
          </div>
        </div>

        <div className="rounded-lg border border-orange-700 bg-card">
          <div className="px-4 py-3 border-b border-orange-700 flex items-center justify-between">
            <h2 className="text-sm font-medium text-white">Movimientos del turno</h2>
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
          <DialogContent className="bg-card border-orange-700 text-white">
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
