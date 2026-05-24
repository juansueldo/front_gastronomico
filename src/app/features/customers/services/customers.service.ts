import { apiClient } from '../../../core/http/client';
import { isApiError } from '../../../core/http/errors';
import { API_VERSION } from '../../../core/http/types';
import { mapCustomerDtoToLookup, mapCustomerDtoToModel } from '../mappers/customers.mapper';
import type { CreateCustomerRequest, CustomerDto, UpdateCustomerRequest } from '../types/customers.dto';
import type { Customer, CustomerListResult, CustomerLookupResult, ListCustomersParams } from '../types/customers.model';

function extractCustomerRows(payload: unknown): CustomerDto[] {
  if (Array.isArray(payload)) return payload as CustomerDto[];
  if (!payload || typeof payload !== 'object') return [];

  const candidate = payload as Record<string, unknown>;
  const rows = candidate.rows ?? candidate.customers ?? candidate.data;
  return Array.isArray(rows) ? rows as CustomerDto[] : [];
}

export async function findCustomerByPhone(phone: string): Promise<CustomerLookupResult | null> {
  try {
    const payload = await apiClient.get(`${API_VERSION}/customer/search`, {
      params: { phone },
      config: { cache: 'short' },
    });
    const data = (payload as { customer?: CustomerDto } | null)?.customer ?? payload;
    return data ? mapCustomerDtoToLookup(data as CustomerDto, phone) : null;
  } catch (error) {
    if (isApiError(error) && error.statusCode === 404) return null;
    throw error;
  }
}

export async function listCustomers(params: ListCustomersParams = {}): Promise<CustomerListResult> {
  const data = await apiClient.get(`${API_VERSION}/customer/datatable`, {
    params: {
      page: params.page,
      limit: params.limit,
      search: params.search,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    },
    config: { cache: 'none' },
  });

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const candidate = data as Record<string, unknown>;
    const total = Number(candidate.recordsFiltered ?? candidate.count ?? candidate.total);
    const rows = extractCustomerRows(data).map(mapCustomerDtoToModel);
    return { rows, total: Number.isFinite(total) ? total : rows.length };
  }

  const rows = extractCustomerRows(data).map(mapCustomerDtoToModel);
  return { rows, total: rows.length };
}

export async function getCustomer(customerId: string | number): Promise<Customer> {
  const data = await apiClient.get(`${API_VERSION}/customer/${customerId}`, {
    config: { cache: 'short' },
  });
  return mapCustomerDtoToModel(data as CustomerDto);
}

export async function createCustomer(payload: CreateCustomerRequest): Promise<Customer> {
  const data = await apiClient.post(`${API_VERSION}/customer`, payload);
  return mapCustomerDtoToModel(data as CustomerDto);
}

export async function updateCustomer(customerId: string | number, payload: UpdateCustomerRequest): Promise<Customer> {
  const data = await apiClient.patch(`${API_VERSION}/customer/${customerId}`, payload);
  return mapCustomerDtoToModel(data as CustomerDto);
}

export async function deleteCustomer(customerId: string | number): Promise<void> {
  await apiClient.delete(`${API_VERSION}/customer/${customerId}`);
}

export async function listCustomerOrders(customerId: string | number) {
  const data = await apiClient.get(`${API_VERSION}/customer/${customerId}/orders`, {
    config: { cache: 'short' },
  });
  return Array.isArray(data) ? data : (data as { rows?: unknown[]; data?: unknown[] })?.rows ?? (data as { data?: unknown[] })?.data ?? [];
}

export type { CreateCustomerRequest, Customer, CustomerListResult, CustomerLookupResult, ListCustomersParams, UpdateCustomerRequest };
