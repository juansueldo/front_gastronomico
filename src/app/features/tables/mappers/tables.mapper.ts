import type { CreateTableRequest, TableDto, UpdateTableRequest } from '../types/tables.dto';
import type { TableItem } from '../types/tables.model';

const parseTableNumber = (item: TableDto) => {
  const directNumber = Number(item.table_number ?? item.tableNumber);
  if (Number.isInteger(directNumber) && directNumber > 0) return directNumber;

  const match = String(item.name ?? '').match(/\d+/);
  const extractedNumber = Number(match?.[0]);
  return Number.isInteger(extractedNumber) && extractedNumber > 0 ? extractedNumber : 0;
};

const parseStatusId = (item: TableDto) => {
  const statusId = Number(item.statusId ?? item.status_id);
  if (Number.isInteger(statusId) && statusId > 0) return statusId;
  return item.active === false ? 2 : 1;
};

export function mapTableDtoToModel(item: TableDto): TableItem {
  const tableNumber = parseTableNumber(item);
  const statusId = parseStatusId(item);
  const capacity = Number(item.capacity);
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : undefined;
  const parsedHeadquarterId = Number(
    item.headquarterId
    ?? item.headquarter_id
    ?? item.headquarter?.id
    ?? item.Headquarter?.id
    ?? item.metadata?.headquarterId
    ?? item.metadata?.headquarter_id
  );

  return {
    id: String(item.id ?? `table-${Date.now()}-${Math.random()}`),
    name: item.name ?? (tableNumber > 0 ? `Mesa ${tableNumber}` : 'Mesa'),
    tableNumber,
    table_number: tableNumber,
    description: item.description ?? undefined,
    capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : undefined,
    location: item.location ?? undefined,
    metadata,
    statusId,
    headquarterId: Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0 ? parsedHeadquarterId : undefined,
    active: item.active ?? statusId === 1,
  };
}

export function mapTablePayloadToRequest(data: CreateTableRequest | UpdateTableRequest) {
  const parsedHeadquarterId = Number(data.headquarterId);
  const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
    ? parsedHeadquarterId
    : undefined;

  return {
    ...data,
    headquarterId: normalizedHeadquarterId,
    headquarter_id: normalizedHeadquarterId,
  };
}
