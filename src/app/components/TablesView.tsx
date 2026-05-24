import { useEffect, useRef, useState } from 'react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shared/ui/components/select';
import { toast } from 'sonner';
import {
  Armchair,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Grid2X2,
  List,
  MapPin,
  Users,
  UserRoundPlus,
} from 'lucide-react';
import { ApiError } from '../core/http/errors';
import {
  createTable,
  deleteTable as deleteBackendTable,
  fetchTables,
  updateTable as updateBackendTable,
  updateTableStatus as updateBackendTableStatus,
  type TableItem as ApiTableItem,
} from '../features/tables';
import {
  fetchProducts,
  type ProductItem,
} from '../features/products';
import {
  createCashMovement,
  type PaymentMethod,
} from '../features/cash-register';
import { listHeadquarters, type Headquarter } from '../features/headquarters';
import { getLoggedUser } from '../core/storage/authStorage';
import { getStorageItem, removeStorageItem, setStorageItem } from '../shared/storage';

interface TableItem {
  id: string;
  number: number;
  area: 'Salón principal' | 'Patio' | 'Barra';
  waiter: string;
  guests: number;
  status: 'libre' | 'ocupada' | 'por-cerrar' | 'reservada';
  openedAt?: string;
  totalAmount?: number;
  capacity?: number;
  description?: string;
  backendStatusId?: number;
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
  libre: 'border-orange-500/80 bg-gradient-to-b from-orange-500/10 to-transparent',
  ocupada: 'border-emerald-500/80 bg-gradient-to-b from-emerald-500/10 to-transparent',
  'por-cerrar': 'border-amber-400/90 bg-gradient-to-b from-amber-500/10 to-transparent',
  reservada: 'border-blue-500/80 bg-gradient-to-b from-blue-500/10 to-transparent',
};

const statusBadgeClasses: Record<TableItem['status'], string> = {
  libre: 'border border-orange-400/50 bg-orange-500/20 text-xs text-orange-700 dark:text-orange-200',
  ocupada: 'border border-emerald-400/50 bg-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-200',
  'por-cerrar': 'border border-amber-400/50 bg-amber-500/20 text-xs text-amber-700 dark:text-amber-200',
  reservada: 'border border-blue-400/50 bg-blue-500/20 text-xs text-blue-700 dark:text-blue-200',
};

const statusActionButtonClasses: Record<TableItem['status'], string> = {
  libre: 'border-orange-500/60 text-orange-700 dark:text-orange-200',
  ocupada: 'border-emerald-500/60 text-emerald-700 dark:text-emerald-200',
  'por-cerrar': 'border-amber-400/70 text-amber-700 dark:text-amber-200',
  reservada: 'border-blue-500/60 text-blue-700 dark:text-blue-200',
};

const areaOptions: TableItem['area'][] = ['Salón principal', 'Patio', 'Barra'];
const statusFilterOptions: Array<{ key: 'todas' | TableItem['status']; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'libre', label: 'Libres' },
  { key: 'ocupada', label: 'Ocupadas' },
  { key: 'por-cerrar', label: 'Por cerrar' },
  { key: 'reservada', label: 'Reservadas' },
];

const statusActionConfig: Record<TableItem['status'], { label: string; icon: ({ className }: { className?: string }) => JSX.Element }> = {
  libre: { label: 'Asignar mozo', icon: UserRoundPlus },
  ocupada: { label: 'Ver detalle', icon: Eye },
  'por-cerrar': { label: 'Cerrar mesa', icon: CheckCircle2 },
  reservada: { label: 'Ver reserva', icon: CalendarClock },
};
const ACTIVE_TABLE_STATUS_ID = 1;
const INACTIVE_TABLE_STATUS_ID = 2;
const TABLES_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';

const getStoredHeadquarterId = () => getStorageItem(TABLES_HEADQUARTER_STORAGE_KEY);

const getLoggedUserHeadquarterId = () => {
  const parsedHeadquarterId = Number(getLoggedUser()?.headquarterId);
  if (Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0) {
    return String(parsedHeadquarterId);
  }

  return '';
};

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

