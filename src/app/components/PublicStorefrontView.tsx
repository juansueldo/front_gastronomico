import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Beer, Bike, CheckCircle2, ChevronLeft, Clock3, Cloud, Coffee, Instagram, Mail, MapPin, MessageCircle, Phone, Pizza, Search, ShoppingBag, Store, Tag, Trash2 } from 'lucide-react';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/components/select';
import { Dialog, DialogContent } from '../shared/ui/components/dialog';
import { DeliveryZonesOverviewMap } from './DeliveryZonesOverviewMap';
import { toast } from 'sonner';
import {
  createPublicStoreOrder,
  fetchPublicStoreDeliveryZones,
  fetchPublicStoreCatalog,
  fetchPublicStore,
  type PublicStoreDeliveryZone,
  type PublicStoreInfo,
  type PublicStoreHeadquarter,
  type PublicStoreProduct,
  type PublicStoreSchedule,
} from '../features/storefront/services/storefront.service';
import { isApiError } from '../core/http/errors';
import {
  geocodeAddressWithNominatim,
  searchAddressSuggestions,
  type AddressSuggestion,
} from '../shared/services/geocoding.service';

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
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const PRODUCT_BATCH_SIZE = 12;
const DAY_OF_WEEK_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
const DAY_OF_WEEK_SHORT_LABELS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'] as const;
const CHECKOUT_INPUT_CLASS_NAME = 'h-11 rounded-lg border border-[#e3d7cc] px-3 !bg-white !text-[#1f2937] placeholder:!text-[#8a8f98] focus:!bg-white focus-visible:border-[#ff5a2f] focus-visible:ring-2 focus-visible:ring-[#ff5a2f]/20';

const isImageIconValue = (value: string) => (
  /^(https?:)?\/\//.test(value)
  || value.startsWith('/')
  || value.startsWith('data:image/')
);

const getFallbackCategoryIcon = (categoryName: string) => {
  const normalizedName = categoryName.toLowerCase();
  if (normalizedName.includes('cafe') || normalizedName.includes('café') || normalizedName.includes('cafeter')) return Coffee;
  if (normalizedName.includes('cerve') || normalizedName.includes('beer')) return Beer;
  if (normalizedName.includes('pizza')) return Pizza;
  return Tag;
};

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

const formatWindowLabel = (open: Date, close: Date) => {
  const openLabel = formatHourLabel(open);
  const closeLabel = formatHourLabel(close);
  return `${openLabel} a ${closeLabel}`;
};

