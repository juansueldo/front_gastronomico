import { type ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react';
import { Button } from './button';
import { Input } from './input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId?: (row: T, index: number) => string;
  emptyMessage: string;
  searchPlaceholder?: string;
  pageSizeOptions?: number[];
  defaultPageSize?: number;
}

type SortDirection = 'asc' | 'desc';

interface SortState {
  key: string;
  direction: SortDirection;
}

function normalizeValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
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
  const [sort, setSort] = useState<SortState | null>(null);

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

  const getSortIcon = (columnKey: string, sortable: boolean | undefined) => {
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
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Filas</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="h-8 rounded-md border border-gray-600 bg-body px-2 text-xs text-white outline-none"
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sortedData.length === 0 ? (
        <div className="rounded-lg border border-gray-700 bg-card p-4 text-sm text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow className="border-gray-700 hover:bg-transparent">
                {columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={column.headerClassName}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key, column.sortable)}
                      className={column.sortable ? 'inline-flex items-center gap-1 text-left' : 'text-left'}
                    >
                      <span>{column.header}</span>
                      {getSortIcon(column.key, column.sortable)}
                    </button>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.map((row, index) => (
                <TableRow key={getRowId ? getRowId(row, index) : String(index)} className="border-gray-700 hover:bg-body">
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell ? column.cell(row) : normalizeValue(column.accessor(row))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-2 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, sortedData.length)} de {sortedData.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
              >
                Anterior
              </Button>
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
              >
                Siguiente
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
