import { useEffect, useRef, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  ApiError,
  createCashMovement,
  createTable,
  fetchProducts,
  fetchTables,
  type PaymentMethod,
  type ProductItem,
  type TableItem as ApiTableItem,
} from '../api';

interface TableItem {
  id: string;
  number: number;
  area: 'Salón principal' | 'Patio' | 'Barra';
  waiter: string;
  guests: number;
  status: 'libre' | 'ocupada' | 'por-cerrar' | 'reservada';
  openedAt?: string;
  totalAmount?: number;
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const statusLabels: Record<TableItem['status'], string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  'por-cerrar': 'Por cerrar',
  reservada: 'Reservada',
};

const statusCardClasses: Record<TableItem['status'], string> = {
  libre: 'border-gray-700 bg-card',
  ocupada: 'border-green-500/70 bg-green-500/10',
  'por-cerrar': 'border-yellow-500/70 bg-yellow-500/10',
  reservada: 'border-blue-500/70 bg-blue-500/10',
};

const statusBadgeClasses: Record<TableItem['status'], string> = {
  libre: 'bg-gray-600 text-white text-xs',
  ocupada: 'bg-green-500 text-white text-xs',
  'por-cerrar': 'bg-yellow-500 text-black text-xs',
  reservada: 'bg-blue-500 text-white text-xs',
};

const areaOptions: TableItem['area'][] = ['Salón principal', 'Patio', 'Barra'];

const getAreaFromDescription = (description: string | undefined): TableItem['area'] => {
  if (!description) {
    return 'Salón principal';
  }

  if (description.toLowerCase().includes('patio')) {
    return 'Patio';
  }

  if (description.toLowerCase().includes('barra')) {
    return 'Barra';
  }

  return 'Salón principal';
};

const getWaiterFromDescription = (description: string | undefined) => {
  if (!description) {
    return 'Sin asignar';
  }

  const waiterMatch = description.match(/mozo:\s*([^|]+)/i);
  return waiterMatch?.[1]?.trim() || 'Sin asignar';
};

const mapBackendTableToUi = (table: ApiTableItem, index: number): TableItem => {
  const parsedNumber = Number(table.name.match(/\d+/)?.[0]);
  return {
    id: table.id,
    number: Number.isFinite(parsedNumber) ? parsedNumber : index + 1,
    area: getAreaFromDescription(table.description),
    waiter: getWaiterFromDescription(table.description),
    guests: 0,
    status: table.active ? 'libre' : 'reservada',
  };
};

