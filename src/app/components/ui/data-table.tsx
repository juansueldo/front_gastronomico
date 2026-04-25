import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, Loader2, MoreHorizontal, Pencil, RefreshCw, Search, Trash2 } from 'lucide-react';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Input } from './input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface BaseDataTableProps<T> {
  columns: DataTableColumn<T>[];
  getRowId?: (row: T, index: number) => string;
  emptyMessage: string;
  searchPlaceholder?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
}

interface DataTableProps<T> extends BaseDataTableProps<T> {
  data: T[];
}

type SortDirection = 'asc' | 'desc';

export interface DataTableSortState {
  key: string;
  direction: SortDirection;
}

export interface RemoteDataTableQuery<TFilters = Record<string, unknown>> {
  page: number;
  pageSize: number;
  search: string;
  sort: DataTableSortState | null;
  filters?: TFilters;
}

export interface RemoteDataTableResult<T> {
  rows: T[];
  total: number;
}

export interface RowAction<T> {
  label: string;
  onClick: (row: T) => void;
  icon?: ComponentType<{ className?: string }>;
  variant?: 'default' | 'destructive';
  disabled?: (row: T) => boolean;
}

interface RemoteDataTableProps<T, TFilters = Record<string, unknown>> extends BaseDataTableProps<T> {
  loadData: (query: RemoteDataTableQuery<TFilters>) => Promise<RemoteDataTableResult<T>>;
  filters?: TFilters;
  reloadKey?: string | number;
}

function normalizeValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function RowActions<T>({
  row,
  editAction,
  deleteAction,
  extraActions = [],
}: {
  row: T;
  editAction?: RowAction<T>;
  deleteAction?: RowAction<T>;
  extraActions?: RowAction<T>[];
}) {
  const visibleExtraActions = extraActions.filter(Boolean);

  return (
    <div className="flex items-center justify-end gap-2">
      {editAction ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-orange-600 bg-transparent text-white hover:bg-gray-700"
          onClick={() => editAction.onClick(row)}
          disabled={editAction.disabled?.(row)}
        >
          <Pencil className="h-4 w-4" />
          <span className="hidden sm:inline">{editAction.label}</span>
        </Button>
      ) : null}

      {deleteAction ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => deleteAction.onClick(row)}
          disabled={deleteAction.disabled?.(row)}
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">{deleteAction.label}</span>
        </Button>
      ) : null}

      {visibleExtraActions.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="size-8 border-orange-600 bg-transparent text-white hover:bg-gray-700"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-orange-700 bg-card text-white">
            {visibleExtraActions.map((action, index) => {
              const Icon = action.icon;
              return (
                <div key={`${action.label}-${index}`}>
                  {index > 0 ? <DropdownMenuSeparator className="bg-orange-700/50" /> : null}
                  <DropdownMenuItem
                    onClick={() => action.onClick(row)}
                    disabled={action.disabled?.(row)}
                    variant={action.variant === 'destructive' ? 'destructive' : 'default'}
                    className="cursor-pointer"
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    <span>{action.label}</span>
                  </DropdownMenuItem>
                </div>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

export function createRowActionsColumn<T>({
  editAction,
  deleteAction,
  extraActions,
  header = 'Acciones',
}: {
  editAction?: RowAction<T>;
  deleteAction?: RowAction<T>;
  extraActions?: RowAction<T>[];
  header?: string;
}): DataTableColumn<T> {
  return {
    key: 'actions',
    header,
    accessor: () => '',
    headerClassName: 'text-right',
    className: 'text-right',
    cell: (row) => (
      <RowActions
        row={row}
        editAction={editAction}
        deleteAction={deleteAction}
        extraActions={extraActions}
      />
    ),
  };
}

function getSortIcon(columnKey: string, sort: DataTableSortState | null, sortable: boolean | undefined) {
  if (!sortable) {
    return null;
  }

  if (!sort || sort.key !== columnKey) {
    return <ArrowUpDown className="h-3.5 w-3.5" />;
  }

  if (sort.direction === 'asc') {
    return <ArrowUp className="h-3.5 w-3.5" />;
  }

  return <ArrowDown className="h-3.5 w-3.5" />;
}

function DataTableHeader<T>({
  columns,
  sort,
  onSort,
}: {
  columns: DataTableColumn<T>[];
  sort: DataTableSortState | null;
  onSort: (key: string, sortable: boolean | undefined) => void;
}) {
  return (
    <TableHeader>
      <TableRow className="border-orange-700 hover:bg-transparent">
        {columns.map((column) => (
          <TableHead
            key={column.key}
            className={column.headerClassName}
          >
            <button
              type="button"
              onClick={() => onSort(column.key, column.sortable)}
              className={column.sortable ? 'inline-flex items-center gap-1 text-left' : 'text-left'}
            >
              <span>{column.header}</span>
              {getSortIcon(column.key, sort, column.sortable)}
            </button>
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function DataTableRows<T>({
  rows,
  columns,
  getRowId,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId?: (row: T, index: number) => string;
}) {
  return (
    <TableBody>
      {rows.map((row, index) => (
        <TableRow key={getRowId ? getRowId(row, index) : String(index)} className="border-orange-700 hover:bg-body">
          {columns.map((column) => (
            <TableCell key={column.key} className={column.className}>
              {column.cell ? column.cell(row) : normalizeValue(column.accessor(row))}
            </TableCell>
          ))}
        </TableRow>
      ))}
    </TableBody>
  );
}

function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  pageSizeOptions: number[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span>Filas</span>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-8 rounded-md border border-orange-600 bg-body px-2 text-xs text-white outline-none"
        >
          {pageSizeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  loading = false,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const pageEnd = total === 0 ? 0 : Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
      <span>
        Mostrando {pageStart}-{pageEnd} de {total}
      </span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={loading || page <= 1}
          className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
        >
          Anterior
        </Button>
        <span>
          Pagina {page} de {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={loading || page >= totalPages}
          className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  emptyMessage,
  searchPlaceholder = 'Buscar...',
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sort, setSort] = useState<DataTableSortState | null>(null);

  const searchableColumns = useMemo(
    () => columns.filter((column) => typeof column.accessor === 'function'),
    [columns],
  );

  const filteredData = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return data;
    }

    return data.filter((row) => searchableColumns.some((column) => (
      normalizeValue(column.accessor(row)).toLowerCase().includes(query)
    )));
  }, [data, search, searchableColumns]);

  const sortedData = useMemo(() => {
    if (!sort) {
      return filteredData;
    }

    const column = columns.find((item) => item.key === sort.key);
    if (!column) {
      return filteredData;
    }

    const factor = sort.direction === 'asc' ? 1 : -1;

    return [...filteredData].sort((left, right) => {
      const leftValue = normalizeValue(column.accessor(left)).toLowerCase();
      const rightValue = normalizeValue(column.accessor(right)).toLowerCase();

      if (leftValue < rightValue) {
        return -1 * factor;
      }

      if (leftValue > rightValue) {
        return 1 * factor;
      }

      return 0;
    });
  }, [columns, filteredData, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedData]);

  const handleSort = (key: string, sortable: boolean | undefined) => {
    if (!sortable) {
      return;
    }

    setPage(1);
    setSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }

      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }

      return null;
    });
  };

  return (
    <div className="space-y-3">
      <DataTableToolbar
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder={searchPlaceholder}
        pageSize={pageSize}
        onPageSizeChange={(value) => {
          setPageSize(value);
          setPage(1);
        }}
        pageSizeOptions={pageSizeOptions}
      />

      {sortedData.length === 0 ? (
        <div className="rounded-lg border border-orange-700 bg-card p-4 text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <>
          <Table>
            <DataTableHeader columns={columns} sort={sort} onSort={handleSort} />
            <DataTableRows rows={paginatedData} columns={columns} getRowId={getRowId} />
          </Table>

          <DataTablePagination
            page={currentPage}
            pageSize={pageSize}
            total={sortedData.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}

export function RemoteDataTable<T, TFilters = Record<string, unknown>>({
  columns,
  getRowId,
  emptyMessage,
  searchPlaceholder = 'Buscar...',
  pageSizeOptions = [10, 25, 50],
  defaultPageSize = 10,
  loadData,
  filters,
  reloadKey,
}: RemoteDataTableProps<T, TFilters>) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [sort, setSort] = useState<DataTableSortState | null>(null);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 400);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters, pageSize, sort]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await loadData({
          page,
          pageSize,
          search: debouncedSearch.trim(),
          sort,
          filters,
        });

        if (cancelled) {
          return;
        }

        setRows(Array.isArray(result.rows) ? result.rows : []);
        setTotal(Number.isFinite(result.total) ? result.total : 0);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRows([]);
        setTotal(0);
        setErrorMessage(error instanceof Error ? error.message : 'No se pudieron cargar los datos');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, filters, loadData, page, pageSize, refreshCounter, reloadKey, sort]);

  const handleSort = (key: string, sortable: boolean | undefined) => {
    if (!sortable) {
      return;
    }

    setSort((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }

      if (prev.direction === 'asc') {
        return { key, direction: 'desc' };
      }

      return null;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DataTableToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          pageSizeOptions={pageSizeOptions}
        />

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRefreshCounter((current) => current + 1)}
          disabled={loading}
          className="border-orange-600 bg-transparent text-white hover:bg-gray-700"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Recargar
        </Button>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-red-700/60 bg-red-950/20 p-4 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-orange-700 bg-card p-6 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando datos...</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-orange-700 bg-card p-4 text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <>
          <Table>
            <DataTableHeader columns={columns} sort={sort} onSort={handleSort} />
            <DataTableRows rows={rows} columns={columns} getRowId={getRowId} />
          </Table>

          <DataTablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            loading={loading}
          />
        </>
      )}
    </div>
  );
}
