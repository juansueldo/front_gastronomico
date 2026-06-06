import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../shared/ui/components/button';
import { Input } from '../../shared/ui/components/input';
import { Badge } from '../../shared/ui/components/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../shared/ui/components/select';
import { toast } from 'sonner';
import { getLoggedUser } from '../../core/storage/authStorage';
import {
  createOrder as createBackendOrder,
  type CreateOrderRequest,
} from '../../features/orders/services/orders.service';
import { ApiError } from '../../core/http/errors';
import {
  fetchDeliveryZones,
  type DeliveryZone,
  type DeliveryZonePoint,
} from '../../features/delivery-zones';
import {
  type ProductCategory,
  type ProductItem,
} from '../../features/products';
import { listHeadquarters, type Headquarter } from '../../features/headquarters';
import { findCustomerByPhone, listCustomerOrders } from '../../features/customers';
import { getStorageItem, setStorageItem } from '../../shared/storage';
import {
  reverseGeocodeCoordinates,
  searchAddressSuggestions,
  type AddressSearchContext,
  type AddressSuggestion,
} from '../../shared/services/geocoding.service';
import { ArrowRight, Check, MapPin, Minus, Phone, RotateCcw, Truck, Utensils } from 'lucide-react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type OrderType = 'delivery' | 'dine-in';
type Step = 'phone' | 'customer' | 'type' | 'address' | 'products' | 'confirm';
type ScheduleMode = 'asap' | 'scheduled';
type ScheduleSlotOption = {
  id: string;
  label: string;
  startDate: Date;
};
type ScheduleDayOption = {
  id: string;
  label: string;
  slots: ScheduleSlotOption[];
};

const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';
const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
let googleMapsScriptPromise: Promise<unknown> | null = null;

interface CustomerData {
  id?: number;
  name: string;
  phone: string;
  savedAddress?: SavedAddress;
  addresses?: SavedAddress[];
  deliveryAddresses?: SavedAddress[];
  orderHistory?: OrderHistoryItem[];
}

interface SavedAddress {
  street?: string;
  number?: string;
  locality?: string;
  crossStreets?: string;
  latitude?: number;
  longitude?: number;
  formatted: string;
}

interface OrderHistoryItem {
  id: string;
  date: string;
  total: string;
  items: string[];
  repeatItems?: RepeatOrderItem[];
}

interface RepeatOrderItem {
  productId?: string;
  name?: string;
  quantity: number;
}

interface DeliveryCoordinates {
  latitude: number;
  longitude: number;
}

type RawOrderAddress = {
  id?: string | number;
  delivery_address?: string;
  address?: string;
  delivery_latitude?: string | number | null;
  latitude?: string | number | null;
  delivery_longitude?: string | number | null;
  longitude?: string | number | null;
};

interface HeadquarterSchedule {
  dayOfWeek: string;
  openTime: string;
  closeTime: string;
  isClosed?: boolean;
}

interface RawHeadquarterSchedule {
  dayOfWeek?: string;
  day_of_week?: string;
  openTime?: string;
  open_time?: string;
  closeTime?: string;
  close_time?: string;
  isClosed?: boolean;
  is_closed?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (createdOrder?: unknown) => void | Promise<void>;
  availableProducts: ProductItem[];
  availableCategories: ProductCategory[];
  initialCustomer?: CustomerData | null;
  onMinimize?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const ORDER_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';
const getStoredHeadquarterId = () => getStorageItem(ORDER_HEADQUARTER_STORAGE_KEY);

function getNormalizedProductCategoryIds(product: ProductItem): string[] {
  const row = product as ProductItem & {
    categoryId?: string | number;
    category_id?: string | number;
    category_ids?: Array<string | number>;
    categories?: Array<{ id?: string | number; categoryId?: string | number }>;
  };

  const collected: Array<string | number> = [];

  if (Array.isArray(row.categoryIds)) collected.push(...row.categoryIds);
  if (Array.isArray(row.category_ids)) collected.push(...row.category_ids);
  if (row.categoryId !== undefined && row.categoryId !== null) collected.push(row.categoryId);
  if (row.category_id !== undefined && row.category_id !== null) collected.push(row.category_id);

  if (Array.isArray(row.categories)) {
    row.categories.forEach((category) => {
      const categoryRef = category?.id ?? category?.categoryId;
      if (categoryRef !== undefined && categoryRef !== null) {
        collected.push(categoryRef);
      }
    });
  }

  return [...new Set(collected.map((value) => String(value).trim()).filter(Boolean))];
}

const DAY_OF_WEEK_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_OF_WEEK_SHORT_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as const;

const buildDateWithTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map((value) => Number(value) || 0);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
};

const formatHourLabel = (date: Date) => (
  date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
);

const formatScheduleDayLabel = (date: Date) => {
  const dayLabel = DAY_OF_WEEK_SHORT_LABELS[date.getDay()];
  return `${dayLabel}-${date.getDate()}/${date.getMonth() + 1}`;
};

