import { useEffect, useRef, useState } from 'react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  CreditCard,
  Eye,
  Grid2X2,
  List,
  MapPin,
  MoreVertical,
  PackagePlus,
  ReceiptText,
  Trash2,
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
  listProductCategories,
  type ProductCategory,
  type ProductItem,
} from '../features/products';
import {
  createCashMovement,
  type PaymentMethod,
} from '../features/cash-register';
import {
  createOrder as createBackendOrder,
  fetchActiveOrders,
  finalizeOrder,
  type CreateOrderRequest,
} from '../features/orders/services/orders.service';
import { listHeadquarters, type Headquarter } from '../features/headquarters';
import { getLoggedUser } from '../core/storage/authStorage';
import { getStorageItem, removeStorageItem, setStorageItem } from '../shared/storage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shared/ui/components/dropdown-menu';

const COMPACT_DIALOG_CONTENT_CLASS = 'w-[calc(100vw-2rem)] max-w-[620px] gap-0 overflow-visible p-0';
const WIDE_DIALOG_CONTENT_CLASS =
  'max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] gap-0 overflow-visible p-0 sm:w-[70vw] sm:!max-w-[70vw]';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';

const getProductImageUrl = (product: ProductItem) => (
  product.image ?? product.imageUrl ?? product.image_url ?? null
);

const getProductCategoryIds = (product: ProductItem) => {
  const row = product as ProductItem & {
    category_ids?: Array<string | number>;
    categoryId?: string | number;
    categoryIds?: Array<string | number>;
  };

  const ids: Array<string | number> = [];
  if (Array.isArray(row.categoryIds)) ids.push(...row.categoryIds);
  if (Array.isArray(row.category_ids)) ids.push(...row.category_ids);
  if (row.categoryId !== undefined && row.categoryId !== null && row.categoryId !== '') ids.push(row.categoryId);

  return ids.map((id) => String(id));
};

const getOrderTableId = (order: any) => {
  const value = order?.tableId ?? order?.table_id ?? order?.Table?.id;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : '';
};

