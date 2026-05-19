import { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  ArrowUpDown,
  CalendarDays,
  RotateCw,
  Search,
  SlidersHorizontal,
  ClipboardList
} from 'lucide-react';
import {
  ApiError,
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

// ← NUEVO: importar el dialog de creación
import { CreateOrderDialog } from './orders/CreateOrderDialog';

type OrderVisualPriority = 'default' | 'on-time' | 'delayed' | 'old';

interface ActiveOrderItem {
  id: string;
  contactId: number;
  type: 'delivery' | 'salon';
  headquarterId?: number;
  customerName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  items: string[];
  detail: string;
  status: string;
  total: string;
  createdAt: string;
  scheduledDate?: string;
  scheduledTime?: string;
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

const getPriorityMapPinColor = (priority: OrderVisualPriority) => {
  if (priority === 'old') return '#ef4444';
  if (priority === 'delayed') return '#eab308';
  if (priority === 'on-time') return '#22c55e';
  return '#6b7280';
};

const toLocalDateLabel = (date: Date) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

const buildDateFromScheduled = (scheduledDate?: string, scheduledTime?: string) => {
  const normalizedDate = String(scheduledDate ?? '').trim();
  if (!normalizedDate) {
    return null;
  }

  if (normalizedDate.includes('T')) {
    const parsed = new Date(normalizedDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const timePart = String(scheduledTime ?? '').trim();
  const normalizedTime = timePart
    ? (timePart.length <= 5 ? `${timePart}:00` : timePart)
    : '00:00:00';
  const parsed = new Date(`${normalizedDate}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function ActiveOrdersView() {
  const [orders, setOrders] = useState<ActiveOrderItem[]>([]);
  const [detailOrder, setDetailOrder] = useState<ActiveOrderItem | null>(null);
  const [statusOrder, setStatusOrder] = useState<ActiveOrderItem | null>(null);

  // ← NUEVO: un solo boolean para abrir/cerrar CreateOrderDialog
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);

  // Productos y categorías se cargan acá y se pasan al dialog
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);

  const [finalizePaymentMethod, setFinalizePaymentMethod] = useState<PaymentMethod>('efectivo');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [googleMapsError, setGoogleMapsError] = useState<string | null>(null);
  const [deliveryZonePoints, setDeliveryZonePoints] = useState<DeliveryZonePoint[]>([]);
  const [draftDeliveryZonePoints, setDraftDeliveryZonePoints] = useState<DeliveryZonePoint[]>([]);
  const [isEditingDeliveryZone, setIsEditingDeliveryZone] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');
  const [channelFilter, setChannelFilter] = useState<'all' | ActiveOrderItem['type']>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'older' | 'total-high' | 'total-low'>('recent');
  const [page, setPage] = useState(1);
  const deliveryOrders = useMemo(
    () => orders.filter((order) => order.type === 'delivery'),
    [orders],
  );

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

  const statusOptions = statusOrder
    ? getAvailableOrderStatusTargets(statusOrder.status).map((status) => getOrderStatusLabel(status))
    : [];

  const normalizeOrder = (order: any): ActiveOrderItem => {
    const rawTotal = order?.total_amount ?? order?.total ?? 0;
    const parsedTotal = Number(rawTotal);
    const displayTotal = Number.isFinite(parsedTotal)
      ? currencyFormatter.format(parsedTotal)
      : String(rawTotal ?? '0');

    const backendType = String(order?.type ?? '');
    const normalizedType: ActiveOrderItem['type'] = backendType === 'delivery' ? 'delivery' : 'salon';
    const parsedHeadquarterId = Number(order?.headquarterId ?? order?.headquarter_id ?? order?.Headquarter?.id);
    const normalizedHeadquarterId = Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0
      ? parsedHeadquarterId
      : undefined;

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
    const customerName =
      order?.customerName ||
      order?.Customer?.name ||
      customerFullName ||
      (order?.customerId ? `Cliente #${order.customerId}` : `Orden ${order?.order_number ?? order?.id ?? ''}`);

    return {
      id: String(order?.id ?? order?.order_number ?? crypto.randomUUID()),
      contactId: Number(order?.contactId ?? order?.customerId ?? 0),
      type: normalizedType,
      headquarterId: normalizedHeadquarterId,
      customerName: String(customerName),
      address: order?.address ?? order?.delivery_address ?? undefined,
      latitude: order?.latitude ?? order?.delivery_latitude ?? undefined,
      longitude: order?.longitude ?? order?.delivery_longitude ?? undefined,
      items: normalizedItems,
      detail: String(order?.detail ?? order?.order_number ?? 'Sin detalle'),
      status: getOrderStatusLabel(String(order?.status ?? order?.Status?.name ?? 'pending')),
      total: String(displayTotal),
      createdAt: String(order?.createdAt ?? order?.order_date ?? ''),
      scheduledDate: order?.scheduled_date ?? order?.scheduledDate ?? order?.requested_date ?? order?.requestedDate ?? undefined,
      scheduledTime: order?.scheduled_time ?? order?.scheduledTime ?? order?.requested_time ?? order?.requestedTime ?? undefined,
      notes: order?.notes ?? undefined,
    };
  };

  const loadOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const backendOrders = await fetchBackendActiveOrders();
      setOrders(backendOrders.map(normalizeOrder));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudieron cargar las órdenes');
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
        const p = productsResult.value;
        setAvailableProducts(Array.isArray(p) ? p : p?.rows ?? p?.products ?? p?.data ?? []);
      } else {
        toast.error('No se pudieron cargar los productos');
      }

      if (categoriesResult.status === 'fulfilled') {
        const c = categoriesResult.value;
        setAvailableCategories(Array.isArray(c) ? c : c?.rows ?? c?.categories ?? c?.data ?? []);
      } else {
        toast.error('No se pudieron cargar las categorías');
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => { void loadOrders(); }, 20_000);
    return () => { window.clearInterval(intervalId); };
  }, []);

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

  // ── Google Maps ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY || !deliveryMapRef.current) return;

    let isCancelled = false;

    const renderGoogleMap = async () => {
      try {
        const google = await loadGoogleMapsScript(GOOGLE_MAPS_API_KEY) as any;
        if (isCancelled || !deliveryMapRef.current) return;

        setGoogleMapsError(null);

        if (!googleMapInstanceRef.current) {
          googleMapInstanceRef.current = new google.maps.Map(deliveryMapRef.current, {
            center: { lat: -34.603722, lng: -58.381592 },
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
          });
        }

        googleMapMarkersRef.current.forEach((m) => m.setMap(null));
        googleMapMarkersRef.current = [];

        if (deliveryZonePolygonRef.current) { deliveryZonePolygonRef.current.setMap(null); deliveryZonePolygonRef.current = null; }
        if (draftDeliveryZonePolygonRef.current) { draftDeliveryZonePolygonRef.current.setMap(null); draftDeliveryZonePolygonRef.current = null; }
        if (draftDeliveryZonePolylineRef.current) { draftDeliveryZonePolylineRef.current.setMap(null); draftDeliveryZonePolylineRef.current = null; }
        draftVertexMarkersRef.current.forEach((m) => m.setMap(null));
        draftVertexMarkersRef.current = [];
        if (deliveryZoneClickListenerRef.current) {
          google.maps.event.removeListener(deliveryZoneClickListenerRef.current);
          deliveryZoneClickListenerRef.current = null;
        }

        const bounds = new google.maps.LatLngBounds();
        let hasBounds = false;

        deliveryOrders
          .filter((o) => Number.isFinite(o.latitude) && Number.isFinite(o.longitude))
          .forEach((order) => {
            const position = { lat: order.latitude as number, lng: order.longitude as number };
            const priority = getOrderVisualPriority(order);
            const marker = new google.maps.Marker({
              position,
              map: googleMapInstanceRef.current,
              title: `${order.id} · ${getPriorityLabel(order)}`,
              label: { text: order.id.replace('A-', ''), color: '#ffffff', fontSize: '11px', fontWeight: '700' },
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
          deliveryZonePoints.forEach((p) => { bounds.extend(p); hasBounds = true; });
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

          draftDeliveryZonePoints.forEach((p) => { bounds.extend(p); hasBounds = true; });

          draftVertexMarkersRef.current = draftDeliveryZonePoints.map((point, index) => {
            const vm = new google.maps.Marker({
              position: point,
              map: googleMapInstanceRef.current,
              draggable: true,
              label: { text: String(index + 1), color: '#ffffff', fontSize: '10px', fontWeight: '700' },
              icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#f59e0b', fillOpacity: 1, strokeColor: '#111827', strokeWeight: 1, scale: 8 },
              title: `Vértice ${index + 1}`,
            });
            vm.addListener('dragend', (event: any) => {
              const lat = event?.latLng?.lat?.();
              const lng = event?.latLng?.lng?.();
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              setDraftDeliveryZonePoints((prev) => prev.map((v, i) => i === index ? { lat, lng } : v));
            });
            vm.addListener('rightclick', () => {
              setDraftDeliveryZonePoints((prev) => prev.filter((_, i) => i !== index));
            });
            return vm;
          });
        }

        if (isEditingDeliveryZone) {
          deliveryZoneClickListenerRef.current = googleMapInstanceRef.current.addListener('click', (event: any) => {
            const lat = event?.latLng?.lat?.();
            const lng = event?.latLng?.lng?.();
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            setDraftDeliveryZonePoints((prev) => [...prev, { lat, lng }]);
          });
        }

        if (hasBounds) googleMapInstanceRef.current.fitBounds(bounds);
      } catch {
        setGoogleMapsError('No se pudo cargar Google Maps');
      }
    };

    void renderGoogleMap();
    return () => { isCancelled = true; };
  }, [deliveryOrders, deliveryZonePoints, draftDeliveryZonePoints, isEditingDeliveryZone]);

  // ── Zona de entrega ───────────────────────────────────────────────────────────

  const startDeliveryZoneEdition = () => {
    if (!GOOGLE_MAPS_API_KEY) { toast.error('Configurá VITE_GOOGLE_MAPS_API_KEY para dibujar zona de entrega'); return; }
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
    if (draftDeliveryZonePoints.length < 3) { toast.error('La zona de entrega necesita al menos 3 puntos'); return; }
    try {
      const zone = await upsertDeliveryZone({ name: 'Zona principal', active: true, polygon: draftDeliveryZonePoints });
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

  // ── Interacción con órdenes ───────────────────────────────────────────────────

  const parseMoneyValue = (moneyText: string) => {
    const cleaned = String(moneyText ?? '').replace(/[^\d,.-]/g, '').trim();
    if (!cleaned) {
      return 0;
    }

    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    const decimalIndex = Math.max(lastComma, lastDot);

    let integerPart = cleaned;
    let decimalPart = '';

    // If separator has 1-2 digits to the right, treat it as decimal separator.
    if (decimalIndex !== -1) {
      const digitsAfterSeparator = cleaned.length - decimalIndex - 1;
      if (digitsAfterSeparator > 0 && digitsAfterSeparator <= 2) {
        integerPart = cleaned.slice(0, decimalIndex);
        decimalPart = cleaned.slice(decimalIndex + 1);
      }
    }

    const normalizedInteger = integerPart
      .replace(/[.,]/g, '')
      .replace(/(?!^)-/g, '');
    const normalizedDecimal = decimalPart.replace(/[^\d]/g, '');
    const normalized = normalizedDecimal
      ? `${normalizedInteger}.${normalizedDecimal}`
      : normalizedInteger;

    const value = Number(normalized);
    return Number.isFinite(value) ? Math.abs(value) : 0;
  };

  const handleOpenDetail = (order: ActiveOrderItem) => {
    if (suppressNextClick.current) { suppressNextClick.current = false; return; }
    setDetailOrder(order);
  };

  const handleOpenStatusDialog = (order: ActiveOrderItem) => setStatusOrder(order);

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
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleChangeStatus = async (nextStatus: string) => {
    if (!statusOrder) return;

    try {
      await transitionOrderStatus(statusOrder.id, statusOrder.status, nextStatus);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo actualizar el estado');
      return;
    }

    const normalizedNextStatus = getOrderStatusLabel(nextStatus);
    const isTerminalStatus = normalizedNextStatus === 'Entregado' || normalizedNextStatus === 'Cancelado';

    setOrders((prev) =>
      isTerminalStatus
        ? prev.filter((o) => o.id !== statusOrder.id)
        : prev.map((o) => o.id === statusOrder.id ? { ...o, status: normalizedNextStatus } : o),
    );
    setDetailOrder((prev) =>
      prev?.id === statusOrder.id
        ? isTerminalStatus ? null : { ...prev, status: normalizedNextStatus }
        : prev,
    );

    setStatusOrder(null);
    void loadOrders();
    toast.success(`Estado actualizado a "${normalizedNextStatus}"`);
  };

  const handleFinalizeOrder = async (order: ActiveOrderItem) => {
    const readyStatusLabel = getOrderStatusLabel('ready');
    if (getOrderStatusLabel(order.status) !== readyStatusLabel) {
      toast.error('La orden debe estar lista para servir antes de cobrarla');
      return;
    }

    const amount = parseMoneyValue(order.total);
    if (amount <= 0) { toast.error('No se pudo calcular el importe de la orden'); return; }

    try {
      await createCashMovement({
        type: 'venta',
        concept: `Orden ${order.id}`,
        amount,
        paymentMethod: finalizePaymentMethod,
        headquarterId: order.headquarterId,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar la venta en caja');
      return;
    }

    try {
      await finalizeOrder(order.id);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo completar la orden');
      return;
    }

    setOrders((prev) => prev.filter((o) => o.id !== order.id));
    setDetailOrder(null);
    setStatusOrder((prev) => prev?.id === order.id ? null : prev);
    void loadOrders();
    toast.success(`Orden ${order.id} finalizada`);
  };

  // ── Prioridad visual ──────────────────────────────────────────────────────────

  const getOrderReferenceDate = (order: ActiveOrderItem): Date | null => {
    const scheduledDate = buildDateFromScheduled(order.scheduledDate, order.scheduledTime);
    if (scheduledDate) {
      return scheduledDate;
    }

    if (order.createdAt.includes('T')) {
      const createdDate = new Date(order.createdAt);
      if (!Number.isNaN(createdDate.getTime())) {
        return createdDate;
      }
    }

    const [h, m] = order.createdAt.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const now = new Date();
    const createdDate = new Date(now);
    createdDate.setHours(h, m, 0, 0);
    if (createdDate.getTime() > now.getTime()) createdDate.setDate(createdDate.getDate() - 1);
    return createdDate;
  };

  const getOrderDateLabel = (order: ActiveOrderItem) => {
    const referenceDate = getOrderReferenceDate(order);
    if (!(referenceDate instanceof Date)) {
      return '';
    }
    return toLocalDateLabel(referenceDate);
  };

  const getOrderAgeMinutes = (order: ActiveOrderItem) => {
    const referenceDate = getOrderReferenceDate(order);
    if (!(referenceDate instanceof Date)) {
      return 0;
    }
    return Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / 60000));
  };

  const getOrderVisualPriority = (order: ActiveOrderItem): OrderVisualPriority => {
    const age = getOrderAgeMinutes(order);
    if (age >= 45) return 'old';
    if (age >= 30) return 'delayed';
    if (age >= 15) return 'on-time';
    return 'default';
  };

  const getOrderCardClass = (order: ActiveOrderItem) => {
    const p = getOrderVisualPriority(order);
    if (p === 'old') return 'border-red-500/70 bg-red-500/10';
    if (p === 'delayed') return 'border-yellow-500/70 bg-yellow-500/10';
    if (p === 'on-time') return 'border-green-500/70 bg-green-500/10';
    return 'border-orange-700 bg-card';
  };

  const getPriorityLabel = (order: ActiveOrderItem) => {
    const p = getOrderVisualPriority(order);
    if (p === 'old') return 'Antiguo';
    if (p === 'delayed') return 'Demorado';
    if (p === 'on-time') return 'En horario';
    return 'Recién ingresado';
  };

  const getStatusBadgeClass = (status: string) => {
    const normalizedStatus = status.trim().toLowerCase();
    if (normalizedStatus.includes('nuevo')) return 'bg-slate-500/20 text-slate-700 dark:text-slate-200';
    if (normalizedStatus.includes('prepar')) return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-200';
    if (normalizedStatus.includes('listo')) return 'bg-blue-500/20 text-blue-700 dark:text-blue-200';
    if (normalizedStatus.includes('camino')) return 'bg-violet-500/20 text-violet-700 dark:text-violet-200';
    if (normalizedStatus.includes('entregado')) return 'bg-emerald-600/20 text-emerald-700 dark:text-emerald-100';
    if (normalizedStatus.includes('cancel')) return 'bg-red-500/20 text-red-700 dark:text-red-200';
    return 'bg-gray-500/20 text-gray-700 dark:text-gray-200';
  };

  const getOrderDateInfo = (order: ActiveOrderItem) => {
    const referenceDate = getOrderReferenceDate(order);
    if (referenceDate instanceof Date) {
      const today = new Date();
      const isToday = today.toDateString() === referenceDate.toDateString();
      return {
        time: referenceDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }),
        dayLabel: isToday ? 'Hoy' : referenceDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      };
    }

    if (order.createdAt.includes(':')) {
      const [hours, minutes] = order.createdAt.split(':');
      return { time: `${hours}:${minutes ?? '00'}`, dayLabel: 'Hoy' };
    }

    return { time: '--:--', dayLabel: '--' };
  };

  const getComparableDate = (order: ActiveOrderItem) => {
    const referenceDate = getOrderReferenceDate(order);
    return referenceDate instanceof Date ? referenceDate.getTime() : 0;
  };

  const getStatusFilterOptions = useMemo(() => {
    const unique = Array.from(new Set(orders.map((order) => order.status)));
    return ['all', ...unique];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();
    const todayLabel = toLocalDateLabel(new Date());

    const withFilters = orders.filter((order) => {
      const matchesSearch = !normalizedSearch
        || order.id.toLowerCase().includes(normalizedSearch)
        || order.customerName.toLowerCase().includes(normalizedSearch)
        || order.detail.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesChannel = channelFilter === 'all' || order.type === channelFilter;

      const orderDateLabel = getOrderDateLabel(order);
      let matchesDate = orderDateLabel === todayLabel;
      if (dateFilter) {
        matchesDate = orderDateLabel === dateFilter;
      }

      return matchesSearch && matchesStatus && matchesChannel && matchesDate;
    });

    withFilters.sort((left, right) => {
      if (sortBy === 'recent') return getComparableDate(right) - getComparableDate(left);
      if (sortBy === 'older') return getComparableDate(left) - getComparableDate(right);
      if (sortBy === 'total-high') return parseMoneyValue(right.total) - parseMoneyValue(left.total);
      return parseMoneyValue(left.total) - parseMoneyValue(right.total);
    });

    return withFilters;
  }, [channelFilter, dateFilter, orders, searchValue, sortBy, statusFilter]);

  const pageSize = 6;
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPage(1);
  }, [searchValue, statusFilter, channelFilter, dateFilter, sortBy]);

  return (
    <div className="h-full overflow-y-auto bg-body">
      <div className="relative p-4 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-28 left-1/4 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-3 text-2xl font-semibold text-white md:text-3xl">
                <ClipboardList className="h-8 w-8 text-orange-400" />
                Pedidos

            </h1>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-11 rounded-2xl border-border bg-card/70 text-foreground hover:bg-card"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
              <Button size="sm" className="h-11 rounded-2xl px-5" onClick={() => setIsCreateOrderDialogOpen(true)}>
                Nueva orden
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-sm">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Buscar por cliente, orden o ID..."
                className="h-11 rounded-xl border-border bg-background pl-10 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 md:flex-nowrap">
              <div className="w-full min-w-0 md:flex-1">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border bg-background text-foreground">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    {getStatusFilterOptions.map((statusValue) => (
                      <SelectItem key={statusValue} value={statusValue}>
                        {statusValue === 'all' ? 'Todos los estados' : statusValue}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full min-w-0 md:flex-1">
                <Select value={channelFilter} onValueChange={(value) => setChannelFilter(value as 'all' | ActiveOrderItem['type'])}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-border bg-background text-foreground">
                    <SelectValue placeholder="Canal" />
                  </SelectTrigger>
                  <SelectContent className="border-border bg-popover text-popover-foreground">
                    <SelectItem value="all">Canal: Todos</SelectItem>
                    <SelectItem value="salon">Salón</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-full min-w-0 md:flex-1">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(event) => setDateFilter(event.target.value)}
                  className="h-10 w-full rounded-xl border-border bg-background pl-10 text-foreground"
                />
              </div>

              <button
                type="button"
                className="shrink-0 whitespace-nowrap text-sm text-primary transition-colors hover:text-primary/80"
                onClick={() => {
                  setSearchValue('');
                  setStatusFilter('all');
                  setChannelFilter('all');
                  setDateFilter('');
                  setSortBy('recent');
                }}
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Ordenar por:</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="h-10 min-w-[190px] rounded-xl border-border bg-background text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover text-popover-foreground">
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="older">Más antiguos</SelectItem>
                  <SelectItem value="total-high">Mayor importe</SelectItem>
                  <SelectItem value="total-low">Menor importe</SelectItem>
                </SelectContent>
              </Select>
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card/70 text-muted-foreground">
                <ArrowUpDown className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl text-foreground">Total: {filteredOrders.length} pedidos</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10 rounded-xl border-border bg-card/70 text-foreground"
                onClick={() => void loadOrders()}
                disabled={isLoadingOrders}
              >
                <RotateCw className={`h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {paginatedOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
                No hay pedidos para los filtros seleccionados.
              </div>
            ) : (
              paginatedOrders.map((order) => {
                const orderDateInfo = getOrderDateInfo(order);
                const isPriority = getOrderVisualPriority(order) === 'default';
                const priorityStyle = isPriority ? 'border-orange-500/80' : getOrderCardClass(order).replace('bg-card', 'bg-card/70');
                return (
                  <article
                    key={order.id}
                    onClick={() => handleOpenDetail(order)}
                    onContextMenu={(event) => handleContextMenu(event, order)}
                    onTouchStart={() => handleLongPressStart(order)}
                    onTouchEnd={handleLongPressEnd}
                    onMouseDown={() => handleLongPressStart(order)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    className={`cursor-pointer rounded-2xl border bg-card/60 p-4 backdrop-blur-sm transition hover:bg-card ${priorityStyle}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xl font-semibold text-foreground md:text-2xl">{order.id}</span>
                          <Badge variant="secondary" className={`${getStatusBadgeClass(getPriorityLabel(order))} text-xs`}>
                            {getPriorityLabel(order)}
                          </Badge>
                        </div>
                        <p className="text-lg text-foreground">{order.customerName}</p>
                        <p className="text-sm text-muted-foreground">{order.detail}</p>
                        <p className="text-sm text-muted-foreground">{order.status}</p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Badge
                          variant="secondary"
                          className={order.type === 'delivery' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-100' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-100'}
                        >
                          {order.type === 'delivery' ? 'Delivery' : 'Salón'}
                        </Badge>
                        <p className="text-lg text-foreground">{orderDateInfo.time}</p>
                        <p className="text-sm text-muted-foreground">{orderDateInfo.dayLabel}</p>
                        <p className="mt-4 text-xl font-medium text-foreground">{order.total}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/70 text-foreground disabled:opacity-40"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }).slice(0, 5).map((_, index) => {
              const pageNumber = index + 1;
              return (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  className={`inline-flex h-9 min-w-9 items-center justify-center rounded-xl px-2 ${
                    pageNumber === currentPage ? 'bg-primary text-white' : 'border border-border bg-card/70 text-foreground'
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}
            {totalPages > 5 ? <span className="px-1 text-muted-foreground">...</span> : null}
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card/70 text-foreground disabled:opacity-40"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage >= totalPages}
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ── Dialog detalle de orden ── */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="bg-card card text-foreground">
          <DialogHeader>
            <DialogTitle>Detalle del pedido {detailOrder?.id}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Tipo</span>
                <Badge variant="secondary" className={detailOrder.type === 'delivery' ? 'bg-label-info text-white text-xs' : 'bg-label-success text-white text-xs'}>
                  {detailOrder.type === 'delivery' ? 'Delivery' : 'Salón'}
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Cliente / mesa</span>
                <span>{detailOrder.customerName}</span>
              </div>
              {detailOrder.type === 'delivery' && detailOrder.address && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-muted-foreground">Dirección</span>
                  <span className="text-right">{detailOrder.address}</span>
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Estado</span>
                <span>{detailOrder.status}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Hora</span>
                <span>{detailOrder.createdAt}</span>
              </div>
              <div>
                <p className="mb-1 text-muted-foreground">Items</p>
                <ul className="space-y-1">
                  {detailOrder.items.map((item) => (
                    <li key={item} className="text-foreground">• {item}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-1 text-muted-foreground">Detalle</p>
                <p>{detailOrder.detail}</p>
              </div>
              {detailOrder.notes && (
                <div>
                  <p className="mb-1 text-muted-foreground">Observaciones</p>
                  <p>{detailOrder.notes}</p>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium">{detailOrder.total}</span>
              </div>
              <div className="space-y-2 border-t border-border pt-2">
                <p className="text-muted-foreground">Finalizar orden</p>
                <Select value={finalizePaymentMethod} onValueChange={(v) => setFinalizePaymentMethod(v as PaymentMethod)}>
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

      {/* ── Dialog cambio de estado ── */}
      <Dialog open={!!statusOrder} onOpenChange={() => setStatusOrder(null)}>
        <DialogContent className="border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Cambiar estado {statusOrder ? `(${statusOrder.id})` : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {statusOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay transiciones disponibles para este estado.</p>
            ) : (
              statusOptions.map((status) => (
                <Button
                  key={status}
                  variant="ghost"
                  className={`w-full justify-start hover:bg-muted ${statusOrder?.status === status ? 'bg-primary text-white' : 'text-foreground'}`}
                  onClick={() => handleChangeStatus(status)}
                >
                  {status}
                </Button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── CreateOrderDialog — reemplaza el Dialog anterior de "Nueva orden" ── */}
      <CreateOrderDialog
        open={isCreateOrderDialogOpen}
        onClose={() => setIsCreateOrderDialogOpen(false)}
        onCreated={() => { void loadOrders(); }}
        availableProducts={availableProducts}
        availableCategories={availableCategories}
      />
    </div>
  );
}
