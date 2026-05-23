import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { getLoggedUser } from '../../authStorage';
import {
  ApiError,
  createOrder as createBackendOrder,
  type CreateOrderRequest,
  type ProductCategory,
  type ProductItem,
} from '../../api';
import { endpoints } from '../../api/endpoints';
import { listHeadquarters, type Headquarter } from '../../api/headquarter';
import { ArrowRight, Check, MapPin, Phone, Truck, Utensils } from 'lucide-react';

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

interface CustomerData {
  id?: number;
  name: string;
  phone: string;
  savedAddress?: SavedAddress;
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
}

interface NominatimResult {
  place_id?: string | number;
  display_name: string;
  lat: string;
  lon: string;
}

interface AddressSuggestion {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
}

interface DeliveryCoordinates {
  latitude: number;
  longitude: number;
}

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
  onCreated: () => void;
  availableProducts: ProductItem[];
  availableCategories: ProductCategory[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const ORDER_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const PHONE_PREFIX_OPTIONS = [
  { value: '+54', label: '+54', country: 'Argentina' },
  { value: '+598', label: '+598', country: 'Uruguay' },
  { value: '+595', label: '+595', country: 'Paraguay' },
  { value: '+56', label: '+56', country: 'Chile' },
  { value: '+55', label: '+55', country: 'Brasil' },
  { value: '+591', label: '+591', country: 'Bolivia' },
];

const getStoredHeadquarterId = () => {
  try {
    return localStorage.getItem(ORDER_HEADQUARTER_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
};

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

async function searchAddressSuggestions(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 4) {
    return [];
  }

  try {
    const response = await fetch(
      `${NOMINATIM_SEARCH_URL}?format=json&addressdetails=1&limit=5&countrycodes=ar&q=${encodeURIComponent(trimmedQuery)}`,
      { method: 'GET', signal, headers: { 'Accept-Language': 'es' } },
    );
    if (!response.ok) {
      return [];
    }

    const payload = await response.json().catch(() => []);
    if (!Array.isArray(payload)) {
      return [];
    }

    return payload
      .map((item: NominatimResult, index: number) => {
        const latitude = Number(item?.lat);
        const longitude = Number(item?.lon);
        const label = String(item?.display_name ?? '').trim();
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !label) {
          return null;
        }

        return {
          id: String(item?.place_id ?? `${label}-${index}`),
          label,
          latitude,
          longitude,
        };
      })
      .filter((item: AddressSuggestion | null): item is AddressSuggestion => item !== null);
  } catch {
    return [];
  }
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

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const formatPhoneDisplay = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)} ${digits.slice(2)}`;
  if (digits.length <= 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6, 10)} ${digits.slice(10)}`;
};