const getOrderTotal = (order: any) => {
  const total = Number(order?.total_amount ?? order?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
};

const getOrderId = (order: any) => String(order?.id ?? order?.order_number ?? '').trim();

const getOrderCustomerId = (order: any) => {
  const value = order?.customerId ?? order?.customer_id ?? order?.Customer?.id;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
};

const getOrderCreatedTime = (order: any) => {
  const rawDate = order?.createdAt ?? order?.order_date ?? order?.created_at;
  const parsedDate = rawDate ? new Date(rawDate) : null;
  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const getOrderItemsSummary = (order: any) => {
  if (Array.isArray(order?.items)) {
    return order.items.map((item: any) => String(item)).filter(Boolean);
  }

  if (!Array.isArray(order?.OrderItems)) {
    return [];
  }

  return order.OrderItems.map((item: any) => {
    const name = item?.Product?.name ?? item?.product?.name ?? `Producto ${item?.productId ?? item?.product_id ?? ''}`.trim();
    const quantity = Number(item?.quantity ?? 0);
    return quantity > 1 ? `${name} x${quantity}` : String(name);
  }).filter(Boolean);
};

interface TableItem {
  id: string;
  number: number;
  area: 'Salón principal' | 'Patio' | 'Barra';
  waiter: string;
  guests: number;
  status: 'libre' | 'ocupada' | 'por-cerrar' | 'reservada';
  openedAt?: string;
  totalAmount?: number;
  customerId?: number;
  activeOrderIds?: string[];
  activeOrderCount?: number;
  activeOrderItems?: string[];
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
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [isSavingTable, setIsSavingTable] = useState(false);
  const [draggedTableId, setDraggedTableId] = useState<string | null>(null);
  const [dragOverTableId, setDragOverTableId] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);
  const [tableCategoryFilter, setTableCategoryFilter] = useState('all');
  const [tableProductFilter, setTableProductFilter] = useState('');
  const [tableProductQuantities, setTableProductQuantities] = useState<Record<string, number>>({});
  const [isAddingTableProducts, setIsAddingTableProducts] = useState(false);
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

    const [backendTables, backendOrders] = await Promise.all([
      fetchTables(resolvedHeadquarterId),
      fetchActiveOrders().catch(() => []),
    ]);

    const ordersByTableId = new Map<string, any[]>();
    backendOrders
      .filter((order: any) => {
        const type = String(order?.type ?? '').toLowerCase();
        return type === 'dine-in' || type === 'salon' || type === 'table';
      })
      .forEach((order: any) => {
        const tableId = getOrderTableId(order);
        if (!tableId) {
          return;
        }
        ordersByTableId.set(tableId, [...(ordersByTableId.get(tableId) ?? []), order]);
      });

    setTables(backendTables.map((backendTable, index) => {
      const table = mapBackendTableToUi(backendTable, index);
      const tableOrders = ordersByTableId.get(String(table.id)) ?? [];

      if (tableOrders.length === 0) {
        return table;
      }

      const activeOrderItems = tableOrders.flatMap(getOrderItemsSummary);
      const totalAmount = tableOrders.reduce((total, order) => total + getOrderTotal(order), 0);
      const customerId = tableOrders
        .map(getOrderCustomerId)
        .find((id): id is number => Number.isInteger(id));
      const openedAt = tableOrders
        .map(getOrderCreatedTime)
        .find(Boolean);

      return {
        ...table,
        status: 'ocupada',
        guests: table.guests > 0 ? table.guests : 1,
        openedAt: openedAt || table.openedAt || getCurrentTime(),
        totalAmount,
        customerId,
        activeOrderIds: tableOrders.map(getOrderId).filter(Boolean),
        activeOrderCount: tableOrders.length,
        activeOrderItems,
      };
    }));
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

        const [_, products, categoriesResult] = await Promise.all([
          loadTables(initialHeadquarterId),
          fetchProducts(),
          listProductCategories({ page: 1, pageSize: 200 }),
        ]);

        setAvailableProducts(products);
        setAvailableCategories(categoriesResult.rows ?? []);
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

  const freeCount = tables.filter((table) => table.status === 'libre').length;
  const occupiedCount = tables.filter((table) => table.status === 'ocupada').length;
  const closingCount = tables.filter((table) => table.status === 'por-cerrar').length;
  const reservedCount = tables.filter((table) => table.status === 'reservada').length;
  const selectedHeadquarterName = headquarters.find((item) => String(item.id) === selectedHeadquarterId)?.name;
  const filteredTables = activeStatusFilter === 'todas'
    ? tables
    : tables.filter((table) => table.status === activeStatusFilter);
  const normalizedTableProductFilter = tableProductFilter.trim().toLowerCase();
  const filteredActionProducts = normalizedTableProductFilter
    ? availableProducts.filter((product) => (
      product.name.toLowerCase().includes(normalizedTableProductFilter)
      || (product.description ?? '').toLowerCase().includes(normalizedTableProductFilter)
    ))
    : availableProducts;
  const categoryFilteredActionProducts = tableCategoryFilter === 'all'
    ? filteredActionProducts
    : filteredActionProducts.filter((product) => getProductCategoryIds(product).includes(tableCategoryFilter));
  const selectedActionProducts = getSelectedTableProducts();
  const selectedActionProductsTotal = selectedActionProducts.reduce(
    (total, item) => total + (item.product.price * item.quantity),
    0,
  );
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

  const resetTableConsumption = (table: TableItem): TableItem => ({
    ...table,
    status: 'libre',
    guests: 0,
    openedAt: undefined,
    totalAmount: undefined,
    customerId: undefined,
    activeOrderIds: [],
    activeOrderCount: 0,
    activeOrderItems: [],
  });

  const finalizeActiveTableOrders = async (table: TableItem) => {
    const orderIds = Array.from(new Set(table.activeOrderIds ?? []));
    if (orderIds.length === 0) {
      return;
    }

    const results = await Promise.allSettled(orderIds.map((orderId) => finalizeOrder(orderId)));
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected) {
      throw rejected.reason;
    }
  };

  const handleOpenDetail = (table: TableItem) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }

    setDetailTable(table);
  };

  const handleOpenActions = (table: TableItem) => {
    setTableProductFilter('');
    setTableCategoryFilter('all');
    setTableProductQuantities({});
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

  const incrementTableProduct = (productId: string) => {
    setTableProductQuantities((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + 1,
    }));
  };

  const decrementTableProduct = (productId: string) => {
    setTableProductQuantities((current) => {
      const nextQuantity = Math.max(0, (current[productId] ?? 0) - 1);
      const next = { ...current };

      if (nextQuantity <= 0) {
        delete next[productId];
      } else {
        next[productId] = nextQuantity;
      }

      return next;
    });
  };

  function getSelectedTableProducts() {
    return availableProducts
      .map((product) => ({
        product,
        quantity: tableProductQuantities[product.id] ?? 0,
      }))
      .filter((item) => item.quantity > 0);
  }

  const handleAddProduct = async () => {
    if (isAddingTableProducts) {
      return;
    }

    if (!actionTable) {
      return;
    }

    const selectedItems = getSelectedTableProducts();

    if (selectedItems.length === 0) {
      toast.error('Seleccioná al menos un producto');
      return;
    }

    if (!selectedHeadquarterId) {
      toast.error('Seleccioná una sede para crear el pedido');
      return;
    }

    const loggedUser = getLoggedUser();
    const userId = Number(loggedUser?.id);
    const headquarterId = Number(selectedHeadquarterId);
    const storeId = Number(loggedUser?.storeId);
    const tableId = Number(actionTable.id);
    const fallbackTableId = Number(actionTable.number);
    const resolvedTableId = Number.isInteger(tableId) && tableId > 0 ? tableId : fallbackTableId;

    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error('Usuario inválido para crear el pedido');
      return;
    }

    if (!Number.isInteger(headquarterId) || headquarterId <= 0) {
      toast.error('Sede inválida para crear el pedido');
      return;
    }

    const totalToAdd = selectedItems.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    const payload: CreateOrderRequest = {
      storeId: Number.isInteger(storeId) && storeId > 0 ? storeId : undefined,
      headquarterId,
      userId,
      customerId: actionTable.customerId,
      customerName: actionTable.customerId ? undefined : `Mesa ${actionTable.number}`,
      customerPhone: actionTable.customerId ? undefined : String(actionTable.number).padStart(10, '0'),
      type: 'dine-in',
      items: selectedItems.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      tableId: Number.isInteger(resolvedTableId) && resolvedTableId > 0 ? resolvedTableId : undefined,
      is_asap: true,
    };

    try {
      setIsAddingTableProducts(true);
      const createdOrder = await createBackendOrder(payload);
      const createdOrderId = getOrderId(createdOrder);
      const addedItems = selectedItems.map((item) => (
        item.quantity > 1 ? `${item.product.name} x${item.quantity}` : item.product.name
      ));

      updateTable(actionTable.id, (table) => ({
        ...table,
        status: 'ocupada',
        guests: table.guests > 0 ? table.guests : 1,
        openedAt: table.openedAt ?? getCurrentTime(),
        totalAmount: getTableTotalAmount(table) + totalToAdd,
        customerId: table.customerId ?? getOrderCustomerId(createdOrder),
        activeOrderIds: createdOrderId
          ? Array.from(new Set([...(table.activeOrderIds ?? []), createdOrderId]))
          : table.activeOrderIds,
        activeOrderCount: createdOrderId
          ? Array.from(new Set([...(table.activeOrderIds ?? []), createdOrderId])).length
          : table.activeOrderCount,
        activeOrderItems: [...(table.activeOrderItems ?? []), ...addedItems],
      }));

      setTableProductQuantities({});
      setTableProductFilter('');
      void loadTables();
      toast.success(`Pedido enviado a cocina para Mesa ${actionTable.number}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo enviar el pedido a cocina');
    } finally {
      setIsAddingTableProducts(false);
    }
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
      await finalizeActiveTableOrders(actionTable);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo completar el cobro de la mesa');
      }
      return;
    }

    updateTable(actionTable.id, resetTableConsumption);

    toast.success(`Mesa ${actionTable.number} cobrada (${paymentMethodLabels[paymentMethod]})`);
    setActionTable(null);
    setDetailTable(null);
    void loadTables();
  };

  const handleMoveTable = () => {
    if (!actionTable) {
      return;
    }

    setNextAreaForMove(actionTable.area);
    setIsMoveTableDialogOpen(true);
  };

  const openEditTableFor = (table: TableItem | null) => {
    if (!table) {
      return;
    }

    setEditTableNumber(String(table.number));
    setEditTableArea(table.area);
    setEditTableWaiter(table.waiter === 'Sin asignar' ? '' : table.waiter);
    setEditTableCapacity(table.capacity ? String(table.capacity) : '');
    setEditTableDescription(table.description ?? '');
    setEditingTable(table);
  };

  const handleOpenEditTable = () => {
    openEditTableFor(actionTable);
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
    if (isCreatingTable) {
      return;
    }

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
      setIsCreatingTable(true);
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
    } finally {
      setIsCreatingTable(false);
    }

    setIsCreateTableDialogOpen(false);
    setNewTableNumber('');
    setNewTableWaiter('');
    setNewTableCapacity('');
    setNewTableArea('Salón principal');
    toast.success(`Mesa ${nextTableNumber} creada`);
  };

  const handleSaveTableChanges = async () => {
    if (isSavingTable) {
      return;
    }

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
      setIsSavingTable(true);
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
    } finally {
      setIsSavingTable(false);
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

  const handleCloseTable = async () => {
    if (!actionTable) {
      return;
    }

    try {
      await finalizeActiveTableOrders(actionTable);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudieron cerrar los pedidos activos de la mesa');
      return;
    }

    updateTable(actionTable.id, resetTableConsumption);
    toast.success(`Mesa ${actionTable.number} cerrada`);
    setActionTable(null);
    setDetailTable(null);
    void loadTables();
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
    <div className="h-full overflow-y-auto">
      <div className="relative p-4 md:p-6">
        

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
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className={statusBadgeClasses[table.status]}>
                                {statusLabels[table.status]}
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-muted)] transition hover:border-[var(--primary)]/70 hover:text-[var(--app-strong)]"
                                    onClick={(event) => event.stopPropagation()}
                                    onPointerDown={(event) => event.stopPropagation()}
                                    title="Más acciones"
                                  >
                                    <MoreVertical className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="w-52 border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]"
                                  onClick={(event) => event.stopPropagation()}
                                  onPointerDown={(event) => event.stopPropagation()}
                                >
                                  <DropdownMenuItem onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenDetail(table);
                                  }}>
                                    <Eye className="mr-2 h-4 w-4" />
                                    Ver detalle
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenActions(table);
                                  }}>
                                    <ReceiptText className="mr-2 h-4 w-4" />
                                    Acciones
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={(event) => {
                                    event.stopPropagation();
                                    handleOpenActions(table);
                                    openEditTableFor(table);
                                  }}>
                                    <Armchair className="mr-2 h-4 w-4" />
                                    Editar mesa
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-500 focus:text-red-500"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setTableToDelete(table);
                                    }}
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Eliminar
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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
                            {table.activeOrderItems && table.activeOrderItems.length > 0 ? (
                              <div className="mb-3 rounded-xl border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3 py-2">
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                                  En cocina {table.activeOrderCount ? `(${table.activeOrderCount})` : ''}
                                </p>
                                <p className="mt-1 line-clamp-2 text-sm text-[var(--app-strong)]">
                                  {table.activeOrderItems.slice(0, 4).join(', ')}
                                  {table.activeOrderItems.length > 4 ? '...' : ''}
                                </p>
                              </div>
                            ) : null}
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
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <Eye size={18} />
            </div>
            <DialogTitle>Detalle de Mesa {detailTable?.number}</DialogTitle>
            <DialogDescription>Consulta el estado y consumo actual de la mesa.</DialogDescription>
          </DialogHeader>
          {detailTable && (
            <div className="space-y-3 px-5 py-4 text-sm">
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
              {detailTable.activeOrderItems && detailTable.activeOrderItems.length > 0 ? (
                <div className="rounded-xl border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">
                    Productos enviados a cocina
                  </p>
                  <ul className="space-y-1 text-[var(--app-strong)]">
                    {detailTable.activeOrderItems.map((item, index) => (
                      <li key={`${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <Button className="w-full" onClick={() => handleOpenActions(detailTable)}>
                Acciones de mesa
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!actionTable} onOpenChange={() => setActionTable(null)}>
        <DialogContent className={WIDE_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <ReceiptText size={18} />
            </div>
            <DialogTitle>Acciones Mesa {actionTable?.number}</DialogTitle>
            <DialogDescription>Agrega productos, cobra la mesa o administra su configuración.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-150px)] space-y-4 overflow-y-auto px-5 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
              <section className="space-y-3 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--app-strong)]">Productos</p>
                    <p className="text-xs text-[var(--app-muted)]">Seleccioná cantidades como en un pedido de salón.</p>
                  </div>
                  <Badge variant="secondary" className="w-fit bg-label-info text-xs">
                    {selectedActionProducts.reduce((total, item) => total + item.quantity, 0)} items
                  </Badge>
                </div>

                <Input
                  placeholder="Buscar producto..."
                  value={tableProductFilter}
                  onChange={(event) => setTableProductFilter(event.target.value)}
                  className={FORM_CONTROL_CLASS}
                />

                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setTableCategoryFilter('all')}
                    className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                      tableCategoryFilter === 'all'
                        ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                        : 'border-[var(--app-line)] text-[var(--app-muted)] hover:border-[var(--primary)]/70 hover:text-[var(--app-strong)]'
                    }`}
                  >
                    Todas
                  </button>
                  {availableCategories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setTableCategoryFilter(String(category.id))}
                      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        tableCategoryFilter === String(category.id)
                          ? 'border-[var(--primary)] bg-[var(--primary)] text-white'
                          : 'border-[var(--app-line)] text-[var(--app-muted)] hover:border-[var(--primary)]/70 hover:text-[var(--app-strong)]'
                      }`}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>

                <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                  {categoryFilteredActionProducts.length === 0 ? (
                    <p className="rounded-md border border-dashed border-[var(--app-line)] px-3 py-6 text-center text-sm text-[var(--app-muted)]">
                      No hay productos para mostrar.
                    </p>
                  ) : (
                    categoryFilteredActionProducts.map((product) => {
                      const quantity = tableProductQuantities[product.id] ?? 0;
                      const imageUrl = getProductImageUrl(product);
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition ${
                            quantity > 0
                              ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                              : 'border-[var(--app-line)] bg-[var(--app-panel)]'
                          }`}
                        >
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)]">
                            {imageUrl ? (
                              <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              <PackagePlus className="h-5 w-5 text-[var(--app-muted)]" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[var(--app-strong)]">{product.name}</p>
                            <p className="text-xs text-[var(--app-muted)]">{formatCurrency(product.price)}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => decrementTableProduct(product.id)}
                              disabled={quantity === 0 || isAddingTableProducts}
                              className="h-8 w-8 rounded-md border border-[var(--app-line)] text-[var(--app-muted)] transition hover:border-[var(--primary)] hover:text-[var(--app-strong)] disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-[var(--app-strong)]">{quantity}</span>
                            <button
                              type="button"
                              onClick={() => incrementTableProduct(product.id)}
                              disabled={isAddingTableProducts}
                              className="h-8 w-8 rounded-md border border-[var(--primary)] text-[var(--primary)] transition hover:bg-[var(--primary)]/10 disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>

              <aside className="space-y-3 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--app-muted)]">Mesa</span>
                  <span className="text-sm font-semibold text-[var(--app-strong)]">{actionTable ? `Mesa ${actionTable.number}` : '-'}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-[var(--app-muted)]">Total actual</span>
                  <span className="text-sm font-semibold text-[var(--app-strong)]">
                    {actionTable ? formatCurrency(getTableTotalAmount(actionTable)) : formatCurrency(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--app-line)] pt-3">
                  <span className="text-sm text-[var(--app-muted)]">A agregar</span>
                  <span className="text-lg font-semibold text-[var(--app-strong)]">{formatCurrency(selectedActionProductsTotal)}</span>
                </div>
                <div className="space-y-2 rounded-md border border-[var(--app-line)] bg-[var(--app-panel)] p-2">
                  {selectedActionProducts.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-[var(--app-muted)]">Sin productos seleccionados</p>
                  ) : (
                    selectedActionProducts.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between gap-3 text-xs">
                        <span className="min-w-0 truncate text-[var(--app-strong)]">{item.product.name} x{item.quantity}</span>
                        <span className="shrink-0 text-[var(--app-muted)]">{formatCurrency(item.product.price * item.quantity)}</span>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={() => { void handleAddProduct(); }}
                  disabled={isAddingTableProducts || selectedActionProducts.length === 0}
                >
                  <PackagePlus className="h-4 w-4" />
                  {isAddingTableProducts ? 'Enviando...' : 'Enviar a cocina'}
                </Button>
              </aside>
            </div>

            <div className="grid gap-3 border-t border-[var(--app-line)] pt-4 lg:grid-cols-2">
              <div className="space-y-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                <p className="text-sm font-semibold text-[var(--app-strong)]">Cobrar mesa</p>
                <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                  <SelectTrigger className={FORM_CONTROL_CLASS}>
                    <SelectValue placeholder="Seleccionar método de pago" />
                  </SelectTrigger>
                  <SelectContent className={SELECT_CONTENT_CLASS}>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full gap-2" onClick={handleChargeTable}>
                  <CreditCard className="h-4 w-4" />
                  Cobrar ({actionTable ? formatCurrency(getTableTotalAmount(actionTable)) : formatCurrency(0)})
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                <p className="text-sm font-semibold text-[var(--app-strong)]">Administración</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button variant="outline" className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]" onClick={handleOpenBill}>
                    Abrir cuenta
                  </Button>
                  <Button variant="outline" className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]" onClick={handleOpenEditTable}>
                    Editar mesa
                  </Button>
                  <Button variant="outline" className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]" onClick={handleMoveTable}>
                    Mover mesa
                  </Button>
                  <Button variant="outline" className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]" onClick={handleToggleTableAvailability}>
                    {actionTable?.status === 'reservada' ? 'Marcar libre' : 'Reservar'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-[var(--app-line)] pt-4">
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() => actionTable && setTableToDelete(actionTable)}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar mesa
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTableDialogOpen} onOpenChange={setIsCreateTableDialogOpen}>
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <Armchair size={18} />
            </div>
            <DialogTitle>Nueva mesa</DialogTitle>
            <DialogDescription>Agrega una mesa al salón y define su sector.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Número de mesa (vacío = automático)"
              value={newTableNumber}
              onChange={(event) => setNewTableNumber(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
            <Input
              placeholder="Mozo"
              value={newTableWaiter}
              onChange={(event) => setNewTableWaiter(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Capacidad (opcional)"
              value={newTableCapacity}
              onChange={(event) => setNewTableCapacity(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
            <Select value={newTableArea} onValueChange={(value) => setNewTableArea(value as TableItem['area'])}>
              <SelectTrigger className={FORM_CONTROL_CLASS}>
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateTableDialogOpen(false)}
              disabled={isCreatingTable}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleCreateTable} disabled={isCreatingTable}>
              {isCreatingTable ? 'Guardando...' : 'Crear mesa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTable} onOpenChange={(open) => !open && setEditingTable(null)}>
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <Armchair size={18} />
            </div>
            <DialogTitle>Editar Mesa {editingTable?.number}</DialogTitle>
            <DialogDescription>Actualiza los datos de la mesa seleccionada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Número de mesa"
              value={editTableNumber}
              onChange={(event) => setEditTableNumber(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
            <Input
              placeholder="Mozo"
              value={editTableWaiter}
              onChange={(event) => setEditTableWaiter(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Capacidad"
              value={editTableCapacity}
              onChange={(event) => setEditTableCapacity(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
            <Select value={editTableArea} onValueChange={(value) => setEditTableArea(value as TableItem['area'])}>
              <SelectTrigger className={FORM_CONTROL_CLASS}>
                <SelectValue placeholder="Sector" />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Descripción (opcional)"
              value={editTableDescription}
              onChange={(event) => setEditTableDescription(event.target.value)}
              className={FORM_CONTROL_CLASS}
            />
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingTable(null)}
              disabled={isSavingTable}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button className="gap-2" onClick={handleSaveTableChanges} disabled={isSavingTable}>
              {isSavingTable ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tableToDelete} onOpenChange={(open) => !open && setTableToDelete(null)}>
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-red-500/45 bg-red-500/10 text-red-500">
              <Trash2 size={18} />
            </div>
            <DialogTitle>Eliminar Mesa {tableToDelete?.number}</DialogTitle>
            <DialogDescription>Esta acción eliminará la mesa de forma permanente.</DialogDescription>
          </DialogHeader>
          <div className="px-5 py-4 text-sm">
            <p className="rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3 text-[var(--app-muted)]">
              Se quitará del salón y no podrá usarse para nuevas órdenes.
            </p>
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTableToDelete(null)}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteTable}>
              Confirmar eliminación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMoveTableDialogOpen} onOpenChange={setIsMoveTableDialogOpen}>
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <MapPin size={18} />
            </div>
            <DialogTitle>Mover Mesa {actionTable?.number}</DialogTitle>
            <DialogDescription>Selecciona el nuevo sector donde ubicar la mesa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-5 py-4">
            <Select value={nextAreaForMove} onValueChange={(value) => setNextAreaForMove(value as TableItem['area'])}>
              <SelectTrigger className={FORM_CONTROL_CLASS}>
                <SelectValue placeholder="Seleccionar sector" />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                {areaOptions.map((area) => (
                  <SelectItem key={area} value={area}>{area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMoveTableDialogOpen(false)}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmMoveTable}>
              Confirmar sector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
