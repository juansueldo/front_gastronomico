import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { CheckCircle2, ChevronLeft, Clock3, Instagram, Loader2, Mail, MapPin, MessageCircle, Phone, Search, ShoppingBag, Store, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent } from './ui/dialog';
import { toast } from 'sonner';
import {
  createPublicStoreOrder,
  fetchPublicStoreCatalog,
  fetchPublicStore,
  type PublicStoreInfo,
  type PublicStoreHeadquarter,
  type PublicStoreProduct,
  type PublicStoreSchedule,
} from '../storefrontApi';
import { isApiError } from '../api/errors';

type StoreLoadState = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';
type CheckoutStep = 'menu' | 'checkout' | 'success';
type PaymentMethod = '' | 'transfer' | 'cash';
type ScheduleMode = 'asap' | 'scheduled';
type StoreScheduleSlotOption = {
  id: string;
  label: string;
  startDate: Date;
};
type StoreScheduleDayOption = {
  id: string;
  label: string;
  slots: StoreScheduleSlotOption[];
};
type OrderSuccessSummary = {
  customerName: string;
  total: number;
  itemsCount: number;
  paymentLabel: string;
  orderType: 'delivery' | 'pickup';
  address?: string;
  pickupHeadquarterName?: string;
};
type AddressSuggestion = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const PRODUCT_BATCH_SIZE = 12;
const DAY_OF_WEEK_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_OF_WEEK_SHORT_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as const;
const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';

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

const formatWindowLabel = (open: Date, close: Date) => {
  const openLabel = formatHourLabel(open);
  const closeLabel = formatHourLabel(close);
  return `${openLabel} a ${closeLabel}`;
};