const getAreaFromLocation = (location: string | undefined): TableItem['area'] => {
  if (!location) {
    return 'Salón principal';
  }

  if (location.toLowerCase().includes('patio')) {
    return 'Patio';
  }

  if (location.toLowerCase().includes('barra')) {
    return 'Barra';
  }

  return 'Salón principal';
};

const getAreaFromTable = (table: ApiTableItem): TableItem['area'] => {
  const metadataArea = typeof table.metadata?.area === 'string' ? table.metadata.area : undefined;

  if (metadataArea && areaOptions.includes(metadataArea as TableItem['area'])) {
    return metadataArea as TableItem['area'];
  }

  if (table.location) {
    return getAreaFromLocation(table.location);
  }

  return getAreaFromDescription(table.description);
};

const getWaiterFromTable = (table: ApiTableItem) => {
  const metadataWaiter = typeof table.metadata?.waiter === 'string' ? table.metadata.waiter.trim() : '';
  if (metadataWaiter) {
    return metadataWaiter;
  }

  return getWaiterFromDescription(table.description);
};

const getUiStatusFromBackend = (table: ApiTableItem): TableItem['status'] => {
  if (table.active === false) {
    return 'reservada';
  }

  if (Number(table.statusId) === INACTIVE_TABLE_STATUS_ID) {
    return 'reservada';
  }

  return 'libre';
};

const mapBackendTableToUi = (table: ApiTableItem, index: number): TableItem => {
  const parsedNumber = Number(table.tableNumber ?? table.table_number ?? table.name.match(/\d+/)?.[0]);
  return {
    id: table.id,
    number: Number.isFinite(parsedNumber) ? parsedNumber : index + 1,
    area: getAreaFromTable(table),
    waiter: getWaiterFromTable(table),
    guests: 0,
    status: getUiStatusFromBackend(table),
    capacity: table.capacity,
    description: table.description,
    backendStatusId: table.statusId,
  };
};