export function TablesView() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [detailTable, setDetailTable] = useState<TableItem | null>(null);
  const [actionTable, setActionTable] = useState<TableItem | null>(null);
  const [isCreateTableDialogOpen, setIsCreateTableDialogOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableArea, setNewTableArea] = useState<TableItem['area']>('Salón principal');
  const [newTableWaiter, setNewTableWaiter] = useState('');
  const [isMoveTableDialogOpen, setIsMoveTableDialogOpen] = useState(false);
  const [nextAreaForMove, setNextAreaForMove] = useState<TableItem['area']>('Salón principal');
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClick = useRef(false);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [backendTables, products] = await Promise.all([
          fetchTables(),
          fetchProducts(),
        ]);

        setTables(backendTables.map(mapBackendTableToUi));
        setAvailableProducts(products);
        if (products.length > 0) {
          setSelectedProductId(products[0].id);
        }
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        } else {
          toast.error('No se pudieron cargar las mesas y productos');
        }
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedProductId && availableProducts.length > 0) {
      setSelectedProductId(availableProducts[0].id);
    }
  }, [availableProducts, selectedProductId]);

  const freeCount = tables.filter((table) => table.status === 'libre').length;
  const occupiedCount = tables.filter((table) => table.status === 'ocupada').length;
  const closingCount = tables.filter((table) => table.status === 'por-cerrar').length;
  const reservedCount = tables.filter((table) => table.status === 'reservada').length;

  const getTableTotalAmount = (table: TableItem) => table.totalAmount ?? 0;

  const formatCurrency = (amount: number) => currencyFormatter.format(amount);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const updateTable = (tableId: string, updater: (table: TableItem) => TableItem) => {
    setTables((prev) => prev.map((table) => (table.id === tableId ? updater(table) : table)));

    setDetailTable((prev) => {
      if (!prev || prev.id !== tableId) {
        return prev;
      }

      return updater(prev);
    });

    setActionTable((prev) => {
      if (!prev || prev.id !== tableId) {
        return prev;
      }

      return updater(prev);
    });
  };

  const handleOpenDetail = (table: TableItem) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }

    setDetailTable(table);
  };

  const handleOpenActions = (table: TableItem) => {
    setActionTable(table);
  };

  const handleContextMenu = (event: React.MouseEvent, table: TableItem) => {
    event.preventDefault();
    handleOpenActions(table);
  };

  const handleLongPressStart = (table: TableItem) => {
    longPressTimer.current = setTimeout(() => {
      suppressNextClick.current = true;
      handleOpenActions(table);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleOpenBill = () => {
    if (!actionTable) {
      return;
    }

    updateTable(actionTable.id, (table) => ({
      ...table,
      status: 'ocupada',
      guests: table.guests > 0 ? table.guests : 1,
      openedAt: table.openedAt ?? getCurrentTime(),
      totalAmount: table.totalAmount ?? 0,
    }));
    toast.success(`Cuenta abierta en Mesa ${actionTable.number}`);
  };

  const handleAddProduct = () => {
    if (!actionTable) {
      return;
    }

    const selectedProduct = availableProducts.find((product) => product.id === selectedProductId);

    if (!selectedProduct) {
      toast.error('Seleccioná un producto válido');
      return;
    }

    if (!Number.isFinite(selectedProduct.price) || selectedProduct.price <= 0) {
      toast.error('El producto seleccionado no tiene un precio válido');
      return;
    }

    updateTable(actionTable.id, (table) => ({
      ...table,
      status: 'ocupada',
      guests: table.guests > 0 ? table.guests : 1,
      openedAt: table.openedAt ?? getCurrentTime(),
      totalAmount: getTableTotalAmount(table) + selectedProduct.price,
    }));

    toast.success(`${selectedProduct.name} sumado a Mesa ${actionTable.number}`);
  };

  const handleChargeTable = async () => {
    if (!actionTable) {
      return;
    }

    const totalAmount = getTableTotalAmount(actionTable);

    if (totalAmount <= 0) {
      toast.error('La mesa no tiene consumo para cobrar');
      return;
    }

    try {
      await createCashMovement({
        type: 'venta',
        concept: `Mesa ${actionTable.number}`,
        amount: totalAmount,
        paymentMethod,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo registrar la venta en caja');
      }
      return;
    }

    updateTable(actionTable.id, (table) => ({
      ...table,
      status: 'libre',
      guests: 0,
      openedAt: undefined,
      totalAmount: undefined,
    }));

    toast.success(`Mesa ${actionTable.number} cobrada (${paymentMethodLabels[paymentMethod]})`);
    setActionTable(null);
    setDetailTable(null);
  };

  const handleMoveTable = () => {
    if (!actionTable) {
      return;
    }

    setNextAreaForMove(actionTable.area);
    setIsMoveTableDialogOpen(true);
  };

  const handleConfirmMoveTable = () => {
    if (!actionTable) {
      return;
    }

    updateTable(actionTable.id, (table) => ({
      ...table,
      area: nextAreaForMove,
    }));

    setIsMoveTableDialogOpen(false);
    toast.success(`Mesa ${actionTable.number} movida a ${nextAreaForMove}`);
  };

  const handleCreateTable = async () => {
    const waiter = newTableWaiter.trim();
    const parsedTableNumber = Number(newTableNumber);
    const maxTableNumber = tables.reduce((maxValue, table) => Math.max(maxValue, table.number), 0);
    const nextTableNumber = newTableNumber.trim() ? parsedTableNumber : maxTableNumber + 1;

    if (!Number.isInteger(nextTableNumber) || nextTableNumber <= 0) {
      toast.error('Ingresá un número de mesa válido');
      return;
    }

    if (tables.some((table) => table.number === nextTableNumber)) {
      toast.error(`La mesa ${nextTableNumber} ya existe`);
      return;
    }

    try {
      await createTable({
        name: `Mesa ${nextTableNumber}`,
        description: `${newTableArea} | Mozo: ${waiter || 'Sin asignar'}`,
        active: true,
      });

      const backendTables = await fetchTables();
      setTables(backendTables.map(mapBackendTableToUi));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo crear la mesa');
      }
      return;
    }

    setIsCreateTableDialogOpen(false);
    setNewTableNumber('');
    setNewTableWaiter('');
    setNewTableArea('Salón principal');
    toast.success(`Mesa ${nextTableNumber} creada`);
  };

  const reorderTables = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    setTables((prev) => {
      const sourceIndex = prev.findIndex((table) => table.id === sourceId);
      const targetIndex = prev.findIndex((table) => table.id === targetId);

      if (sourceIndex === -1 || targetIndex === -1) {
        return prev;
      }

      const nextTables = [...prev];
      const [movedTable] = nextTables.splice(sourceIndex, 1);
      nextTables.splice(targetIndex, 0, movedTable);

      return nextTables;
    });
  };

  const handleDragStart = (tableId: string) => {
    setDraggedTableId(tableId);
    suppressNextClick.current = true;
  };

  const handleDragOver = (event: React.DragEvent, tableId: string) => {
    event.preventDefault();
    setDragOverTableId(tableId);
  };

  const handleDrop = (event: React.DragEvent, tableId: string) => {
    event.preventDefault();

    if (!draggedTableId) {
      return;
    }

    reorderTables(draggedTableId, tableId);
    setDraggedTableId(null);
    setDragOverTableId(null);
  };

  const handleDragEnd = () => {
    setDraggedTableId(null);
    setDragOverTableId(null);
  };

  const handleCloseTable = () => {
    if (!actionTable) {
      return;
    }

    updateTable(actionTable.id, (table) => ({
      ...table,
      status: 'libre',
      guests: 0,
      openedAt: undefined,
      totalAmount: undefined,
    }));
    toast.success(`Mesa ${actionTable.number} cerrada`);
  };

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl font-semibold text-white">Mesas</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-secondary text-white">
              Total: {tables.length}
            </Badge>
            <Button size="sm" onClick={() => setIsCreateTableDialogOpen(true)}>
              Nueva mesa
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="p-2 rounded-lg bg-card border border-gray-700 text-center">
            <p className="text-xs text-gray-400">Libres</p>
            <p className="text-sm text-white font-medium">{freeCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-card border border-green-500/60 text-center">
            <p className="text-xs text-green-300">Ocupadas</p>
            <p className="text-sm text-white font-medium">{occupiedCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-card border border-yellow-500/60 text-center">
            <p className="text-xs text-yellow-300">Por cerrar</p>
            <p className="text-sm text-white font-medium">{closingCount}</p>
          </div>
          <div className="p-2 rounded-lg bg-card border border-blue-500/60 text-center">
            <p className="text-xs text-blue-300">Reservadas</p>
            <p className="text-sm text-white font-medium">{reservedCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
          {tables.map((table) => (
            <div
              key={table.id}
              draggable
              onClick={() => handleOpenDetail(table)}
              onContextMenu={(event) => handleContextMenu(event, table)}
              onTouchStart={() => handleLongPressStart(table)}
              onTouchEnd={handleLongPressEnd}
              onMouseDown={() => handleLongPressStart(table)}
              onMouseUp={handleLongPressEnd}
              onMouseLeave={handleLongPressEnd}
              onDragStart={() => handleDragStart(table.id)}
              onDragOver={(event) => handleDragOver(event, table.id)}
              onDrop={(event) => handleDrop(event, table.id)}
              onDragEnd={handleDragEnd}
              className={`p-4 rounded-lg border cursor-pointer transition-colors hover:bg-gray-800/60 ${statusCardClasses[table.status]} ${dragOverTableId === table.id ? 'ring-2 ring-blue-400' : ''} ${draggedTableId === table.id ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-white font-semibold">Mesa {table.number}</h2>
                <Badge variant="secondary" className={statusBadgeClasses[table.status]}>
                  {statusLabels[table.status]}
                </Badge>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sector</span>
                  <span className="text-white">{table.area}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Mozo</span>
                  <span className="text-white">{table.waiter}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Comensales</span>
                  <span className="text-white">{table.guests}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Hora apertura</span>
                  <span className="text-white">{table.openedAt ?? '--:--'}</span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-gray-700 flex items-center justify-between">
                <span className="text-xs text-gray-400">Total</span>
                <span className="text-sm text-white font-medium">{formatCurrency(getTableTotalAmount(table))}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!detailTable} onOpenChange={() => setDetailTable(null)}>
        <DialogContent className="bg-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Detalle de Mesa {detailTable?.number}</DialogTitle>
          </DialogHeader>
          {detailTable && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Estado</span>
                <Badge variant="secondary" className={statusBadgeClasses[detailTable.status]}>
                  {statusLabels[detailTable.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Sector</span>
                <span>{detailTable.area}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Mozo</span>
                <span>{detailTable.waiter}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Comensales</span>
                <span>{detailTable.guests}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Hora apertura</span>
                <span>{detailTable.openedAt ?? '--:--'}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                <span className="text-gray-400">Total</span>
                <span className="font-medium">{formatCurrency(getTableTotalAmount(detailTable))}</span>
              </div>
              <Button className="w-full" onClick={() => setActionTable(detailTable)}>
                Acciones de mesa
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionTable} onOpenChange={() => setActionTable(null)}>
        <DialogContent className="bg-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Acciones Mesa {actionTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button className="w-full" onClick={handleOpenBill}>
              Abrir cuenta
            </Button>
            <div className="space-y-2 pt-2 border-t border-gray-700">
              <p className="text-sm text-gray-300">Sumar producto a la mesa</p>
              {availableProducts.length === 0 ? (
                <p className="text-xs text-gray-500">No hay productos cargados</p>
              ) : (
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar producto" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} · {formatCurrency(product.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="secondary" className="w-full" onClick={handleAddProduct}>
                Sumar producto
              </Button>
            </div>
            <div className="space-y-2 pt-2 border-t border-gray-700">
              <p className="text-sm text-gray-300">Cobrar mesa</p>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar método de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
              <Button className="w-full" onClick={handleChargeTable}>
                Cobrar ({actionTable ? formatCurrency(getTableTotalAmount(actionTable)) : formatCurrency(0)})
              </Button>
            </div>
            <Button variant="secondary" className="w-full" onClick={handleMoveTable}>
              Mover mesa
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
              Cerrar mesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTableDialogOpen} onOpenChange={setIsCreateTableDialogOpen}>
        <DialogContent className="bg-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Nueva mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Número de mesa (vacío = automático)"
              value={newTableNumber}
              onChange={(event) => setNewTableNumber(event.target.value)}
            />
            <Input
              placeholder="Mozo"
              value={newTableWaiter}
              onChange={(event) => setNewTableWaiter(event.target.value)}
            />
            <Select value={newTableArea} onValueChange={(value) => setNewTableArea(value as TableItem['area'])}>
              <SelectTrigger>
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleCreateTable}>
              Crear mesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveTableDialogOpen} onOpenChange={setIsMoveTableDialogOpen}>
        <DialogContent className="bg-card border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle>Mover Mesa {actionTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={nextAreaForMove} onValueChange={(value) => setNextAreaForMove(value as TableItem['area'])}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar sector" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleConfirmMoveTable}>
              Confirmar sector
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