const formatDateForPayload = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const formatTimeForPayload = (date: Date) => (
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`
);

const formatLocalDateTimeForPayload = (date: Date) => (
  `${formatDateForPayload(date)}T${formatTimeForPayload(date)}`
);

const buildManualScheduleDate = (date: string, time: string) => {
  if (!date || !time) return null;
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const result = new Date(`${date}T${normalizedTime}`);
  return Number.isNaN(result.getTime()) ? null : result;
};

const formatManualScheduleLabel = (date: string, time: string) => {
  const scheduledDate = buildManualScheduleDate(date, time);
  if (!scheduledDate) return 'Sin horario seleccionado';
  return scheduledDate.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatPhoneDisplay = (value: string) => {
  const digits = onlyDigits(value).slice(0, 15);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
};

const buildFullPhone = (phoneValue: string) => onlyDigits(phoneValue).slice(0, 15);

const normalizeAddressLabel = (value?: string | null) => String(value ?? '').replace(/\s+/g, ' ').trim();

const parseLocationParts = (location?: string) => {
  const parts = String(location ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    city: parts[0],
    region: parts.length > 2 ? parts[parts.length - 2] : parts[1],
    country: parts.length > 0 ? parts[parts.length - 1] : undefined,
  };
};

const getCountryCodeFromCountry = (country?: string) => {
  const normalized = String(country ?? '').trim().toLowerCase();
  const map: Record<string, string> = {
    argentina: 'ar',
    uruguay: 'uy',
    paraguay: 'py',
    chile: 'cl',
    brasil: 'br',
    brazil: 'br',
    bolivia: 'bo',
  };
  return map[normalized];
};

const getHeadquarterSearchContext = (headquarter?: Headquarter): AddressSearchContext | undefined => {
  if (!headquarter) return undefined;
  const locationParts = parseLocationParts(headquarter.location);
  const latitude = Number(headquarter.latitude);
  const longitude = Number(headquarter.longitude);

  return {
    ...locationParts,
    countryCode: getCountryCodeFromCountry(locationParts.country),
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
};

const isPointInsidePolygon = (point: DeliveryCoordinates, polygon: DeliveryZonePoint[]) => {
  if (polygon.length < 3) return false;

  let inside = false;
  const pointLat = point.latitude;
  const pointLng = point.longitude;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const vertex = polygon[i];
    const previousVertex = polygon[j];
    const lat = Number(vertex.lat);
    const lng = Number(vertex.lng);
    const previousLat = Number(previousVertex.lat);
    const previousLng = Number(previousVertex.lng);

    if (![lat, lng, previousLat, previousLng].every(Number.isFinite)) continue;

    const crossesLatitude = (lat > pointLat) !== (previousLat > pointLat);
    const intersectionLng = ((previousLng - lng) * (pointLat - lat)) / (previousLat - lat) + lng;

    if (crossesLatitude && pointLng < intersectionLng) {
      inside = !inside;
    }
  }

  return inside;
};

const findDeliveryZoneForPoint = (point: DeliveryCoordinates, zones: DeliveryZone[]) => (
  zones.find((zone) => isPointInsidePolygon(point, zone.polygon))
);

const normalizeSavedAddress = (candidate?: Partial<SavedAddress> | null): SavedAddress | null => {
  const formatted = normalizeAddressLabel(candidate?.formatted);
  if (!formatted) return null;
  const latitude = Number(candidate?.latitude);
  const longitude = Number(candidate?.longitude);
  return {
    ...candidate,
    formatted,
    latitude: Number.isFinite(latitude) ? latitude : undefined,
    longitude: Number.isFinite(longitude) ? longitude : undefined,
  };
};

const extractSavedAddresses = (customer?: CustomerData | null, orderRows: RawOrderAddress[] = []) => {
  const candidates: Array<Partial<SavedAddress> | null | undefined> = [
    customer?.savedAddress,
    ...(Array.isArray(customer?.addresses) ? customer.addresses : []),
    ...(Array.isArray(customer?.deliveryAddresses) ? customer.deliveryAddresses : []),
    ...orderRows.map((order) => ({
      formatted: normalizeAddressLabel(order.delivery_address ?? order.address),
      latitude: order.delivery_latitude ?? order.latitude ?? undefined,
      longitude: order.delivery_longitude ?? order.longitude ?? undefined,
    })),
  ];

  const byKey = new Map<string, SavedAddress>();
  candidates.forEach((candidate) => {
    const address = normalizeSavedAddress(candidate);
    if (!address) return;
    const key = `${address.formatted.toLowerCase()}|${address.latitude ?? ''}|${address.longitude ?? ''}`;
    if (!byKey.has(key)) {
      byKey.set(key, address);
    }
  });

  return Array.from(byKey.values());
};

const getRecord = (value: unknown): Record<string, any> => (
  value && typeof value === 'object' ? value as Record<string, any> : {}
);

const getFirstValue = (record: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
};

const normalizeProductNameKey = (value?: string) => (
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
);

const parseDisplayOrderItem = (value: string): RepeatOrderItem | null => {
  const text = value.trim();
  if (!text) return null;
  const quantityMatch = text.match(/^(\d+(?:[.,]\d+)?)x\s+(.+)$/i);
  if (!quantityMatch) return { name: text, quantity: 1 };

  const quantity = Number(quantityMatch[1].replace(',', '.'));
  const name = quantityMatch[2].trim();
  return {
    name,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
};

const formatHistoryDate = (value: unknown) => {
  const date = new Date(String(value ?? ''));
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-AR');
};

const normalizeOrderHistoryItems = (order: Record<string, any>): RepeatOrderItem[] => {
  const rows = getFirstValue(order, ['OrderItems', 'orderItems', 'order_items', 'items', 'products']);
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => {
      if (typeof row === 'string') {
        const name = row.trim();
        return name ? { name, quantity: 1 } : null;
      }

      const item = getRecord(row);
      const product = getRecord(getFirstValue(item, ['Product', 'product']));
      const productId = String(getFirstValue(item, [
        'productId',
        'product_id',
        'ProductId',
        'productID',
      ]) ?? getFirstValue(product, ['id', 'productId', 'product_id']) ?? '').trim();
      const name = String(getFirstValue(item, ['name', 'productName', 'product_name']) ?? getFirstValue(product, ['name']) ?? '').trim();
      const quantity = Number(getFirstValue(item, ['quantity', 'qty', 'count', 'amount']) ?? 1);

      if (!productId && !name) return null;

      return {
        productId: productId || undefined,
        name: name || undefined,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      };
    })
    .filter((item: RepeatOrderItem | null): item is RepeatOrderItem => item !== null);
};

const normalizeCustomerOrders = (orders: unknown[], fallbackOrders: OrderHistoryItem[] = []): OrderHistoryItem[] => {
  const normalized = orders
    .map((orderRow, index) => {
      const order = getRecord(orderRow);
      const repeatItems = normalizeOrderHistoryItems(order);
      const total = Number(getFirstValue(order, ['total_amount', 'totalAmount', 'total', 'amount']) ?? 0);
      const explicitItems = getFirstValue(order, ['itemNames', 'itemsText']);
      const displayItems = repeatItems.length > 0
        ? repeatItems.map((item) => `${item.quantity}x ${item.name ?? `Producto ${item.productId}`}`)
        : Array.isArray(explicitItems)
          ? explicitItems.map((item) => String(item).trim()).filter(Boolean)
          : [];

      return {
        id: String(getFirstValue(order, ['id', 'orderId', 'order_id']) ?? `historial-${index}`),
        date: formatHistoryDate(getFirstValue(order, ['createdAt', 'created_at', 'date', 'orderDate', 'order_date'])),
        total: currencyFormatter.format(Number.isFinite(total) ? total : 0),
        items: displayItems,
        repeatItems,
      };
    })
    .filter((order) => order.items.length > 0 || (order.repeatItems?.length ?? 0) > 0);

  return normalized.length > 0 ? normalized : fallbackOrders;
};

const loadGoogleMapsScript = (apiKey: string) => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps no disponible en servidor'));
  }

  const windowWithGoogle = window as Window & { google?: unknown };
  if (windowWithGoogle.google) return Promise.resolve(windowWithGoogle.google);
  if (googleMapsScriptPromise) return googleMapsScriptPromise;

  googleMapsScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(windowWithGoogle.google);
    script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
    document.head.appendChild(script);
  });

  return googleMapsScriptPromise;
};

const buildScheduleState = (schedules: HeadquarterSchedule[] | undefined, now: Date) => {
  if (!schedules || schedules.length === 0) {
    return {
      hasSchedules: false,
      dayOptions: [] as ScheduleDayOption[],
    };
  }

  const validSchedules = schedules.filter((schedule) => !schedule.isClosed);
  if (validSchedules.length === 0) {
    return {
      hasSchedules: false,
      dayOptions: [] as ScheduleDayOption[],
    };
  }

  const dayOptions: ScheduleDayOption[] = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    const dayKey = DAY_OF_WEEK_KEYS[date.getDay()];
    const daySchedules = validSchedules.filter((schedule) => schedule.dayOfWeek === dayKey);
    const daySlots: ScheduleSlotOption[] = [];

    daySchedules.forEach((schedule) => {
      const openDate = buildDateWithTime(date, schedule.openTime);
      const closeDate = buildDateWithTime(date, schedule.closeTime);
      if (closeDate <= openDate) {
        closeDate.setDate(closeDate.getDate() + 1);
      }

      let slot = new Date(openDate);
      while (slot < closeDate) {
        const slotEnd = new Date(Math.min(slot.getTime() + 30 * 60 * 1000, closeDate.getTime()));
        if (slotEnd > now) {
          daySlots.push({
            id: `${dayKey}-${slot.toISOString()}`,
            label: `${formatHourLabel(slot)} - ${formatHourLabel(slotEnd)}`,
            startDate: new Date(slot),
          });
        }

        slot = new Date(slot.getTime() + 30 * 60 * 1000);
      }
    });

    if (daySlots.length > 0) {
      dayOptions.push({
        id: `day:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        label: formatScheduleDayLabel(date),
        slots: daySlots,
      });
    }
  }

  return {
    hasSchedules: true,
    dayOptions,
  };
};

