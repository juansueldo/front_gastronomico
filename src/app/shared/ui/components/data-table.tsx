import { type ComponentType, type ReactNode, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDown, ArrowUp, ArrowUpDown, LayoutGrid, List, Loader2, MoreHorizontal, Pencil, Search, Trash2 } from 'lucide-react';
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
type DataTableViewMode = 'list' | 'cards';
const LIST_PAGE_SIZE = 10;
const CARD_PAGE_SIZE = 12;

const getInitialViewMode = (): DataTableViewMode => {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    return 'cards';
  }

  return 'list';
};

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

function DataTableCards<T>({
  rows,
  columns,
  getRowId,
}: {
  rows: T[];
  columns: DataTableColumn<T>[];
  getRowId?: (row: T, index: number) => string;
}) {
  const visibleColumns = columns.filter((column) => column.key !== 'actions');
  const actionsColumn = columns.find((column) => column.key === 'actions');

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, index) => {
        const titleColumn = visibleColumns[0];
        const subtitleColumn = visibleColumns[1];
        const detailColumns = visibleColumns.slice(2);

        return (
          <article
            key={getRowId ? getRowId(row, index) : String(index)}
            className="min-w-0 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4 text-sm shadow-sm transition hover:border-[var(--primary)]/50 hover:bg-[var(--app-panel-subtle)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="min-w-0 text-base font-semibold text-foreground [&_*]:min-w-0">
                  {titleColumn ? titleColumn.cell?.(row) ?? normalizeValue(titleColumn.accessor(row)) : `Registro ${index + 1}`}
                </div>
                {subtitleColumn ? (
                  <div className="mt-1 min-w-0 break-words text-xs text-muted-foreground">
                    {subtitleColumn.cell?.(row) ?? normalizeValue(subtitleColumn.accessor(row))}
                  </div>
                ) : null}
              </div>
              {actionsColumn ? (
                <div className="shrink-0">
                  {actionsColumn.cell ? actionsColumn.cell(row) : normalizeValue(actionsColumn.accessor(row))}
                </div>
              ) : null}
            </div>

            {detailColumns.length > 0 ? (
              <dl className="mt-4 grid gap-3">
                {detailColumns.map((column) => (
                  <div key={column.key} className="grid gap-1 sm:grid-cols-[minmax(92px,0.45fr)_1fr] sm:gap-3">
                    <dt className="text-xs font-medium text-muted-foreground">{column.header}</dt>
                    <dd className="min-w-0 break-words text-sm text-foreground [&_*]:min-w-0">
                      {column.cell ? column.cell(row) : normalizeValue(column.accessor(row))}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function DataTableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  viewMode,
  onViewModeChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  pageSize: number;
  onPageSizeChange: (value: number) => void;
  pageSizeOptions: number[];
  viewMode: DataTableViewMode;
  onViewModeChange: (mode: DataTableViewMode) => void;
}) {
  const listPageSizeOptions = Array.from(new Set([LIST_PAGE_SIZE, 20, 50, 100, ...pageSizeOptions]))
    .filter((option) => Number.isFinite(option) && option > 0)
    .sort((left, right) => left - right);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-3xl">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-11 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] pl-9 text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]/20"
          />
        </div>
      </div>

      <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-[var(--app-muted)] lg:w-auto lg:justify-end">
        <div className="inline-flex h-11 overflow-hidden rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-1">
          <button
            type="button"
            aria-label="Modo lista"
            title="Modo lista"
            onClick={() => onViewModeChange('list')}
            className={`inline-flex w-10 items-center justify-center rounded-md transition ${
              viewMode === 'list' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--app-muted)] hover:bg-[var(--app-soft)] hover:text-[var(--app-strong)]'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Modo tarjetas"
            title="Modo tarjetas"
            onClick={() => onViewModeChange('cards')}
            className={`inline-flex w-10 items-center justify-center rounded-md transition ${
              viewMode === 'cards' ? 'bg-[var(--primary)] text-white shadow-sm' : 'text-[var(--app-muted)] hover:bg-[var(--app-soft)] hover:text-[var(--app-strong)]'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
        {viewMode === 'list' ? (
          <label className="ml-auto inline-flex h-11 items-center gap-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-sm text-[var(--app-muted)] lg:ml-0">
            <span>Filas</span>
            <select
              value={pageSize}
              onChange={(event) => onPageSizeChange(Number(event.target.value))}
              className="h-9 rounded-md border-0 bg-[var(--app-panel)] px-2 text-sm text-[var(--app-strong)] outline-none"
            >
              {listPageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="ml-auto inline-flex h-11 items-center rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-3 text-sm font-semibold text-[var(--app-strong)] lg:ml-0">
            12 por página
          </span>
        )}
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
    <div className="flex flex-col gap-3 text-xs text-[var(--app-muted)] sm:flex-row sm:items-center sm:justify-between">
      <span className="text-center sm:text-left">
        Mostrando {pageStart}-{pageEnd} de {total}
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={loading || page <= 1}
          className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
        >
          Anterior
        </Button>
        <span className="min-w-[86px] text-center">
          Pagina {page} de {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={loading || page >= totalPages}
          className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
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
  const initialViewMode = useMemo(getInitialViewMode, []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialViewMode === 'cards' ? CARD_PAGE_SIZE : (defaultPageSize || LIST_PAGE_SIZE));
  const [sort, setSort] = useState<DataTableSortState | null>(null);
  const [viewMode, setViewMode] = useState<DataTableViewMode>(initialViewMode);

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
    <div className="datatable-surface">
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
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setPageSize(mode === 'cards' ? CARD_PAGE_SIZE : LIST_PAGE_SIZE);
          setPage(1);
        }}
      />

      {sortedData.length === 0 ? (
        <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4 text-sm text-[var(--app-muted)]">
          {emptyMessage}
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="w-full overflow-x-auto rounded-lg">
              <Table className="min-w-[760px]">
                <DataTableHeader columns={columns} sort={sort} onSort={handleSort} />
                <DataTableRows rows={paginatedData} columns={columns} getRowId={getRowId} />
              </Table>
            </div>
          ) : (
            <DataTableCards rows={paginatedData} columns={columns} getRowId={getRowId} />
          )}

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
  const initialViewMode = useMemo(getInitialViewMode, []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialViewMode === 'cards' ? CARD_PAGE_SIZE : (defaultPageSize || LIST_PAGE_SIZE));
  const [sort, setSort] = useState<DataTableSortState | null>(null);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<DataTableViewMode>(initialViewMode);
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
  }, [debouncedSearch, filters, loadData, page, pageSize, reloadKey, sort]);

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
    <div className="datatable-surface">
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        pageSizeOptions={pageSizeOptions}
        viewMode={viewMode}
        onViewModeChange={(mode) => {
          setViewMode(mode);
          setPageSize(mode === 'cards' ? CARD_PAGE_SIZE : LIST_PAGE_SIZE);
          setPage(1);
        }}
      />

      {errorMessage ? (
        <div className="rounded-lg border border-red-700/60 bg-red-950/20 p-4 text-sm text-red-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span>{errorMessage}</span>
          </div>
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-6 text-sm text-[var(--app-muted)]">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Cargando datos...</span>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4 text-sm text-[var(--app-muted)]">
          {emptyMessage}
        </div>
      ) : (
        <>
          {viewMode === 'list' ? (
            <div className="w-full overflow-x-auto rounded-lg">
              <Table className="min-w-[760px]">
                <DataTableHeader columns={columns} sort={sort} onSort={handleSort} />
                <DataTableRows rows={rows} columns={columns} getRowId={getRowId} />
              </Table>
            </div>
          ) : (
            <DataTableCards rows={rows} columns={columns} getRowId={getRowId} />
          )}

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
