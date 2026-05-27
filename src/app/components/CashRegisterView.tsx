import { useEffect, useState } from 'react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from '../shared/ui/components/dialog';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '../shared/ui/components/select';
import { CircleDollarSign, WalletCards } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../core/http/errors';
import { closeDailyCashMovements, createCashMovement, fetchCashMovements, getCashMovementsByDate, listCashMovements, type CashMovement, type PaymentMethod } from '../features/cash-register';
import { listHeadquarters, type Headquarter } from '../features/headquarters';
import { getLoggedUser } from '../core/storage/authStorage';
import { getStorageItem, removeStorageItem, setStorageItem } from '../shared/storage';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const CASH_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';
const COMPACT_DIALOG_CONTENT_CLASS = 'max-h-[90vh] w-[calc(100vw-2rem)] max-w-[680px] gap-0 overflow-visible p-0';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';

const getStoredHeadquarterId = () => getStorageItem(CASH_HEADQUARTER_STORAGE_KEY);

const getLoggedUserHeadquarterId = () => {
  const parsedHeadquarterId = Number(getLoggedUser()?.headquarterId);
  if (Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0) {
    return String(parsedHeadquarterId);
  }

  return '';
};

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

const getMovementTimestamp = (movement: Pick<CashMovement, 'movementDate' | 'createdAt' | 'created_at'>): number | null => {
  const rawDate = movement.movementDate ?? movement.createdAt ?? movement.created_at;
  if (!rawDate) {
    return null;
  }

  const parsedTimestamp = new Date(rawDate).getTime();
  if (Number.isNaN(parsedTimestamp)) {
    return null;
  }

  return parsedTimestamp;
};