const normalizeHeadquarterSchedules = (input: unknown): HeadquarterSchedule[] => {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      const schedule = item as RawHeadquarterSchedule;
      const dayOfWeek = String(schedule.dayOfWeek ?? schedule.day_of_week ?? '').trim().toLowerCase();
      const openTime = String(schedule.openTime ?? schedule.open_time ?? '').trim();
      const closeTime = String(schedule.closeTime ?? schedule.close_time ?? '').trim();
      if (!dayOfWeek || !openTime || !closeTime) {
        return null;
      }

      return {
        dayOfWeek,
        openTime,
        closeTime,
        isClosed: Boolean(schedule.isClosed ?? schedule.is_closed ?? false),
      };
    })
    .filter((schedule): schedule is HeadquarterSchedule => schedule !== null);
};

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function StepIndicator({ current, steps }: { current: Step; steps: Step[] }) {
  const idx = steps.indexOf(current);
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center">
          <div
            className={`h-1.5 w-10 rounded-full transition-all duration-300 ${
              i <= idx ? 'bg-[var(--primary)]' : 'bg-[var(--app-line)]'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-sm font-semibold text-[var(--app-strong)]">{children}</p>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-xl font-bold leading-tight text-[var(--app-strong)]">{children}</p>;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function CreateOrderDialog({ open, onClose, onCreated, availableProducts, availableCategories, initialCustomer = null, onMinimize }: Props) {
  // Paso actual
  const [step, setStep] = useState<Step>('phone');

  // Paso 1 — Teléfono
  const [phone, setPhone] = useState('');
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [customerFound, setCustomerFound] = useState<CustomerData | null>(null);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  // Paso 2 — Datos del cliente (si es nuevo)
  const [newCustomerName, setNewCustomerName] = useState('');

  // Paso 3 — Tipo de orden
  const [orderType, setOrderType] = useState<OrderType>('delivery');

  // Paso 4 — Dirección delivery
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryAddressSuggestions, setDeliveryAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showDeliveryAddressSuggestions, setShowDeliveryAddressSuggestions] = useState(false);
  const [isLoadingDeliveryAddressSuggestions, setIsLoadingDeliveryAddressSuggestions] = useState(false);
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<DeliveryCoordinates | null>(null);
  const [selectedDeliveryAddressLabel, setSelectedDeliveryAddressLabel] = useState('');
  const [savedCustomerAddresses, setSavedCustomerAddresses] = useState<SavedAddress[]>([]);
  const [previousCustomerOrders, setPreviousCustomerOrders] = useState<OrderHistoryItem[]>([]);
  const [isLoadingPreviousOrders, setIsLoadingPreviousOrders] = useState(false);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [isLoadingDeliveryZones, setIsLoadingDeliveryZones] = useState(false);
  const [deliveryZoneCheck, setDeliveryZoneCheck] = useState<{ inside: boolean; hasZone: boolean } | null>(null);
  const [deliveryMapError, setDeliveryMapError] = useState<string | null>(null);

  // Paso 5 — Productos
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Misc
  const [newOrderUserId, setNewOrderUserId] = useState('');
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState(() => getStoredHeadquarterId());
  const [autoDeliveryHeadquarterId, setAutoDeliveryHeadquarterId] = useState('');
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('asap');
  const [selectedScheduleDayId, setSelectedScheduleDayId] = useState('');
  const [selectedScheduleSlotId, setSelectedScheduleSlotId] = useState('');
  const [manualScheduleDate, setManualScheduleDate] = useState('');
  const [manualScheduleTime, setManualScheduleTime] = useState('');
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const [newOrderTableId, setNewOrderTableId] = useState('');
  const [newOrderWaiterId, setNewOrderWaiterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deliverySuggestAbortRef = useRef<AbortController | null>(null);
  const deliveryMapRef = useRef<HTMLDivElement | null>(null);
  const deliveryMapInstanceRef = useRef<any>(null);
  const deliveryMarkerRef = useRef<any>(null);
  const deliveryMapClickListenerRef = useRef<any>(null);
  const deliveryZonePolygonRefs = useRef<any[]>([]);
  const deliveryReverseAbortRef = useRef<AbortController | null>(null);

  const STEPS: Step[] = ['phone', 'customer', 'type', 'address', 'products', 'confirm'];
  const STEPS_DINE_IN: Step[] = ['phone', 'customer', 'type', 'products', 'confirm'];

  const activeSteps = orderType === 'delivery' ? STEPS : STEPS_DINE_IN;
  const selectedHeadquarter = headquarters.find((headquarter) => String(headquarter.id) === selectedHeadquarterId);
  const autoDeliveryHeadquarter = headquarters.find((headquarter) => String(headquarter.id) === autoDeliveryHeadquarterId);
  const orderHeadquarter = orderType === 'delivery' ? autoDeliveryHeadquarter : selectedHeadquarter;
  const deliverySearchHeadquarter = selectedHeadquarter
    ?? headquarters.find((headquarter) => {
      const latitude = Number(headquarter.latitude);
      const longitude = Number(headquarter.longitude);
      return Number.isFinite(latitude) && Number.isFinite(longitude);
    })
    ?? headquarters[0];
  const addressSearchContext = useMemo(
    () => getHeadquarterSearchContext(deliverySearchHeadquarter),
    [deliverySearchHeadquarter],
  );
  const fullPhone = buildFullPhone(phone);
  const scheduleState = useMemo(
    () => buildScheduleState(normalizeHeadquarterSchedules(orderHeadquarter?.schedules), scheduleNow),
    [orderHeadquarter?.schedules, scheduleNow],
  );
  const availableScheduleDays = scheduleState.dayOptions;
  const selectedScheduleDay = availableScheduleDays.find((day) => day.id === selectedScheduleDayId) ?? availableScheduleDays[0];
  const selectedScheduleSlot = selectedScheduleDay?.slots.find((slot) => slot.id === selectedScheduleSlotId) ?? selectedScheduleDay?.slots[0];

  const resetDeliveryMap = () => {
    deliveryMapClickListenerRef.current?.remove?.();
    deliveryMapClickListenerRef.current = null;
    deliveryMarkerRef.current?.setMap?.(null);
    deliveryMarkerRef.current = null;
    deliveryZonePolygonRefs.current.forEach((polygon) => polygon.setMap?.(null));
    deliveryZonePolygonRefs.current = [];
    deliveryMapInstanceRef.current = null;
  };

  const applyDeliveryPointFromMap = (coordinates: DeliveryCoordinates) => {
    const fallbackAddress = `Ubicación seleccionada en mapa (${coordinates.latitude.toFixed(5)}, ${coordinates.longitude.toFixed(5)})`;
    setDeliveryCoordinates(coordinates);
    setDeliveryAddress(fallbackAddress);
    setSelectedDeliveryAddressLabel(fallbackAddress);
    setShowDeliveryAddressSuggestions(false);
    setDeliveryAddressSuggestions([]);

    deliveryReverseAbortRef.current?.abort();
    const abortController = new AbortController();
    deliveryReverseAbortRef.current = abortController;

    void reverseGeocodeCoordinates(coordinates.latitude, coordinates.longitude, abortController.signal)
      .then((result) => {
        if (abortController.signal.aborted) return;
        const formattedAddress = result?.formattedAddress?.trim();
        if (!formattedAddress) return;
        setDeliveryAddress(formattedAddress);
        setSelectedDeliveryAddressLabel(formattedAddress);
      })
      .catch(() => undefined)
      .finally(() => {
        if (deliveryReverseAbortRef.current === abortController) {
          deliveryReverseAbortRef.current = null;
        }
      });
  };

  // ── Efectos ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const loggedUser = getLoggedUser();
    if (loggedUser?.id) setNewOrderUserId(String(loggedUser.id));
    const userHeadquarterId = Number(loggedUser?.headquarterId);
    if (Number.isInteger(userHeadquarterId) && userHeadquarterId > 0) {
      setSelectedHeadquarterId(String(userHeadquarterId));
    }
  }, [open]);

  useEffect(() => {
    if (open && step === 'address' && orderType === 'delivery') return;
    resetDeliveryMap();
  }, [open, orderType, step]);

  useEffect(() => {
    if (!open || !initialCustomer) return;

    setCustomerFound(initialCustomer);
    setCustomerNotFound(false);
    setPhone(onlyDigits(initialCustomer.phone));
    setSavedCustomerAddresses(extractSavedAddresses(initialCustomer));
    setPreviousCustomerOrders(initialCustomer.orderHistory ?? []);
    setStep('type');

    if (initialCustomer.savedAddress) {
      setDeliveryAddress(initialCustomer.savedAddress.formatted ?? '');
      if (
        Number.isFinite(initialCustomer.savedAddress.latitude)
        && Number.isFinite(initialCustomer.savedAddress.longitude)
      ) {
        setDeliveryCoordinates({
          latitude: Number(initialCustomer.savedAddress.latitude),
          longitude: Number(initialCustomer.savedAddress.longitude),
        });
      }
    }
  }, [initialCustomer, open]);

  useEffect(() => {
    if (!open || !initialCustomer?.id) return;

    let cancelled = false;
    setIsLoadingPreviousOrders(true);
    void listCustomerOrders(initialCustomer.id)
      .then((orders) => {
        if (cancelled) return;
        const normalizedOrders = normalizeCustomerOrders(
          Array.isArray(orders) ? orders : [],
          initialCustomer.orderHistory ?? [],
        );
        setPreviousCustomerOrders(normalizedOrders);
        setCustomerFound((current) => current && current.id === initialCustomer.id
          ? { ...current, orderHistory: normalizedOrders }
          : current);
        setSavedCustomerAddresses(extractSavedAddresses(
          initialCustomer,
          Array.isArray(orders) ? orders as RawOrderAddress[] : [],
        ));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsLoadingPreviousOrders(false);
      });

    return () => {
      cancelled = true;
    };
  }, [initialCustomer, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const loadHeadquarters = async () => {
      setIsLoadingHeadquarters(true);
      try {
        const result = await listHeadquarters({ page: 1, pageSize: 100 });
        const rows = result.rows ?? [];
        setHeadquarters(rows);

        if (rows.length === 0) {
          setSelectedHeadquarterId('');
          return;
        }

        const userHeadquarterId = Number(getLoggedUser()?.headquarterId);
        const userHeadquarterAsText = Number.isInteger(userHeadquarterId) && userHeadquarterId > 0
          ? String(userHeadquarterId)
          : '';
        const storedHeadquarterId = getStoredHeadquarterId();
        const currentIsValid = selectedHeadquarterId && rows.some((item) => String(item.id) === selectedHeadquarterId);
        const userIsValid = userHeadquarterAsText && rows.some((item) => String(item.id) === userHeadquarterAsText);
        const storedIsValid = storedHeadquarterId && rows.some((item) => String(item.id) === storedHeadquarterId);

        const initialHeadquarterId = currentIsValid
          ? selectedHeadquarterId
          : userIsValid
            ? userHeadquarterAsText
            : storedIsValid
              ? storedHeadquarterId
              : String(rows[0].id);

        setSelectedHeadquarterId(initialHeadquarterId);
      } catch {
        toast.error('No se pudieron cargar las sedes');
      } finally {
        setIsLoadingHeadquarters(false);
      }
    };

    void loadHeadquarters();
  }, [open]);

  useEffect(() => {
    if (selectedHeadquarterId) {
      setStorageItem(ORDER_HEADQUARTER_STORAGE_KEY, selectedHeadquarterId);
    }
  }, [selectedHeadquarterId]);

  useEffect(() => {
    if (!open || orderType !== 'delivery') {
      setDeliveryZones([]);
      return;
    }

    let cancelled = false;
    const loadZones = async () => {
      setIsLoadingDeliveryZones(true);
      try {
        const zones = await fetchDeliveryZones();
        if (cancelled) return;
        setDeliveryZones(zones.filter((zone) => (
          zone.active !== false
          && Number(zone.statusId ?? 1) === 1
          && zone.polygon.length >= 3
        )));
      } catch {
        if (!cancelled) setDeliveryZones([]);
      } finally {
        if (!cancelled) setIsLoadingDeliveryZones(false);
      }
    };

    void loadZones();
    return () => { cancelled = true; };
  }, [open, orderType]);

  useEffect(() => {
    if (!deliveryCoordinates || orderType !== 'delivery') {
      setDeliveryZoneCheck(null);
      setAutoDeliveryHeadquarterId('');
      return;
    }

    const matchedZone = findDeliveryZoneForPoint(deliveryCoordinates, deliveryZones);
    const matchedHeadquarterId = Number(matchedZone?.headquarterId);
    if (Number.isInteger(matchedHeadquarterId) && matchedHeadquarterId > 0) {
      setAutoDeliveryHeadquarterId(String(matchedHeadquarterId));
    } else {
      setAutoDeliveryHeadquarterId('');
    }

    setDeliveryZoneCheck({
      inside: Boolean(matchedZone),
      hasZone: deliveryZones.length > 0,
    });
  }, [deliveryCoordinates, deliveryZones, orderType]);

  useEffect(() => {
    if (!open || step !== 'address' || orderType !== 'delivery' || !deliveryMapRef.current || !GOOGLE_MAPS_API_KEY) {
      return;
    }

    let cancelled = false;
    const renderMap = async () => {
      try {
        const google = await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY) as any;
        if (cancelled || !deliveryMapRef.current) return;
        setDeliveryMapError(null);

        const headquarterLat = Number(deliverySearchHeadquarter?.latitude);
        const headquarterLng = Number(deliverySearchHeadquarter?.longitude);
        const center = deliveryCoordinates
          ? { lat: deliveryCoordinates.latitude, lng: deliveryCoordinates.longitude }
          : Number.isFinite(headquarterLat) && Number.isFinite(headquarterLng)
            ? { lat: headquarterLat, lng: headquarterLng }
            : { lat: -34.603722, lng: -58.381592 };

        if (!deliveryMapInstanceRef.current) {
          deliveryMapInstanceRef.current = new google.maps.Map(deliveryMapRef.current, {
            center,
            zoom: deliveryCoordinates ? 15 : 12,
            disableDefaultUI: true,
            zoomControl: true,
          });
        } else {
          deliveryMapInstanceRef.current.setCenter(center);
          if (deliveryCoordinates) deliveryMapInstanceRef.current.setZoom(15);
        }

        if (deliveryMapClickListenerRef.current) {
          google.maps.event.removeListener(deliveryMapClickListenerRef.current);
        }
        deliveryMapClickListenerRef.current = deliveryMapInstanceRef.current.addListener('click', (event: any) => {
          const lat = event?.latLng?.lat?.();
          const lng = event?.latLng?.lng?.();
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          applyDeliveryPointFromMap({ latitude: lat, longitude: lng });
        });

        deliveryZonePolygonRefs.current.forEach((polygon) => polygon.setMap(null));
        deliveryZonePolygonRefs.current = deliveryZones.map((zone) => new google.maps.Polygon({
          paths: zone.polygon,
          map: deliveryMapInstanceRef.current,
          strokeColor: '#22c55e',
          strokeOpacity: 0.95,
          strokeWeight: 2,
          fillColor: '#22c55e',
          fillOpacity: 0.12,
          clickable: false,
        }));

        if (deliveryCoordinates) {
          const markerPosition = { lat: deliveryCoordinates.latitude, lng: deliveryCoordinates.longitude };
          if (!deliveryMarkerRef.current) {
            deliveryMarkerRef.current = new google.maps.Marker({
              position: markerPosition,
              map: deliveryMapInstanceRef.current,
              draggable: true,
              title: 'Punto de entrega',
            });
            deliveryMarkerRef.current.addListener('dragend', (event: any) => {
              const lat = event?.latLng?.lat?.();
              const lng = event?.latLng?.lng?.();
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              applyDeliveryPointFromMap({ latitude: lat, longitude: lng });
            });
          } else {
            deliveryMarkerRef.current.setMap(deliveryMapInstanceRef.current);
            deliveryMarkerRef.current.setPosition(markerPosition);
          }
        } else if (deliveryMarkerRef.current) {
          deliveryMarkerRef.current.setMap(null);
        }
      } catch {
        setDeliveryMapError('No se pudo cargar el mapa');
      }
    };

    void renderMap();
    return () => { cancelled = true; };
  }, [deliveryCoordinates, deliveryZones, deliverySearchHeadquarter?.latitude, deliverySearchHeadquarter?.longitude, open, orderType, step]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setScheduleNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (availableScheduleDays.length === 0) {
      if (selectedScheduleDayId) setSelectedScheduleDayId('');
      if (selectedScheduleSlotId) setSelectedScheduleSlotId('');
      return;
    }

    if (!selectedScheduleDay || selectedScheduleDay.id !== selectedScheduleDayId) {
      setSelectedScheduleDayId(selectedScheduleDay?.id ?? '');
    }
  }, [availableScheduleDays, selectedScheduleDay, selectedScheduleDayId, selectedScheduleSlotId]);

  useEffect(() => {
    if (!selectedScheduleDay) {
      if (selectedScheduleSlotId) {
        setSelectedScheduleSlotId('');
      }
      return;
    }

    const currentSlotExists = selectedScheduleDay.slots.some((slot) => slot.id === selectedScheduleSlotId);
    if (!currentSlotExists) {
      setSelectedScheduleSlotId(selectedScheduleDay.slots[0]?.id ?? '');
    }
  }, [selectedScheduleDay, selectedScheduleSlotId]);

  useEffect(() => {
    if (orderType !== 'delivery') {
      setDeliveryAddressSuggestions([]);
      setShowDeliveryAddressSuggestions(false);
      setIsLoadingDeliveryAddressSuggestions(false);
      return;
    }

    const query = deliveryAddress.trim();
    if (query.length < 4 || (deliveryCoordinates && query === selectedDeliveryAddressLabel)) {
      setDeliveryAddressSuggestions([]);
      setShowDeliveryAddressSuggestions(false);
      setIsLoadingDeliveryAddressSuggestions(false);
      return;
    }

    setIsLoadingDeliveryAddressSuggestions(true);
    const timeoutId = window.setTimeout(() => {
      deliverySuggestAbortRef.current?.abort();
      const abortController = new AbortController();
      deliverySuggestAbortRef.current = abortController;

      void searchAddressSuggestions(query, abortController.signal, addressSearchContext)
        .then((suggestions) => {
          setDeliveryAddressSuggestions(suggestions);
          setShowDeliveryAddressSuggestions(suggestions.length > 0);
        })
        .catch((error) => {
          if ((error as { name?: string })?.name !== 'AbortError') {
            setDeliveryAddressSuggestions([]);
            setShowDeliveryAddressSuggestions(false);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsLoadingDeliveryAddressSuggestions(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deliveryAddress, deliveryCoordinates, selectedDeliveryAddressLabel, orderType, addressSearchContext]);

  // ── Búsqueda de cliente por teléfono ─────────────────────────────────────────

  const searchCustomer = async () => {
    const trimmed = fullPhone.trim();
    if (!trimmed) return;

    setIsSearchingCustomer(true);
    setCustomerFound(null);
    setCustomerNotFound(false);
    setPreviousCustomerOrders([]);
    setIsLoadingPreviousOrders(false);

    try {
      const result = await findCustomerByPhone(trimmed);

      if (result) {
        setCustomerFound(result);
        let savedAddresses = extractSavedAddresses(result);
        let normalizedOrders = result.orderHistory ?? [];
        if (result.id) {
          try {
            setIsLoadingPreviousOrders(true);
            const orders = await listCustomerOrders(result.id);
            normalizedOrders = normalizeCustomerOrders(Array.isArray(orders) ? orders : [], result.orderHistory ?? []);
            savedAddresses = extractSavedAddresses(result, Array.isArray(orders) ? orders as RawOrderAddress[] : []);
          } catch {
            savedAddresses = extractSavedAddresses(result);
          } finally {
            setIsLoadingPreviousOrders(false);
          }
        }
        setCustomerFound({ ...result, orderHistory: normalizedOrders });
        setPreviousCustomerOrders(normalizedOrders);
        setSavedCustomerAddresses(savedAddresses);
        // Precargar dirección si el cliente la tiene guardada
        const defaultAddress = savedAddresses[0] ?? result.savedAddress;
        if (defaultAddress) {
          setDeliveryAddress(defaultAddress.formatted ?? '');
          setSelectedDeliveryAddressLabel(defaultAddress.formatted ?? '');
          if (
            Number.isFinite(defaultAddress.latitude)
            && Number.isFinite(defaultAddress.longitude)
          ) {
            setDeliveryCoordinates({
              latitude: Number(defaultAddress.latitude),
              longitude: Number(defaultAddress.longitude),
            });
          }
        }
        setStep('type');
      } else {
        setCustomerNotFound(true);
        setStep('customer');
      }
    } catch {
      setCustomerNotFound(true);
      setStep('customer');
    } finally {
      setIsSearchingCustomer(false);
    }
  };

  // ── Navegación ────────────────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 'address' && orderType === 'delivery' && !deliveryCoordinates) {
      toast.error('Seleccioná una ubicación desde las sugerencias o marcala en el mapa.');
      return;
    }

    const idx = activeSteps.indexOf(step);
    if (idx < activeSteps.length - 1) setStep(activeSteps[idx + 1]);
  };

  const goBack = () => {
    const idx = activeSteps.indexOf(step);
    if (idx > 0) setStep(activeSteps[idx - 1]);
  };

  // ── Productos ─────────────────────────────────────────────────────────────────

  const increment = (id: string) =>
    setSelectedQuantities((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));

  const decrement = (id: string) =>
    setSelectedQuantities((prev) => {
      const q = prev[id] ?? 0;
      if (q <= 1) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: q - 1 };
    });

  const repeatPreviousOrder = (order: OrderHistoryItem) => {
    const quantities: Record<string, number> = {};
    const missingItems: string[] = [];

    const repeatItems = (order.repeatItems && order.repeatItems.length > 0)
      ? order.repeatItems
      : order.items.map(parseDisplayOrderItem).filter((item): item is RepeatOrderItem => item !== null);

    repeatItems.forEach((item) => {
      const product = item.productId
        ? availableProducts.find((candidate) => String(candidate.id) === String(item.productId))
        : availableProducts.find((candidate) => normalizeProductNameKey(candidate.name) === normalizeProductNameKey(item.name));

      if (!product) {
        missingItems.push(item.name ?? `Producto ${item.productId ?? ''}`.trim());
        return;
      }

      quantities[product.id] = (quantities[product.id] ?? 0) + item.quantity;
    });

    if (Object.keys(quantities).length === 0) {
      toast.error('No se pudieron encontrar los productos de ese pedido en el catálogo actual.');
      return;
    }

    setSelectedQuantities(quantities);
    setProductFilter('');
    setCategoryFilter('all');
    setStep('products');
    toast.success(missingItems.length > 0
      ? 'Pedido repetido parcialmente; algunos productos ya no están disponibles.'
      : 'Pedido anterior cargado.');
  };

  const selectedItems = availableProducts
    .map((p) => ({ ...p, quantity: selectedQuantities[p.id] ?? 0 }))
    .filter((p) => p.quantity > 0);

  const totalAmount = selectedItems.reduce((acc, p) => acc + p.price * p.quantity, 0);
  const effectiveDeliveryAddress = orderType === 'delivery'
    ? deliveryAddress.trim() || (deliveryCoordinates ? 'Ubicación seleccionada en mapa' : '')
    : '';

  const filteredProducts = availableProducts.filter((p) => {
    const q = productFilter.trim().toLowerCase();
    const matchName = !q || p.name.toLowerCase().includes(q);
    const productCategoryIds = getNormalizedProductCategoryIds(p);
    const matchCat = categoryFilter === 'all' || productCategoryIds.includes(categoryFilter);
    return matchName && matchCat;
  });

  // ── Submit ────────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    const userId = Number(newOrderUserId);
    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error('User ID inválido');
      return;
    }

    if (selectedItems.length === 0) {
      toast.error('Seleccioná al menos un producto');
      return;
    }

    const parsedHeadquarterId = Number(orderType === 'delivery' ? autoDeliveryHeadquarterId : selectedHeadquarterId);
    const resolvedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
      ? parsedHeadquarterId
      : null;

    if (orderType === 'dine-in' && !resolvedHeadquarterId) {
      toast.error('Seleccioná una sede para el pedido de salón');
      return;
    }

    const loggedUser = getLoggedUser();
    const storeId = Number(loggedUser?.storeId);

    if (orderType === 'delivery' && !deliveryCoordinates) {
      toast.error('Seleccioná una ubicación desde las sugerencias o marcala en el mapa.');
      return;
    }

    const isAsapSchedule = scheduleMode === 'asap';
    const manualScheduledDate = !isAsapSchedule ? buildManualScheduleDate(manualScheduleDate, manualScheduleTime) : null;
    const scheduledSlotDate = !isAsapSchedule
      ? selectedScheduleSlot?.startDate ?? manualScheduledDate ?? undefined
      : undefined;
    if (!isAsapSchedule && !scheduledSlotDate) {
      toast.error('Seleccioná un horario válido para el pedido');
      return;
    }

    if (scheduledSlotDate && scheduledSlotDate <= new Date()) {
      toast.error('El horario programado debe ser posterior al momento actual');
      return;
    }

    const scheduledDate = scheduledSlotDate ? formatDateForPayload(scheduledSlotDate) : undefined;
    const scheduledTime = scheduledSlotDate ? formatTimeForPayload(scheduledSlotDate) : undefined;

    const payload: CreateOrderRequest = {
      storeId,
      headquarterId: resolvedHeadquarterId ?? undefined,
      customerId: customerFound?.id,
      customerName: !customerFound?.id ? newCustomerName.trim() : undefined,
      customerPhone: !customerFound?.id ? fullPhone : undefined,
      userId,
      type: orderType,
      items: selectedItems.map((p) => ({ productId: p.id, quantity: p.quantity })),
      delivery_address: orderType === 'delivery' ? effectiveDeliveryAddress : undefined,
      delivery_latitude: orderType === 'delivery' ? deliveryCoordinates.latitude : undefined,
      delivery_longitude: orderType === 'delivery' ? deliveryCoordinates.longitude : undefined,
      delivery_date: orderType === 'delivery' && scheduledSlotDate ? formatLocalDateTimeForPayload(scheduledSlotDate) : undefined,
      scheduled_for: scheduledSlotDate ? formatLocalDateTimeForPayload(scheduledSlotDate) : undefined,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      is_asap: isAsapSchedule,
      tableId: orderType === 'dine-in' && newOrderTableId ? Number(newOrderTableId) : undefined,
      waiterId: newOrderWaiterId ? Number(newOrderWaiterId) : undefined,
    };

    setIsSubmitting(true);
    try {
      const createdOrder = await createBackendOrder(payload);
      toast.success('Orden creada correctamente');
      handleClose();
      void Promise.resolve(onCreated(createdOrder)).catch(() => undefined);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reset & Close ─────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('phone');
    setPhone('');
    setCustomerFound(null);
    setCustomerNotFound(false);
    setSavedCustomerAddresses([]);
    setPreviousCustomerOrders([]);
    setIsLoadingPreviousOrders(false);
    setNewCustomerName('');
    setOrderType('delivery');
    setDeliveryAddress('');
    setSelectedDeliveryAddressLabel('');
    setDeliveryAddressSuggestions([]);
    setShowDeliveryAddressSuggestions(false);
    setIsLoadingDeliveryAddressSuggestions(false);
    setDeliveryCoordinates(null);
    setDeliveryZones([]);
    setDeliveryZoneCheck(null);
    setDeliveryMapError(null);
    setAutoDeliveryHeadquarterId('');
    deliveryReverseAbortRef.current?.abort();
    deliveryReverseAbortRef.current = null;
    resetDeliveryMap();
    setScheduleMode('asap');
    setSelectedScheduleDayId('');
    setSelectedScheduleSlotId('');
    setManualScheduleDate('');
    setManualScheduleTime('');
    setScheduleNow(new Date());
    setSelectedQuantities({});
    setProductFilter('');
    setCategoryFilter('all');
    setNewOrderTableId('');
    setNewOrderWaiterId('');
    onClose();
  };

  // ── Render por paso ───────────────────────────────────────────────────────────

  const renderPhone = () => (
    <div className="space-y-5">
      <div>
        <SectionTitle>¿Cuál es el teléfono del cliente?</SectionTitle>
        <p className="text-sm text-[var(--app-muted)]">Ingresá el número para buscar al cliente y continuar.</p>
      </div>

      <div>
        <FieldLabel>Teléfono internacional</FieldLabel>
        <div className="flex h-12 overflow-hidden rounded-lg border border-[var(--primary)] bg-[var(--app-panel)] text-[var(--app-strong)] shadow-[0_0_0_1px_rgb(255_90_10_/_16%)]">
          <div className="flex items-center gap-2 border-r border-[var(--app-line)] px-3">
            <Phone className="h-4 w-4 text-[var(--app-strong)]" />
            <span className="text-sm font-semibold text-[var(--app-strong)]">WhatsApp</span>
          </div>
          <input
            placeholder="54911 2345 6789"
            value={formatPhoneDisplay(phone)}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && void searchCustomer()}
            autoFocus
            type="tel"
            className="min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-[var(--app-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-0 focus:shadow-none"
          />
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--app-muted)]">
          Usá formato internacional, solo números, sin + ni espacios. Ej: 5491123456789 para vincularlo con WhatsApp.
        </p>
      </div>

      <div className="-mx-5 -mb-5 flex justify-end gap-3 border-t border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-5 py-4 sm:-mx-7 sm:-mb-6 sm:px-7">
        <Button
          type="button"
          variant="outline"
          className="ghost-action h-11 min-w-36 rounded-lg"
          onClick={handleClose}
        >
          Cancelar
        </Button>
        <Button
          className="primary-action h-11 min-w-48 gap-2 rounded-lg"
          onClick={() => void searchCustomer()}
          disabled={!fullPhone || isSearchingCustomer}
        >
          {isSearchingCustomer ? 'Buscando...' : 'Buscar cliente'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const renderCustomer = () => (
    <div className="space-y-4">
      <SectionTitle>Cliente nuevo</SectionTitle>
      <p className="text-xs text-gray-400">
        No encontramos a nadie con el teléfono <span className="text-white">{fullPhone}</span>. Ingresá su nombre para registrarlo.
      </p>
      <div>
        <FieldLabel>Nombre completo</FieldLabel>
        <Input
          placeholder="Ej: Juan Pérez"
          value={newCustomerName}
          onChange={(e) => setNewCustomerName(e.target.value)}
          autoFocus
          className={FORM_CONTROL_CLASS}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="ghost-action h-11 flex-1 rounded-lg" onClick={goBack}>← Atrás</Button>
        <Button
          className="primary-action h-11 flex-1 rounded-lg"
          onClick={goNext}
          disabled={!newCustomerName.trim()}
        >
          Continuar →
        </Button>
      </div>
    </div>
  );

  const renderPreviousOrders = () => {
    const orders = previousCustomerOrders.length > 0 ? previousCustomerOrders : customerFound?.orderHistory ?? [];

    if (isLoadingPreviousOrders) {
      return (
        <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3 py-2 text-xs text-[var(--app-muted)]">
          Cargando pedidos anteriores...
        </div>
      );
    }

    if (orders.length === 0) {
      return (
        <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3 py-2 text-xs text-[var(--app-muted)]">
          Este cliente no tiene pedidos anteriores para repetir.
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pedidos anteriores</p>
        <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
          {orders.slice(0, 6).map((order) => (
            <div key={order.id} className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3 py-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--app-strong)]">{order.date}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--app-muted)]">
                    {order.items.length > 0 ? order.items.slice(0, 3).join(', ') : 'Sin detalle de productos'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs font-semibold text-[var(--app-strong)]">{order.total}</span>
                  <button
                    type="button"
                    onClick={() => repeatPreviousOrder(order)}
                    className="inline-flex h-8 items-center gap-1 rounded-md border border-[var(--primary)]/45 px-2 text-xs font-medium text-[var(--primary)] transition hover:bg-[var(--primary)]/10"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Repetir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCustomerFound = () => {
    const c = customerFound!;
    const displayName = (c.name ?? '').trim() || 'Cliente';
    const avatarInitial = displayName.charAt(0).toUpperCase();
    const displayPhone = (c.phone ?? '').trim() || fullPhone;
    return (
      <div className="space-y-3 rounded-lg border border-orange-700/50 bg-orange-950/20 p-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20 text-orange-400 text-sm font-bold">
            {avatarInitial}
          </div>
          <div>
            <p className="text-sm font-medium text-white">{displayName}</p>
            <p className="text-xs text-gray-400">{displayPhone}</p>
          </div>
          <Badge className="ml-auto bg-emerald-600 text-white text-xs">Existente</Badge>
        </div>

        {c.savedAddress && (
          <div className="text-xs text-gray-400">
            <span className="text-gray-500">Última dirección: </span>
            <span className="text-gray-300">{c.savedAddress.formatted}</span>
          </div>
        )}

        {renderPreviousOrders()}
      </div>
    );
  };

  const renderType = () => (
    <div className="space-y-4">
      {customerFound && renderCustomerFound()}

      <SectionTitle>Tipo de orden</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {(['delivery', 'dine-in'] as OrderType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setOrderType(type)}
            className={`rounded-lg border-2 p-4 text-left transition-all ${
              orderType === type
                ? 'border-orange-500 bg-orange-500/10 text-white'
                : 'border-gray-700 bg-card text-gray-400 hover:border-gray-500'
            }`}
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
              {type === 'delivery' ? <Truck className="h-4 w-4" /> : <Utensils className="h-4 w-4" />}
            </div>
            <p className="text-sm font-medium">{type === 'delivery' ? 'Delivery' : 'Salón'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {type === 'delivery' ? 'Con dirección de entrega' : 'Mesa o mostrador'}
            </p>
          </button>
        ))}
      </div>

      {orderType === 'dine-in' && (
        <div className="space-y-2">
          <div>
            <FieldLabel>Sede *</FieldLabel>
            <Select value={selectedHeadquarterId} onValueChange={setSelectedHeadquarterId}>
              <SelectTrigger className={FORM_CONTROL_CLASS}>
                <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Seleccioná una sede'} />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                {headquarters.map((headquarter) => (
                  <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                    {headquarter.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Mesa (opcional)</FieldLabel>
              <Input
                placeholder="ID de mesa"
                value={newOrderTableId}
                onChange={(e) => setNewOrderTableId(e.target.value)}
                type="number"
                className={FORM_CONTROL_CLASS}
              />
            </div>
            <div>
              <FieldLabel>Mozo (opcional)</FieldLabel>
              <Input
                placeholder="ID de mozo"
                value={newOrderWaiterId}
                onChange={(e) => setNewOrderWaiterId(e.target.value)}
                type="number"
                className={FORM_CONTROL_CLASS}
              />
            </div>
          </div>
        </div>
      )}

      {orderType === 'dine-in' && !selectedHeadquarterId && (
        <p className="text-xs text-yellow-400">Seleccioná una sede para continuar con el pedido de salón.</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="ghost-action h-11 flex-1 rounded-lg" onClick={goBack}>← Atrás</Button>
        <Button
          className="primary-action h-11 flex-1 rounded-lg"
          onClick={goNext}
          disabled={orderType === 'dine-in' && !selectedHeadquarterId}
        >
          Continuar →
        </Button>
      </div>
    </div>
  );

  const renderAddress = () => {
    const hasBlockingZoneCheck = deliveryZoneCheck?.hasZone && !deliveryZoneCheck.inside;
    const canContinue = Boolean(deliveryCoordinates)
      && !hasBlockingZoneCheck;
    const searchScope = [
      addressSearchContext?.city,
      addressSearchContext?.region,
      addressSearchContext?.country,
    ].filter(Boolean).join(', ');

    return (
      <div className="space-y-4">
        <SectionTitle>Dirección de entrega</SectionTitle>

        <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] px-3 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FieldLabel>Sede de entrega</FieldLabel>
            <Badge className="bg-[var(--app-soft)] text-[var(--app-strong)] text-xs">
              {autoDeliveryHeadquarter?.name ?? 'Automática por zona'}
            </Badge>
          </div>
          <p className="text-xs text-[var(--app-muted)]">
            La sede se asigna automáticamente cuando la dirección queda dentro de una zona activa.
          </p>
          {searchScope ? (
            <p className="mt-1 text-xs text-[var(--app-muted)]">Las sugerencias se priorizan cerca de {searchScope}.</p>
          ) : null}
        </div>

        {savedCustomerAddresses.length > 0 ? (
          <div>
            <FieldLabel>Direcciones del cliente</FieldLabel>
            <div className="grid gap-2">
              {savedCustomerAddresses.map((address) => (
                <button
                  key={`${address.formatted}-${address.latitude ?? ''}-${address.longitude ?? ''}`}
                  type="button"
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-left text-xs transition ${
                    deliveryAddress === address.formatted
                      ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--app-strong)]'
                      : 'border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-muted)] hover:bg-[var(--app-soft)]'
                  }`}
                  onClick={() => {
                    deliveryReverseAbortRef.current?.abort();
                    setDeliveryAddress(address.formatted);
                    setSelectedDeliveryAddressLabel(address.formatted);
                    if (Number.isFinite(address.latitude) && Number.isFinite(address.longitude)) {
                      setDeliveryCoordinates({
                        latitude: Number(address.latitude),
                        longitude: Number(address.longitude),
                      });
                    } else {
                      setDeliveryCoordinates(null);
                    }
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                  <span>{address.formatted}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="relative">
          <FieldLabel>Domicilio</FieldLabel>
          <Input
            placeholder="Opcional: Av. Argentina 1234"
            value={deliveryAddress}
            onChange={(event) => {
              deliveryReverseAbortRef.current?.abort();
              const nextValue = event.target.value;
              setDeliveryAddress(nextValue);
              if (selectedDeliveryAddressLabel && nextValue !== selectedDeliveryAddressLabel) {
                setDeliveryCoordinates(null);
              }
              setSelectedDeliveryAddressLabel('');
            }}
            onFocus={() => {
              if (deliveryAddressSuggestions.length > 0) {
                setShowDeliveryAddressSuggestions(true);
              }
            }}
            onBlur={() => {
              window.setTimeout(() => setShowDeliveryAddressSuggestions(false), 120);
            }}
            className={FORM_CONTROL_CLASS}
          />
          {showDeliveryAddressSuggestions && deliveryAddressSuggestions.length > 0 ? (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[80] max-h-56 overflow-y-auto rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-1 shadow-[0_18px_46px_rgb(0_0_0_/_28%)]">
              {deliveryAddressSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-xs text-[var(--app-strong)] transition hover:bg-[var(--app-soft)]"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    deliveryReverseAbortRef.current?.abort();
                    setDeliveryAddress(suggestion.label);
                    setSelectedDeliveryAddressLabel(suggestion.label);
                    setDeliveryCoordinates({
                      latitude: suggestion.latitude,
                      longitude: suggestion.longitude,
                    });
                    setShowDeliveryAddressSuggestions(false);
                  }}
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                  <span>{suggestion.label}</span>
                </button>
              ))}
            </div>
          ) : null}
          <input type="hidden" name="delivery_latitude" value={deliveryCoordinates?.latitude ?? ''} />
          <input type="hidden" name="delivery_longitude" value={deliveryCoordinates?.longitude ?? ''} />
        </div>

        <p className="text-xs text-gray-500">
          {isLoadingDeliveryAddressSuggestions
            ? 'Buscando sugerencias de dirección...'
            : deliveryCoordinates
              ? `Ubicación detectada: ${deliveryCoordinates.latitude.toFixed(5)}, ${deliveryCoordinates.longitude.toFixed(5)}`
              : 'Escribí una dirección o marcá la ubicación directamente en el mapa.'}
        </p>

        <div className="overflow-hidden rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--app-line)] px-3 py-2 text-xs">
            <span className="font-semibold text-[var(--app-strong)]">Mapa y zonas activas</span>
            <span className={deliveryZoneCheck?.hasZone
              ? deliveryZoneCheck.inside ? 'text-emerald-400' : 'text-red-400'
              : 'text-[var(--app-muted)]'}
            >
              {isLoadingDeliveryZones
                ? 'Cargando zonas...'
                : deliveryZoneCheck?.hasZone
                  ? deliveryZoneCheck.inside ? 'Dentro de zona' : 'Fuera de zona'
                  : deliveryZones.length > 0 ? 'Elegí o mové el punto' : 'Sin zonas activas'}
            </span>
          </div>
          {GOOGLE_MAPS_API_KEY ? (
            <div ref={deliveryMapRef} className="h-64 w-full bg-[var(--app-soft)]" />
          ) : (
            <div className="flex h-40 items-center justify-center px-4 text-center text-xs text-[var(--app-muted)]">
              Configurá VITE_GOOGLE_MAPS_API_KEY para ver el mapa y ajustar el punto de entrega.
            </div>
          )}
          {deliveryMapError ? (
            <p className="border-t border-[var(--app-line)] px-3 py-2 text-xs text-red-400">{deliveryMapError}</p>
          ) : (
            <p className="border-t border-[var(--app-line)] px-3 py-2 text-xs text-[var(--app-muted)]">
              Podés hacer click en el mapa o arrastrar el pin para ajustar la ubicación exacta antes de continuar.
            </p>
          )}
        </div>

        {hasBlockingZoneCheck ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            La dirección está fuera de las zonas de entrega activas.
          </p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" className="ghost-action h-11 flex-1 rounded-lg" onClick={goBack}>← Atrás</Button>
          <Button
            className="primary-action h-11 flex-1 rounded-lg"
            onClick={goNext}
            disabled={!canContinue}
          >
            Continuar →
          </Button>
        </div>
      </div>
    );
  };

  const renderProducts = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <SectionTitle>Productos</SectionTitle>
        <span className="text-xs text-gray-400">
          {selectedItems.reduce((a, p) => a + p.quantity, 0)} items · {currencyFormatter.format(totalAmount)}
        </span>
      </div>

      {customerFound ? renderPreviousOrders() : null}

      <Input
        placeholder="Buscar producto..."
        value={productFilter}
        onChange={(e) => setProductFilter(e.target.value)}
        className={`${FORM_CONTROL_CLASS} h-9 text-sm`}
      />

      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setCategoryFilter('all')}
          className={`rounded-full px-3 py-1 text-xs transition-colors ${
            categoryFilter === 'all' ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          Todas
        </button>
        {availableCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(String(cat.id))}
            className={`rounded-full px-3 py-1 text-xs transition-colors ${
              categoryFilter === String(cat.id) ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
        {filteredProducts.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">Sin productos</p>
        ) : (
          filteredProducts.map((product) => {
            const qty = selectedQuantities[product.id] ?? 0;
            return (
              <div
                key={product.id}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors ${
                  qty > 0 ? 'border-orange-700/60 bg-orange-950/20' : 'border-gray-800 bg-card'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{product.name}</p>
                  <p className="text-xs text-gray-400">{currencyFormatter.format(product.price)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => decrement(product.id)}
                    disabled={qty === 0}
                    className="h-7 w-7 rounded-md border border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 transition-colors text-sm font-bold"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm text-white">{qty}</span>
                  <button
                    type="button"
                    onClick={() => increment(product.id)}
                    className="h-7 w-7 rounded-md border border-orange-700 text-orange-400 hover:bg-orange-500/10 transition-colors text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex gap-3 pt-1">
        <Button variant="outline" className="ghost-action h-11 flex-1 rounded-lg" onClick={goBack}>← Atrás</Button>
        <Button className="primary-action h-11 flex-1 rounded-lg" onClick={goNext} disabled={selectedItems.length === 0}>
          Revisar →
        </Button>
      </div>
    </div>
  );

  const renderConfirm = () => {
    const customerName = customerFound?.name ?? newCustomerName;
    const formattedAddress = orderType === 'delivery' ? effectiveDeliveryAddress : null;
    const hasScheduleOptions = availableScheduleDays.length > 0;
    const manualScheduleSummary = formatManualScheduleLabel(manualScheduleDate, manualScheduleTime);
    const scheduleSummary = scheduleMode === 'asap'
      ? 'Lo antes posible'
      : (selectedScheduleDay && selectedScheduleSlot
        ? `${selectedScheduleDay.label} ${selectedScheduleSlot.label}`
        : manualScheduleSummary);

    return (
      <div className="space-y-4">
        <SectionTitle>Confirmar orden</SectionTitle>

        <div className="rounded-lg border border-gray-800 divide-y divide-gray-800 overflow-hidden">
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Cliente</span>
            <span className="text-white">{customerName}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Teléfono</span>
            <span className="text-white">{customerFound?.phone ?? fullPhone}</span>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Tipo</span>
            <Badge className={orderType === 'delivery' ? 'bg-blue-600 text-white text-xs' : 'bg-emerald-600 text-white text-xs'}>
              {orderType === 'delivery' ? 'Delivery' : 'Salón'}
            </Badge>
          </div>
          <div className="flex justify-between px-3 py-2 text-sm">
            <span className="text-gray-400">Sede</span>
            <span className="text-white">{orderHeadquarter?.name ?? 'Automática por zona'}</span>
          </div>
          {formattedAddress && (
            <div className="flex justify-between items-start gap-4 px-3 py-2 text-sm">
              <span className="text-gray-400 shrink-0">Dirección</span>
              <span className="text-white text-right">{formattedAddress}</span>
            </div>
          )}
          <div className="flex justify-between items-start gap-4 px-3 py-2 text-sm">
            <span className="text-gray-400 shrink-0">Entrega</span>
            <span className="text-white text-right">{scheduleSummary}</span>
          </div>
        </div>

        <div className="rounded-lg border border-gray-800 p-3 space-y-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Horario del pedido</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScheduleMode('asap')}
              className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                scheduleMode === 'asap'
                  ? 'border-orange-500 bg-orange-500/10 text-white'
                  : 'border-gray-700 bg-card text-gray-300'
              }`}
            >
              Lo antes posible
            </button>
            <button
              type="button"
              onClick={() => setScheduleMode('scheduled')}
              className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                scheduleMode === 'scheduled'
                  ? 'border-orange-500 bg-orange-500/10 text-white'
                  : 'border-gray-700 bg-card text-gray-300'
              }`}
            >
              Programado
            </button>
          </div>

          {scheduleMode === 'scheduled' ? (
            hasScheduleOptions ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Día</FieldLabel>
                  <Select value={selectedScheduleDayId} onValueChange={setSelectedScheduleDayId}>
                    <SelectTrigger className={FORM_CONTROL_CLASS}>
                      <SelectValue placeholder="Seleccioná un día" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_CONTENT_CLASS}>
                      {availableScheduleDays.map((day) => (
                        <SelectItem key={day.id} value={day.id}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <FieldLabel>Horario</FieldLabel>
                  <Select value={selectedScheduleSlotId} onValueChange={setSelectedScheduleSlotId}>
                    <SelectTrigger className={FORM_CONTROL_CLASS}>
                      <SelectValue placeholder="Seleccioná un horario" />
                    </SelectTrigger>
                    <SelectContent className={SELECT_CONTENT_CLASS}>
                      {(selectedScheduleDay?.slots ?? []).map((slot) => (
                        <SelectItem key={slot.id} value={slot.id}>
                          {slot.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Fecha</FieldLabel>
                  <Input
                    type="date"
                    value={manualScheduleDate}
                    min={formatDateForPayload(new Date())}
                    onChange={(event) => setManualScheduleDate(event.target.value)}
                    className={FORM_CONTROL_CLASS}
                  />
                </div>
                <div>
                  <FieldLabel>Hora</FieldLabel>
                  <Input
                    type="time"
                    value={manualScheduleTime}
                    onChange={(event) => setManualScheduleTime(event.target.value)}
                    className={FORM_CONTROL_CLASS}
                  />
                </div>
                <p className="col-span-2 text-xs text-[var(--app-muted)]">
                  La sede no tiene horarios cargados; podés indicar manualmente cuándo preparar o entregar el pedido.
                </p>
              </div>
            )
          ) : null}
        </div>

        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <div className="px-3 py-2 bg-gray-900/50">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Items</p>
          </div>
          {selectedItems.map((p) => (
            <div key={p.id} className="flex justify-between items-center px-3 py-2 text-sm border-t border-gray-800">
              <span className="text-white">{p.name}</span>
              <div className="flex items-center gap-3 text-gray-400">
                <span>x{p.quantity}</span>
                <span className="text-white">{currencyFormatter.format(p.price * p.quantity)}</span>
              </div>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 border-t border-orange-700/50 bg-orange-950/10">
            <span className="text-sm font-medium text-gray-300">Total</span>
            <span className="text-sm font-bold text-white">{currencyFormatter.format(totalAmount)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="ghost-action h-11 flex-1 rounded-lg" onClick={goBack} disabled={isSubmitting}>
            ← Atrás
          </Button>
          <Button
            className="primary-action h-11 flex-1 rounded-lg gap-2"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || (scheduleMode === 'scheduled' && !selectedScheduleSlot?.startDate && !buildManualScheduleDate(manualScheduleDate, manualScheduleTime))}
          >
            {isSubmitting ? 'Creando...' : (
              <>
                <Check className="h-4 w-4" />
                Crear orden
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 'phone': return renderPhone();
      case 'customer': return renderCustomer();
      case 'type': return renderType();
      case 'address': return renderAddress();
      case 'products': return renderProducts();
      case 'confirm': return renderConfirm();
    }
  };

  const stepLabel: Record<Step, string> = {
    phone: 'Teléfono',
    customer: 'Cliente',
    type: 'Tipo',
    address: 'Dirección',
    products: 'Productos',
    confirm: 'Confirmar',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-2rem)] max-w-[720px] gap-0 overflow-visible p-0">
        {onMinimize ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-14 top-4 z-10 h-9 w-9 rounded-lg border border-[var(--app-line)] bg-[var(--app-soft)] text-[var(--app-strong)] hover:bg-[var(--app-panel)]"
            onClick={onMinimize}
            title="Minimizar orden"
          >
            <Minus className="h-4 w-4" />
          </Button>
        ) : null}
        <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-5 pb-4 pt-6 pr-16 text-left sm:px-7">
          <div className="row-span-2 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
            <Phone className="h-6 w-6" />
          </div>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-2xl font-bold leading-tight">
            <span>Nueva orden</span>
            <span className="text-[var(--app-muted)]">·</span>
            <span className="text-xl font-semibold text-[var(--app-muted)]">{stepLabel[step]}</span>
          </DialogTitle>
          <StepIndicator current={step} steps={activeSteps} />
        </DialogHeader>

        <div className="max-h-[calc(92vh-7rem)] overflow-y-auto overflow-x-visible px-5 pb-5 sm:px-7 sm:pb-6">
          {renderStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
