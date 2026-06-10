import { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Mail, Phone, Plus, ShoppingBag, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Badge } from '../../../shared/ui/components/badge';
import { Button } from '../../../shared/ui/components/button';
import { DeleteConfirmDialog } from '../../../shared/ui/components/delete-confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../../shared/ui/components/dialog';
import {
  type DataTableColumn,
  type RemoteDataTableQuery,
  RemoteDataTable,
  createRowActionsColumn,
} from '../../../shared/ui/components/data-table';
import { CreateOrderDialog } from '../../../components/orders/CreateOrderDialog';
import { fetchProductCategories, fetchProducts, type ProductCategory, type ProductItem } from '../../products';
import { formatOrderNumber } from '../../../shared/utils/orderNumbers';
import { deleteCustomer, listCustomerOrders, listCustomers, type Customer } from '../services/customers.service';

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function getInitials(name: string) {
  const initials = name
    .split(' ')
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();

  return initials.slice(0, 2) || 'CL';
}

function formatDate(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

type CustomerOrderHistoryItem = {
  id?: string | number;
  order_number?: string;
  orderNumber?: string;
  status?: string;
  total_amount?: number | string;
  totalAmount?: number | string;
  order_date?: string;
  orderDate?: string;
  createdAt?: string;
};

function getOrderNumber(order: CustomerOrderHistoryItem) {
  return formatOrderNumber(order, '-');
}

function getOrderDate(order: CustomerOrderHistoryItem) {
  return order.orderDate ?? order.order_date ?? order.createdAt;
}

function getOrderTotal(order: CustomerOrderHistoryItem) {
  return Number(order.totalAmount ?? order.total_amount ?? 0);
}

export function CustomersPage() {
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);
  const [customerForOrder, setCustomerForOrder] = useState<Customer | null>(null);
  const [customerForHistory, setCustomerForHistory] = useState<Customer | null>(null);
  const [orderHistory, setOrderHistory] = useState<CustomerOrderHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const [products, categories] = await Promise.all([fetchProducts(), fetchProductCategories()]);
        setAvailableProducts(products);
        setAvailableCategories(categories);
      } catch {
        toast.error('No se pudo cargar el catalogo para crear pedidos');
      }
    };

    void loadCatalog();
  }, []);

  const loadCustomers = useCallback(async (query: RemoteDataTableQuery) => {
    const result = await listCustomers({
      page: query.page,
      limit: query.pageSize,
      search: query.search,
      sortBy: query.sort?.key,
      sortDir: query.sort?.direction === 'asc' ? 'ASC' : query.sort?.direction === 'desc' ? 'DESC' : undefined,
    });

    return {
      rows: result.rows,
      total: result.total,
    };
  }, []);

  const handleDeleteCustomer = async () => {
    if (!customerToDelete?.id) return;

    setIsDeletingCustomer(true);
    try {
      await deleteCustomer(customerToDelete.id);
      toast.success('Cliente eliminado');
      setCustomerToDelete(null);
      setReloadKey((current) => current + 1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar el cliente');
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const handleOpenHistory = useCallback(async (customer: Customer) => {
    if (!customer.id) return;

    setCustomerForHistory(customer);
    setIsLoadingHistory(true);
    try {
      const orders = await listCustomerOrders(customer.id);
      setOrderHistory(Array.isArray(orders) ? orders as CustomerOrderHistoryItem[] : []);
    } catch (error) {
      setOrderHistory([]);
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar el historial');
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const handleOpenCustomerChat = useCallback((customer: Customer) => {
    const phone = customer.phone?.trim();
    if (!phone) {
      toast.error('Este cliente no tiene telefono cargado');
      return;
    }

    navigate('/chats', {
      state: {
        customerChat: {
          id: customer.id,
          name: customer.name,
          phone,
        },
      },
    });
  }, [navigate]);

  const columns = useMemo<DataTableColumn<Customer>[]>(() => [
    {
      key: 'name',
      header: 'Cliente',
      accessor: (customer) => customer.name,
      sortable: true,
      cell: (customer) => (
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--primary)]/15 text-sm font-bold text-[var(--primary)]">
            {getInitials(customer.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--app-strong)]">{customer.name}</p>
            <p className="truncate text-xs text-[var(--app-muted)]">#{customer.id ?? '-'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Telefono',
      accessor: (customer) => customer.phone,
      sortable: true,
      cell: (customer) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            handleOpenCustomerChat(customer);
          }}
          disabled={!customer.phone}
          className="inline-flex min-w-0 items-center gap-2 rounded-md text-left text-[var(--app-strong)] transition-colors hover:text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:text-[var(--app-strong)]"
          title={customer.phone ? 'Enviar mensaje por WhatsApp' : 'Sin telefono'}
        >
          <Phone className="h-4 w-4 shrink-0 text-[var(--primary)]" />
          <span className="truncate">{customer.phone || '-'}</span>
        </button>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (customer) => customer.email,
      sortable: true,
      cell: (customer) => (
        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--app-strong)]">
          <Mail className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
          <span className="truncate">{customer.email || '-'}</span>
        </span>
      ),
    },
    {
      key: 'orderCount',
      header: 'Pedidos',
      accessor: (customer) => customer.orderCount ?? 0,
      sortable: true,
      cell: (customer) => (
        <span className="inline-flex items-center gap-2 text-[var(--app-strong)]">
          <ShoppingBag className="h-4 w-4 text-[var(--app-muted)]" />
          {customer.orderCount ?? 0}
        </span>
      ),
    },
    {
      key: 'totalSpent',
      header: 'Total gastado',
      accessor: (customer) => customer.totalSpent ?? 0,
      sortable: true,
      cell: (customer) => currencyFormatter.format(customer.totalSpent ?? 0),
    },
    {
      key: 'lastOrder',
      header: 'Ultimo pedido',
      accessor: (customer) => customer.lastOrder?.orderDate ?? '',
      sortable: true,
      cell: (customer) => (
        <div className="min-w-0 text-sm">
          <p className="text-[var(--app-strong)]">{formatDate(customer.lastOrder?.orderDate)}</p>
          {customer.lastOrder?.status ? (
            <p className="mt-1 text-xs text-[var(--app-muted)]">{customer.lastOrder.status}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Estado',
      accessor: (customer) => customer.statusName ?? '',
      sortable: true,
      cell: (customer) => (
        <Badge className="bg-label-success">
          {customer.statusName || 'Activo'}
        </Badge>
      ),
    },
    createRowActionsColumn<Customer>({
      extraActions: [
        {
          label: 'Crear pedido',
          icon: Plus,
          onClick: setCustomerForOrder,
          disabled: (customer) => !customer.id,
        },
        {
          label: 'Ver historial',
          icon: History,
          onClick: handleOpenHistory,
          disabled: (customer) => !customer.id,
        },
        {
          label: 'Eliminar',
          icon: Trash2,
          onClick: setCustomerToDelete,
          variant: 'destructive',
          disabled: (customer) => !customer.id,
        },
      ],
    }),
  ], [handleOpenCustomerChat, handleOpenHistory]);

  return (
    <div className="min-h-full p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--app-strong)]">
          <UserRound className="h-6 w-6 text-[var(--primary)]" />
          Clientes
        </h1>
        <p className="text-sm text-[var(--app-muted)]">
          Consulta clientes, telefonos y comportamiento de compra.
        </p>
      </div>

      <div className="card bg-card p-4">
        <RemoteDataTable
          columns={columns}
          loadData={loadCustomers}
          reloadKey={reloadKey}
          getRowId={(customer) => String(customer.id ?? customer.phone)}
          emptyMessage="Todavia no hay clientes registrados."
          searchPlaceholder="Buscar por nombre, telefono o email"
          defaultPageSize={10}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>

      <DeleteConfirmDialog
        open={Boolean(customerToDelete)}
        onOpenChange={(open) => {
          if (!open) setCustomerToDelete(null);
        }}
        itemLabel="Cliente"
        itemName={customerToDelete?.name ?? ''}
        itemIcon={customerToDelete ? (
          <span className="flex size-8 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-bold text-[var(--primary)]">
            {getInitials(customerToDelete.name)}
          </span>
        ) : null}
        loading={isDeletingCustomer}
        onConfirm={handleDeleteCustomer}
      />

      <Dialog open={Boolean(customerForHistory)} onOpenChange={(open) => {
        if (!open) {
          setCustomerForHistory(null);
          setOrderHistory([]);
        }
      }}>
        <DialogContent className="max-h-[88vh] w-[min(720px,calc(100vw-2rem))] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de pedidos</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
              <p className="font-semibold text-[var(--app-strong)]">{customerForHistory?.name}</p>
              <p className="text-sm text-[var(--app-muted)]">{customerForHistory?.phone || '-'}</p>
            </div>

            {isLoadingHistory ? (
              <p className="text-sm text-[var(--app-muted)]">Cargando historial...</p>
            ) : orderHistory.length === 0 ? (
              <p className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4 text-sm text-[var(--app-muted)]">
                Este cliente todavia no tiene pedidos.
              </p>
            ) : (
              <div className="space-y-2">
                {orderHistory.map((order) => (
                  <div key={String(order.id ?? getOrderNumber(order))} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
                    <div>
                      <p className="font-semibold text-[var(--app-strong)]">Pedido #{getOrderNumber(order)}</p>
                      <p className="text-sm text-[var(--app-muted)]">{formatDate(getOrderDate(order))}</p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-label-info">{order.status ?? 'Sin estado'}</Badge>
                      <p className="mt-2 font-semibold text-[var(--app-strong)]">{currencyFormatter.format(getOrderTotal(order))}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <CreateOrderDialog
        open={Boolean(customerForOrder)}
        onClose={() => setCustomerForOrder(null)}
        onCreated={() => {
          setCustomerForOrder(null);
          setReloadKey((current) => current + 1);
        }}
        availableProducts={availableProducts}
        availableCategories={availableCategories}
        initialCustomer={customerForOrder ? {
          id: customerForOrder.id,
          name: customerForOrder.name,
          phone: customerForOrder.phone,
        } : null}
      />
    </div>
  );
}