export function CashRegisterView() {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState(() => getLoggedUserHeadquarterId() || getStoredHeadquarterId());
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
  const [isOpeningDialogOpen, setIsOpeningDialogOpen] = useState(false);
  const [manualType, setManualType] = useState<'ingreso' | 'egreso'>('ingreso');
  const [manualConcept, setManualConcept] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [manualPaymentMethod, setManualPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [openingAmount, setOpeningAmount] = useState('');
  const [openingConcept, setOpeningConcept] = useState('Apertura de caja');
  const [lastClosingAmount, setLastClosingAmount] = useState<number | null>(null);
  const [isLoadingLastClosingAmount, setIsLoadingLastClosingAmount] = useState(false);
  const [isSavingManualMovement, setIsSavingManualMovement] = useState(false);
  const [isSavingOpening, setIsSavingOpening] = useState(false);

  const loadMovements = async (options?: {
    mode?: 'current-shift' | 'date';
    date?: string;
    headquarterId?: string;
  }) => {
    const mode = options?.mode ?? movementFilterMode;
    const date = options?.date ?? selectedMovementDate;
    const headquarterId = options?.headquarterId ?? selectedHeadquarterId;

    if (!headquarterId) {
      setMovements([]);
      return;
    }

    setIsLoadingMovements(true);
    try {
      if (mode === 'date') {
        const backendMovements = await getCashMovementsByDate(date, headquarterId);
        setMovements(backendMovements);
      } else {
        const backendMovements = await fetchCashMovements(headquarterId, { sinceLastClosing: true });
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

  const loadLastClosingAmount = async (headquarterId: string) => {
    if (!headquarterId) {
      setLastClosingAmount(null);
      return;
    }

    setIsLoadingLastClosingAmount(true);
    try {
      const closingMovements = await listCashMovements({
        headquarterId,
        type: 'closing',
      });

      const latestClosing = closingMovements.reduce<CashMovement | null>((latest, movement) => {
        if (movement.type !== 'closing') {
          return latest;
        }

        const movementTimestamp = getMovementTimestamp(movement);
        if (movementTimestamp === null) {
          return latest;
        }

        if (!latest) {
          return movement;
        }

        const latestTimestamp = getMovementTimestamp(latest);
        if (latestTimestamp === null || movementTimestamp > latestTimestamp) {
          return movement;
        }

        return latest;
      }, null);

      setLastClosingAmount(latestClosing ? Math.max(latestClosing.amount, 0) : null);
    } catch {
      // Si falla la carga de sugerencia no bloqueamos el flujo principal de caja.
      setLastClosingAmount(null);
    } finally {
      setIsLoadingLastClosingAmount(false);
    }
  };

  useEffect(() => {
    const initializeHeadquarters = async () => {
      setIsLoadingHeadquarters(true);
      try {
        const result = await listHeadquarters({ page: 1, pageSize: 100 });
        const rows = result.rows ?? [];
        setHeadquarters(rows);

        if (rows.length === 0) {
          setSelectedHeadquarterId('');
          setMovements([]);
          toast.error('No hay sedes configuradas para operar la caja');
          return;
        }

        const loggedUserHeadquarterId = getLoggedUserHeadquarterId();
        const storedHeadquarterId = getStoredHeadquarterId();
        const loggedUserIsValid = loggedUserHeadquarterId && rows.some((item) => String(item.id) === loggedUserHeadquarterId);
        const currentIsValid = selectedHeadquarterId && rows.some((item) => String(item.id) === selectedHeadquarterId);
        const storedIsValid = storedHeadquarterId && rows.some((item) => String(item.id) === storedHeadquarterId);

        const initialHeadquarterId = loggedUserIsValid
          ? loggedUserHeadquarterId
          : currentIsValid
            ? selectedHeadquarterId
          : storedIsValid
            ? storedHeadquarterId
            : String(rows[0].id);

        setSelectedHeadquarterId(initialHeadquarterId);
        await loadMovements({ mode: 'current-shift', headquarterId: initialHeadquarterId });
        await loadLastClosingAmount(initialHeadquarterId);
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        } else {
          toast.error('No se pudieron cargar las sedes');
        }
      } finally {
        setIsLoadingHeadquarters(false);
      }
    };

    void initializeHeadquarters();
  }, []);

  useEffect(() => {
    if (selectedHeadquarterId) {
      setStorageItem(CASH_HEADQUARTER_STORAGE_KEY, selectedHeadquarterId);
    } else {
      removeStorageItem(CASH_HEADQUARTER_STORAGE_KEY);
    }
  }, [selectedHeadquarterId]);

  const selectedHeadquarterName = headquarters.find((item) => String(item.id) === selectedHeadquarterId)?.name;
  const hasOpeningInCurrentShift = movements.some((movement) => movement.type === 'opening');

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
    if (isSavingManualMovement) {
      return;
    }

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

    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para registrar movimientos');
      return;
    }

    try {
      setIsSavingManualMovement(true);
      await createCashMovement({
        type: manualType,
        concept: trimmedConcept,
        amount: normalizedAmount,
        paymentMethod: manualPaymentMethod,
        headquarterId: selectedHeadquarterId,
      });

      await loadMovements();
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo registrar el movimiento');
      }
      return;
    } finally {
      setIsSavingManualMovement(false);
    }

    toast.success(`${manualType === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado`);
    setManualConcept('');
    setManualAmount('');
    setIsManualDialogOpen(false);
  };

  const handleOpenCashRegister = async () => {
    if (isSavingOpening) {
      return;
    }

    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para abrir la caja');
      return;
    }

    const parsedAmount = Number(openingAmount.replace(',', '.'));
    const trimmedConcept = openingConcept.trim() || 'Apertura de caja';

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Ingresá un importe de apertura válido');
      return;
    }

    try {
      setIsSavingOpening(true);
      await createCashMovement({
        type: 'opening',
        concept: trimmedConcept,
        amount: Math.abs(parsedAmount),
        paymentMethod: 'efectivo',
        headquarterId: selectedHeadquarterId,
      });

      await loadMovements();
      toast.success('Apertura de caja registrada');
      setOpeningAmount('');
      setOpeningConcept('Apertura de caja');
      setIsOpeningDialogOpen(false);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo registrar la apertura de caja');
      }
    } finally {
      setIsSavingOpening(false);
    }
  };

  const handleOpenOpeningDialog = () => {
    if (lastClosingAmount !== null) {
      setOpeningAmount((currentValue) => currentValue.trim() !== '' ? currentValue : String(lastClosingAmount));
    }

    setIsOpeningDialogOpen(true);
  };

  const handleCloseCashRegister = async () => {
    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para cerrar la caja');
      return;
    }

    const closingAmount = Math.max(expectedCash, 0);

    try {
      await closeDailyCashMovements(new Date().toISOString(), selectedHeadquarterId, closingAmount);
      await loadMovements();
      setLastClosingAmount(closingAmount);
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
      <div className="space-y-5 p-4 pb-24 md:space-y-6 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-semibold text-white">Caja</h1>
            <p className="mt-1 text-sm leading-5 text-gray-400">
              {selectedHeadquarterName ? `Sede: ${selectedHeadquarterName}. ` : ''}
              {movementFilterMode === 'current-shift'
                ? 'Mostrando movimientos desde el último cierre'
                : `Mostrando movimientos del ${new Date(`${selectedMovementDate}T00:00:00`).toLocaleDateString('es-AR')}`}
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:grid-cols-[auto_auto_auto_auto] lg:items-center">
            <Badge
              variant="secondary"
              className={`justify-center px-3 py-2 text-center ${hasOpeningInCurrentShift ? 'bg-label-success text-white' : 'bg-label-danger text-white'}`}
            >
              {hasOpeningInCurrentShift ? 'Caja abierta' : 'Caja cerrada'}
            </Badge>
            <Button
              size="sm"
              variant="secondary"
              className="w-full lg:w-auto"
              onClick={handleOpenOpeningDialog}
              disabled={!selectedHeadquarterId || isLoadingHeadquarters}
            >
              Apertura de caja
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="w-full lg:w-auto"
              onClick={() => setIsManualDialogOpen(true)}
              disabled={!selectedHeadquarterId || isLoadingHeadquarters || !hasOpeningInCurrentShift}
            >
              Registrar movimiento
            </Button>
            <Button
              size="sm"
              className="w-full lg:w-auto"
              onClick={() => void handleCloseCashRegister()}
              disabled={!selectedHeadquarterId || isLoadingHeadquarters || !hasOpeningInCurrentShift}
            >
              Cierre de caja
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(220px,280px)_minmax(220px,260px)_190px_auto] xl:items-center">
          <Select
            value={selectedHeadquarterId}
            onValueChange={(value) => {
              setSelectedHeadquarterId(value);
              void loadMovements({
                mode: movementFilterMode,
                date: selectedMovementDate,
                headquarterId: value,
              });
              void loadLastClosingAmount(value);
            }}
            disabled={isLoadingHeadquarters || headquarters.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Seleccionar sede'} />
            </SelectTrigger>
            <SelectContent>
              {headquarters.map((headquarter) => (
                <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                  {headquarter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            <SelectTrigger className="w-full">
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
              className="w-full"
            />
          )}

          <Button
            size="sm"
            variant="secondary"
            className="w-full xl:w-auto"
            onClick={() => void loadMovements()}
            disabled={isLoadingMovements || !selectedHeadquarterId || (movementFilterMode === 'date' && !selectedMovementDate)}
          >
            {isLoadingMovements ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border card bg-blue-500/10 border-blue-500/70 p-4 sm:p-3">
            <p className="text-xs text-gray-400">Ventas</p>
            <p className="mt-1 break-words text-lg font-semibold text-white">{currencyFormatter.format(totalSales)}</p>
          </div>
          <div className="rounded-lg border card bg-green-500/10 border-green-500/70 p-4 sm:p-3">
            <p className="text-xs text-gray-400">Ingresos</p>
            <p className="mt-1 break-words text-lg font-semibold text-white">{currencyFormatter.format(totalIncomes)}</p>
          </div>
          <div className="rounded-lg border card bg-red-500/10 border-red-500/70 p-4 sm:p-3">
            <p className="text-xs text-gray-400">Egresos</p>
            <p className="mt-1 break-words text-lg font-semibold text-white">{currencyFormatter.format(totalExpenses)}</p>
          </div>
          <div className="rounded-lg border border-yellow-500/70 card bg-yellow-500/10 p-4 sm:p-3">
            <p className="text-xs text-gray-300">Efectivo esperado</p>
            <p className="mt-1 break-words text-lg font-semibold text-white">{currencyFormatter.format(expectedCash)}</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border card bg-card">
          <div className="flex flex-col gap-2 border-b border-[--border] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-white">
              {movementFilterMode === 'current-shift' ? 'Movimientos del turno' : 'Movimientos por fecha'}
            </h2>
            <Badge variant="secondary" className="w-fit bg-label-secondary text-white text-xs">
              {movements.length} movimientos
            </Badge>
          </div>

          <div className="divide-y divide-gray-700">
            {movements.map((movement) => (
              <div key={movement.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-400">{movement.time}</span>
                    <Badge variant="secondary" className={getTypeBadgeClass(movement.type)}>
                      {getTypeLabel(movement.type)}
                    </Badge>
                  </div>
                  <p className="break-words text-sm text-white sm:truncate">{movement.concept}</p>
                  <p className="text-xs text-gray-400">{getPaymentMethodLabel(movement.paymentMethod)}</p>
                </div>

                <span className={`shrink-0 self-end text-sm font-medium sm:self-auto ${movement.amount >= 0 ? 'text-white' : 'text-red-400'}`}>
                  {movement.amount >= 0 ? '+' : '-'}{currencyFormatter.format(Math.abs(movement.amount))}
                </span>
              </div>
            ))}
            {movements.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-gray-400">
                No hay movimientos para mostrar.
              </div>
            ) : null}
          </div>
        </div>

        <Dialog open={isManualDialogOpen} onOpenChange={setIsManualDialogOpen}>
          <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
            <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
              <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
                <CircleDollarSign size={18} />
              </div>
              <DialogTitle>Registrar ingreso/egreso</DialogTitle>
              <DialogDescription>Carga un movimiento manual en la caja activa.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 px-5 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select value={manualType} onValueChange={(value) => setManualType(value as 'ingreso' | 'egreso')}>
                  <SelectTrigger className={FORM_CONTROL_CLASS}>
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent className={SELECT_CONTENT_CLASS}>
                    <SelectItem value="ingreso">Ingreso</SelectItem>
                    <SelectItem value="egreso">Egreso</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={manualPaymentMethod} onValueChange={(value) => setManualPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger className={FORM_CONTROL_CLASS}>
                    <SelectValue placeholder="Método de pago" />
                  </SelectTrigger>
                  <SelectContent className={SELECT_CONTENT_CLASS}>
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
                  className={FORM_CONTROL_CLASS}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Importe"
                  value={manualAmount}
                  onChange={(event) => setManualAmount(event.target.value)}
                  className={FORM_CONTROL_CLASS}
                />
              </div>
            </div>
            <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsManualDialogOpen(false)}
                disabled={isSavingManualMovement}
                className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
              >
                Cancelar
              </Button>
              <Button className="gap-2" onClick={handleAddManualMovement} disabled={isSavingManualMovement}>
                {isSavingManualMovement ? 'Guardando...' : 'Guardar movimiento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isOpeningDialogOpen} onOpenChange={setIsOpeningDialogOpen}>
          <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
            <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
              <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
                <WalletCards size={18} />
              </div>
              <DialogTitle>Registrar apertura de caja</DialogTitle>
              <DialogDescription>Define el concepto y monto inicial para abrir caja.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 px-5 py-4">
              <Input
                placeholder="Concepto"
                value={openingConcept}
                onChange={(event) => setOpeningConcept(event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Monto inicial"
                value={openingAmount}
                onChange={(event) => setOpeningAmount(event.target.value)}
                className={FORM_CONTROL_CLASS}
              />
              {lastClosingAmount !== null && (
                <p className="text-xs text-gray-400">
                  Sugerido segun ultimo cierre: {currencyFormatter.format(lastClosingAmount)}
                  {isLoadingLastClosingAmount ? ' (actualizando...)' : ''}
                </p>
              )}
            </div>
            <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpeningDialogOpen(false)}
                disabled={isSavingOpening}
                className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
              >
                Cancelar
              </Button>
              <Button className="gap-2" onClick={() => void handleOpenCashRegister()} disabled={isSavingOpening}>
                {isSavingOpening ? 'Guardando...' : 'Confirmar apertura'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