const searchAddressSuggestions = async (query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery || trimmedQuery.length < 4) {
    return [];
  }

  const response = await fetch(
    `${NOMINATIM_SEARCH_URL}?format=json&addressdetails=1&limit=5&countrycodes=ar&q=${encodeURIComponent(trimmedQuery)}`,
    { method: 'GET', signal },
  );
  if (!response.ok) {
    return [];
  }

  const payload = await response.json().catch(() => []);
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((item: any, index: number) => {
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
};

const resolveAddressCoordinates = async (query: string): Promise<{ latitude: number; longitude: number } | null> => {
  const suggestions = await searchAddressSuggestions(query);
  if (suggestions.length === 0) {
    return null;
  }

  const firstSuggestion = suggestions[0];
  return {
    latitude: firstSuggestion.latitude,
    longitude: firstSuggestion.longitude,
  };
};

const buildScheduleState = (schedules: PublicStoreSchedule[] | undefined, now: Date) => {
  if (!schedules || schedules.length === 0) {
    return {
      isOpenNow: false,
      hasSchedules: false,
      todayWindowLabel: '',
      nextOpeningLabel: '',
      dayOptions: [] as StoreScheduleDayOption[],
    };
  }

  const validSchedules = schedules.filter((schedule) => !schedule.isClosed);
  if (validSchedules.length === 0) {
    return {
      isOpenNow: false,
      hasSchedules: false,
      todayWindowLabel: '',
      nextOpeningLabel: '',
      dayOptions: [] as StoreScheduleDayOption[],
    };
  }

  const dayOptions: StoreScheduleDayOption[] = [];
  const todayKey = DAY_OF_WEEK_KEYS[now.getDay()];
  const todayWindows: string[] = [];
  let isOpenNow = false;
  let firstFutureOpening: Date | null = null;

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(now);
    date.setDate(now.getDate() + dayOffset);
    const dayKey = DAY_OF_WEEK_KEYS[date.getDay()];
    const daySchedules = validSchedules.filter((schedule) => schedule.dayOfWeek === dayKey);
    const daySlots: StoreScheduleSlotOption[] = [];

    daySchedules.forEach((schedule) => {
      const openDate = buildDateWithTime(date, schedule.openTime);
      const closeDate = buildDateWithTime(date, schedule.closeTime);
      if (closeDate <= openDate) {
        closeDate.setDate(closeDate.getDate() + 1);
      }

      if (dayKey === todayKey) {
        todayWindows.push(formatWindowLabel(openDate, closeDate));
        if (now >= openDate && now < closeDate) {
          isOpenNow = true;
        }
      }

      if (openDate > now && (!firstFutureOpening || openDate < firstFutureOpening)) {
        firstFutureOpening = new Date(openDate);
      }

      let slot = new Date(openDate);
      while (slot < closeDate) {
        const slotEnd = new Date(Math.min(slot.getTime() + (30 * 60 * 1000), closeDate.getTime()));
        if (dayOffset > 0 || slot > now) {
          daySlots.push({
            id: `slot:${slot.toISOString()}`,
            label: `${formatHourLabel(slot)} - ${formatHourLabel(slotEnd)}`,
            startDate: new Date(slot),
          });
        }
        slot = new Date(slot.getTime() + 30 * 60 * 1000);
      }
    });

    if (daySlots.length > 0) {
      const dayId = `day:${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      dayOptions.push({
        id: dayId,
        label: formatScheduleDayLabel(date),
        slots: daySlots,
      });
    }
  }

  const nextOpeningLabel = firstFutureOpening
    ? firstFutureOpening.toLocaleString('es-AR', {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).replace('.', '')
    : '';

  return {
    isOpenNow,
    hasSchedules: true,
    todayWindowLabel: todayWindows.join(' | '),
    nextOpeningLabel,
    dayOptions,
  };
};

export function PublicStorefrontView() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [store, setStore] = useState<PublicStoreInfo | null>(null);
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [headquarters, setHeadquarters] = useState<PublicStoreHeadquarter[]>([]);
  const [categoriesById, setCategoriesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isLoadingAddressSuggestions, setIsLoadingAddressSuggestions] = useState(false);
  const [deliveryAddressExtra, setDeliveryAddressExtra] = useState('');
  const [notes, setNotes] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('');
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<CheckoutStep>('menu');
  const [orderSuccessSummary, setOrderSuccessSummary] = useState<OrderSuccessSummary | null>(null);
  const [storeDefaultHeadquarterId, setStoreDefaultHeadquarterId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [storeLoadState, setStoreLoadState] = useState<StoreLoadState>('idle');
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('asap');
  const [selectedScheduleDayId, setSelectedScheduleDayId] = useState('');
  const [selectedScheduleSlotId, setSelectedScheduleSlotId] = useState('');
  const [scheduleNow, setScheduleNow] = useState(() => new Date());
  const [activeProduct, setActiveProduct] = useState<PublicStoreProduct | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productDialogQuantity, setProductDialogQuantity] = useState(1);
  const [visibleProductsCount, setVisibleProductsCount] = useState(PRODUCT_BATCH_SIZE);
  const loadMoreTriggerRef = useRef<HTMLDivElement | null>(null);
  const addressSuggestAbortRef = useRef<AbortController | null>(null);

  const categoryEntries = useMemo(
    () => Object.entries(categoriesById).sort(([, leftName], [, rightName]) => leftName.localeCompare(rightName, 'es')),
    [categoriesById],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const categoryMatch = selectedCategoryId === 'all' || product.categoryIds.includes(selectedCategoryId);

      if (!categoryMatch) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const categoryLabel = product.categoryIds
        .map((categoryId) => categoriesById[categoryId] ?? '')
        .join(' ')
        .toLowerCase();

      return (
        product.name.toLowerCase().includes(normalizedSearch)
        || String(product.description ?? '').toLowerCase().includes(normalizedSearch)
        || categoryLabel.includes(normalizedSearch)
      );
    });
  }, [products, selectedCategoryId, searchTerm, categoriesById]);

  const cartItems = products
    .map((product) => ({
      ...product,
      quantity: cartQuantities[product.id] ?? 0,
    }))
    .filter((product) => product.quantity > 0);

  const cartItemsCount = cartItems.reduce((accumulator, product) => accumulator + product.quantity, 0);
  const cartTotal = cartItems.reduce((accumulator, product) => accumulator + (product.price * product.quantity), 0);

  const pickupHeadquarter = headquarters.find((headquarter) => headquarter.id === selectedHeadquarterId);
  const fallbackHeadquarter = headquarters.find((headquarter) => headquarter.id === storeDefaultHeadquarterId) ?? headquarters[0];
  const isPickupZonePending = orderType === 'pickup' && !selectedHeadquarterId;
  const activeScheduleHeadquarter = orderType === 'pickup'
    ? (isPickupZonePending ? undefined : pickupHeadquarter)
    : fallbackHeadquarter;
  const scheduleState = useMemo(
    () => buildScheduleState(activeScheduleHeadquarter?.schedules, scheduleNow),
    [activeScheduleHeadquarter?.schedules, scheduleNow],
  );
  const storeImageUrl = store?.profileImageUrl ?? store?.logoUrl;
  const availableScheduleDays = scheduleState.dayOptions;
  const selectedScheduleDay = availableScheduleDays.find((day) => day.id === selectedScheduleDayId) ?? availableScheduleDays[0];
  const selectedScheduleSlot = selectedScheduleDay?.slots.find((slot) => slot.id === selectedScheduleSlotId) ?? selectedScheduleDay?.slots[0];
  const productDialogTotal = (activeProduct?.price ?? 0) * productDialogQuantity;
  const canConfirmCheckout = (
    customerName.trim().length > 0
    && customerPhone.trim().length > 0
    && paymentMethod !== ''
    && (orderType !== 'delivery' || deliveryAddress.trim().length > 0)
  );
  const visibleProducts = filteredProducts.slice(0, visibleProductsCount);
  const hasMoreProducts = visibleProductsCount < filteredProducts.length;
  const groupedVisibleProducts = useMemo(() => {
    const categoryOrder = new Map(categoryEntries.map(([categoryId], index) => [categoryId, index]));
    const groups = new Map<string, { categoryId: string; categoryName: string; products: PublicStoreProduct[] }>();

    visibleProducts.forEach((product) => {
      const firstKnownCategoryId = product.categoryIds.find((categoryId) => Boolean(categoriesById[categoryId]));
      const groupCategoryId = firstKnownCategoryId ?? product.categoryIds[0] ?? 'uncategorized';
      const groupCategoryName = categoriesById[groupCategoryId]
        ?? (groupCategoryId === 'uncategorized' ? 'Sin categoria' : `Categoria ${groupCategoryId}`);

      if (!groups.has(groupCategoryId)) {
        groups.set(groupCategoryId, {
          categoryId: groupCategoryId,
          categoryName: groupCategoryName,
          products: [],
        });
      }

      groups.get(groupCategoryId)?.products.push(product);
    });

    return Array.from(groups.values()).sort((left, right) => {
      const leftOrder = categoryOrder.get(left.categoryId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = categoryOrder.get(right.categoryId) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.categoryName.localeCompare(right.categoryName, 'es');
    });
  }, [visibleProducts, categoryEntries, categoriesById]);

  const loadStore = async () => {
    if (!slug) {
      setStoreLoadState('not-found');
      return;
    }

    setStoreLoadState('loading');
    setIsLoading(true);
    setStore(null);
    setProducts([]);
    setHeadquarters([]);
    setCategoriesById({});

    try {
      const [storeData, productsData] = await Promise.all([
        fetchPublicStore(slug),
        fetchPublicStoreCatalog(slug),
      ]);

      setStore(storeData);
      const nextProducts = productsData.products.filter((product) => product.available);
      setProducts(nextProducts);

      const mergedHeadquartersMap = new Map<string, PublicStoreHeadquarter>();

      [...(storeData.pickupHeadquarters ?? []), ...productsData.headquarters].forEach((headquarter) => {
        const currentHeadquarter = mergedHeadquartersMap.get(headquarter.id);
        if (!currentHeadquarter) {
          mergedHeadquartersMap.set(headquarter.id, headquarter);
          return;
        }

        mergedHeadquartersMap.set(headquarter.id, {
          ...currentHeadquarter,
          schedules: currentHeadquarter.schedules?.length
            ? currentHeadquarter.schedules
            : headquarter.schedules,
          name: currentHeadquarter.name || headquarter.name,
          location: currentHeadquarter.location ?? headquarter.location,
          phone: currentHeadquarter.phone ?? headquarter.phone,
        });
      });

      const mergedHeadquarters = Array.from(mergedHeadquartersMap.values());
      setHeadquarters(mergedHeadquarters);

      const nextDefaultHeadquarterId = (
        storeData.defaultHeadquarterId
        ?? productsData.defaultHeadquarterId
        ?? mergedHeadquarters[0]?.id
        ?? ''
      );

      setStoreDefaultHeadquarterId(nextDefaultHeadquarterId);
      setSelectedHeadquarterId((current) => {
        if (current && mergedHeadquarters.some((headquarter) => headquarter.id === current)) {
          return current;
        }

        return '';
      });

      const categoryMap: Record<string, string> = {};
      productsData.categories.forEach((category) => {
        categoryMap[category.id] = category.name;
      });

      nextProducts.forEach((product) => {
        product.categoryIds.forEach((categoryId) => {
          if (!categoryMap[categoryId]) {
            categoryMap[categoryId] = `Categoria ${categoryId}`;
          }
        });
      });

      setCategoriesById(categoryMap);
      setStoreLoadState('ready');
    } catch (error) {
      if (isApiError(error) && error.statusCode === 404) {
        setStoreLoadState('not-found');
        return;
      }

      setStoreLoadState('error');
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la tienda');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStore();
  }, [slug]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.title = store?.name ? `${store.name} - Menu Online` : 'Menu Online';

    const faviconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]'));
    if (faviconLinks.length === 0) {
      const createdLink = document.createElement('link');
      createdLink.rel = 'icon';
      document.head.appendChild(createdLink);
      faviconLinks.push(createdLink);
    }

    const fallbackFavicon = faviconLinks[0]?.dataset.defaultFavicon || faviconLinks[0]?.href || '';
    const rawTargetFavicon = storeImageUrl || fallbackFavicon;
    if (!rawTargetFavicon) {
      return;
    }

    let resolvedTargetFavicon = rawTargetFavicon;
    if (storeImageUrl) {
      try {
        const withCacheBuster = new URL(rawTargetFavicon, window.location.origin);
        withCacheBuster.searchParams.set('favicon_ts', String(Date.now()));
        resolvedTargetFavicon = withCacheBuster.toString();
      } catch {
        const separator = rawTargetFavicon.includes('?') ? '&' : '?';
        resolvedTargetFavicon = `${rawTargetFavicon}${separator}favicon_ts=${Date.now()}`;
      }
    }

    faviconLinks.forEach((faviconLink) => {
      if (!faviconLink.dataset.defaultFavicon) {
        faviconLink.dataset.defaultFavicon = faviconLink.href || fallbackFavicon;
      }

      faviconLink.href = resolvedTargetFavicon;
    });
  }, [store?.name, storeImageUrl]);

  useEffect(() => {
    setVisibleProductsCount(PRODUCT_BATCH_SIZE);
  }, [slug, searchTerm, selectedCategoryId, products.length]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

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
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setIsLoadingAddressSuggestions(false);
      return;
    }

    const query = deliveryAddress.trim();
    if (query.length < 4) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setIsLoadingAddressSuggestions(false);
      return;
    }

    setIsLoadingAddressSuggestions(true);
    const timeoutId = window.setTimeout(() => {
      addressSuggestAbortRef.current?.abort();
      const abortController = new AbortController();
      addressSuggestAbortRef.current = abortController;

      void searchAddressSuggestions(query, abortController.signal)
        .then((suggestions) => {
          setAddressSuggestions(suggestions);
          setShowAddressSuggestions(suggestions.length > 0);
        })
        .catch((error) => {
          if ((error as { name?: string })?.name !== 'AbortError') {
            setAddressSuggestions([]);
            setShowAddressSuggestions(false);
          }
        })
        .finally(() => {
          if (!abortController.signal.aborted) {
            setIsLoadingAddressSuggestions(false);
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [deliveryAddress, orderType]);

  useEffect(() => {
    const target = loadMoreTriggerRef.current;

    if (!target || !hasMoreProducts) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting) {
          setVisibleProductsCount((current) => Math.min(current + PRODUCT_BATCH_SIZE, filteredProducts.length));
        }
      },
      {
        root: null,
        rootMargin: '0px 0px 160px 0px',
        threshold: 0,
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMoreProducts, filteredProducts.length]);

  useEffect(() => {
    if (cartItemsCount === 0 && checkoutStep === 'checkout') {
      setCheckoutStep('menu');
    }
  }, [cartItemsCount, checkoutStep]);

  if (storeLoadState === 'not-found') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e6e6e6] px-4">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <p className="text-5xl font-black tracking-[0.28em] text-[#ff5a2f]">Cloud Cook</p>
          <h1 className="mt-8 text-2xl font-extrabold uppercase tracking-[0.15em] text-[#2f2f2f] md:text-3xl">
            Tienda no encontrada
          </h1>
          <p className="mt-3 text-sm text-[#6e6e6e] md:text-base">
            No encontramos la tienda
            {' '}
            <span className="font-semibold text-[#454545]">{slug || 'solicitada'}</span>
            . Verifica el enlace e intenta nuevamente.
          </p>

          <div className="mt-10 relative flex h-52 w-52 items-center justify-center">
            <div className="absolute h-44 w-44 rounded-full border-[12px] border-[#c9cbd1] bg-[#dde0e6]" />
            <div className="absolute h-24 w-24 rounded-full border-4 border-[#b8bcc5] bg-[#f4f5f8] shadow-sm flex items-center justify-center">
              <Store className="h-10 w-10 text-[#9ea3ae]" />
            </div>
            <Search className="absolute bottom-4 right-5 h-11 w-11 text-[#bcc0c8]" />
            <span className="absolute -left-1 top-7 h-3.5 w-3.5 rotate-45 rounded-sm bg-[#ffba2f]" />
            <span className="absolute right-3 top-5 h-3.5 w-3.5 rotate-45 rounded-sm bg-[#ff6a35]" />
          </div>

          <Button asChild className="mt-8 h-11 rounded-xl bg-[#ff5a2f] px-6 !text-[#ffffff] hover:bg-[#e94d26]">
            <Link to="/">Volver al inicio</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (storeLoadState === 'loading' || storeLoadState === 'idle') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e6e6e6] px-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-xl border border-[#dddddd] bg-white px-5 py-3 text-sm text-[#666666]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando tienda...</span>
        </div>
      </div>
    );
  }

  if (storeLoadState === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#e6e6e6] px-4 text-center">
        <p className="rounded-xl border border-[#dddddd] bg-white px-5 py-3 text-sm text-[#666666]">
          No se pudo cargar la tienda. Intenta de nuevo en unos segundos.
        </p>
      </div>
    );
  }

  const openProductDialog = (product: PublicStoreProduct) => {
    const currentQuantity = cartQuantities[product.id] ?? 0;
    setActiveProduct(product);
    setProductDialogQuantity(currentQuantity > 0 ? currentQuantity : 1);
    setIsProductDialogOpen(true);
  };

  const closeProductDialog = () => {
    setIsProductDialogOpen(false);
    setActiveProduct(null);
    setProductDialogQuantity(1);
  };

  const setProductQuantity = (productId: string, quantity: number) => {
    setCartQuantities((prev) => {
      if (quantity <= 0) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: quantity,
      };
    });
  };

  const removeProductFromCart = (productId: string) => {
    setProductQuantity(productId, 0);
  };

  const confirmProductSelection = () => {
    if (!activeProduct) {
      return;
    }

    setProductQuantity(activeProduct.id, productDialogQuantity);
    closeProductDialog();
  };

  const clearCart = () => {
    setCartQuantities({});
  };

  const handleContinueCheckout = () => {
    setCheckoutStep('checkout');
  };

  const handleBackToMenu = () => {
    setCheckoutStep('menu');
  };

  const handleCreateOrder = async () => {
    const trimmedName = customerName.trim();
    const trimmedPhone = customerPhone.trim();
    const trimmedAddress = deliveryAddress.trim();
    const trimmedAddressExtra = deliveryAddressExtra.trim();
    const trimmedNotes = notes.trim();
    const isAsapSchedule = scheduleMode === 'asap';
    const scheduledSlotDate = !isAsapSchedule ? selectedScheduleSlot?.startDate : undefined;
    const scheduledDate = scheduledSlotDate ? formatDateForPayload(scheduledSlotDate) : undefined;
    const scheduledTime = scheduledSlotDate ? formatTimeForPayload(scheduledSlotDate) : undefined;
    const scheduleNotes = isAsapSchedule
      ? 'Horario solicitado: lo antes posible'
      : (selectedScheduleDay && selectedScheduleSlot
        ? `Horario solicitado: ${selectedScheduleDay.label} ${selectedScheduleSlot.label}`
        : '');
    const mergedNotes = [trimmedAddressExtra ? `Piso/Depto: ${trimmedAddressExtra}` : '', scheduleNotes, trimmedNotes]
      .filter(Boolean)
      .join(' | ');

    if (!slug) {
      toast.error('No se encontro el slug de la tienda');
      return;
    }

    if (!trimmedName) {
      toast.error('Ingresa tu nombre');
      return;
    }

    if (!trimmedPhone) {
      toast.error('Ingresa tu telefono');
      return;
    }

    if (orderType === 'delivery' && !trimmedAddress) {
      toast.error('Ingresa la direccion para delivery');
      return;
    }

    if (!paymentMethod) {
      toast.error('Selecciona forma de pago');
      return;
    }

    if (cartItemsCount === 0) {
      toast.error('Agrega al menos un producto al carrito');
      return;
    }

    if (orderType === 'pickup') {
      if (headquarters.length === 0) {
        toast.error('No hay sedes disponibles para retiro');
        return;
      }

      if (!selectedHeadquarterId) {
        toast.error('Selecciona la sede para retirar tu pedido');
        return;
      }
    }

    if (!isAsapSchedule && !selectedScheduleSlot?.startDate) {
      toast.error('Selecciona un horario valido para el pedido');
      return;
    }

    setIsCreatingOrder(true);

    try {
      let resolvedDeliveryCoordinates = deliveryCoordinates;
      if (orderType === 'delivery' && !resolvedDeliveryCoordinates && trimmedAddress) {
        resolvedDeliveryCoordinates = await resolveAddressCoordinates(trimmedAddress);
        if (resolvedDeliveryCoordinates) {
          setDeliveryCoordinates(resolvedDeliveryCoordinates);
        }
      }

      const productIds = cartItems.flatMap((product) => (
        Array.from({ length: product.quantity }, () => product.id)
      ));
      const items = cartItems.map((product) => (
        product.quantity > 1 ? `${product.name} x${product.quantity}` : product.name
      ));

      await createPublicStoreOrder(slug, {
        customerName: trimmedName,
        phone: trimmedPhone,
        type: orderType,
        address: orderType === 'delivery' ? trimmedAddress : undefined,
        deliveryLatitude: orderType === 'delivery' ? resolvedDeliveryCoordinates?.latitude : undefined,
        deliveryLongitude: orderType === 'delivery' ? resolvedDeliveryCoordinates?.longitude : undefined,
        notes: mergedNotes || undefined,
        total: cartTotal,
        productIds,
        items,
        headquarterId: orderType === 'pickup' ? selectedHeadquarterId : undefined,
        scheduledDate,
        scheduledTime,
        scheduledFor: isAsapSchedule ? undefined : selectedScheduleSlot?.startDate.toISOString(),
        isAsap: isAsapSchedule,
      });

      const paymentLabel = paymentMethod === 'transfer' ? 'Transferencia' : 'Efectivo';
      setOrderSuccessSummary({
        customerName: trimmedName,
        total: cartTotal,
        itemsCount: cartItemsCount,
        paymentLabel,
        orderType,
        address: orderType === 'delivery' ? trimmedAddress : undefined,
        pickupHeadquarterName: orderType === 'pickup' ? (pickupHeadquarter ?? fallbackHeadquarter)?.name : undefined,
      });

      toast.success('Compra creada con exito');
      clearCart();
      setCheckoutStep('success');
      setNotes('');
      setDeliveryAddressExtra('');
      setPaymentMethod('');
      setCustomerEmail('');
      setDeliveryCoordinates(null);
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      if (orderType === 'delivery') {
        setDeliveryAddress('');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo completar la compra');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleStartNewOrder = () => {
    setCheckoutStep('menu');
    setOrderSuccessSummary(null);
    setSelectedCategoryId('all');
    setSearchTerm('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const logoText = (store?.name ?? slug ?? 'T')
    .slice(0, 2)
    .toUpperCase();

  const renderProductCard = (product: PublicStoreProduct) => (
    <button
      key={product.id}
      type="button"
      onClick={() => openProductDialog(product)}
      className="w-full rounded-xl border border-[#e4e4e4] bg-[#fbfbfb] p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="grid items-center gap-3 md:grid-cols-[1fr_108px]">
        <div>
          <p className="text-base font-bold text-[#303030]">{product.name}</p>
          {product.description ? (
            <p className="mt-1 line-clamp-2 min-h-10 text-xs text-[#656565]">{product.description}</p>
          ) : (
            <p className="mt-1 min-h-10 text-xs text-[#9a9a9a]">Sin descripcion</p>
          )}
          <p className="mt-2 text-2xl font-black text-[#ff5a2f]">{currencyFormatter.format(product.price)}</p>
        </div>
        <div className="h-24 overflow-hidden rounded-lg border border-[#e8e8e8] bg-[#f1f1f1]">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[#9ea3ae]">
              <Store className="h-8 w-8" />
            </div>
          )}
        </div>
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#e6e6e6] text-[#2f2f2f]">
      <section className="relative overflow-hidden bg-[#6f6f72] pb-24 text-[#ffffff]">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_15px_15px,rgba(255,255,255,0.26)_2px,transparent_2px),radial-gradient(circle_at_45px_45px,rgba(255,255,255,0.15)_2px,transparent_2px)] bg-[length:60px_60px]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-8 md:px-6 md:pt-10">
          <div className="grid gap-6 md:grid-cols-[1.5fr_1fr_1fr]">
            <div className="flex items-start gap-4">
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-black/80 shadow-xl ring-2 ring-white/20 flex items-center justify-center">
                {storeImageUrl ? (
                  <img src={storeImageUrl} alt={`Logo de ${store?.name ?? 'la tienda'}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-semibold tracking-widest text-amber-300">{logoText}</span>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-extrabold leading-tight tracking-tight">{store?.name ?? 'Tienda'}</h1>
                <p
                  className={`mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                    isPickupZonePending
                      ? 'bg-white/25 text-white'
                      : scheduleState.hasSchedules
                      ? (scheduleState.isOpenNow ? 'bg-emerald-300/30 text-emerald-100' : 'bg-rose-300/30 text-rose-100')
                      : 'bg-white/25 text-white'
                  }`}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {isPickupZonePending
                    ? 'Selecciona sede'
                    : (!scheduleState.hasSchedules ? 'Horarios no cargados' : (scheduleState.isOpenNow ? 'Abierto ahora' : 'Cerrado ahora'))}
                </p>
              </div>
            </div>

            <div className="space-y-2 border-white/20 md:border-l md:pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/80">Contacto</p>
              <p className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4" /> {fallbackHeadquarter?.phone ?? 'Sin telefono'}</p>
              <p className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4" /> {`${slug}@tienda.com`}</p>
              <p className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4" /> {fallbackHeadquarter?.location ?? 'Retiro en sede'}</p>
            </div>

            <div className="space-y-2 border-white/20 md:border-l md:pl-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/80">Canales</p>
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-white text-[#ff5a2f] shadow flex items-center justify-center">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="h-11 w-11 rounded-full bg-white text-[#ff5a2f] shadow flex items-center justify-center">
                  <Instagram className="h-5 w-5" />
                </div>
                <div className="h-11 w-11 rounded-full bg-white text-[#ff5a2f] shadow flex items-center justify-center">
                  <Store className="h-5 w-5" />
                </div>
              </div>
              <p className="text-xs text-[#f2f2f2]/90">Atencion por redes y retiro en tienda.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-12 max-w-6xl px-4 pb-10 md:px-6">
        <section className="mx-auto mb-5 max-w-2xl rounded-2xl border border-black/10 bg-[#f4f4f4] p-4 shadow-lg">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              onClick={() => setOrderType('delivery')}
              className={`h-11 rounded-full border text-base font-semibold transition ${
                orderType === 'delivery'
                  ? 'border-[#3f3f41] bg-[#3f3f41] !text-[#ffffff]'
                  : 'border-[#d3d3d3] bg-[#f4f4f4] text-[#454545] hover:bg-[#ededed]'
              }`}
            >
              Delivery
            </Button>
            <Button
              type="button"
              onClick={() => setOrderType('pickup')}
              className={`h-11 rounded-full border text-base font-semibold transition ${
                orderType === 'pickup'
                  ? 'border-[#3f3f41] bg-[#3f3f41] !text-[#ffffff]'
                  : 'border-[#d3d3d3] bg-[#f4f4f4] text-[#454545] hover:bg-[#ededed]'
              }`}
            >
              Para retirar
            </Button>
          </div>

          {orderType === 'pickup' ? (
            <div className="mt-4 grid items-center gap-3 md:grid-cols-[1fr_1.4fr]">
              <p className="text-3md font-medium text-[#4d4d4d] md:pl-10">Sede para retirar:</p>
              <Select
                value={selectedHeadquarterId}
                onValueChange={setSelectedHeadquarterId}
                disabled={headquarters.length === 0}
              >
                <SelectTrigger className="h-12 rounded-lg border border-[#bdbdbd] !bg-[#f4f4f4] !text-[#3e3e3e] data-[placeholder]:!text-[#6b7280] [&_svg]:!text-[#575757]">
                  <SelectValue
                    className="!text-[#3f3f3f] text-base"
                    placeholder={headquarters.length === 0 ? 'Sin sedes disponibles' : 'Sede de retiro'}
                  />
                </SelectTrigger>
                <SelectContent className="!bg-white !text-[#1f2937] h-full">
                  {headquarters.map((headquarter) => (
                    <SelectItem
                      key={headquarter.id}
                      value={headquarter.id}
                      className="!text-[#1f2937] focus:!bg-[#f3f4f6] focus:!text-[#1f2937] data-[state=checked]:!bg-[#f3f4f6] data-[state=checked]:!text-[#1f2937]"
                    >
                      {headquarter.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="mt-3 grid items-center gap-3 md:grid-cols-[1fr_1.4fr]">
            <p className="text-3md font-medium text-[#4d4d4d] md:pl-10">Horario de entrega:</p>
            <Select
              value={scheduleMode}
              onValueChange={(value) => setScheduleMode(value as ScheduleMode)}
              disabled={isPickupZonePending}
            >
              <SelectTrigger className="h-12 rounded-lg border border-[#bdbdbd] !bg-[#f4f4f4] !text-[#3e3e3e] [&_svg]:!text-[#575757]">
                <SelectValue className="!text-[#3f3f3f] text-base" placeholder={isPickupZonePending ? 'Selecciona una sede primero' : undefined} />
              </SelectTrigger>
              <SelectContent className="!bg-white !text-[#1f2937]">
                <SelectItem
                  value="asap"
                  className="!text-[#1f2937] focus:!bg-[#f3f4f6] focus:!text-[#1f2937] data-[state=checked]:!bg-[#f3f4f6] data-[state=checked]:!text-[#1f2937]"
                >
                  Lo antes posible
                </SelectItem>
                <SelectItem
                  value="scheduled"
                  disabled={availableScheduleDays.length === 0}
                  className="!text-[#1f2937] focus:!bg-[#f3f4f6] focus:!text-[#1f2937] data-[state=checked]:!bg-[#f3f4f6] data-[state=checked]:!text-[#1f2937]"
                >
                  Programar pedido
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {scheduleMode === 'scheduled' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Select
                value={selectedScheduleDay?.id ?? ''}
                onValueChange={setSelectedScheduleDayId}
                disabled={availableScheduleDays.length === 0 || isPickupZonePending}
              >
                <SelectTrigger className="h-12 rounded-lg border border-[#bdbdbd] !bg-[#f4f4f4] !text-[#3e3e3e] data-[placeholder]:!text-[#6b7280] [&_svg]:!text-[#575757]">
                  <SelectValue
                    className="!text-[#3f3f3f] text-base"
                    placeholder={isPickupZonePending ? 'Selecciona una sede primero' : (availableScheduleDays.length === 0 ? 'Sin dias disponibles' : 'Elegir dia')}
                  />
                </SelectTrigger>
                <SelectContent className="!bg-white !text-[#1f2937] h-full">
                  {availableScheduleDays.map((dayOption) => (
                    <SelectItem
                      key={dayOption.id}
                      value={dayOption.id}
                      className="!text-[#1f2937] focus:!bg-[#f3f4f6] focus:!text-[#1f2937] data-[state=checked]:!bg-[#f3f4f6] data-[state=checked]:!text-[#1f2937]"
                    >
                      {dayOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={selectedScheduleSlot?.id ?? ''}
                onValueChange={setSelectedScheduleSlotId}
                disabled={!selectedScheduleDay || selectedScheduleDay.slots.length === 0 || isPickupZonePending}
              >
                <SelectTrigger className="h-12 rounded-lg border border-[#bdbdbd] !bg-[#f4f4f4] !text-[#3e3e3e] data-[placeholder]:!text-[#6b7280] [&_svg]:!text-[#575757]">
                  <SelectValue
                    className="!text-[#3f3f3f] text-base"
                    placeholder={isPickupZonePending ? 'Selecciona una sede primero' : (selectedScheduleDay ? 'Elegir hora' : 'Elegir dia primero')}
                  />
                </SelectTrigger>
                <SelectContent className="!bg-white !text-[#1f2937] h-full">
                  {(selectedScheduleDay?.slots ?? []).map((slotOption) => (
                    <SelectItem
                      key={slotOption.id}
                      value={slotOption.id}
                      className="!text-[#1f2937] focus:!bg-[#f3f4f6] focus:!text-[#1f2937] data-[state=checked]:!bg-[#f3f4f6] data-[state=checked]:!text-[#1f2937]"
                    >
                      {slotOption.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {isPickupZonePending ? (
            <p className="mt-2 text-xs text-[#6b7280]">
              Selecciona la sede para habilitar los horarios disponibles.
            </p>
          ) : !scheduleState.hasSchedules ? (
            <p className="mt-2 text-xs text-[#6b7280]">
              Esta sede no tiene horarios configurados. El pedido quedara como lo antes posible.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#e3e3e3] pt-3">
            <span
              className={`rounded-xl px-4 py-1 text-sm font-semibold ${
                isPickupZonePending
                  ? 'bg-[#e5e7eb] text-[#4b5563]'
                  : scheduleState.hasSchedules
                  ? (scheduleState.isOpenNow ? 'bg-[#c8e9d2] text-[#2ea65f]' : 'bg-[#ffd9d9] text-[#c53030]')
                  : 'bg-[#e5e7eb] text-[#4b5563]'
              }`}
            >
              {isPickupZonePending
                ? 'Selecciona sede'
                : (!scheduleState.hasSchedules ? 'Sin horarios' : (scheduleState.isOpenNow ? 'Abierto ahora' : 'Cerrado ahora'))}
            </span>
            <div className="flex items-center gap-2 text-[#757575]">
              <Clock3 className="h-4 w-4" />
              <span className="text-2md">
                {isPickupZonePending ? 'Elige una sede para ver horarios' : (scheduleState.todayWindowLabel || 'Sin horarios para hoy')}
              </span>
              {!isPickupZonePending && !scheduleState.isOpenNow && scheduleState.nextOpeningLabel ? (
                <>
                  <span className="text-[#bbbbbb]">|</span>
                  <Clock3 className="h-4 w-4" />
                  <span className="text-2md">Proxima apertura: {scheduleState.nextOpeningLabel}</span>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-black/10 bg-[#f1f1f1] p-4 shadow-xl md:p-7">
          <div className={`grid gap-5 ${checkoutStep === 'success' ? '' : 'lg:grid-cols-[1.6fr_1fr]'}`}>
            <div className="rounded-2xl border border-[#dfdfdf] bg-white p-4 md:p-5">
              {checkoutStep === 'menu' ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6a6a6a]" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-11 border-[#d2d2d2] !bg-white pl-10 !text-[#333333] placeholder:!text-[#7b7b7b] focus:!bg-white"
                      placeholder="Buscar por productos"
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-b border-[#ececec] pb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId('all')}
                      className={`rounded-full border px-4 py-1.5 text-sm font-semibold uppercase transition ${
                        selectedCategoryId === 'all'
                          ? 'border-[#ff5a2f] bg-[#ff5a2f] !text-[#ffffff]'
                          : 'border-[#dedede] bg-white text-[#4f4f4f] hover:border-[#ff8d72] hover:text-[#ff5a2f]'
                      }`}
                    >
                      Todas
                    </button>
                    {categoryEntries.map(([categoryId, categoryName]) => (
                      <button
                        key={categoryId}
                        type="button"
                        onClick={() => setSelectedCategoryId(categoryId)}
                        className={`rounded-full border px-4 py-1.5 text-sm font-semibold uppercase transition ${
                          selectedCategoryId === categoryId
                            ? 'border-[#ff5a2f] bg-[#ff5a2f] !text-[#ffffff]'
                            : 'border-[#dedede] bg-white text-[#4f4f4f] hover:border-[#ff8d72] hover:text-[#ff5a2f]'
                        }`}
                      >
                        {categoryName}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <h2 className="text-xl font-black uppercase tracking-wide text-[#2f2f2f]">
                      {selectedCategoryId === 'all' ? '' : (categoriesById[selectedCategoryId] ?? 'Categoria')}
                    </h2>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="mt-4 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4 text-sm text-[#777777]">
                      No hay productos disponibles para este filtro.
                    </div>
                  ) : (
                    <>
                      {selectedCategoryId === 'all' ? (
                        <div className="mt-4 space-y-6">
                          {groupedVisibleProducts.map((group) => (
                            <section key={group.categoryId}>
                              <h2 className="text-xl font-black uppercase tracking-wide text-[#2f2f2f]">
                                {group.categoryName}
                              </h2>
                              <div className="grid gap-3 md:grid-cols-2">
                                {group.products.map((product) => renderProductCard(product))}
                              </div>
                            </section>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {visibleProducts.map((product) => renderProductCard(product))}
                        </div>
                      )}
                      <div ref={loadMoreTriggerRef} className="h-10" />
                      {hasMoreProducts ? (
                        <p className="pt-1 text-center text-xs text-[#7a7a7a]">Cargando mas productos...</p>
                      ) : null}
                    </>
                  )}
                </>
              ) : checkoutStep === 'checkout' ? (
                <div className="space-y-8">
                  <section className="space-y-4 border-b border-[#e4e4e4] pb-6">
                    <h3 className="text-3xl font-extrabold text-[#2f2f2f]">Datos generales</h3>
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-[#2f2f2f]">Correo electrónico</label>
                      <Input
                        placeholder="ejemplo@gmail.com"
                        value={customerEmail}
                        onChange={(event) => setCustomerEmail(event.target.value)}
                        className="h-11 rounded-none border-0 border-b border-[#c9ccd1] px-0 !bg-transparent !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-transparent focus-visible:rounded-none focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-[#ff5a2f] focus-visible:ring-0 focus-visible:ring-transparent"
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-[#2f2f2f]">Nombre y apellido*</label>
                        <Input
                          placeholder="Nombre completo"
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          className="h-11 rounded-none border-0 border-b border-[#c9ccd1] px-0 !bg-transparent !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-transparent focus-visible:rounded-none focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-[#ff5a2f] focus-visible:ring-0 focus-visible:ring-transparent"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-[#2f2f2f]">Número de teléfono*</label>
                        <Input
                          placeholder="011 15-2345-6789"
                          value={customerPhone}
                          onChange={(event) => setCustomerPhone(event.target.value)}
                          className="h-11 rounded-none border-0 border-b border-[#c9ccd1] px-0 !bg-transparent !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-transparent focus-visible:rounded-none focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-[#ff5a2f] focus-visible:ring-0 focus-visible:ring-transparent"
                        />
                      </div>
                    </div>
                  </section>

                  {orderType === 'delivery' ? (
                    <section className="space-y-4 border-b border-[#e4e4e4] pb-6">
                      <h3 className="text-3xl font-extrabold text-[#2f2f2f]">Dirección</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-[#2f2f2f]">Calle y número*</label>
                          <div className="relative">
                            <Input
                              placeholder="Av. Argentina 1234"
                              value={deliveryAddress}
                              onChange={(event) => {
                                setDeliveryAddress(event.target.value);
                                setDeliveryCoordinates(null);
                              }}
                              onFocus={() => {
                                if (addressSuggestions.length > 0) {
                                  setShowAddressSuggestions(true);
                                }
                              }}
                              onBlur={() => {
                                window.setTimeout(() => setShowAddressSuggestions(false), 120);
                              }}
                              className="h-11 rounded-none border-0 border-b border-[#c9ccd1] px-0 !bg-transparent !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-transparent focus-visible:rounded-none focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-[#ff5a2f] focus-visible:ring-0 focus-visible:ring-transparent"
                            />
                            {showAddressSuggestions && addressSuggestions.length > 0 ? (
                              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-56 overflow-y-auto rounded-lg border border-[#dedede] bg-white p-1 shadow-lg">
                                {addressSuggestions.map((suggestion) => (
                                  <button
                                    key={suggestion.id}
                                    type="button"
                                    className="w-full rounded-md px-2 py-2 text-left text-xs text-[#1f2937] transition hover:bg-[#f3f4f6]"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={() => {
                                      setDeliveryAddress(suggestion.label);
                                      setDeliveryCoordinates({
                                        latitude: suggestion.latitude,
                                        longitude: suggestion.longitude,
                                      });
                                      setShowAddressSuggestions(false);
                                    }}
                                  >
                                    {suggestion.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <p className="text-[11px] text-[#8a8f98]">
                            {isLoadingAddressSuggestions
                              ? 'Buscando sugerencias de dirección...'
                              : deliveryCoordinates
                                ? `Ubicación detectada: ${deliveryCoordinates.latitude.toFixed(5)}, ${deliveryCoordinates.longitude.toFixed(5)}`
                                : 'Elegí una sugerencia para guardar la ubicación exacta.'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-[#2f2f2f]">Piso y departamento</label>
                          <Input
                            placeholder="Por ejemplo: 1B"
                            value={deliveryAddressExtra}
                            onChange={(event) => setDeliveryAddressExtra(event.target.value)}
                            className="h-11 rounded-none border-0 border-b border-[#c9ccd1] px-0 !bg-transparent !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-transparent focus-visible:rounded-none focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-[#ff5a2f] focus-visible:ring-0 focus-visible:ring-transparent"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-[#2f2f2f]">Comentarios</label>
                        <Input
                          placeholder="Notas para el pedido"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          className="h-11 rounded-none border-0 border-b border-[#c9ccd1] px-0 !bg-transparent !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-transparent focus-visible:rounded-none focus-visible:border-x-0 focus-visible:border-t-0 focus-visible:border-b-[#ff5a2f] focus-visible:ring-0 focus-visible:ring-transparent"
                        />
                      </div>
                    </section>
                  ) : null}

                  <section className="space-y-4">
                    <h3 className="text-3xl font-extrabold text-[#2f2f2f]">Forma de pago*</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('transfer')}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                          paymentMethod === 'transfer' ? 'border-[#ff5a2f] bg-[#fff3ef]' : 'border-[#dadada] bg-white'
                        }`}
                      >
                        <span className="text-sm font-semibold text-[#2f2f2f]">Transferencia</span>
                        <span className={`h-5 w-5 rounded-full border ${paymentMethod === 'transfer' ? 'border-[#ff5a2f] bg-[#ff5a2f]' : 'border-[#b9b9b9] bg-transparent'}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left ${
                          paymentMethod === 'cash' ? 'border-[#ff5a2f] bg-[#fff3ef]' : 'border-[#dadada] bg-white'
                        }`}
                      >
                        <span className="text-sm font-semibold text-[#2f2f2f]">Efectivo</span>
                        <span className={`h-5 w-5 rounded-full border ${paymentMethod === 'cash' ? 'border-[#ff5a2f] bg-[#ff5a2f]' : 'border-[#b9b9b9] bg-transparent'}`} />
                      </button>
                    </div>
                    <div className="grid gap-3 pt-2 md:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-[#ff5a2f] text-[#ff5a2f] hover:bg-[#fff3ef]"
                        onClick={handleBackToMenu}
                      >
                        Atrás
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-xl bg-[#ff5a2f] !text-[#ffffff] hover:bg-[#ed4f25] disabled:bg-[#b0b0b0]"
                        onClick={() => void handleCreateOrder()}
                        disabled={!canConfirmCheckout || isCreatingOrder || isLoading}
                      >
                        {isCreatingOrder ? 'Procesando...' : 'Confirmar pedido'}
                      </Button>
                    </div>
                  </section>
                </div>
              ) : (
                <div className="flex min-h-[540px] items-center justify-center">
                  <div className="w-full max-w-2xl rounded-2xl border border-[#e2e2e2] bg-white p-8 text-center shadow-sm">
                    <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#eafaf0] text-[#2da861]">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <h3 className="text-4xl font-black text-[#2f2f2f]">Compra realizada con éxito</h3>
                    <p className="mt-2 text-base text-[#6b7280]">
                      Gracias
                      {' '}
                      <span className="font-semibold text-[#374151]">{orderSuccessSummary?.customerName || 'por tu compra'}</span>
                      . Tu pedido fue confirmado correctamente.
                    </p>

                    <div className="mt-6 rounded-xl border border-[#ececec] bg-[#fafafa] p-5 text-left">
                      <p className="flex items-center justify-between text-sm text-[#5f636b]">
                        <span>Items</span>
                        <span className="font-semibold">{orderSuccessSummary?.itemsCount ?? 0}</span>
                      </p>
                      <p className="mt-2 flex items-center justify-between text-sm text-[#5f636b]">
                        <span>Pago</span>
                        <span className="font-semibold">{orderSuccessSummary?.paymentLabel ?? '-'}</span>
                      </p>
                      {orderSuccessSummary?.orderType === 'delivery' && orderSuccessSummary.address ? (
                        <p className="mt-2 flex items-start justify-between gap-3 text-sm text-[#5f636b]">
                          <span>Dirección</span>
                          <span className="text-right font-semibold">{orderSuccessSummary.address}</span>
                        </p>
                      ) : null}
                      {orderSuccessSummary?.orderType === 'pickup' && orderSuccessSummary.pickupHeadquarterName ? (
                        <p className="mt-2 flex items-start justify-between gap-3 text-sm text-[#5f636b]">
                          <span>Retiro</span>
                          <span className="text-right font-semibold">{orderSuccessSummary.pickupHeadquarterName}</span>
                        </p>
                      ) : null}
                      <div className="mt-4 border-t border-[#e4e4e4] pt-3">
                        <p className="flex items-center justify-between text-2md font-black text-[#2f2f2f]">
                          <span>Total</span>
                          <span className="text-[#ff5a2f]">{currencyFormatter.format(orderSuccessSummary?.total ?? 0)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-[#ff5a2f] text-[#ff5a2f] hover:bg-[#fff3ef]"
                        onClick={handleBackToMenu}
                      >
                        Volver al menu
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-xl bg-[#ff5a2f] !text-[#ffffff] hover:bg-[#ed4f25]"
                        onClick={handleStartNewOrder}
                      >
                        Hacer otro pedido
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {checkoutStep !== 'success' ? (
              <aside className="h-fit rounded-2xl border border-[#dedede] bg-white p-4 md:sticky md:top-4">
              <div className="flex items-center justify-between">
                <h3 className="text-4md font-extrabold leading-none text-[#303030]">Mi pedido</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#5b5b5b]"
                  onClick={clearCart}
                  disabled={cartItemsCount === 0}
                >
                  Limpiar
                </Button>
              </div>
              <div className="mt-4 h-px bg-[#e9e9e9]" />

              {cartItems.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="mb-6 rounded-full border border-[#e6e6e6] bg-[#f8f8f8] p-8 text-[#b8bcc5]">
                    <ShoppingBag className="h-16 w-16" />
                  </div>
                  <p className="text-2xl font-medium text-[#8b8e94]">Pedido vacio</p>
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  {cartItems.map((item) => (
                    <article key={item.id}>
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-3md font-black text-[#3b3b3b]">{item.name}</h4>
                        <button
                          type="button"
                          onClick={() => openProductDialog(item)}
                          className="text-sm font-medium text-[#1f5ea8] underline-offset-2 hover:underline"
                        >
                          Editar
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-lg text-[#4f4f4f]">(x{item.quantity}) <span className="ml-3 font-semibold text-[#ff5a2f]">{currencyFormatter.format(item.price * item.quantity)}</span></p>
                        <button
                          type="button"
                          onClick={() => removeProductFromCart(item.id)}
                          className="rounded-lg border border-[#cfcfcf] p-2 text-[#7d7d7d] transition hover:border-[#ff5a2f] hover:text-[#ff5a2f]"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </article>
                  ))}

                  <div className="h-px border-t border-dashed border-[#d9d9d9]" />

                  <section>
                    <h4 className="text-3xl font-extrabold text-[#3b3b3b]">Resumen</h4>
                    <div className="mt-3 space-y-1 text-lg text-[#606060]">
                      <p className="flex items-center justify-between">
                        <span className="font-semibold">Subtotal</span>
                        <span>{currencyFormatter.format(cartTotal)}</span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span className="font-semibold">Costo de envio</span>
                        <span>-</span>
                      </p>
                    </div>
                    <div className="mt-4 border-t border-[#dfdfdf] pt-3">
                      <p className="flex items-center justify-between text-4xl font-black text-[#2f2f2f]">
                        <span>Total</span>
                        <span className="text-[#ff5a2f]">{currencyFormatter.format(cartTotal)}</span>
                      </p>
                      {orderType === 'pickup' && (pickupHeadquarter || fallbackHeadquarter) ? (
                        <p className="mt-2 text-sm text-[#666666]">
                          Retiro en: {(pickupHeadquarter ?? fallbackHeadquarter)?.name}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}

              </aside>
            ) : null}
          </div>
        </section>
      </div>

      {cartItemsCount > 0 && checkoutStep === 'menu' ? (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between rounded-2xl bg-[#ff5a2f] px-5 py-3 shadow-2xl">
            <button
              type="button"
              onClick={handleContinueCheckout}
              className="text-md font-extrabold !text-[#ffffff]"
            >
              Continuar
            </button>
            <p className="text-2md font-black !text-[#ffffff]">{currencyFormatter.format(cartTotal)}</p>
          </div>
        </div>
      ) : null}

      <Dialog open={isProductDialogOpen} onOpenChange={(open) => (!open ? closeProductDialog() : setIsProductDialogOpen(true))}>
        <DialogContent className="max-h-[94vh] max-w-[460px] overflow-y-auto border-0 p-0 !bg-[#ffffff]">
          {activeProduct ? (
            <div>
              <div className="relative h-[380px] overflow-hidden bg-[#efefef]">
                {activeProduct.imageUrl ? (
                  <img src={activeProduct.imageUrl} alt={activeProduct.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#9ea3ae]">
                    <Store className="h-20 w-20" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={closeProductDialog}
                  className="absolute left-3 top-3 rounded-full bg-[#ffffff] p-2 text-[#1f2937] shadow-md"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 p-4">
                <h3 className="text-xl font-black text-[#2f2f2f]">{activeProduct.name}</h3>
                <p className="text-sm text-[#5f636b]">{activeProduct.description ?? 'Sin descripcion.'}</p>
                <p className="text-xl font-black text-[#ff5a2f]">{currencyFormatter.format(activeProduct.price)}</p>
                <p className="text-sm text-[#7a7a7a]">
                  Sin impuestos nacionales:
                  {' '}
                  {currencyFormatter.format(activeProduct.price * 0.83)}
                </p>

                <div className="grid grid-cols-3 items-center rounded-2xl border border-[#dfdfdf] bg-[#fbfbfb]">
                  <button
                    type="button"
                    onClick={() => setProductDialogQuantity((qty) => Math.max(1, qty - 1))}
                    className="h-11 text-center text-3md font-semibold text-[#4a4a4a]"
                  >
                    -
                  </button>
                  <p className="h-11 border-x border-[#dfdfdf] text-center text-2md font-bold leading-[44px] text-[#2f2f2f]">
                    {productDialogQuantity}
                  </p>
                  <button
                    type="button"
                    onClick={() => setProductDialogQuantity((qty) => qty + 1)}
                    className="h-11 text-center text-3md font-semibold text-[#4a4a4a]"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmProductSelection}
                  className="flex h-12 w-full items-center justify-between rounded-2xl bg-[#ff5a2f] px-6 text-2md font-black !text-[#ffffff]"
                >
                  <span>Agregar a mi pedido</span>
                  <span>{currencyFormatter.format(productDialogTotal)}</span>
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