const resolveAddressCoordinates = async (query: string): Promise<{ latitude: number; longitude: number } | null> => {
  const geocodedAddress = await geocodeAddressWithNominatim(query);
  if (!geocodedAddress) {
    return null;
  }

  return {
    latitude: geocodedAddress.latitude,
    longitude: geocodedAddress.longitude,
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
  const [categoryIconsById, setCategoryIconsById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [cartQuantities, setCartQuantities] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'delivery' | 'pickup'>('delivery');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedHeadquarterId, setSelectedHeadquarterId] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryCoordinates, setDeliveryCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedDeliveryAddressLabel, setSelectedDeliveryAddressLabel] = useState('');
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
  const [deliveryZones, setDeliveryZones] = useState<PublicStoreDeliveryZone[]>([]);
  const [isDeliveryZonesDialogOpen, setIsDeliveryZonesDialogOpen] = useState(false);
  const [isLoadingDeliveryZones, setIsLoadingDeliveryZones] = useState(false);
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
    () => Object.entries(categoriesById)
      .map(([categoryId, categoryName]) => ({
        categoryId,
        categoryName,
        icon: categoryIconsById[categoryId],
      }))
      .sort((left, right) => left.categoryName.localeCompare(right.categoryName, 'es')),
    [categoriesById, categoryIconsById],
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
  const offersDelivery = store?.offersDelivery !== false;
  const offersPickup = store?.offersPickup !== false;
  const hasPublicOrderingMethod = offersDelivery || offersPickup;
  const availableScheduleDays = scheduleState.dayOptions;
  const selectedScheduleDay = availableScheduleDays.find((day) => day.id === selectedScheduleDayId) ?? availableScheduleDays[0];
  const selectedScheduleSlot = selectedScheduleDay?.slots.find((slot) => slot.id === selectedScheduleSlotId) ?? selectedScheduleDay?.slots[0];
  const productDialogTotal = (activeProduct?.price ?? 0) * productDialogQuantity;
  const isAsapScheduleUnavailable = !isPickupZonePending && scheduleState.hasSchedules && !scheduleState.isOpenNow;
  const canConfirmCheckout = (
    customerName.trim().length > 0
    && customerPhone.trim().length > 0
    && paymentMethod !== ''
    && hasPublicOrderingMethod
    && (orderType !== 'delivery' || offersDelivery)
    && (orderType !== 'pickup' || offersPickup)
    && (orderType !== 'delivery' || deliveryAddress.trim().length > 0)
    && !(scheduleMode === 'asap' && isAsapScheduleUnavailable)
  );
  const visibleProducts = filteredProducts.slice(0, visibleProductsCount);
  const hasMoreProducts = visibleProductsCount < filteredProducts.length;
  const deliveryZoneHeadquarterMarkers = useMemo(() => (
    headquarters
      .filter((headquarter) => Number.isFinite(headquarter.latitude) && Number.isFinite(headquarter.longitude))
      .map((headquarter) => ({
        id: headquarter.id,
        name: headquarter.name,
        location: headquarter.location,
        latitude: Number(headquarter.latitude),
        longitude: Number(headquarter.longitude),
      }))
  ), [headquarters]);
  const groupedVisibleProducts = useMemo(() => {
    const categoryOrder = new Map(categoryEntries.map((entry, index) => [entry.categoryId, index]));
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
    setCategoryIconsById({});

    try {
      const [storeData, productsData] = await Promise.all([
        fetchPublicStore(slug),
        fetchPublicStoreCatalog(slug),
      ]);

      setStore(storeData);
      if (storeData.offersDelivery === false && storeData.offersPickup !== false) {
        setOrderType('pickup');
      } else if (storeData.offersPickup === false && storeData.offersDelivery !== false) {
        setOrderType('delivery');
      }
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
          latitude: currentHeadquarter.latitude ?? headquarter.latitude,
          longitude: currentHeadquarter.longitude ?? headquarter.longitude,
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
      const categoryIconMap: Record<string, string> = {};
      productsData.categories.forEach((category) => {
        categoryMap[category.id] = category.name;
        if (category.icon) {
          categoryIconMap[category.id] = category.icon;
        }
      });

      nextProducts.forEach((product) => {
        product.categoryIds.forEach((categoryId) => {
          if (!categoryMap[categoryId]) {
            categoryMap[categoryId] = `Categoria ${categoryId}`;
          }
        });
      });

      setCategoriesById(categoryMap);
      setCategoryIconsById(categoryIconMap);
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
    setDeliveryZones([]);
    setIsDeliveryZonesDialogOpen(false);
  }, [slug]);

  useEffect(() => {
    if (!store) {
      return;
    }

    if (orderType === 'delivery' && !offersDelivery && offersPickup) {
      setOrderType('pickup');
      return;
    }

    if (orderType === 'pickup' && !offersPickup && offersDelivery) {
      setOrderType('delivery');
    }
  }, [store, orderType, offersDelivery, offersPickup]);

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

    if (scheduleMode === 'asap' && isAsapScheduleUnavailable && availableScheduleDays.length > 0) {
      setScheduleMode('scheduled');
      return;
    }

    if (!selectedScheduleDay || selectedScheduleDay.id !== selectedScheduleDayId) {
      setSelectedScheduleDayId(selectedScheduleDay?.id ?? '');
    }
  }, [scheduleMode, availableScheduleDays, selectedScheduleDay, selectedScheduleDayId, isAsapScheduleUnavailable]);

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
    if (selectedDeliveryAddressLabel && query === selectedDeliveryAddressLabel && deliveryCoordinates) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setIsLoadingAddressSuggestions(false);
      return;
    }

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
  }, [deliveryAddress, selectedDeliveryAddressLabel, deliveryCoordinates, orderType]);

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
      <div
        className="relative flex min-h-screen overflow-hidden bg-[#fffaf6] px-4 py-10 text-center text-[#2f2f2f]"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 0% 0%, rgba(255, 120, 48, 0.28), transparent 28%)',
            'radial-gradient(circle at 100% 100%, rgba(255, 120, 48, 0.22), transparent 30%)',
            'radial-gradient(circle at 50% 50%, rgba(255, 239, 228, 0.88), transparent 34%)',
          ].join(', '),
        }}
      >
        <div className="absolute right-8 top-6 h-32 w-48 opacity-40 [background-image:radial-gradient(#ffb884_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute bottom-4 left-0 h-40 w-52 opacity-35 [background-image:radial-gradient(#ffb884_1px,transparent_1px)] [background-size:16px_16px]" />
        <Cloud className="absolute left-[7%] top-[34%] h-12 w-12 text-[#ffd8c2] opacity-70 md:h-16 md:w-16" strokeWidth={1.5} />
        <Cloud className="absolute right-[8%] top-[34%] h-14 w-14 text-[#ffd8c2] opacity-70 md:h-20 md:w-20" strokeWidth={1.5} />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center justify-center">
          <div className="relative mb-8 h-52 w-52 sm:h-64 sm:w-64">
            <div className="absolute inset-6 rounded-full border border-[#ffe4d4]" />
            <div className="absolute inset-6 rounded-full border-[5px] border-transparent border-r-[#ff5a2f] border-t-[#ff9a5c] shadow-[0_0_18px_rgba(255,90,47,0.22)]" />
            <div className="absolute inset-[23%] rounded-full bg-[#fff1e8]" />
            <div className="absolute inset-[34%] rounded-full bg-white shadow-[0_16px_45px_rgba(255,90,47,0.18)]" />
            <Store className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[#ff8a4c] sm:h-14 sm:w-14" strokeWidth={1.8} />
            <Search className="absolute bottom-[22%] left-[10%] h-7 w-7 text-[#ffc6a5] sm:h-8 sm:w-8" strokeWidth={1.8} />
            <span className="absolute right-[18%] top-[18%] h-2 w-2 rounded-full bg-[#ff7a24]" />
            <span className="absolute bottom-[26%] right-[21%] h-4 w-4 rounded-full bg-[#ff5a2f] shadow-[0_0_16px_rgba(255,90,47,0.55)]" />
            <span className="absolute left-[15%] top-[36%] text-lg font-black text-[#ffb47e]">+</span>
            <span className="absolute right-[12%] top-[42%] text-lg font-black text-[#ffb47e]">+</span>
            <span className="absolute bottom-[18%] right-[2%] text-lg font-black text-[#ffb47e]">+</span>
          </div>

          <h1 className="text-3xl font-black text-[#2f3137] sm:text-4xl">Tienda no encontrada</h1>
          <p className="mt-3 max-w-xl text-base text-[#6b7280] sm:text-lg">
            No encontramos la tienda <span className="font-semibold text-[#454545]">{slug || 'solicitada'}</span>.
          </p>
        </div>
      </div>
    );
  }

  if (storeLoadState === 'loading' || storeLoadState === 'idle') {
    return (
      <div
        className="relative flex min-h-screen overflow-hidden bg-[#fffaf6] px-4 py-10 text-center text-[#2f2f2f]"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 0% 0%, rgba(255, 120, 48, 0.28), transparent 28%)',
            'radial-gradient(circle at 100% 100%, rgba(255, 120, 48, 0.22), transparent 30%)',
            'radial-gradient(circle at 50% 50%, rgba(255, 239, 228, 0.88), transparent 34%)',
          ].join(', '),
        }}
      >
        <div className="absolute right-8 top-6 h-32 w-48 opacity-40 [background-image:radial-gradient(#ffb884_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute bottom-4 left-0 h-40 w-52 opacity-35 [background-image:radial-gradient(#ffb884_1px,transparent_1px)] [background-size:16px_16px]" />
        <Cloud className="absolute left-[7%] top-[34%] h-12 w-12 text-[#ffd8c2] opacity-70 md:h-16 md:w-16" strokeWidth={1.5} />
        <Cloud className="absolute right-[8%] top-[34%] h-14 w-14 text-[#ffd8c2] opacity-70 md:h-20 md:w-20" strokeWidth={1.5} />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center justify-center">
          <div className="relative mb-8 h-52 w-52 sm:h-64 sm:w-64">
            <div className="absolute inset-6 rounded-full border border-[#ffe4d4]" />
            <div className="absolute inset-6 rounded-full border-[5px] border-transparent border-r-[#ff5a2f] border-t-[#ff9a5c] shadow-[0_0_18px_rgba(255,90,47,0.22)] animate-spin" />
            <div className="absolute inset-[23%] rounded-full bg-[#fff1e8]" />
            <div className="absolute inset-[34%] rounded-full bg-white shadow-[0_16px_45px_rgba(255,90,47,0.18)]" />
            <Store className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[#ff8a4c] sm:h-14 sm:w-14" strokeWidth={1.8} />
            <Search className="absolute bottom-[22%] left-[10%] h-7 w-7 text-[#ffc6a5] sm:h-8 sm:w-8" strokeWidth={1.8} />
            <span className="absolute right-[18%] top-[18%] h-2 w-2 rounded-full bg-[#ff7a24]" />
            <span className="absolute bottom-[26%] right-[21%] h-4 w-4 rounded-full bg-[#ff5a2f] shadow-[0_0_16px_rgba(255,90,47,0.55)]" />
            <span className="absolute left-[15%] top-[36%] text-lg font-black text-[#ffb47e]">+</span>
            <span className="absolute right-[12%] top-[42%] text-lg font-black text-[#ffb47e]">+</span>
            <span className="absolute bottom-[18%] right-[2%] text-lg font-black text-[#ffb47e]">+</span>
          </div>

          <h1 className="text-3xl font-black text-[#2f3137] sm:text-4xl">Buscando tienda</h1>
        </div>
      </div>
    );
  }

  if (storeLoadState === 'error') {
    return (
      <div
        className="relative flex min-h-screen overflow-hidden bg-[#fffaf6] px-4 py-10 text-center text-[#2f2f2f]"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 0% 0%, rgba(255, 120, 48, 0.28), transparent 28%)',
            'radial-gradient(circle at 100% 100%, rgba(255, 120, 48, 0.22), transparent 30%)',
            'radial-gradient(circle at 50% 50%, rgba(255, 239, 228, 0.88), transparent 34%)',
          ].join(', '),
        }}
      >
        <div className="absolute right-8 top-6 h-32 w-48 opacity-40 [background-image:radial-gradient(#ffb884_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="absolute bottom-4 left-0 h-40 w-52 opacity-35 [background-image:radial-gradient(#ffb884_1px,transparent_1px)] [background-size:16px_16px]" />
        <Cloud className="absolute left-[7%] top-[34%] h-12 w-12 text-[#ffd8c2] opacity-70 md:h-16 md:w-16" strokeWidth={1.5} />
        <Cloud className="absolute right-[8%] top-[34%] h-14 w-14 text-[#ffd8c2] opacity-70 md:h-20 md:w-20" strokeWidth={1.5} />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center justify-center">
          <div className="relative mb-8 h-52 w-52 sm:h-64 sm:w-64">
            <div className="absolute inset-6 rounded-full border border-[#ffe4d4]" />
            <div className="absolute inset-6 rounded-full border-[5px] border-transparent border-r-[#ff5a2f] border-t-[#ff9a5c] shadow-[0_0_18px_rgba(255,90,47,0.22)]" />
            <div className="absolute inset-[23%] rounded-full bg-[#fff1e8]" />
            <div className="absolute inset-[34%] rounded-full bg-white shadow-[0_16px_45px_rgba(255,90,47,0.18)]" />
            <Store className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-[#ff8a4c] sm:h-14 sm:w-14" strokeWidth={1.8} />
            <Search className="absolute bottom-[22%] left-[10%] h-7 w-7 text-[#ffc6a5] sm:h-8 sm:w-8" strokeWidth={1.8} />
            <span className="absolute right-[18%] top-[18%] h-2 w-2 rounded-full bg-[#ff7a24]" />
            <span className="absolute bottom-[26%] right-[21%] h-4 w-4 rounded-full bg-[#ff5a2f] shadow-[0_0_16px_rgba(255,90,47,0.55)]" />
            <span className="absolute left-[15%] top-[36%] text-lg font-black text-[#ffb47e]">+</span>
            <span className="absolute right-[12%] top-[42%] text-lg font-black text-[#ffb47e]">+</span>
            <span className="absolute bottom-[18%] right-[2%] text-lg font-black text-[#ffb47e]">+</span>
          </div>

          <h1 className="text-3xl font-black text-[#2f3137] sm:text-4xl">No pudimos cargar la tienda</h1>
          <p className="mt-3 max-w-xl text-base text-[#6b7280] sm:text-lg">
            Intenta de nuevo en unos segundos. Si el problema continúa, revisa la configuración de la tienda.
          </p>
        </div>
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

  const loadActiveDeliveryZones = async () => {
    if (!store?.id || !offersDelivery) {
      setDeliveryZones([]);
      return;
    }

    setIsLoadingDeliveryZones(true);
    try {
      const zones = await fetchPublicStoreDeliveryZones({
        storeId: store.id,
        activeOnly: true,
      });
      setDeliveryZones(zones);
    } catch (error) {
      setDeliveryZones([]);
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar las zonas de entrega');
    } finally {
      setIsLoadingDeliveryZones(false);
    }
  };

  const handleContinueCheckout = () => {
    if (!hasPublicOrderingMethod) {
      toast.error('La tienda no tiene métodos de compra disponibles por el momento');
      return;
    }

    if (orderType === 'delivery' && !offersDelivery) {
      toast.error('La tienda no ofrece delivery actualmente');
      return;
    }

    if (orderType === 'pickup' && !offersPickup) {
      toast.error('La tienda no ofrece retiro actualmente');
      return;
    }

    setCheckoutStep('checkout');
  };

  const handleBackToMenu = () => {
    setCheckoutStep('menu');
  };

  const openDeliveryZonesDialog = () => {
    if (!offersDelivery) {
      toast.error('La tienda no ofrece delivery actualmente');
      return;
    }

    setIsDeliveryZonesDialogOpen(true);
    void loadActiveDeliveryZones();
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

    if (!hasPublicOrderingMethod) {
      toast.error('La tienda no tiene métodos de compra disponibles por el momento');
      return;
    }

    if (orderType === 'delivery' && !offersDelivery) {
      toast.error('La tienda no ofrece delivery actualmente');
      return;
    }

    if (orderType === 'pickup' && !offersPickup) {
      toast.error('La tienda no ofrece retiro actualmente');
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

    if (isAsapSchedule && isAsapScheduleUnavailable) {
      toast.error('La tienda esta cerrada. Programa el pedido para un horario disponible.');
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
        scheduledFor: isAsapSchedule || !selectedScheduleSlot?.startDate
          ? undefined
          : formatLocalDateTimeForPayload(selectedScheduleSlot.startDate),
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
      setSelectedDeliveryAddressLabel('');
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

  const renderCategoryIcon = (categoryName: string, iconValue?: string) => {
    if (iconValue) {
      if (isImageIconValue(iconValue)) {
        return <img src={iconValue} alt="" className="h-4 w-4 object-contain" />;
      }

      return <span className="text-sm leading-none">{iconValue}</span>;
    }

    const CategoryIcon = getFallbackCategoryIcon(categoryName);
    return <CategoryIcon className="h-4 w-4" />;
  };

  const renderProductCard = (product: PublicStoreProduct) => (
    <button
      key={product.id}
      type="button"
      onClick={() => openProductDialog(product)}
      className="w-full overflow-hidden rounded-2xl border border-[#efe7df] bg-white p-3 text-left shadow-[0_10px_28px_rgba(29,36,45,0.08)] transition hover:-translate-y-0.5 hover:border-[#ffb08f] hover:shadow-[0_14px_36px_rgba(29,36,45,0.12)]"
    >
      <div className="grid items-center gap-3 md:grid-cols-[1fr_108px]">
        <div>
          <p className="text-base font-extrabold text-[#1d2530]">{product.name}</p>
          {product.description ? (
            <p className="mt-1 line-clamp-2 min-h-10 text-xs text-[#69727d]">{product.description}</p>
          ) : (
            <p className="mt-1 min-h-10 text-xs text-[#9aa3ad]">Sin descripcion</p>
          )}
          <p className="mt-2 text-2xl font-black text-[#ff5a2f]">{currencyFormatter.format(product.price)}</p>
        </div>
        <div className="h-24 overflow-hidden rounded-xl border border-[#f0e7de] bg-[#fff7f0]">
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
    <div className="min-h-screen bg-[#fff8ef] text-[#1d2530]">
      <section className="relative overflow-hidden bg-[#141d28] pb-28 text-[#ffffff]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18px_18px,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[length:24px_24px] opacity-70" />
        <div className="absolute inset-y-0 right-0 hidden w-[36%] bg-[radial-gradient(circle_at_72%_35%,rgba(255,90,47,0.35),transparent_0_24%,transparent_35%),linear-gradient(135deg,transparent,rgba(255,255,255,0.06))] lg:block" />
        <div className="absolute -right-20 -top-20 hidden h-80 w-80 rounded-full border border-[#ff8a4c]/40 bg-[#ff5a2f]/10 shadow-[0_0_80px_rgba(255,90,47,0.18)] lg:block" />
        <div className="relative mx-auto max-w-7xl px-4 pt-8 md:px-6 md:pt-10">
          <div className="grid gap-6 md:grid-cols-[1.45fr_1fr_1fr]">
            <div className="flex items-start gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff7e8] shadow-xl ring-4 ring-white/10">
                {storeImageUrl ? (
                  <img src={storeImageUrl} alt={`Logo de ${store?.name ?? 'la tienda'}`} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xl font-black tracking-widest text-[#ff5a2f]">{logoText}</span>
                )}
              </div>
              <div>
                <h1 className="text-4xl font-black leading-tight tracking-tight md:text-5xl">{store?.name ?? 'Tienda'}</h1>
                <p
                  className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold ${
                    isPickupZonePending
                      ? 'bg-white/15 text-white'
                      : scheduleState.hasSchedules
                      ? (scheduleState.isOpenNow ? 'bg-emerald-400/15 text-emerald-100' : 'bg-[#ff5a2f]/20 text-[#ff9f7d]')
                      : 'bg-white/15 text-white'
                  }`}
                >
                  <Clock3 className="h-3.5 w-3.5" />
                  {isPickupZonePending
                    ? 'Selecciona sede'
                    : (!scheduleState.hasSchedules ? 'Horarios no cargados' : (scheduleState.isOpenNow ? 'Abierto ahora' : 'Cerrado ahora'))}
                </p>
              </div>
            </div>

            <div className="space-y-3 border-white/10 text-[#f3f5f7] md:border-l md:pl-6">
              <p className="flex items-center gap-3 text-sm"><Phone className="h-4 w-4 text-[#ff9f7d]" /> {fallbackHeadquarter?.phone ?? 'Sin telefono'}</p>
              <p className="flex items-center gap-3 text-sm"><Mail className="h-4 w-4 text-[#ff9f7d]" /> {`${slug}@tienda.com`}</p>
              <p className="flex items-center gap-3 text-sm"><MapPin className="h-4 w-4 text-[#ff9f7d]" /> {fallbackHeadquarter?.location ?? 'Retiro en sede'}</p>
            </div>

            <div className="space-y-3 border-white/10 md:border-l md:pl-6">
              <p className="text-sm font-semibold text-[#f7f7f7]">Síguenos</p>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#ff5a2f] shadow">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#ff5a2f] shadow">
                  <Instagram className="h-5 w-5" />
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#ff5a2f] shadow">
                  <Store className="h-5 w-5" />
                </div>
                {offersDelivery ? (
                  <button
                    type="button"
                    onClick={openDeliveryZonesDialog}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#ff5a2f] shadow transition hover:bg-[#fff3ef]"
                    aria-label="Ver zonas de entrega"
                  >
                    <MapPin className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="relative mx-auto -mt-16 max-w-7xl px-4 pb-10 md:px-6">
        <section className="mx-auto mb-6 max-w-4xl rounded-2xl border border-[#efe2d7] bg-white/95 p-4 shadow-[0_18px_55px_rgba(22,29,39,0.18)] backdrop-blur md:p-5">
          {hasPublicOrderingMethod ? (
            <div className={`grid gap-3 ${offersDelivery && offersPickup ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {offersDelivery ? (
                <Button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`h-12 rounded-full border text-base font-bold transition ${
                    orderType === 'delivery'
                      ? 'border-[#141d28] bg-[#141d28] !text-[#ffffff]'
                      : 'border-[#f1e5da] bg-[#f8f4ef] text-[#9aa0a8] hover:bg-[#fff7f0]'
                  }`}
                >
                  <Bike className="mr-2 h-5 w-5" />
                  Delivery
                </Button>
              ) : null}
              {offersPickup ? (
                <Button
                  type="button"
                  onClick={() => setOrderType('pickup')}
                  className={`h-12 rounded-full border text-base font-bold transition ${
                    orderType === 'pickup'
                      ? 'border-[#141d28] bg-[#141d28] !text-[#ffffff]'
                      : 'border-[#f1e5da] bg-[#f8f4ef] text-[#9aa0a8] hover:bg-[#fff7f0]'
                  }`}
                >
                  <ShoppingBag className="mr-2 h-5 w-5" />
                  Para retirar
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="rounded-2xl border border-[#ffb28f] bg-[#fff3ef] px-4 py-4 text-center">
              <p className="text-base font-black text-[#1d2530]">Compras no disponibles</p>
              <p className="mt-1 text-sm text-[#69727d]">La tienda no tiene habilitado delivery ni retiro por el momento.</p>
            </div>
          )}

          {orderType === 'pickup' && offersPickup ? (
            <div className="mt-4 grid items-center gap-3 md:grid-cols-[1fr_1.4fr]">
              <p className="text-sm font-bold text-[#1d2530] md:pl-10">Sede para retirar</p>
              <Select
                value={selectedHeadquarterId}
                onValueChange={setSelectedHeadquarterId}
                disabled={headquarters.length === 0}
              >
                <SelectTrigger className="h-12 rounded-full border border-[#eee2d8] !bg-white !text-[#1d2530] shadow-inner data-[placeholder]:!text-[#8f98a3] [&_svg]:!text-[#6b7280]">
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
                      <span className="flex flex-col gap-0.5">
                        <span className="font-semibold">{headquarter.name}</span>
                        {headquarter.location ? (
                          <span className="text-xs text-[#6b7280]">{headquarter.location}</span>
                        ) : null}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {hasPublicOrderingMethod ? (
          <div className="mt-3 grid items-center gap-3 md:grid-cols-[1fr_1.4fr]">
            <p className="text-sm font-bold text-[#1d2530] md:pl-10">Horario de entrega</p>
            <Select
              value={scheduleMode}
              onValueChange={(value) => {
                if (value === 'asap' && isAsapScheduleUnavailable) {
                  toast.error('La tienda esta cerrada. Programa el pedido para un horario disponible.');
                  return;
                }
                setScheduleMode(value as ScheduleMode);
              }}
              disabled={isPickupZonePending}
            >
              <SelectTrigger className="h-12 rounded-full border border-[#eee2d8] !bg-white !text-[#1d2530] shadow-inner [&_svg]:!text-[#6b7280]">
                <SelectValue className="!text-[#3f3f3f] text-base" placeholder={isPickupZonePending ? 'Selecciona una sede primero' : undefined} />
              </SelectTrigger>
              <SelectContent className="!bg-white !text-[#1f2937]">
                <SelectItem
                  value="asap"
                  disabled={isAsapScheduleUnavailable}
                  className="!text-[#1f2937] focus:!bg-[#f3f4f6] focus:!text-[#1f2937] data-[state=checked]:!bg-[#f3f4f6] data-[state=checked]:!text-[#1f2937]"
                >
                  {isAsapScheduleUnavailable ? 'Lo antes posible (cerrado)' : 'Lo antes posible'}
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
          ) : null}

          {hasPublicOrderingMethod && scheduleMode === 'scheduled' ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Select
                value={selectedScheduleDayId}
                onValueChange={setSelectedScheduleDayId}
                disabled={availableScheduleDays.length === 0 || isPickupZonePending}
              >
                <SelectTrigger className="h-12 rounded-full border border-[#eee2d8] !bg-white !text-[#1d2530] shadow-inner data-[placeholder]:!text-[#8f98a3] [&_svg]:!text-[#6b7280]">
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
                value={selectedScheduleSlotId}
                onValueChange={setSelectedScheduleSlotId}
                disabled={!selectedScheduleDay || selectedScheduleDay.slots.length === 0 || isPickupZonePending}
              >
                <SelectTrigger className="h-12 rounded-full border border-[#eee2d8] !bg-white !text-[#1d2530] shadow-inner data-[placeholder]:!text-[#8f98a3] [&_svg]:!text-[#6b7280]">
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
          ) : isAsapScheduleUnavailable ? (
            <p className="mt-2 rounded-xl border border-[#ffd3c4] bg-[#fff3ef] px-3 py-2 text-xs font-semibold text-[#d54528]">
              La tienda esta cerrada ahora. Para comprar, programa el pedido en un horario disponible.
            </p>
          ) : !scheduleState.hasSchedules ? (
            <p className="mt-2 text-xs text-[#6b7280]">
              Esta sede no tiene horarios configurados. El pedido quedara como lo antes posible.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#f1e5da] pt-4">
            <span
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                isPickupZonePending
                  ? 'bg-[#eef0f2] text-[#4b5563]'
                  : scheduleState.hasSchedules
                  ? (scheduleState.isOpenNow ? 'bg-[#dff4e7] text-[#209454]' : 'bg-[#ffe2d9] text-[#d54528]')
                  : 'bg-[#eef0f2] text-[#4b5563]'
              }`}
            >
              {isPickupZonePending
                ? 'Selecciona sede'
                : (!scheduleState.hasSchedules ? 'Sin horarios' : (scheduleState.isOpenNow ? 'Abierto ahora' : 'Cerrado ahora'))}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-[#5f6873]">
              <Clock3 className="h-4 w-4 text-[#ff7a45]" />
              <span className="text-sm">
                {isPickupZonePending ? 'Elige una sede para ver horarios' : (scheduleState.todayWindowLabel || 'Sin horarios para hoy')}
              </span>
              {!isPickupZonePending && !scheduleState.isOpenNow && scheduleState.nextOpeningLabel ? (
                <>
                  <span className="text-[#d6c9be]">|</span>
                  <Clock3 className="h-4 w-4 text-[#ff7a45]" />
                  <span className="text-sm">Proxima apertura: {scheduleState.nextOpeningLabel}</span>
                </>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-[28px] bg-transparent">
          <div className={`grid gap-5 ${checkoutStep === 'success' ? '' : 'lg:grid-cols-[1.6fr_1fr]'}`}>
            <div className="rounded-2xl border border-[#f0e4d9] bg-white/95 p-4 shadow-[0_16px_45px_rgba(29,36,45,0.08)] md:p-6">
              {checkoutStep === 'menu' ? (
                <>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8b949e]" />
                    <Input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      className="h-14 rounded-full border-[#eee2d8] !bg-white pl-14 pr-4 !text-[#1d2530] shadow-inner placeholder:!text-[#9aa3ad] focus:!bg-white focus-visible:ring-[#ffb08f]"
                      placeholder="Buscar productos..."
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-b border-[#f1e6dc] pb-5">
                    <button
                      type="button"
                      onClick={() => setSelectedCategoryId('all')}
                      className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition ${
                        selectedCategoryId === 'all'
                          ? 'border-[#ff8a4c] bg-[#ff8a4c] !text-[#ffffff] shadow-[0_8px_20px_rgba(255,90,47,0.22)]'
                          : 'border-[#eee2d8] bg-[#fffaf4] text-[#4f5864] hover:border-[#ffb08f] hover:text-[#ff5a2f]'
                      }`}
                    >
                      <Tag className="h-4 w-4" />
                      Todas
                    </button>
                    {categoryEntries.map(({ categoryId, categoryName, icon }) => (
                      <button
                        key={categoryId}
                        type="button"
                        onClick={() => setSelectedCategoryId(categoryId)}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-bold transition ${
                          selectedCategoryId === categoryId
                            ? 'border-[#ff8a4c] bg-[#ff8a4c] !text-[#ffffff] shadow-[0_8px_20px_rgba(255,90,47,0.22)]'
                            : 'border-[#eee2d8] bg-[#fffaf4] text-[#4f5864] hover:border-[#ffb08f] hover:text-[#ff5a2f]'
                        }`}
                      >
                        {renderCategoryIcon(categoryName, icon)}
                        {categoryName}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <h2 className="text-xl font-black uppercase tracking-wide text-[#1d2530]">
                      {selectedCategoryId === 'all' ? '' : (categoriesById[selectedCategoryId] ?? 'Categoria')}
                    </h2>
                  </div>

                  {filteredProducts.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-[#f1e6dc] bg-[#fffaf4] p-4 text-sm text-[#69727d]">
                      No hay productos disponibles para este filtro.
                    </div>
                  ) : (
                    <>
                      {selectedCategoryId === 'all' ? (
                        <div className="mt-4 space-y-6">
                          {groupedVisibleProducts.map((group) => (
                            <section key={group.categoryId}>
                              <h2 className="mb-3 text-xl font-black uppercase tracking-wide text-[#1d2530]">
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
                        className={CHECKOUT_INPUT_CLASS_NAME}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-[#2f2f2f]">Nombre y apellido*</label>
                        <Input
                          placeholder="Nombre completo"
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          className={CHECKOUT_INPUT_CLASS_NAME}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-[#2f2f2f]">Número de teléfono*</label>
                        <Input
                          placeholder="011 15-2345-6789"
                          value={customerPhone}
                          onChange={(event) => setCustomerPhone(event.target.value)}
                          className={CHECKOUT_INPUT_CLASS_NAME}
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
                                const nextAddress = event.target.value;
                                setDeliveryAddress(nextAddress);
                                if (nextAddress.trim() !== selectedDeliveryAddressLabel) {
                                  setSelectedDeliveryAddressLabel('');
                                  setDeliveryCoordinates(null);
                                }
                              }}
                              onFocus={() => {
                                if (addressSuggestions.length > 0 && deliveryAddress.trim() !== selectedDeliveryAddressLabel) {
                                  setShowAddressSuggestions(true);
                                }
                              }}
                              onBlur={() => {
                                window.setTimeout(() => setShowAddressSuggestions(false), 120);
                              }}
                              className={CHECKOUT_INPUT_CLASS_NAME}
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
                                      addressSuggestAbortRef.current?.abort();
                                      setDeliveryAddress(suggestion.label);
                                      setSelectedDeliveryAddressLabel(suggestion.label);
                                      setDeliveryCoordinates({
                                        latitude: suggestion.latitude,
                                        longitude: suggestion.longitude,
                                      });
                                      setAddressSuggestions([]);
                                      setShowAddressSuggestions(false);
                                    }}
                                  >
                                    {suggestion.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                          <input type="hidden" name="deliveryLatitude" value={deliveryCoordinates?.latitude ?? ''} />
                          <input type="hidden" name="deliveryLongitude" value={deliveryCoordinates?.longitude ?? ''} />
                          {isLoadingAddressSuggestions ? (
                            <p className="text-[11px] text-[#8a8f98]">Buscando sugerencias de dirección...</p>
                          ) : !deliveryCoordinates ? (
                            <p className="text-[11px] text-[#8a8f98]">Elegí una sugerencia para guardar la ubicación exacta.</p>
                          ) : null}
                        </div>
                        <div className="space-y-1">
                          <label className="text-sm font-semibold text-[#2f2f2f]">Piso y departamento</label>
                          <Input
                            placeholder="Por ejemplo: 1B"
                            value={deliveryAddressExtra}
                            onChange={(event) => setDeliveryAddressExtra(event.target.value)}
                            className={CHECKOUT_INPUT_CLASS_NAME}
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm font-semibold text-[#2f2f2f]">Comentarios</label>
                        <Input
                          placeholder="Notas para el pedido"
                          value={notes}
                          onChange={(event) => setNotes(event.target.value)}
                          className={CHECKOUT_INPUT_CLASS_NAME}
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
              <aside className="relative h-fit overflow-hidden rounded-2xl border border-[#263342] bg-[#141d28] p-5 text-white shadow-[0_18px_45px_rgba(20,29,40,0.22)] md:sticky md:top-4">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12px_12px,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:24px_24px] opacity-60" />
              <div className="pointer-events-none absolute -bottom-24 -right-16 h-56 w-56 rounded-full border border-[#ff8a4c]/20 bg-[#ff5a2f]/10" />
              <div className="relative">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black leading-none text-white">Mi pedido</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#ffb18c] hover:bg-white/10 hover:text-[#ffcfba]"
                  onClick={clearCart}
                  disabled={cartItemsCount === 0}
                >
                  Limpiar
                </Button>
              </div>
              <div className="mt-4 h-px bg-white/10" />

              {cartItems.length === 0 ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
                  <div className="mb-6 rounded-full border border-[#ff8a4c]/35 bg-white/5 p-8 text-[#d6dce4]">
                    <ShoppingBag className="h-16 w-16" />
                  </div>
                  <p className="text-2xl font-black text-white">Tu pedido está vacío</p>
                  <p className="mt-3 max-w-56 text-sm leading-6 text-[#d5dbe4]">Agrega productos para comenzar tu pedido</p>
                  <div className="mt-10 rounded-2xl border border-[#ff8a4c]/50 bg-white/5 p-5 text-sm font-semibold leading-6 text-[#ffbf9f]">
                    Agrega productos y podrás ver el total de tu pedido aquí
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-5">
                  {cartItems.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-base font-black text-white">{item.name}</h4>
                        <button
                          type="button"
                          onClick={() => openProductDialog(item)}
                          className="text-sm font-medium text-[#ffb18c] underline-offset-2 hover:underline"
                        >
                          Editar
                        </button>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-sm text-[#d5dbe4]">(x{item.quantity}) <span className="ml-3 text-lg font-black text-[#ff9f7d]">{currencyFormatter.format(item.price * item.quantity)}</span></p>
                        <button
                          type="button"
                          onClick={() => removeProductFromCart(item.id)}
                          className="rounded-lg border border-white/15 p-2 text-[#d5dbe4] transition hover:border-[#ff8a4c] hover:text-[#ff9f7d]"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </article>
                  ))}

                  <div className="h-px border-t border-dashed border-white/20" />

                  <section>
                    <h4 className="text-2xl font-black text-white">Resumen</h4>
                    <div className="mt-3 space-y-1 text-base text-[#d5dbe4]">
                      <p className="flex items-center justify-between">
                        <span className="font-semibold">Subtotal</span>
                        <span>{currencyFormatter.format(cartTotal)}</span>
                      </p>
                      <p className="flex items-center justify-between">
                        <span className="font-semibold">Costo de envio</span>
                        <span>-</span>
                      </p>
                    </div>
                    <div className="mt-4 border-t border-white/15 pt-3">
                      <p className="flex items-center justify-between text-3xl font-black text-white">
                        <span>Total</span>
                        <span className="text-[#ff9f7d]">{currencyFormatter.format(cartTotal)}</span>
                      </p>
                      {orderType === 'pickup' && (pickupHeadquarter || fallbackHeadquarter) ? (
                        <p className="mt-2 text-sm text-[#d5dbe4]">
                          Retiro en: {(pickupHeadquarter ?? fallbackHeadquarter)?.name}
                        </p>
                      ) : null}
                    </div>
                  </section>
                </div>
              )}

              </div>
              </aside>
            ) : null}
          </div>
        </section>
      </div>

      {cartItemsCount > 0 && checkoutStep === 'menu' && hasPublicOrderingMethod ? (
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
        <DialogContent className="max-h-[94vh] w-[96vw] !max-w-[1180px] sm:!max-w-[1180px] overflow-hidden rounded-2xl border border-[#f0e4d9] p-0 !bg-[#fffaf4] shadow-[0_28px_90px_rgba(20,29,40,0.35)]">
          {activeProduct ? (
            <div className="grid max-h-[94vh] overflow-y-auto md:grid-cols-[1.2fr_0.8fr]">
              <div className="relative min-h-[320px] overflow-hidden bg-[#141d28] md:min-h-[620px]">
                {activeProduct.imageUrl ? (
                  <img src={activeProduct.imageUrl} alt={activeProduct.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[#ffb18c]">
                    <Store className="h-20 w-20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141d28]/35 via-transparent to-transparent" />
                <button
                  type="button"
                  onClick={closeProductDialog}
                  className="absolute left-4 top-4 rounded-full bg-white p-2.5 text-[#1f2937] shadow-lg transition hover:bg-[#fff3ef] hover:text-[#ff5a2f]"
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              </div>

              <div className="flex flex-col p-5 md:p-7">
                <div className="space-y-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a2f]">Producto</p>
                  <h3 className="text-3xl font-black leading-tight text-[#1d2530]">{activeProduct.name}</h3>
                  <p className="text-sm leading-6 text-[#69727d]">{activeProduct.description ?? 'Sin descripcion.'}</p>
                  <p className="text-3xl font-black text-[#ff5a2f]">{currencyFormatter.format(activeProduct.price)}</p>
                </div>

                <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-[#69727d]">
                  Sin impuestos nacionales:
                  {' '}
                  {currencyFormatter.format(activeProduct.price * 0.83)}
                </p>

                <div className="mt-6 grid grid-cols-3 items-center overflow-hidden rounded-2xl border border-[#eaded4] bg-white">
                  <button
                    type="button"
                    onClick={() => setProductDialogQuantity((qty) => Math.max(1, qty - 1))}
                    className="h-12 text-center text-xl font-black text-[#1d2530] transition hover:bg-[#fff3ef] hover:text-[#ff5a2f]"
                    aria-label="Quitar unidad"
                  >
                    -
                  </button>
                  <p className="h-12 border-x border-[#eaded4] text-center text-lg font-black leading-[48px] text-[#1d2530]">
                    {productDialogQuantity}
                  </p>
                  <button
                    type="button"
                    onClick={() => setProductDialogQuantity((qty) => qty + 1)}
                    className="h-12 text-center text-xl font-black text-[#1d2530] transition hover:bg-[#fff3ef] hover:text-[#ff5a2f]"
                    aria-label="Agregar unidad"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={confirmProductSelection}
                  className="mt-5 flex h-14 w-full items-center justify-between rounded-2xl bg-[#ff5a2f] px-6 text-base font-black !text-[#ffffff] shadow-[0_14px_30px_rgba(255,90,47,0.28)] transition hover:bg-[#ed4f25]"
                >
                  <span>Agregar a mi pedido</span>
                  <span>{currencyFormatter.format(productDialogTotal)}</span>
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeliveryZonesDialogOpen} onOpenChange={setIsDeliveryZonesDialogOpen}>
        <DialogContent className="max-h-[94vh] w-[98vw] !max-w-[1500px] sm:!max-w-[1500px] overflow-hidden rounded-2xl border border-[#f0e4d9] !bg-[#fffaf4] p-0 shadow-[0_28px_90px_rgba(20,29,40,0.35)] [&_[data-slot=dialog-close]]:border-[#eadfd4] [&_[data-slot=dialog-close]]:!bg-[#fff4ec] [&_[data-slot=dialog-close]]:text-[#1d2530] [&_[data-slot=dialog-close]]:hover:border-[#ff5a2f] [&_[data-slot=dialog-close]]:hover:text-[#ff5a2f]">
          <div className="border-b border-[#efe2d7] bg-[#fffaf4] px-5 py-4">
            <h3 className="text-xl font-black text-[#1d2530]">Zonas de entrega activas</h3>
            <p className="mt-1 text-sm text-[#69727d]">
              Buscá una dirección y comprobá si está dentro de una zona de cobertura.
            </p>
          </div>
          <div className="h-[min(68vh,720px)] min-h-[500px] bg-[#fffaf4] p-4 pt-3">
            {isLoadingDeliveryZones ? (
              <div className="flex h-full items-center justify-center rounded-2xl bg-white text-sm text-[#6b7280]">
                Cargando zonas...
              </div>
            ) : deliveryZones.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl bg-white px-6 text-center text-sm text-[#6b7280]">
                No hay zonas activas disponibles para esta tienda.
              </div>
            ) : (
              <DeliveryZonesOverviewMap zones={deliveryZones} headquarters={deliveryZoneHeadquarterMarkers} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
