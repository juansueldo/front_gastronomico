import { apiClient } from '../../../core/http/client';
import { API_VERSION } from '../../../core/http/types';
import { getStorageItem } from '../../../shared/storage';
import { listHeadquarters } from '../../headquarters';
import {
  mapCashMovementDtoToModel,
  mapCashMovementRequestToDto,
} from '../mappers/cashRegister.mapper';
import type { CashMovementDto, CashRegisterSummaryDto, CreateCashMovementRequest } from '../types/cashRegister.dto';
import type { CashMovement, FetchCashMovementsOptions, ListCashMovementsParams } from '../types/cashRegister.model';

const CASH_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';

const extractMovementRows = (data: CashRegisterSummaryDto | CashMovementDto[] | unknown): CashMovementDto[] => {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];

  const candidate = data as CashRegisterSummaryDto;
  return candidate.movements ?? candidate.rows ?? candidate.data ?? [];
};

const resolveHeadquarterId = async (headquarterId?: string | number) => {
  if (headquarterId !== undefined && headquarterId !== null && String(headquarterId).trim() !== '') {
    return String(headquarterId);
  }

  const persistedHeadquarterId = getStorageItem(CASH_HEADQUARTER_STORAGE_KEY);
  if (persistedHeadquarterId?.trim()) return persistedHeadquarterId;

  const headquarters = await listHeadquarters({ page: 1, pageSize: 1 });
  const firstHeadquarter = headquarters.rows[0];
  if (!firstHeadquarter?.id) throw new Error('No hay sedes configuradas para registrar movimientos de caja');
  return String(firstHeadquarter.id);
};

const getMovementTimestamp = (movement: Pick<CashMovement, 'movementDate' | 'createdAt' | 'created_at'>): number | null => {
  const rawDate = movement.movementDate ?? movement.createdAt ?? movement.created_at;
  if (!rawDate) return null;

  const parsed = new Date(rawDate).getTime();
  return Number.isNaN(parsed) ? null : parsed;
};

export const filterMovementsSinceLastClosing = (movements: CashMovement[]): CashMovement[] => {
  const lastClosingTimestamp = movements.reduce<number | null>((latest, movement) => {
    if (movement.type !== 'closing') return latest;
    const timestamp = getMovementTimestamp(movement);
    if (timestamp === null) return latest;
    return latest === null || timestamp > latest ? timestamp : latest;
  }, null);

  if (lastClosingTimestamp === null) return movements;

  return movements.filter((movement) => {
    const timestamp = getMovementTimestamp(movement);
    return timestamp === null || timestamp > lastClosingTimestamp;
  });
};

const resolveDateRange = (date: string) => {
  const normalized = String(date ?? '').trim();
  if (!normalized) return { from: '', to: '' };

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return {
      from: `${normalized}T00:00:00.000`,
      to: `${normalized}T23:59:59.999`,
    };
  }

  return { from: normalized, to: normalized };
};

export async function fetchCashMovements(
  headquarterId?: string | number,
  options?: FetchCashMovementsOptions,
): Promise<CashMovement[]> {
  const resolvedHeadquarterId = await resolveHeadquarterId(headquarterId);
  const data = await apiClient.get(`${API_VERSION}/headquarter/${resolvedHeadquarterId}/cash-register`, {
    config: { cache: 'short' },
  });
  const movements = extractMovementRows(data).map(mapCashMovementDtoToModel);

  return options?.sinceLastClosing ? filterMovementsSinceLastClosing(movements) : movements;
}

export async function listCashMovements(params?: ListCashMovementsParams): Promise<CashMovement[]> {
  const resolvedHeadquarterId = await resolveHeadquarterId(params?.headquarterId);
  const data = await apiClient.get(`${API_VERSION}/headquarter/${resolvedHeadquarterId}/cash-register`, {
    params: {
      from: params?.from ?? '',
      to: params?.to ?? '',
      type: params?.type ?? '',
      limit: params?.limit ?? '',
    },
    config: { cache: 'short' },
  });

  return extractMovementRows(data).map(mapCashMovementDtoToModel);
}

export async function createCashMovement(movementData: CreateCashMovementRequest) {
  const resolvedHeadquarterId = await resolveHeadquarterId(movementData.headquarterId);
  return apiClient.post(
    `${API_VERSION}/headquarter/${resolvedHeadquarterId}/cash-register`,
    mapCashMovementRequestToDto(movementData),
  );
}

export async function closeDailyCashMovements(date: string, headquarterId?: string | number, amount = 0) {
  return createCashMovement({
    headquarterId,
    type: 'closing',
    amount,
    description: `Cierre de caja ${date}`,
    movementDate: date,
  });
}

export async function getFinalizedCashMovementsByDate(date: string, headquarterId?: string | number): Promise<CashMovement[]> {
  const { from, to } = resolveDateRange(date);
  return listCashMovements({ headquarterId, from, to });
}

export async function getCashMovementsByDate(date: string, headquarterId?: string | number): Promise<CashMovement[]> {
  return getFinalizedCashMovementsByDate(date, headquarterId);
}

export type {
  BackendCashMovementType,
  CreateCashMovementRequest,
  LegacyCashMovementType,
  PaymentMethod,
} from '../types/cashRegister.dto';
export type { CashMovement, FetchCashMovementsOptions, ListCashMovementsParams };
