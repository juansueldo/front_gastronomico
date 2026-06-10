import { getLoggedUser, type AuthUser } from '../../core/storage/authStorage';

type OrderNumberRecord = Record<string, unknown>;

const getNestedRecord = (value: unknown): OrderNumberRecord | null => (
  value && typeof value === 'object' ? value as OrderNumberRecord : null
);

const firstString = (record: OrderNumberRecord | null, keys: string[]) => {
  if (!record) return '';
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
};

const resolveStoreId = (record: OrderNumberRecord | null, user: AuthUser | null) => {
  const store = getNestedRecord(record?.Store ?? record?.store);
  const userStore = getNestedRecord(user?.store);
  return firstString(record, ['storeId', 'store_id'])
    || firstString(store, ['id', 'storeId', 'store_id'])
    || String(user?.storeId ?? '').trim()
    || firstString(userStore, ['id', 'storeId', 'store_id']);
};

const resolveStoreSlug = (record: OrderNumberRecord | null, user: AuthUser | null) => {
  const store = getNestedRecord(record?.Store ?? record?.store);
  const userStore = getNestedRecord(user?.store);
  return firstString(record, ['storeSlug', 'store_slug', 'slug'])
    || firstString(store, ['slug', 'slug_url', 'slugUrl'])
    || firstString(user as OrderNumberRecord | null, ['storeSlug', 'store_slug', 'slug'])
    || firstString(userStore, ['slug', 'slug_url', 'slugUrl']);
};

export const getRawOrderNumber = (order: unknown) => {
  const record = getNestedRecord(order);
  if (!record) return String(order ?? '').trim();
  return firstString(record, ['orderNumber', 'order_number', 'number', 'id']);
};

export const getStoreOrderPrefix = (order?: unknown) => {
  const record = getNestedRecord(order);
  const user = getLoggedUser() as AuthUser | null;
  const slug = resolveStoreSlug(record, user);
  const storeId = resolveStoreId(record, user);
  const slugPrefix = slug.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();

  if (!slugPrefix || !storeId) return '';
  return `${slugPrefix}-${storeId}`;
};

export const formatOrderNumber = (order: unknown, fallback = 'SIN-ID') => {
  const rawNumber = getRawOrderNumber(order) || fallback;
  const prefix = getStoreOrderPrefix(order);
  if (!prefix) return rawNumber;

  const normalizedRaw = rawNumber.toUpperCase();
  const normalizedPrefix = prefix.toUpperCase();
  if (normalizedRaw === normalizedPrefix || normalizedRaw.startsWith(`${normalizedPrefix}-`)) {
    return rawNumber;
  }

  return `${prefix}-${rawNumber.replace(/^#+/, '')}`;
};
