import type { CreateWaiterRequest, UpdateWaiterRequest, WaiterDto } from '../types/waiters.dto';
import type { Waiter } from '../types/waiters.model';

function toNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function mapWaiterDtoToModel(item: WaiterDto): Waiter {
  const statusId = toNumber(item.statusId ?? item.Status?.id);
  const headquarterId = toNumber(item.headquarterId ?? item.Headquarter?.id);
  const salary = item.salary === null || item.salary === undefined || item.salary === ''
    ? null
    : toNumber(item.salary);

  return {
    id: String(item.id ?? ''),
    firstname: String(item.firstname ?? ''),
    lastname: String(item.lastname ?? ''),
    email: item.email ?? null,
    phone: item.phone ?? null,
    identification: item.identification ?? null,
    salary,
    hireDate: item.hire_date ?? item.hireDate ?? null,
    headquarterId,
    headquarterName: item.Headquarter?.name ?? null,
    headquarterLocation: item.Headquarter?.location ?? null,
    statusId,
    statusName: item.Status?.name ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function mapWaiterPayloadToRequest(data: CreateWaiterRequest | UpdateWaiterRequest) {
  return {
    ...(data.firstname !== undefined ? { firstname: data.firstname } : {}),
    ...(data.lastname !== undefined ? { lastname: data.lastname } : {}),
    ...(data.email !== undefined ? { email: data.email || null } : {}),
    ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
    ...(data.identification !== undefined ? { identification: data.identification || null } : {}),
    ...(data.salary !== undefined ? { salary: data.salary } : {}),
    ...(data.hireDate !== undefined ? { hire_date: data.hireDate || null } : {}),
    ...(data.headquarterId !== undefined ? { headquarterId: data.headquarterId } : {}),
  };
}