export function TablesView() {
  const [tables, setTables] = useState<TableItem[]>([]);
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState(() => getLoggedUserHeadquarterId() || getStoredHeadquarterId());
  const [detailTable, setDetailTable] = useState<TableItem | null>(null);
  const [actionTable, setActionTable] = useState<TableItem | null>(null);
  const [isCreateTableDialogOpen, setIsCreateTableDialogOpen] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [newTableArea, setNewTableArea] = useState<TableItem['area']>('Salón principal');
  const [newTableWaiter, setNewTableWaiter] = useState('');
  const [newTableCapacity, setNewTableCapacity] = useState('');
  const [isMoveTableDialogOpen, setIsMoveTableDialogOpen] = useState(false);
  const [nextAreaForMove, setNextAreaForMove] = useState<TableItem['area']>('Salón principal');
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [editTableNumber, setEditTableNumber] = useState('');
  const [editTableArea, setEditTableArea] = useState<TableItem['area']>('Salón principal');
  const [editTableWaiter, setEditTableWaiter] = useState('');
  const [editTableCapacity, setEditTableCapacity] = useState('');
  const [editTableDescription, setEditTableDescription] = useState('');
  const [tableToDelete, setTableToDelete] = useState<TableItem | null>(null);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [activeStatusFilter, setActiveStatusFilter] = useState<'todas' | TableItem['status']>('todas');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [collapsedAreas, setCollapsedAreas] = useState<Record<TableItem['area'], boolean>>({
    'Salón principal': false,
    Patio: false,
    Barra: false,
  });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClick = useRef(false);

  const loadTables = async (headquarterId?: string) => {
    const resolvedHeadquarterId = headquarterId ?? selectedHeadquarterId;
    if (!resolvedHeadquarterId) {
      setTables([]);
      return;
    }

    const backendTables = await fetchTables(resolvedHeadquarterId);
    setTables(backendTables.map(mapBackendTableToUi));
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsLoadingHeadquarters(true);
        const headquarterResult = await listHeadquarters({ page: 1, pageSize: 100 });
        const headquarterRows = headquarterResult.rows ?? [];
        setHeadquarters(headquarterRows);

        if (headquarterRows.length === 0) {
          setSelectedHeadquarterId('');
          setTables([]);
          toast.error('No hay sedes configuradas para operar mesas');
          return;
        }

        const loggedUserHeadquarterId = getLoggedUserHeadquarterId();
        const storedHeadquarterId = getStoredHeadquarterId();
        const loggedUserIsValid = loggedUserHeadquarterId && headquarterRows.some((item) => String(item.id) === loggedUserHeadquarterId);
        const currentIsValid = selectedHeadquarterId && headquarterRows.some((item) => String(item.id) === selectedHeadquarterId);
        const storedIsValid = storedHeadquarterId && headquarterRows.some((item) => String(item.id) === storedHeadquarterId);

        const initialHeadquarterId = loggedUserIsValid
          ? loggedUserHeadquarterId
          : currentIsValid
            ? selectedHeadquarterId
          : storedIsValid
            ? storedHeadquarterId
            : String(headquarterRows[0].id);

        setSelectedHeadquarterId(initialHeadquarterId);

        const [_, products] = await Promise.all([
          loadTables(initialHeadquarterId),
          fetchProducts(),
        ]);

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
      } finally {
        setIsLoadingHeadquarters(false);
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedHeadquarterId) {
      setStorageItem(TABLES_HEADQUARTER_STORAGE_KEY, selectedHeadquarterId);
    } else {
      removeStorageItem(TABLES_HEADQUARTER_STORAGE_KEY);
    }
  }, [selectedHeadquarterId]);

  useEffect(() => {
    if (!selectedProductId && availableProducts.length > 0) {
      setSelectedProductId(availableProducts[0].id);
    }
  }, [availableProducts, selectedProductId]);

  const freeCount = tables.filter((table) => table.status === 'libre').length;
  const occupiedCount = tables.filter((table) => table.status === 'ocupada').length;
  const closingCount = tables.filter((table) => table.status === 'por-cerrar').length;
  const reservedCount = tables.filter((table) => table.status === 'reservada').length;
  const selectedHeadquarterName = headquarters.find((item) => String(item.id) === selectedHeadquarterId)?.name;
  const filteredTables = activeStatusFilter === 'todas'
    ? tables
    : tables.filter((table) => table.status === activeStatusFilter);
  const areaLabelsInUse = areaOptions.filter((area) => filteredTables.some((table) => table.area === area));
  const tablesByArea = areaLabelsInUse.map((area) => ({
    area,
    tables: filteredTables
      .filter((table) => table.area === area)
      .sort((left, right) => left.number - right.number),
  }));
  const activeFilterCount = activeStatusFilter === 'todas'
    ? tables.length
    : tables.filter((table) => table.status === activeStatusFilter).length;
  const updatedAtLabel = new Date().toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

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

    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para cobrar la mesa');
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
        headquarterId: selectedHeadquarterId,
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

  const handleOpenEditTable = () => {
    if (!actionTable) {
      return;
    }

    setEditTableNumber(String(actionTable.number));
    setEditTableArea(actionTable.area);
    setEditTableWaiter(actionTable.waiter === 'Sin asignar' ? '' : actionTable.waiter);
    setEditTableCapacity(actionTable.capacity ? String(actionTable.capacity) : '');
    setEditTableDescription(actionTable.description ?? '');
    setEditingTable(actionTable);
  };

  const handleConfirmMoveTable = async () => {
    if (!actionTable) {
      return;
    }

    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para mover la mesa');
      return;
    }

    try {
      await updateBackendTable(actionTable.id, {
        location: nextAreaForMove,
        headquarterId: selectedHeadquarterId,
        metadata: {
          waiter: actionTable.waiter === 'Sin asignar' ? undefined : actionTable.waiter,
          area: nextAreaForMove,
        },
      });

      await loadTables();
      setIsMoveTableDialogOpen(false);
      toast.success(`Mesa ${actionTable.number} movida a ${nextAreaForMove}`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo actualizar la mesa');
      }
    }
  };

  const handleCreateTable = async () => {
    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para crear la mesa');
      return;
    }

    const waiter = newTableWaiter.trim();
    const capacity = Number(newTableCapacity.trim());
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
        table_number: nextTableNumber,
        capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
        location: newTableArea,
        headquarterId: selectedHeadquarterId,
        metadata: {
          waiter: waiter || undefined,
          area: newTableArea,
        },
      });

      await loadTables();
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
    setNewTableCapacity('');
    setNewTableArea('Salón principal');
    toast.success(`Mesa ${nextTableNumber} creada`);
  };

  const handleSaveTableChanges = async () => {
    if (!editingTable) {
      return;
    }

    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para editar la mesa');
      return;
    }

    const nextTableNumber = Number(editTableNumber.trim());
    const nextCapacity = Number(editTableCapacity.trim());
    const waiter = editTableWaiter.trim();
    const description = editTableDescription.trim();

    if (!Number.isInteger(nextTableNumber) || nextTableNumber <= 0) {
      toast.error('Ingresá un número de mesa válido');
      return;
    }

    if (tables.some((table) => table.id !== editingTable.id && table.number === nextTableNumber)) {
      toast.error(`La mesa ${nextTableNumber} ya existe`);
      return;
    }

    try {
      await updateBackendTable(editingTable.id, {
        name: `Mesa ${nextTableNumber}`,
        table_number: nextTableNumber,
        capacity: Number.isFinite(nextCapacity) && nextCapacity > 0 ? nextCapacity : undefined,
        location: editTableArea,
        description: description || undefined,
        headquarterId: selectedHeadquarterId,
        metadata: {
          waiter: waiter || undefined,
          area: editTableArea,
        },
      });

      await loadTables();
      setEditingTable(null);
      toast.success(`Mesa ${nextTableNumber} actualizada`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo actualizar la mesa');
      }
    }
  };

  const handleToggleTableAvailability = async () => {
    if (!actionTable) {
      return;
    }

    const nextStatusId = actionTable.status === 'reservada' ? ACTIVE_TABLE_STATUS_ID : INACTIVE_TABLE_STATUS_ID;
    const nextStatusLabel = nextStatusId === ACTIVE_TABLE_STATUS_ID ? 'libre' : 'reservada';

    try {
      await updateBackendTableStatus(actionTable.id, nextStatusId);
      await loadTables();
      setActionTable(null);
      setDetailTable(null);
      toast.success(`Mesa ${actionTable.number} marcada como ${nextStatusLabel}`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo actualizar el estado de la mesa');
      }
    }
  };

  const handleDeleteTable = async () => {
    if (!tableToDelete) {
      return;
    }

    try {
      await deleteBackendTable(tableToDelete.id);
      await loadTables();
      setActionTable(null);
      setDetailTable(null);
      setTableToDelete(null);
      toast.success(`Mesa ${tableToDelete.number} eliminada`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo eliminar la mesa');
      }
    }
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

  const getStatusCount = (status: 'todas' | TableItem['status']) => {
    if (status === 'todas') {
      return tables.length;
    }

    return tables.filter((table) => table.status === status).length;
  };

  const handleTableActionClick = (table: TableItem) => {
    if (table.status === 'ocupada') {
      setDetailTable(table);
      return;
    }

    if (table.status === 'por-cerrar') {
      updateTable(table.id, (currentTable) => ({
        ...currentTable,
        status: 'libre',
        guests: 0,
        openedAt: undefined,
        totalAmount: undefined,
      }));
      toast.success(`Mesa ${table.number} cerrada`);
      return;
    }

    setActionTable(table);
  };

  const toggleAreaCollapse = (area: TableItem['area']) => {
    setCollapsedAreas((prev) => ({
      ...prev,
      [area]: !prev[area],
    }));
  };

  return (
    <div className="h-full overflow-y-auto bg-body">
      <div className="relative p-4 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-32 left-1/4 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-semibold text-white md:text-3xl">
                <Armchair className="h-8 w-8 text-orange-400 md:h-10 md:w-10" />
                Mesas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-1xl">Gestioná el estado de tus mesas en tiempo real</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-10 rounded-xl border border-border bg-card/70 px-4 text-sm text-foreground">
                Total: {tables.length}
              </Badge>
              <Button
                size="sm"
                className="h-10 rounded-xl bg-primary px-4 text-white"
                onClick={() => setIsCreateTableDialogOpen(true)}
                disabled={!selectedHeadquarterId || isLoadingHeadquarters}
              >
                + Nueva mesa
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4 text-orange-300" />
              <span className="text-sm text-muted-foreground">Sede:</span>
              <Select
                value={selectedHeadquarterId}
                onValueChange={(value) => {
                  setSelectedHeadquarterId(value);
                  void loadTables(value);
                }}
                disabled={isLoadingHeadquarters || headquarters.length === 0}
              >
                <SelectTrigger className="h-10 min-w-[260px] rounded-xl border-orange-500/50 bg-background text-foreground">
                  <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Seleccionar sede'} />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover text-popover-foreground">
                  {headquarters.map((headquarter) => (
                    <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                      {headquarter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <div className="rounded-xl border border-orange-500/60 bg-orange-500/10 p-3">
              <p className="text-sm text-orange-700 dark:text-orange-200">Libres</p>
              <p className="text-3xl font-semibold text-orange-800 dark:text-orange-100">{freeCount}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 p-3">
              <p className="text-sm text-emerald-700 dark:text-emerald-200">Ocupadas</p>
              <p className="text-3xl font-semibold text-emerald-800 dark:text-emerald-100">{occupiedCount}</p>
            </div>
            <div className="rounded-xl border border-amber-400/70 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-700 dark:text-amber-200">Por cerrar</p>
              <p className="text-3xl font-semibold text-amber-800 dark:text-amber-100">{closingCount}</p>
            </div>
            <div className="rounded-xl border border-blue-500/60 bg-blue-500/10 p-3">
              <p className="text-sm text-blue-700 dark:text-blue-200">Reservadas</p>
              <p className="text-3xl font-semibold text-blue-800 dark:text-blue-100">{reservedCount}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div className="flex flex-wrap items-center gap-4">
              {statusFilterOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`border-b-2 pb-2 text-sm transition-colors ${
                    activeStatusFilter === option.key
                      ? 'border-orange-400 text-orange-700 dark:text-orange-300'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveStatusFilter(option.key)}
                >
                  {option.label} ({getStatusCount(option.key)})
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-xl border border-border bg-card/70 p-1">
              <button
                type="button"
                className={`rounded-lg p-2 ${viewMode === 'grid' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setViewMode('grid')}
                title="Vista grilla"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                className={`rounded-lg p-2 ${viewMode === 'list' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setViewMode('list')}
                title="Vista lista"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {tablesByArea.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
              No hay mesas para el filtro seleccionado.
            </div>
          ) : (
            tablesByArea.map(({ area, tables: areaTables }) => (
              <section key={area} className="space-y-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-card/60 px-3 py-2 text-left"
                  onClick={() => toggleAreaCollapse(area)}
                >
                  <span className="flex items-center gap-2 text-xl font-medium text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {area}
                  </span>
                  {collapsedAreas[area] ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                {!collapsedAreas[area] ? (
                  <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4' : 'space-y-3'}>
                    {areaTables.map((table) => {
                      const action = statusActionConfig[table.status];
                      const ActionIcon = action.icon;
                      return (
                        <article
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
                          className={`rounded-2xl border bg-card/60 p-4 backdrop-blur-sm transition hover:bg-card ${
                            statusCardClasses[table.status]
                          } ${dragOverTableId === table.id ? 'ring-2 ring-blue-400' : ''} ${draggedTableId === table.id ? 'opacity-60' : ''}`}
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <h2 className="text-3xl font-semibold text-foreground md:text-4xl">Mesa {table.number}</h2>
                            <Badge variant="secondary" className={statusBadgeClasses[table.status]}>
                              {statusLabels[table.status]}
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Sector</span>
                              <span className="text-foreground">{table.area}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Mozo</span>
                              <span className="text-foreground">{table.waiter}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Comensales</span>
                              <span className="text-foreground">{table.guests}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">Hora apertura</span>
                              <span className="text-foreground">{table.openedAt ?? '--:--'}</span>
                            </div>
                          </div>

                          <div className="mt-3 border-t border-border pt-3">
                            <div className="mb-3 flex items-center justify-between">
                              <span className="text-sm text-muted-foreground">Total</span>
                              <span className="text-2xl font-medium text-foreground">{formatCurrency(getTableTotalAmount(table))}</span>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className={`h-10 w-full rounded-xl border bg-transparent text-foreground hover:bg-muted ${statusActionButtonClasses[table.status]}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleTableActionClick(table);
                              }}
                            >
                              <ActionIcon className="h-4 w-4" />
                              {action.label}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            ))
          )}

          <div className="flex flex-wrap items-center justify-between border-t border-border pt-3 text-sm text-muted-foreground">
            <span>Mostrando: {activeFilterCount} mesas</span>
            <span>Última actualización: {updatedAtLabel}</span>
          </div>
        </div>
      </div>

      <Dialog open={!!detailTable} onOpenChange={() => setDetailTable(null)}>
        <DialogContent className="bg-card card text-foreground">
          <DialogHeader>
            <DialogTitle>Detalle de Mesa {detailTable?.number}</DialogTitle>
          </DialogHeader>
          {detailTable && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant="secondary" className={statusBadgeClasses[detailTable.status]}>
                  {statusLabels[detailTable.status]}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sector</span>
                <span>{detailTable.area}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mozo</span>
                <span>{detailTable.waiter}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Comensales</span>
                <span>{detailTable.guests}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Capacidad</span>
                <span>{detailTable.capacity ?? '-'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hora apertura</span>
                <span>{detailTable.openedAt ?? '--:--'}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Total</span>
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
        <DialogContent className="bg-card card text-foreground">
          <DialogHeader>
            <DialogTitle>Acciones Mesa {actionTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button className="w-full" onClick={handleOpenBill}>
              Abrir cuenta
            </Button>
            <div className="space-y-2 border-t border-border pt-2">
              <p className="text-sm text-muted-foreground">Sumar producto a la mesa</p>
              {availableProducts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay productos cargados</p>
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
            <div className="space-y-2 border-t border-border pt-2">
              <p className="text-sm text-muted-foreground">Cobrar mesa</p>
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
            <Button variant="secondary" className="w-full" onClick={handleOpenEditTable}>
              Editar mesa
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleMoveTable}>
              Mover mesa
            </Button>
            <Button variant="secondary" className="w-full" onClick={handleToggleTableAvailability}>
              {actionTable?.status === 'reservada' ? 'Marcar como libre' : 'Marcar como reservada'}
            </Button>
            <Button variant="destructive" className="w-full" onClick={handleCloseTable}>
              Cerrar mesa
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => actionTable && setTableToDelete(actionTable)}
            >
              Eliminar mesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTableDialogOpen} onOpenChange={setIsCreateTableDialogOpen}>
        <DialogContent className="bg-card card text-foreground">
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
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Capacidad (opcional)"
              value={newTableCapacity}
              onChange={(event) => setNewTableCapacity(event.target.value)}
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

      <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Editar Mesa {editingTable?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Número de mesa"
              value={editTableNumber}
              onChange={(event) => setEditTableNumber(event.target.value)}
            />
            <Input
              placeholder="Mozo"
              value={editTableWaiter}
              onChange={(event) => setEditTableWaiter(event.target.value)}
            />
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Capacidad"
              value={editTableCapacity}
              onChange={(event) => setEditTableCapacity(event.target.value)}
            />
            <Select value={editTableArea} onValueChange={(value) => setEditTableArea(value as TableItem['area'])}>
              <SelectTrigger>
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Descripción (opcional)"
              value={editTableDescription}
              onChange={(event) => setEditTableDescription(event.target.value)}
            />
            <Button className="w-full" onClick={handleSaveTableChanges}>
              Guardar cambios
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tableToDelete} onOpenChange={(open) => !open && setTableToDelete(null)}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Eliminar Mesa {tableToDelete?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Esta acción eliminará la mesa de forma permanente.</p>
            <Button variant="destructive" className="w-full" onClick={handleDeleteTable}>
              Confirmar eliminación
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveTableDialogOpen} onOpenChange={setIsMoveTableDialogOpen}>
        <DialogContent className="border-border bg-card text-foreground">
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
