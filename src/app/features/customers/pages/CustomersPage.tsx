import { useCallback, useMemo } from 'react';
import { Mail, Phone, ShoppingBag, UserRound } from 'lucide-react';
import { Badge } from '../../../shared/ui/components/badge';
import {
  type DataTableColumn,
  type RemoteDataTableQuery,
  RemoteDataTable,
} from '../../../shared/ui/components/data-table';
import { listCustomers, type Customer } from '../services/customers.service';

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

export function CustomersPage() {
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
        <span className="inline-flex min-w-0 items-center gap-2 text-[var(--app-strong)]">
          <Phone className="h-4 w-4 shrink-0 text-[var(--app-muted)]" />
          <span className="truncate">{customer.phone || '-'}</span>
        </span>
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
  ], []);

  return (
    <div className="min-h-full bg-body p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--app-strong)]">
          <UserRound className="h-6 w-6 text-[var(--primary)]" />
          Clientes
        </h1>
        <p className="text-sm text-[var(--app-muted)]">
          Consulta clientes, telefonos y comportamiento de compra.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-surface)] p-4 shadow-sm md:p-5">
        <RemoteDataTable
          columns={columns}
          loadData={loadCustomers}
          getRowId={(customer) => String(customer.id ?? customer.phone)}
          emptyMessage="Todavia no hay clientes registrados."
          searchPlaceholder="Buscar por nombre, telefono o email"
          defaultPageSize={10}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>
    </div>
  );
}