const buildFullPhone = (prefix: string, phoneValue: string) => {
  const digits = onlyDigits(phoneValue);
  return digits ? `${prefix}${digits}` : '';
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

export function CreateOrderDialog({ open, onClose, onCreated, availableProducts, availableCategories }: Props) {
  // Paso actual
  const [step, setStep] = useState<Step>('phone');

  // Paso 1 — Teléfono
  const [phonePrefix, setPhonePrefix] = useState('+54');
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

  // Paso 5 — Productos
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>({});
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Misc
  const [newOrderUserId, setNewOrderUserId] = useState('');
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState(() => getStoredHeadquarterId());
  const [isLoadingHeadquarters, setIsLoadingHeadquarters] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('asap');
  const [selectedScheduleDayId, setSelectedScheduleDayId] = useState('');
  const [selectedScheduleSlotId, setSelectedScheduleSlotId] = useState('');
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const [newOrderTableId, setNewOrderTableId] = useState('');
  const [newOrderWaiterId, setNewOrderWaiterId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deliverySuggestAbortRef = useRef<AbortController | null>(null);

  const STEPS: Step[] = ['phone', 'customer', 'type', 'address', 'products', 'confirm'];
  const STEPS_DINE_IN: Step[] = ['phone', 'customer', 'type', 'products', 'confirm'];

  const activeSteps = orderType === 'delivery' ? STEPS : STEPS_DINE_IN;
  const selectedHeadquarter = headquarters.find((headquarter) => String(headquarter.id) === selectedHeadquarterId);
  const fullPhone = buildFullPhone(phonePrefix, phone);
  const scheduleState = useMemo(
    () => buildScheduleState(normalizeHeadquarterSchedules(selectedHeadquarter?.schedules), scheduleNow),
    [selectedHeadquarter?.schedules, scheduleNow],
  );
  const availableScheduleDays = scheduleState.dayOptions;
  const selectedScheduleDay = availableScheduleDays.find((day) => day.id === selectedScheduleDayId) ?? availableScheduleDays[0];
  const selectedScheduleSlot = selectedScheduleDay?.slots.find((slot) => slot.id === selectedScheduleSlotId) ?? selectedScheduleDay?.slots[0];

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
    try {
      if (selectedHeadquarterId) {
        localStorage.setItem(ORDER_HEADQUARTER_STORAGE_KEY, selectedHeadquarterId);
      }
    } catch {
      // noop
    }
  }, [selectedHeadquarterId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setScheduleNow(new Date());
    }, 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (scheduleMode === 'scheduled' && availableScheduleDays.length === 0) {
      setScheduleMode('asap');
      return;
    }

    if (!selectedScheduleDay || selectedScheduleDay.id !== selectedScheduleDayId) {
      setSelectedScheduleDayId(selectedScheduleDay?.id ?? '');
    }
  }, [scheduleMode, availableScheduleDays, selectedScheduleDay, selectedScheduleDayId]);

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

      void searchAddressSuggestions(query, abortController.signal)
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
  }, [deliveryAddress, deliveryCoordinates, selectedDeliveryAddressLabel, orderType]);

  // ── Búsqueda de cliente por teléfono ─────────────────────────────────────────

  const searchCustomer = async () => {
    const trimmed = fullPhone.trim();
    if (!trimmed) return;

    setIsSearchingCustomer(true);
    setCustomerFound(null);
    setCustomerNotFound(false);

    try {
      const result = await endpoints.fetchCustomerByPhone?.(trimmed);

      if (result) {
        setCustomerFound(result);
        // Precargar dirección si el cliente la tiene guardada
        if (result.savedAddress) {
          setDeliveryAddress(result.savedAddress.formatted ?? '');
          if (
            Number.isFinite(result.savedAddress.latitude)
            && Number.isFinite(result.savedAddress.longitude)
          ) {
            setDeliveryCoordinates({
              latitude: Number(result.savedAddress.latitude),
              longitude: Number(result.savedAddress.longitude),
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
      toast.error('Seleccioná una dirección de las sugerencias para validar latitud y longitud.');
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

  const selectedItems = availableProducts
    .map((p) => ({ ...p, quantity: selectedQuantities[p.id] ?? 0 }))
    .filter((p) => p.quantity > 0);

  const totalAmount = selectedItems.reduce((acc, p) => acc + p.price * p.quantity, 0);

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

    const parsedHeadquarterId = Number(selectedHeadquarterId);
    const resolvedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
      ? parsedHeadquarterId
      : null;

    if (!resolvedHeadquarterId) {
      toast.error(orderType === 'delivery'
        ? 'Seleccioná una sede para el pedido delivery'
        : 'Seleccioná una sede para el pedido de salón');
      return;
    }

    const loggedUser = getLoggedUser();
    const storeId = Number(loggedUser?.storeId);
    const trimmedDeliveryAddress = deliveryAddress.trim();

    if (orderType === 'delivery' && !trimmedDeliveryAddress) {
      toast.error('Ingresá el domicilio de entrega');
      return;
    }

    if (orderType === 'delivery' && !deliveryCoordinates) {
      toast.error('Seleccioná una dirección de las sugerencias para validar latitud y longitud.');
      return;
    }

    const isAsapSchedule = scheduleMode === 'asap';
    const scheduledSlotDate = !isAsapSchedule ? selectedScheduleSlot?.startDate : undefined;
    if (!isAsapSchedule && !scheduledSlotDate) {
      toast.error('Seleccioná un horario válido para el pedido');
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
      delivery_address: orderType === 'delivery' ? trimmedDeliveryAddress : undefined,
      delivery_latitude: orderType === 'delivery' ? deliveryCoordinates.latitude : undefined,
      delivery_longitude: orderType === 'delivery' ? deliveryCoordinates.longitude : undefined,
      scheduled_for: scheduledSlotDate ? formatLocalDateTimeForPayload(scheduledSlotDate) : undefined,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      is_asap: isAsapSchedule,
      tableId: orderType === 'dine-in' && newOrderTableId ? Number(newOrderTableId) : undefined,
      waiterId: newOrderWaiterId ? Number(newOrderWaiterId) : undefined,
    };

    setIsSubmitting(true);
    try {
      await createBackendOrder(payload);
      toast.success('Orden creada correctamente');
      handleClose();
      onCreated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo crear la orden');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Reset & Close ─────────────────────────────────────────────────────────────

  const handleClose = () => {
    setStep('phone');
    setPhonePrefix('+54');
    setPhone('');
    setCustomerFound(null);
    setCustomerNotFound(false);
    setNewCustomerName('');
    setOrderType('delivery');
    setDeliveryAddress('');
    setSelectedDeliveryAddressLabel('');
    setDeliveryAddressSuggestions([]);
    setShowDeliveryAddressSuggestions(false);
    setIsLoadingDeliveryAddressSuggestions(false);
    setDeliveryCoordinates(null);
    setScheduleMode('asap');
    setSelectedScheduleDayId('');
    setSelectedScheduleSlotId('');
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
        <FieldLabel>Teléfono</FieldLabel>
        <div className="flex h-12 overflow-hidden rounded-lg border border-[var(--primary)] bg-[var(--app-panel)] text-[var(--app-strong)] shadow-[0_0_0_1px_rgb(255_90_10_/_16%)]">
          <div className="flex items-center gap-2 border-r border-[var(--app-line)] px-3">
            <Phone className="h-4 w-4 text-[var(--app-strong)]" />
            <Select value={phonePrefix} onValueChange={setPhonePrefix}>
              <SelectTrigger
                aria-label="Código de área"
                className="h-full min-w-[138px] border-0 bg-transparent px-0 py-0 text-sm font-semibold text-[var(--app-strong)] shadow-none ring-0 focus:border-0 focus:ring-0 focus-visible:border-0 focus-visible:ring-0 [&>svg]:text-[var(--app-muted)]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="z-[90] w-60 rounded-xl border-[var(--app-line)] bg-[var(--app-panel)] p-1 text-[var(--app-strong)] shadow-[0_18px_46px_rgb(0_0_0_/_32%)]"
              >
                {PHONE_PREFIX_OPTIONS.map((option) => (
                  <SelectItem
                    key={option.value}
                    value={option.value}
                    className="rounded-lg px-3 py-2.5 text-sm text-[var(--app-strong)] focus:bg-[var(--app-soft)] focus:text-[var(--app-strong)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:text-white"
                  >
                    <span className="flex w-full items-center justify-between gap-4">
                      <span className="font-semibold">{option.label}</span>
                      <span className="text-xs opacity-75">{option.country}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <input
            placeholder="11 2345 6789"
            value={formatPhoneDisplay(phone)}
            onChange={(e) => setPhone(onlyDigits(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && void searchCustomer()}
            autoFocus
            type="tel"
            className="min-w-0 flex-1 border-0 bg-transparent px-4 text-base text-[var(--app-strong)] outline-none placeholder:text-[var(--app-muted)] focus:border-0 focus:shadow-none"
          />
        </div>
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

        {c.orderHistory && c.orderHistory.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Historial reciente</p>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {c.orderHistory.slice(0, 3).map((h) => (
                <div key={h.id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">{h.date}</span>
                  <span className="text-gray-300">{h.items.slice(0, 2).join(', ')}</span>
                  <span className="text-white">{h.total}</span>
                </div>
              ))}
            </div>
          </div>
        )}
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
              <SelectTrigger>
                <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Seleccioná una sede'} />
              </SelectTrigger>
              <SelectContent>
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
              />
            </div>
            <div>
              <FieldLabel>Mozo (opcional)</FieldLabel>
              <Input
                placeholder="ID de mozo"
                value={newOrderWaiterId}
                onChange={(e) => setNewOrderWaiterId(e.target.value)}
                type="number"
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
    const canContinue = Boolean(selectedHeadquarterId) && deliveryAddress.trim().length > 0 && Boolean(deliveryCoordinates);

    return (
      <div className="space-y-4">
        <SectionTitle>Dirección de entrega</SectionTitle>

        <div>
          <FieldLabel>Sede *</FieldLabel>
          <Select value={selectedHeadquarterId} onValueChange={setSelectedHeadquarterId}>
            <SelectTrigger>
              <SelectValue placeholder={isLoadingHeadquarters ? 'Cargando sedes...' : 'Seleccioná una sede'} />
            </SelectTrigger>
            <SelectContent>
              {headquarters.map((headquarter) => (
                <SelectItem key={headquarter.id} value={String(headquarter.id)}>
                  {headquarter.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedHeadquarterId && (
            <p className="text-xs text-yellow-400 mt-1">Seleccioná una sede para continuar.</p>
          )}
        </div>

        <div className="relative">
          <FieldLabel>Domicilio *</FieldLabel>
          <Input
            placeholder="Ej: Av. Argentina 1234"
            value={deliveryAddress}
            onChange={(event) => {
              setDeliveryAddress(event.target.value);
              setDeliveryCoordinates(null);
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
              : 'Escribí la dirección y elegí una sugerencia para validar la ubicación.'}
        </p>

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

      <Input
        placeholder="Buscar producto..."
        value={productFilter}
        onChange={(e) => setProductFilter(e.target.value)}
        className="h-8 text-sm"
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
    const formattedAddress = orderType === 'delivery' ? deliveryAddress.trim() : null;
    const hasScheduleOptions = availableScheduleDays.length > 0;
    const scheduleSummary = scheduleMode === 'asap'
      ? 'Lo antes posible'
      : (selectedScheduleDay && selectedScheduleSlot
        ? `${selectedScheduleDay.label} ${selectedScheduleSlot.label}`
        : 'Sin horario seleccionado');

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
            <span className="text-white">{selectedHeadquarter?.name ?? 'Sin sede'}</span>
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
              disabled={!hasScheduleOptions}
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
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un día" />
                    </SelectTrigger>
                    <SelectContent>
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
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccioná un horario" />
                    </SelectTrigger>
                    <SelectContent>
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
              <p className="text-xs text-yellow-400">La sede seleccionada no tiene horarios disponibles.</p>
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
            disabled={isSubmitting || (scheduleMode === 'scheduled' && !selectedScheduleSlot?.startDate)}
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
