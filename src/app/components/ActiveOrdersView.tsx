import { useEffect, useRef, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { getLoggedUser } from '../authStorage';
import {
  ApiError,
  checkDeliveryZonePoint,
  createOrder as createBackendOrder,
  type CreateOrderRequest,
  createCashMovement,
  deleteDeliveryZone,
  fetchActiveOrders as fetchBackendActiveOrders,
  finalizeOrder,
  getAvailableOrderStatusTargets,
  getDeliveryZone,
  getOrderStatusLabel,
  type DeliveryZonePoint,
  type PaymentMethod,
  type ProductCategory,
  type ProductItem,
  transitionOrderStatus,
  upsertDeliveryZone,
} from '../api';
import { endpoints } from '../api/endpoints';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from './ui/carousel';

type OrderVisualPriority = 'default' | 'on-time' | 'delayed' | 'old';
type DeliveryAddressValidationState = 'idle' | 'typing' | 'validating' | 'valid' | 'outside_zone' | 'not_found' | 'error';

interface GeocodedAddressResult {
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

interface ActiveOrderItem {
  id: string;
  contactId: number;
  type: 'delivery' | 'salon';
  customerName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: string[];
  detail: string;
  status: string;
  total: string;
  createdAt: string;
  notes?: string;
}

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

let googleMapsScriptPromise: Promise<unknown> | null = null;

const loadGoogleMapsScript = (apiKey: string) => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps no disponible en servidor'));
  }

  const windowWithGoogle = window as Window & { google?: unknown };

  if (windowWithGoogle.google) {
    return Promise.resolve(windowWithGoogle.google);
  }

  if (googleMapsScriptPromise) {
    return googleMapsScriptPromise;
  }

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

const geocodeAddressWithGoogle = async (address: string): Promise<GeocodedAddressResult | null> => {
  if (!GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(geocodeUrl);

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as {
    status: string;
    results?: Array<{
      formatted_address: string;
      geometry: {
        location: {
          lat: number;
          lng: number;
        };
      };
    }>;
  };

  if (data.status !== 'OK' || !data.results || data.results.length === 0) {
    return null;
  }

  const firstResult = data.results[0];
  return {
    formattedAddress: firstResult.formatted_address,
    latitude: firstResult.geometry.location.lat,
    longitude: firstResult.geometry.location.lng,
  };
};

const geocodeAddressWithNominatim = async (address: string): Promise<GeocodedAddressResult | null> => {
  const geocodeUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
  const response = await fetch(geocodeUrl, {
    headers: {
      'Accept-Language': 'es',
    },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json() as Array<{
    display_name: string;
    lat: string;
    lon: string;
  }>;

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const firstResult = data[0];
  const latitude = Number(firstResult.lat);
  const longitude = Number(firstResult.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    formattedAddress: firstResult.display_name,
    latitude,
    longitude,
  };
};

const geocodeAddress = async (address: string) => {
  const googleResult = await geocodeAddressWithGoogle(address);

  if (googleResult) {
    return googleResult;
  }

  return geocodeAddressWithNominatim(address);
};

const getPriorityMapPinColor = (priority: OrderVisualPriority) => {
  if (priority === 'old') {
    return '#ef4444';
  }

  if (priority === 'delayed') {
    return '#eab308';
  }

  if (priority === 'on-time') {
    return '#22c55e';
  }

  return '#6b7280';
};

export function ActiveOrdersView() {
  const [orders, setOrders] = useState<ActiveOrderItem[]>([]);
  const [detailOrder, setDetailOrder] = useState<ActiveOrderItem | null>(null);
  const [statusOrder, setStatusOrder] = useState<ActiveOrderItem | null>(null);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [newOrderType, setNewOrderType] = useState<ActiveOrderItem['type']>('delivery');
  const [newOrderCustomerName, setNewOrderCustomerName] = useState('');
  const [newOrderCustomerPhone, setNewOrderCustomerPhone] = useState('');
  const [newOrderUserId, setNewOrderUserId] = useState('');
  const [newOrderTableId, setNewOrderTableId] = useState('');
  const [newOrderWaiterId, setNewOrderWaiterId] = useState('');
  const [newOrderDeliveryDate, setNewOrderDeliveryDate] = useState('');
  const [newOrderAddress, setNewOrderAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isLoadingAddressSuggestions, setIsLoadingAddressSuggestions] = useState(false);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [newOrderDetail, setNewOrderDetail] = useState('');
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, number>>({});
  const [newOrderNotes, setNewOrderNotes] = useState('');
  const [finalizePaymentMethod, setFinalizePaymentMethod] = useState<PaymentMethod>('efectivo');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isValidatingAddress, setIsValidatingAddress] = useState(false);
  const [deliveryAddressValidationState, setDeliveryAddressValidationState] = useState<DeliveryAddressValidationState>('idle');
  const [deliveryAddressValidationMessage, setDeliveryAddressValidationMessage] = useState('');
  const [validatedDeliveryAddressPoint, setValidatedDeliveryAddressPoint] = useState<GeocodedAddressResult | null>(null);
  const [validatedDeliveryAddressInput, setValidatedDeliveryAddressInput] = useState('');
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const [deliveryZonePoints, setDeliveryZonePoints] = useState<DeliveryZonePoint[]>([]);
  const [draftDeliveryZonePoints, setDraftDeliveryZonePoints] = useState<DeliveryZonePoint[]>([]);
  const [isEditingDeliveryZone, setIsEditingDeliveryZone] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressNextClick = useRef(false);
  const deliveryMapRef = useRef<HTMLDivElement | null>(null);
  const googleMapInstanceRef = useRef<any>(null);
  const googleMapMarkersRef = useRef<any[]>([]);
  const deliveryZonePolygonRef = useRef<any>(null);
  const draftDeliveryZonePolygonRef = useRef<any>(null);
  const draftDeliveryZonePolylineRef = useRef<any>(null);
  const deliveryZoneClickListenerRef = useRef<any>(null);
  const draftVertexMarkersRef = useRef<any[]>([]);
  const addressValidationRequestIdRef = useRef(0);
  const addressSuggestionsRequestIdRef = useRef(0);

  const deliveryOrders = orders.filter((order) => order.type === 'delivery');
  const salonOrders = orders.filter((order) => order.type === 'salon');
  const statusOptions = statusOrder
    ? getAvailableOrderStatusTargets(statusOrder.status).map((status) => getOrderStatusLabel(status))
    : [];
  const selectedProductsWithQuantity = availableProducts
    .map((product) => ({
      ...product,
      quantity: selectedProductQuantities[product.id] ?? 0,
    }))
    .filter((product) => product.quantity > 0);
  const selectedProductsTotal = selectedProductsWithQuantity.reduce(
    (accumulator, product) => accumulator + (product.price * product.quantity),
    0,
  );
  const selectedProductsCount = selectedProductsWithQuantity.reduce(
    (accumulator, product) => accumulator + product.quantity,
    0,
  );
  const categoriesById = availableCategories.reduce((accumulator, category) => {
    accumulator[category.id] = category;
    return accumulator;
  }, {} as Record<string, ProductCategory>);

  const getProductCategoryIds = (product: ProductItem) => (Array.isArray(product.categoryIds) ? product.categoryIds : []);

  const filteredProducts = availableProducts.filter((product) => {
    const normalizedFilter = productFilter.trim().toLowerCase();
    const matchesName = normalizedFilter.length === 0
      || product.name.toLowerCase().includes(normalizedFilter)
      || (product.description ?? '').toLowerCase().includes(normalizedFilter);
    const productCategoryIds = getProductCategoryIds(product);
    const matchesCategory = categoryFilter === 'all' || productCategoryIds.includes(categoryFilter);

    return matchesName && matchesCategory;
  });

  const groupedFilteredProducts = filteredProducts.reduce((accumulator, product) => {
    const productCategoryIds = getProductCategoryIds(product);
    const categoryIds = productCategoryIds.length > 0 ? productCategoryIds : ['uncategorized'];

    categoryIds.forEach((categoryId) => {
      const categoryLabel = categoryId === 'uncategorized'
        ? 'Sin categoría'
        : categoriesById[categoryId]?.name ?? 'Sin categoría';

      if (!accumulator[categoryLabel]) {
        accumulator[categoryLabel] = [];
      }

      accumulator[categoryLabel].push(product);
    });

    return accumulator;
  }, {} as Record<string, ProductItem[]>);

  const groupedFilteredProductEntries = Object.entries(groupedFilteredProducts)
    .map(([categoryName, products]) => [
      categoryName,
      products.filter((product, index, productList) => (
        productList.findIndex((candidate) => candidate.id === product.id) === index
      )),
    ] as const)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'));

  const normalizeOrder = (order: any): ActiveOrderItem => {
    const rawTotal = order?.total_amount ?? order?.total ?? 0;
    const parsedTotal = Number(rawTotal);
    const displayTotal = Number.isFinite(parsedTotal)
      ? currencyFormatter.format(parsedTotal)
      : String(rawTotal ?? '0');

    const backendType = String(order?.type ?? '');
    const normalizedType: ActiveOrderItem['type'] = backendType === 'delivery' ? 'delivery' : 'salon';

    const normalizedItems = Array.isArray(order?.items)
      ? order.items.map((item: any) => String(item))
      : Array.isArray(order?.OrderItems)
        ? order.OrderItems.map((item: any) => {
          const name = item?.Product?.name ?? `Producto ${item?.productId ?? ''}`.trim();
          const quantity = Number(item?.quantity ?? 0);
          return quantity > 1 ? `${name} x${quantity}` : String(name);
        })
        : [];

    const customerFullName = [order?.Customer?.name].filter(Boolean).join(' ').trim();
    const customerName = order?.customerName
      || order?.Customer?.name
      || customerFullName
      || (order?.customerId ? `Cliente #${order.customerId}` : `Orden ${order?.order_number ?? order?.id ?? ''}`);

    return {
      id: String(order?.id ?? order?.order_number ?? crypto.randomUUID()),
      contactId: Number(order?.contactId ?? order?.customerId ?? 0),
      type: normalizedType,
      customerName: String(customerName),
      address: order?.address ?? order?.delivery_address ?? undefined,
      latitude: order?.latitude ?? order?.delivery_latitude ?? undefined,
      longitude: order?.longitude ?? order?.delivery_longitude ?? undefined,
      items: normalizedItems,
      detail: String(order?.detail ?? order?.order_number ?? 'Sin detalle'),
      status: getOrderStatusLabel(String(order?.status ?? order?.Status?.name ?? 'pending')),
      total: String(displayTotal),
      createdAt: String(order?.createdAt ?? order?.order_date ?? ''),
      notes: order?.notes ?? undefined,
    };
  };

  const loadOrders = async () => {
    setIsLoadingOrders(true);

    try {
      const backendOrders = await fetchBackendActiveOrders();
      setOrders(backendOrders.map(normalizeOrder));
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudieron cargar las órdenes');
      }
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      await loadOrders();

      const [productsResult, categoriesResult] = await Promise.allSettled([
        endpoints.fetchProducts(),
        endpoints.fetchCategories(),
      ]);

      if (productsResult.status === 'fulfilled') {
        const productsPayload = productsResult.value;
        const products = Array.isArray(productsPayload)
          ? productsPayload
          : productsPayload?.rows ?? productsPayload?.products ?? productsPayload?.data ?? [];
        setAvailableProducts(products);
      } else {
        const reason = productsResult.reason;
        toast.error(reason instanceof Error ? reason.message : 'No se pudieron cargar los productos');
      }

      if (categoriesResult.status === 'fulfilled') {
        const categoriesPayload = categoriesResult.value;
        const categories = Array.isArray(categoriesPayload)
          ? categoriesPayload
          : categoriesPayload?.rows ?? categoriesPayload?.categories ?? categoriesPayload?.data ?? [];
        setAvailableCategories(categories);
      } else {
        const reason = categoriesResult.reason;
        toast.error(reason instanceof Error ? reason.message : 'No se pudieron cargar las categorías');
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void loadOrders();
    }, 20_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const loggedUser = getLoggedUser();
    if (loggedUser?.id && !newOrderUserId) {
      setNewOrderUserId(String(loggedUser.id));
    }
  }, [newOrderUserId]);

  useEffect(() => {
    const loadDeliveryZone = async () => {
      try {
        const zone = await getDeliveryZone();
        setDeliveryZonePoints(zone?.polygon ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'No se pudo cargar la zona de entrega');
      }
    };

    void loadDeliveryZone();
  }, []);

  useEffect(() => {
    if (!isCreateOrderDialogOpen || newOrderType !== 'delivery') {
      resetDeliveryAddressValidation();
      return;
    }

    const trimmedAddress = newOrderAddress.trim();

    if (!trimmedAddress) {
      resetDeliveryAddressValidation();
      return;
    }

    setDeliveryAddressValidationState('typing');
    setDeliveryAddressValidationMessage('Escribiendo dirección...');

    const requestId = ++addressValidationRequestIdRef.current;
    const timeoutId = window.setTimeout(async () => {
      if (requestId !== addressValidationRequestIdRef.current) {
        return;
      }

      await validateDeliveryAddress(trimmedAddress);
    }, 650);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [newOrderAddress, newOrderType, isCreateOrderDialogOpen]);

  useEffect(() => {
    if (!isCreateOrderDialogOpen || newOrderType !== 'delivery') {
      resetAddressSuggestions();
      return;
    }

    const query = newOrderAddress.trim();

    if (query.length < 3) {
      resetAddressSuggestions();
      return;
    }

    const requestId = ++addressSuggestionsRequestIdRef.current;
    setIsLoadingAddressSuggestions(true);
    setShowAddressSuggestions(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`,
          {
            headers: {
              'Accept-Language': 'es',
            },
          },
        );

        if (!response.ok) {
          throw new Error('No se pudieron obtener sugerencias');
        }

        const data = await response.json() as Array<{
          display_name?: string;
          lat?: string;
          lon?: string;
        }>;

        if (requestId !== addressSuggestionsRequestIdRef.current) {
          return;
        }

        const nextSuggestions = (Array.isArray(data) ? data : [])
          .map((item) => {
            const lat = Number(item.lat);
            const lng = Number(item.lon);

            if (!item.display_name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

            return {
              label: item.display_name,
              lat,
              lng,
            };
          })
          .filter((item): item is AddressSuggestion => item !== null);

        setAddressSuggestions(nextSuggestions);
      } catch {
        if (requestId !== addressSuggestionsRequestIdRef.current) {
          return;
        }

        setAddressSuggestions([]);
      } finally {
        if (requestId === addressSuggestionsRequestIdRef.current) {
          setIsLoadingAddressSuggestions(false);
        }
      }
    }, 300);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [newOrderAddress, newOrderType, isCreateOrderDialogOpen]);

  const incrementProductQuantity = (productId: string) => {
    setSelectedProductQuantities((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));
  };

  const decrementProductQuantity = (productId: string) => {
    setSelectedProductQuantities((prev) => {
      const currentQuantity = prev[productId] ?? 0;

      if (currentQuantity <= 1) {
        const { [productId]: _removed, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [productId]: currentQuantity - 1,
      };
    });
  };

  const clearSelectedProducts = () => {
    setSelectedProductQuantities({});
  };

  const resetAddressSuggestions = () => {
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
    setIsLoadingAddressSuggestions(false);
  };

  const resetDeliveryAddressValidation = () => {
    setDeliveryAddressValidationState('idle');
    setDeliveryAddressValidationMessage('');
    setValidatedDeliveryAddressPoint(null);
    setValidatedDeliveryAddressInput('');
  };

  const validateDeliveryPoint = async (point: GeocodedAddressResult) => {
    try {
      const zoneCheck = await checkDeliveryZonePoint({
        latitude: point.latitude,
        longitude: point.longitude,
      });

      if (zoneCheck.hasZone && !zoneCheck.inside) {
        setDeliveryAddressValidationState('outside_zone');
        setDeliveryAddressValidationMessage('Dirección fuera de la zona de entrega');
        setValidatedDeliveryAddressPoint(null);
        setValidatedDeliveryAddressInput('');
        return null;
      }

      setDeliveryAddressValidationState('valid');
      setDeliveryAddressValidationMessage(
        zoneCheck.hasZone
          ? 'Dirección válida dentro de zona'
          : 'Dirección válida (sin zona activa)',
      );
      setValidatedDeliveryAddressPoint(point);
      setValidatedDeliveryAddressInput(point.formattedAddress.trim());
      return point;
    } catch {
      setDeliveryAddressValidationState('error');
      setDeliveryAddressValidationMessage('No se pudo validar la zona de entrega');
      setValidatedDeliveryAddressPoint(null);
      setValidatedDeliveryAddressInput('');
      return null;
    }
  };

  const validateDeliveryAddress = async (address: string) => {
    const trimmedAddress = address.trim();

    if (!trimmedAddress) {
      resetDeliveryAddressValidation();
      return null;
    }

    setDeliveryAddressValidationState('validating');
    setDeliveryAddressValidationMessage('Validando dirección y zona...');

    const geocodedAddress = await geocodeAddress(trimmedAddress);

    if (!geocodedAddress) {
      setDeliveryAddressValidationState('not_found');
      setDeliveryAddressValidationMessage('No se encontró la dirección');
      setValidatedDeliveryAddressPoint(null);
      setValidatedDeliveryAddressInput('');
      return null;
    }

    return validateDeliveryPoint({
      ...geocodedAddress,
      formattedAddress: trimmedAddress,
    });
  };

  const selectAddressSuggestion = async (suggestion: AddressSuggestion) => {
    const normalizedAddress = suggestion.label.trim();
    setNewOrderAddress(normalizedAddress);
    resetAddressSuggestions();
    setIsValidatingAddress(true);
    await validateDeliveryPoint({
      formattedAddress: normalizedAddress,
      latitude: suggestion.lat,
      longitude: suggestion.lng,
    });
    setIsValidatingAddress(false);
  };

  const startDeliveryZoneEdition = () => {
    if (!GOOGLE_MAPS_API_KEY) {
      toast.error('Configurá VITE_GOOGLE_MAPS_API_KEY para dibujar zona de entrega');
      return;
    }

    setDraftDeliveryZonePoints(deliveryZonePoints);
    setIsEditingDeliveryZone(true);
    toast.info('Modo edición activo: hacé click sobre el mapa para agregar puntos');
  };

  const cancelDeliveryZoneEdition = () => {
    setIsEditingDeliveryZone(false);
    setDraftDeliveryZonePoints([]);
  };

  const undoDeliveryZonePoint = () => {
    setDraftDeliveryZonePoints((prev) => prev.slice(0, -1));
  };

  const saveDeliveryZonePolygon = async () => {
    if (draftDeliveryZonePoints.length < 3) {
      toast.error('La zona de entrega necesita al menos 3 puntos');
      return;
    }

    try {
      const zone = await upsertDeliveryZone({
        name: 'Zona principal',
        active: true,
        polygon: draftDeliveryZonePoints,
      });

      setDeliveryZonePoints(zone?.polygon ?? draftDeliveryZonePoints);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar la zona de entrega');
      return;
    }

    setIsEditingDeliveryZone(false);
    toast.success('Zona de entrega guardada');
  };

  const removeDeliveryZonePolygon = async () => {
    try {
      await deleteDeliveryZone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo eliminar la zona de entrega');
      return;
    }

    setDeliveryZonePoints([]);
    setDraftDeliveryZonePoints([]);
    setIsEditingDeliveryZone(false);
    toast.success('Zona de entrega eliminada');
  };

  const resetOrderForm = () => {
    setIsCreateOrderDialogOpen(false);
    setNewOrderType('delivery');
    setNewOrderCustomerName('');
    setNewOrderUserId(String(getLoggedUser()?.id ?? ''));
    setNewOrderTableId('');
    setNewOrderWaiterId('');
    setNewOrderDeliveryDate('');
    setNewOrderAddress('');
    setNewOrderDetail('');
    setSelectedProductQuantities({});
    setProductFilter('');
    setCategoryFilter('all');
    setNewOrderNotes('');
    resetDeliveryAddressValidation();
    resetAddressSuggestions();
  };

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !deliveryMapRef.current) {
      return;
    }

    let isCancelled = false;

    const renderGoogleMap = async () => {
      try {
        const google = await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY) as any;

        if (isCancelled || !deliveryMapRef.current) {
          return;
        }

        setGoogleMapsError(null);

        if (!googleMapInstanceRef.current) {
          googleMapInstanceRef.current = new google.maps.Map(deliveryMapRef.current, {
            center: { lat: -34.603722, lng: -58.381592 },
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
          });
        }

        googleMapMarkersRef.current.forEach((marker) => marker.setMap(null));
        googleMapMarkersRef.current = [];

        if (deliveryZonePolygonRef.current) {
          deliveryZonePolygonRef.current.setMap(null);
          deliveryZonePolygonRef.current = null;
        }

        if (draftDeliveryZonePolygonRef.current) {
          draftDeliveryZonePolygonRef.current.setMap(null);
          draftDeliveryZonePolygonRef.current = null;
        }

        if (draftDeliveryZonePolylineRef.current) {
          draftDeliveryZonePolylineRef.current.setMap(null);
          draftDeliveryZonePolylineRef.current = null;
        }

        draftVertexMarkersRef.current.forEach((marker) => marker.setMap(null));
        draftVertexMarkersRef.current = [];

        if (deliveryZoneClickListenerRef.current) {
          google.maps.event.removeListener(deliveryZoneClickListenerRef.current);
          deliveryZoneClickListenerRef.current = null;
        }

        const deliveryOrdersWithCoordinates = deliveryOrders.filter(
          (order) => Number.isFinite(order.latitude) && Number.isFinite(order.longitude),
        );

        const bounds = new google.maps.LatLngBounds();
        let hasBounds = false;

        deliveryOrdersWithCoordinates.forEach((order) => {
          const position = { lat: order.latitude as number, lng: order.longitude as number };
          const priority = getOrderVisualPriority(order);

          const marker = new google.maps.Marker({
            position,
            map: googleMapInstanceRef.current,
            title: `${order.id} · ${getPriorityLabel(order)}`,
            label: {
              text: order.id.replace('A-', ''),
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: '700',
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: getPriorityMapPinColor(priority),
              fillOpacity: 1,
              strokeColor: '#111827',
              strokeWeight: 1,
              scale: 14,
            },
          });

          marker.addListener('click', () => handleOpenDetail(order));
          googleMapMarkersRef.current.push(marker);
          bounds.extend(position);
          hasBounds = true;
        });

        if (deliveryZonePoints.length >= 3) {
          deliveryZonePolygonRef.current = new google.maps.Polygon({
            paths: deliveryZonePoints,
            map: googleMapInstanceRef.current,
            strokeColor: '#06b6d4',
            strokeOpacity: 1,
            strokeWeight: 2,
            fillColor: '#06b6d4',
            fillOpacity: 0.15,
          });

          deliveryZonePoints.forEach((point) => {
            bounds.extend(point);
            hasBounds = true;
          });
        }

        if (isEditingDeliveryZone && draftDeliveryZonePoints.length > 0) {
          draftDeliveryZonePolylineRef.current = new google.maps.Polyline({
            path: draftDeliveryZonePoints,
            map: googleMapInstanceRef.current,
            strokeColor: '#f59e0b',
            strokeOpacity: 1,
            strokeWeight: 2,
          });

          if (draftDeliveryZonePoints.length >= 3) {
            draftDeliveryZonePolygonRef.current = new google.maps.Polygon({
              paths: draftDeliveryZonePoints,
              map: googleMapInstanceRef.current,
              strokeColor: '#f59e0b',
              strokeOpacity: 1,
              strokeWeight: 2,
              fillColor: '#f59e0b',
              fillOpacity: 0.1,
            });
          }

          draftDeliveryZonePoints.forEach((point) => {
            bounds.extend(point);
            hasBounds = true;
          });

          draftVertexMarkersRef.current = draftDeliveryZonePoints.map((point, index) => {
            const vertexMarker = new google.maps.Marker({
              position: point,
              map: googleMapInstanceRef.current,
              draggable: true,
              label: {
                text: String(index + 1),
                color: '#ffffff',
                fontSize: '10px',
                fontWeight: '700',
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#f59e0b',
                fillOpacity: 1,
                strokeColor: '#111827',
                strokeWeight: 1,
                scale: 8,
              },
              title: `Vértice ${index + 1}`,
            });

            vertexMarker.addListener('dragend', (event: any) => {
              const lat = event?.latLng?.lat?.();
              const lng = event?.latLng?.lng?.();

              if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return;
              }

              setDraftDeliveryZonePoints((prev) => prev.map((vertex, vertexIndex) => (
                vertexIndex === index ? { lat, lng } : vertex
              )));
            });

            vertexMarker.addListener('rightclick', () => {
              setDraftDeliveryZonePoints((prev) => prev.filter((_, vertexIndex) => vertexIndex !== index));
            });

            return vertexMarker;
          });
        }

        if (isEditingDeliveryZone) {
          deliveryZoneClickListenerRef.current = googleMapInstanceRef.current.addListener('click', (event: any) => {
            const lat = event?.latLng?.lat?.();
            const lng = event?.latLng?.lng?.();

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return;
            }

            setDraftDeliveryZonePoints((prev) => ([...prev, { lat, lng }]));
          });
        }

        if (hasBounds) {
          googleMapInstanceRef.current.fitBounds(bounds);
        }
      } catch {
        setGoogleMapsError('No se pudo cargar Google Maps');
      }
    };

    void renderGoogleMap();

    return () => {
      isCancelled = true;
    };
  }, [deliveryOrders, deliveryZonePoints, draftDeliveryZonePoints, isEditingDeliveryZone]);

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const parseMoneyValue = (moneyText: string) => {
    const normalizedValue = moneyText.replace(/[^\d,.-]/g, '').replace(',', '.');
    const parsedValue = Number(normalizedValue);

    if (!Number.isFinite(parsedValue)) {
      return 0;
    }

    return Math.abs(parsedValue);
  };

  const handleOpenDetail = (order: ActiveOrderItem) => {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }

    setDetailOrder(order);
  };

  const handleOpenStatusDialog = (order: ActiveOrderItem) => {
    setStatusOrder(order);
  };

  const handleContextMenu = (event: React.MouseEvent, order: ActiveOrderItem) => {
    event.preventDefault();
    handleOpenStatusDialog(order);
  };

  const handleLongPressStart = (order: ActiveOrderItem) => {
    longPressTimer.current = setTimeout(() => {
      suppressNextClick.current = true;
      handleOpenStatusDialog(order);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleChangeStatus = async (nextStatus: string) => {
    if (!statusOrder) {
      return;
    }

    try {
      await transitionOrderStatus(statusOrder.id, statusOrder.status, nextStatus);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo actualizar el estado');
      }
      return;
    }

    const normalizedNextStatus = getOrderStatusLabel(nextStatus);
    const isTerminalStatus = normalizedNextStatus === 'Entregado' || normalizedNextStatus === 'Cancelado';

    setOrders((prev) => (
      isTerminalStatus
        ? prev.filter((order) => order.id !== statusOrder.id)
        : prev.map((order) => (
            order.id === statusOrder.id
              ? { ...order, status: normalizedNextStatus }
              : order
          ))
    ));

    setDetailOrder((prev) => (
      prev && prev.id === statusOrder.id
        ? isTerminalStatus ? null : { ...prev, status: normalizedNextStatus }
        : prev
    ));

    setStatusOrder(null);
    void loadOrders();
    toast.success(`Estado actualizado a "${normalizedNextStatus}"`);
  };

  const handleCreateOrder = async () => {
    const loggedUser = getLoggedUser();
    const storeId = Number(loggedUser?.storeId);
    const customerId = Number(newOrderCustomerName.trim());
    const userId = Number(newOrderUserId.trim());
    const tableId = Number(newOrderTableId.trim());
    const waiterId = Number(newOrderWaiterId.trim());
    const address = newOrderAddress.trim();
    const backendType: CreateOrderRequest['type'] = newOrderType === 'delivery' ? 'delivery' : 'dine-in';
    const orderItems = selectedProductsWithQuantity.map((product) => ({
      productId: product.id,
      quantity: product.quantity,
    }));

    if (!Number.isInteger(userId) || userId <= 0) {
      toast.error('Ingresá un User ID válido');
      return;
    }

    if (!Number.isInteger(storeId) || storeId <= 0) {
      toast.error('No se encontró un storeId válido en la sesión');
      return;
    }

    if (newOrderType === 'delivery' && !address) {
      toast.error('Ingresá la dirección de entrega');
      return;
    }

    if (selectedProductsCount === 0) {
      toast.error('Seleccioná al menos un producto');
      return;
    }

    if (orderItems.length === 0) {
      toast.error('Seleccioná al menos un producto');
      return;
    }

    let geocodedAddress: GeocodedAddressResult | null = null;

    if (newOrderType === 'delivery') {
      if (deliveryAddressValidationState === 'valid' && validatedDeliveryAddressInput === address && validatedDeliveryAddressPoint) {
        geocodedAddress = validatedDeliveryAddressPoint;
      } else {
        setIsValidatingAddress(true);
        geocodedAddress = await validateDeliveryAddress(address);
        setIsValidatingAddress(false);

        if (!geocodedAddress) {
          toast.error('La dirección no es válida para delivery');
          return;
        }
      }
    }

    const orderPayload: CreateOrderRequest = {
      storeId,
      customerId: Number.isInteger(customerId) && customerId > 0 ? customerId : undefined,
      customerName: !Number.isInteger(customerId) || customerId <= 0 ? newOrderCustomerName.trim() : undefined,
      customerPhone: !Number.isInteger(customerId) || customerId <= 0 ? newOrderCustomerPhone.trim() : undefined,
      userId,
      type: backendType,
      items: orderItems,
      delivery_address: geocodedAddress?.formattedAddress,
      delivery_latitude: geocodedAddress?.latitude,
      delivery_longitude: geocodedAddress?.longitude,
      delivery_date: newOrderType === 'delivery' ? (newOrderDeliveryDate || undefined) : undefined,
      tableId: backendType === 'dine-in' && Number.isInteger(tableId) && tableId > 0 ? tableId : undefined,
      waiterId: Number.isInteger(waiterId) && waiterId > 0 ? waiterId : undefined,
    };

    try {
      await createBackendOrder(orderPayload);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo crear la orden');
      }
      return;
    }

    resetOrderForm();
    toast.success('Orden creada');
    void loadOrders();
  };

  const handleFinalizeOrder = async (order: ActiveOrderItem) => {
    const readyStatusLabel = getOrderStatusLabel('ready');

    if (getOrderStatusLabel(order.status) !== readyStatusLabel) {
      toast.error('La orden debe estar lista para servir antes de cobrarla');
      return;
    }

    const amount = parseMoneyValue(order.total);

    if (amount <= 0) {
      toast.error('No se pudo calcular el importe de la orden');
      return;
    }

    try {
      await createCashMovement({
        type: 'venta',
        concept: `Orden ${order.id}`,
        amount,
        paymentMethod: finalizePaymentMethod,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo registrar la venta en caja');
      }
      return;
    }

    try {
      await finalizeOrder(order.id);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo completar la orden');
      }
      return;
    }

    setOrders((prev) => prev.filter((currentOrder) => currentOrder.id !== order.id));
    setDetailOrder(null);
    setStatusOrder((prev) => (prev?.id === order.id ? null : prev));
    void loadOrders();
    toast.success(`Orden ${order.id} finalizada`);
  };

  const getOrderAgeMinutes = (createdAt: string) => {
    if (createdAt.includes('T')) {
      const createdDate = new Date(createdAt);

      if (Number.isNaN(createdDate.getTime())) {
        return 0;
      }

      return Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 60000));
    }

    const [hoursText, minutesText] = createdAt.split(':');
    const hours = Number(hoursText);
    const minutes = Number(minutesText);

    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return 0;
    }

    const now = new Date();
    const createdDate = new Date(now);
    createdDate.setHours(hours, minutes, 0, 0);

    if (createdDate.getTime() > now.getTime()) {
      createdDate.setDate(createdDate.getDate() - 1);
    }

    return Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 60000));
  };

  const getOrderVisualPriority = (order: ActiveOrderItem): OrderVisualPriority => {
    const ageMinutes = getOrderAgeMinutes(order.createdAt);

    if (ageMinutes >= 45) {
      return 'old';
    }

    if (ageMinutes >= 30) {
      return 'delayed';
    }

    if (ageMinutes >= 15) {
      return 'on-time';
    }

    return 'default';
  };

  const getOrderCardClass = (order: ActiveOrderItem) => {
    const priority = getOrderVisualPriority(order);

    if (priority === 'old') {
      return 'border-red-500/70 bg-red-500/10';
    }

    if (priority === 'delayed') {
      return 'border-yellow-500/70 bg-yellow-500/10';
    }

    if (priority === 'on-time') {
      return 'border-green-500/70 bg-green-500/10';
    }

    return 'border-orange-700 bg-card';
  };

  const getPriorityBadgeClass = (order: ActiveOrderItem) => {
    const priority = getOrderVisualPriority(order);

    if (priority === 'old') {
      return 'bg-red-500 text-white text-xs';
    }

    if (priority === 'delayed') {
      return 'bg-yellow-500 text-black text-xs';
    }

    if (priority === 'on-time') {
      return 'bg-green-500 text-white text-xs';
    }

    return 'bg-gray-600 text-white text-xs';
  };

  const getPriorityLabel = (order: ActiveOrderItem) => {
    const priority = getOrderVisualPriority(order);

    if (priority === 'old') {
      return 'Antiguo';
    }

    if (priority === 'delayed') {
      return 'Demorado';
    }

    if (priority === 'on-time') {
      return 'En horario';
    }

    return 'Recién ingresado';
  };

  const renderOrderCard = (order: ActiveOrderItem) => (
    <div
      key={order.id}
      onClick={() => handleOpenDetail(order)}
      onContextMenu={(event) => handleContextMenu(event, order)}
      onTouchStart={() => handleLongPressStart(order)}
      onTouchEnd={handleLongPressEnd}
      onMouseDown={() => handleLongPressStart(order)}
      onMouseUp={handleLongPressEnd}
      onMouseLeave={handleLongPressEnd}
      className={`p-4 card cursor-pointer transition-colors hover:bg-[--card-hover] ${getOrderCardClass(order)}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{order.id}</span>
          <Badge variant="secondary" className={getPriorityBadgeClass(order)}>
            {getPriorityLabel(order)}
          </Badge>
        </div>
        <Badge
          variant="secondary"
          className={order.type === 'delivery' ? 'bg-label-info text-white text-xs' : 'bg-label-success text-white text-xs'}
        >
          {order.type === 'delivery' ? 'Delivery' : 'Salón'}
        </Badge>
      </div>
      <p className="text-sm text-white truncate">{order.customerName}</p>
      <p className="text-xs text-gray-400 truncate">{order.detail}</p>
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-gray-400">{order.status}</span>
        <span className="text-xs text-white">{order.total}</span>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl md:text-2xl font-semibold text-white">Pedidos activos</h1>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-label-warning text-white">
              {orders.length}
            </Badge>
            <Button size="sm" onClick={() => setIsCreateOrderDialogOpen(true)}>
              Nueva orden
            </Button>
          </div>
        </div>

        

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Delivery</h2>
              <Badge variant="secondary" className="bg-label-info text-white text-xs">
                {deliveryOrders.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {deliveryOrders.length === 0 ? (
                <div className="p-4 rounded-lg border card bg-card text-sm text-gray-400">
                  Sin pedidos de delivery
                </div>
              ) : (
                deliveryOrders.map(renderOrderCard)
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-gray-300">Salón</h2>
              <Badge variant="secondary" className="bg-label-success text-white text-xs">
                {salonOrders.length}
              </Badge>
            </div>
            <div className="space-y-2">
              {salonOrders.length === 0 ? (
                <div className="p-4 rounded-lg border card bg-card text-sm text-gray-400">
                  Sin pedidos en salón
                </div>
              ) : (
                salonOrders.map(renderOrderCard)
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="bg-card card text-white">
          <DialogHeader>
            <DialogTitle>Detalle del pedido {detailOrder?.id}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400">Tipo</span>
                <Badge
                  variant="secondary"
                  className={detailOrder.type === 'delivery' ? 'bg-label-info text-white text-xs' : 'bg-label-success text-white text-xs'}
                >
                  {detailOrder.type === 'delivery' ? 'Delivery' : 'Salón'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400">Cliente / mesa</span>
                <span>{detailOrder.customerName}</span>
              </div>
              {detailOrder.type === 'delivery' && detailOrder.address && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-gray-400">Dirección</span>
                  <span className="text-right">{detailOrder.address}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400">Estado</span>
                <span>{detailOrder.status}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400">Hora</span>
                <span>{detailOrder.createdAt}</span>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Items</p>
                <ul className="space-y-1">
                  {detailOrder.items.map((item) => (
                    <li key={item} className="text-white">• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-gray-400 mb-1">Detalle</p>
                <p>{detailOrder.detail}</p>
              </div>
              {detailOrder.notes && (
                <div>
                  <p className="text-gray-400 mb-1">Observaciones</p>
                  <p>{detailOrder.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-orange-700">
                <span className="text-gray-400">Total</span>
                <span className="font-medium">{detailOrder.total}</span>
              </div>
              <div className="space-y-2 pt-2 border-t border-orange-700">
                <p className="text-gray-400">Finalizar orden</p>
                <Select
                  value={finalizePaymentMethod}
                  onValueChange={(value) => setFinalizePaymentMethod(value as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Método de pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="tarjeta">Tarjeta</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="w-full" onClick={() => handleFinalizeOrder(detailOrder)}>
                  Finalizar orden
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!statusOrder} onOpenChange={() => setStatusOrder(null)}>
        <DialogContent className="bg-card border-orange-700 text-white">
          <DialogHeader>
            <DialogTitle>Cambiar estado {statusOrder ? `(${statusOrder.id})` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {statusOptions.length === 0 ? (
              <p className="text-sm text-gray-400">No hay transiciones disponibles para este estado.</p>
            ) : (
              statusOptions.map((status) => (
                <Button
                  key={status}
                  variant="ghost"
                  className={`w-full justify-start hover:bg-gray-700 ${statusOrder?.status === status ? 'bg-primary text-white' : 'text-white'}`}
                  onClick={() => handleChangeStatus(status)}
                >
                  {status}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateOrderDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetOrderForm();
            return;
          }

          setIsCreateOrderDialogOpen(true);
        }}
      >
        <DialogContent className="bg-card card max-h-[90vh] overflow-hidden text-white">
          <DialogHeader>
            <DialogTitle>Nueva orden</DialogTitle>
          </DialogHeader>

          <div className="max-h-[calc(90vh-5rem)] space-y-3 overflow-y-auto pr-1">
            <Select value={newOrderType} onValueChange={(value) => setNewOrderType(value as ActiveOrderItem['type'])}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="delivery">Delivery</SelectItem>
                <SelectItem value="salon">Salón</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Customer ID (opcional)"
              value={newOrderCustomerName}
              onChange={(event) => setNewOrderCustomerName(event.target.value)}
            />

            <Input
              placeholder="Customer phone (opcional)"
              value={newOrderCustomerPhone}
              onChange={(event) => setNewOrderCustomerPhone(event.target.value)}
            />

            <Input
              placeholder="Customer name (opcional)"
              value={newOrderCustomerName}
              onChange={(event) => setNewOrderCustomerName(event.target.value)}
            />

            <Input
              placeholder="User ID (requerido)"
              value={newOrderUserId}
              onChange={(event) => setNewOrderUserId(event.target.value)}
            />

            {newOrderType === 'delivery' && (
              <div className="space-y-2">
                <Input
                  placeholder="Dirección de entrega"
                  value={newOrderAddress}
                  onChange={(event) => setNewOrderAddress(event.target.value)}
                />
                {deliveryAddressValidationState !== 'idle' ? (
                  <p
                    className={`text-xs ${
                      deliveryAddressValidationState === 'valid'
                        ? 'text-emerald-300'
                        : deliveryAddressValidationState === 'typing' || deliveryAddressValidationState === 'validating'
                        ? 'text-amber-300'
                        : 'text-red-300'
                    }`}
                  >
                    {deliveryAddressValidationMessage}
                  </p>
                ) : null}

                <Input
                  type="datetime-local"
                  placeholder="Fecha de entrega (opcional)"
                  value={newOrderDeliveryDate}
                  onChange={(event) => setNewOrderDeliveryDate(event.target.value)}
                />
              </div>
            )}

            {newOrderType === 'salon' ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  placeholder="Table ID (opcional)"
                  value={newOrderTableId}
                  onChange={(event) => setNewOrderTableId(event.target.value)}
                />
                <Input
                  placeholder="Waiter ID (opcional)"
                  value={newOrderWaiterId}
                  onChange={(event) => setNewOrderWaiterId(event.target.value)}
                />
              </div>
            ) : null}

            <Input
              placeholder="Detalle"
              value={newOrderDetail}
              onChange={(event) => setNewOrderDetail(event.target.value)}
            />

            <div className="space-y-2 rounded-md border card bg-body p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-300">Productos</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {selectedProductsCount} items · Total: {currencyFormatter.format(selectedProductsTotal)}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={clearSelectedProducts}
                    disabled={selectedProductsCount === 0}
                  >
                    Limpiar carrito
                  </Button>
                </div>
              </div>

              <Input
                placeholder="Buscar producto por nombre..."
                value={productFilter}
                onChange={(event) => setProductFilter(event.target.value)}
                className="h-9"
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={categoryFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setCategoryFilter('all')}
                >
                  Todas
                </Button>
                {availableCategories.map((category) => (
                  <Button
                    key={category.id}
                    type="button"
                    size="sm"
                    variant={categoryFilter === category.id ? 'default' : 'outline'}
                    onClick={() => setCategoryFilter(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
              </div>

              {availableProducts.length === 0 ? (
                <p className="text-xs text-gray-500">No hay productos cargados</p>
              ) : groupedFilteredProductEntries.length === 0 ? (
                <p className="text-xs text-gray-500">No se encontraron productos con ese filtro</p>
              ) : (
                <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
                  {groupedFilteredProductEntries.map(([categoryName, categoryProducts]) => (
                    <div key={categoryName} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-300 uppercase tracking-wide">{categoryName}</p>
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryProducts.length}
                        </Badge>
                      </div>

                      <Carousel opts={{ align: 'start', dragFree: true }} className="px-10">
                        <CarouselContent className="-ml-2">
                          {categoryProducts.map((product) => {
                            const quantity = selectedProductQuantities[product.id] ?? 0;

                            return (
                              <CarouselItem key={product.id} className="pl-2 basis-[82%] sm:basis-1/2">
                                <div className="w-full rounded-md border border-orange-700 bg-card px-3 py-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm text-white">{product.name}</p>
                                    {product.description ? (
                                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-400">{product.description}</p>
                                    ) : null}
                                  </div>

                                  <div className="mt-2 flex items-center justify-between gap-2">
                                    <span className="text-xs text-gray-300">{currencyFormatter.format(product.price)}</span>
                                    <span className="text-xs text-gray-400">Cantidad: {quantity}</span>
                                  </div>

                                  <div className="mt-2 flex items-center justify-end gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => decrementProductQuantity(product.id)}
                                      disabled={quantity === 0}
                                    >
                                      -
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      onClick={() => incrementProductQuantity(product.id)}
                                    >
                                      +
                                    </Button>
                                  </div>
                                </div>
                              </CarouselItem>
                            );
                          })}
                        </CarouselContent>
                        <CarouselPrevious className="-left-1 h-7 w-7 border-orange-600 bg-body text-white hover:bg-card" />
                        <CarouselNext className="-right-1 h-7 w-7 border-orange-600 bg-body text-white hover:bg-card" />
                      </Carousel>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Input
              placeholder="Observaciones (opcional)"
              value={newOrderNotes}
              onChange={(event) => setNewOrderNotes(event.target.value)}
            />

            <Button
              className="w-full"
              onClick={() => void handleCreateOrder()}
              disabled={
                isValidatingAddress
                || (newOrderType === 'delivery' && (
                  deliveryAddressValidationState === 'validating'
                  || deliveryAddressValidationState === 'outside_zone'
                  || deliveryAddressValidationState === 'not_found'
                  || deliveryAddressValidationState === 'error'
                ))
              }
            >
              {isValidatingAddress ? 'Validando dirección...' : 'Crear orden'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
