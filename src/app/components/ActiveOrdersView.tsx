import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../shared/ui/components/select';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  CalendarDays,
  ChefHat,
  RotateCw,
  CreditCard,
  Search,
  SlidersHorizontal,
  ClipboardList,
  MoreVertical,
  Printer,
  ReceiptText,
} from 'lucide-react';
import { Checkbox } from '../shared/ui/components/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shared/ui/components/dropdown-menu';
import {
  ApiError,
} from '../core/http/errors';
import {
  createCashMovement,
  type PaymentMethod,
} from '../features/cash-register';
import {
  deleteDeliveryZone,
  getDeliveryZone,
  type DeliveryZonePoint,
  upsertDeliveryZone,
} from '../features/delivery-zones';
import {
  fetchActiveOrders as fetchBackendActiveOrders,
  finalizeOrder,
  getAvailableOrderStatusTargets,
  getOrderStatusLabel,
  transitionOrderStatus,
} from '../features/orders/services/orders.service';
import {
  fetchProductCategories,
  fetchProducts,
  type ProductCategory,
  type ProductItem,
} from '../features/products';

// ← NUEVO: importar el dialog de creación
import { CreateOrderDialog } from './orders/CreateOrderDialog';

type OrderVisualPriority = 'default' | 'on-time' | 'delayed' | 'old';
type PrintMode = 'comanda' | 'factura';

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

const DIALOG_CONTENT_CLASS = 'w-[calc(100vw-2rem)] max-w-[720px] gap-0 overflow-hidden p-0';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';

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
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [chargeOrders, setChargeOrders] = useState<ActiveOrderItem[]>([]);
  const [isChargingOrders, setIsChargingOrders] = useState(false);

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
            const modifiers = Array.isArray(item?.OrderItemModifiers)
              ? item.OrderItemModifiers.map((modifier: any) => (
                  modifier?.type === 'removed'
                    ? `Sin ${modifier?.name}`
                    : `Extra ${modifier?.name}${Number(modifier?.quantity ?? 1) > 1 ? ` x${modifier.quantity}` : ''}`
                ))
              : [];
            const baseLabel = quantity > 1 ? `${name} x${quantity}` : String(name);
            return modifiers.length > 0 ? `${baseLabel} (${modifiers.join(', ')})` : baseLabel;
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
        fetchProducts(),
        fetchProductCategories(),
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

  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrderIds((current) => (
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    ));
  };

  const clearOrderSelection = () => setSelectedOrderIds([]);

  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.includes(order.id)),
    [orders, selectedOrderIds],
  );

  const selectedOrdersTotal = selectedOrders.reduce((total, order) => total + parseMoneyValue(order.total), 0);

  const openChargeDialog = (ordersToCharge: ActiveOrderItem[]) => {
    if (ordersToCharge.length === 0) {
      toast.error('Seleccioná al menos un pedido para cobrar');
      return;
    }

    setChargeOrders(ordersToCharge);
    setFinalizePaymentMethod('efectivo');
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

  const handleFinalizeOrders = async () => {
    if (isChargingOrders || chargeOrders.length === 0) {
      return;
    }

    const amount = chargeOrders.reduce((total, order) => total + parseMoneyValue(order.total), 0);
    if (amount <= 0) { toast.error('No se pudo calcular el importe de la orden'); return; }

    try {
      setIsChargingOrders(true);
      await createCashMovement({
        type: 'venta',
        concept: chargeOrders.length === 1
          ? `Orden ${chargeOrders[0].id}`
          : `Pedidos ${chargeOrders.map((order) => order.id).join(', ')}`,
        amount,
        paymentMethod: finalizePaymentMethod,
        headquarterId: chargeOrders[0]?.headquarterId,
      });
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo registrar la venta en caja');
      setIsChargingOrders(false);
      return;
    }

    try {
      await Promise.all(chargeOrders.map((order) => finalizeOrder(order.id)));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'No se pudo completar la orden');
      setIsChargingOrders(false);
      return;
    }

    const chargedIds = new Set(chargeOrders.map((order) => order.id));
    setOrders((prev) => prev.filter((order) => !chargedIds.has(order.id)));
    setSelectedOrderIds((prev) => prev.filter((orderId) => !chargedIds.has(orderId)));
    setDetailOrder(null);
    setStatusOrder((prev) => prev && chargedIds.has(prev.id) ? null : prev);
    setChargeOrders([]);
    setIsChargingOrders(false);
    void loadOrders();
    toast.success(chargeOrders.length === 1 ? `Orden ${chargeOrders[0].id} cobrada` : `${chargeOrders.length} pedidos cobrados`);
  };

  const buildPrintableHtml = (order: ActiveOrderItem, mode: PrintMode) => {
    const title = mode === 'comanda'
      ? `Comanda ${order.type === 'delivery' ? 'delivery' : 'cocina'}`
      : 'Factura';
    const itemsHtml = order.items.length > 0
      ? order.items.map((item) => `<li>${item}</li>`).join('')
      : '<li>Sin items cargados</li>';

    return `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${title} ${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { font-size: 22px; margin: 0 0 8px; }
            h2 { font-size: 15px; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; }
            p { margin: 4px 0; }
            ul { margin: 8px 0 0; padding-left: 20px; }
            .muted { color: #6b7280; font-size: 12px; }
            .total { margin-top: 18px; font-size: 18px; font-weight: 700; text-align: right; }
            .box { border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px; margin-top: 12px; }
            @media print { body { margin: 12px; } }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <p class="muted">Pedido ${order.id}</p>
          <div class="box">
            <p><strong>Cliente / mesa:</strong> ${order.customerName}</p>
            <p><strong>Tipo:</strong> ${order.type === 'delivery' ? 'Delivery' : 'Salón'}</p>
            <p><strong>Estado:</strong> ${order.status}</p>
            <p><strong>Hora:</strong> ${getOrderDateInfo(order).time}</p>
            ${order.address ? `<p><strong>Dirección:</strong> ${order.address}</p>` : ''}
          </div>
          <h2>Items</h2>
          <ul>${itemsHtml}</ul>
          ${order.notes ? `<h2>Observaciones</h2><p>${order.notes}</p>` : ''}
          ${mode === 'factura' ? `<p class="total">Total: ${order.total}</p>` : ''}
        </body>
      </html>
    `;
  };

  const printOrder = (order: ActiveOrderItem, mode: PrintMode) => {
    if (typeof window === 'undefined') {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=720');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    printWindow.document.write(buildPrintableHtml(order, mode));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
    }, 150);
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

    const withFilters = orders.filter((order) => {
      const matchesSearch = !normalizedSearch
        || order.id.toLowerCase().includes(normalizedSearch)
        || order.customerName.toLowerCase().includes(normalizedSearch)
        || order.detail.toLowerCase().includes(normalizedSearch);

      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesChannel = channelFilter === 'all' || order.type === channelFilter;

      const orderDateLabel = getOrderDateLabel(order);
      const matchesDate = !dateFilter || orderDateLabel === dateFilter;

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
  const paginatedOrderIds = paginatedOrders.map((order) => order.id);
  const arePageOrdersSelected = paginatedOrderIds.length > 0
    && paginatedOrderIds.every((orderId) => selectedOrderIds.includes(orderId));

  const togglePageSelection = () => {
    setSelectedOrderIds((current) => {
      if (arePageOrdersSelected) {
        return current.filter((orderId) => !paginatedOrderIds.includes(orderId));
      }

      return Array.from(new Set([...current, ...paginatedOrderIds]));
    });
  };

  useEffect(() => {
    setPage(1);
  }, [searchValue, statusFilter, channelFilter, dateFilter, sortBy]);

  return (
    <div className="h-full overflow-y-auto bg-body">
      <div className="relative px-3 py-4 sm:p-4 md:p-6">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-28 left-1/4 h-80 w-80 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="flex items-center gap-2 text-xl font-semibold text-white sm:gap-3 sm:text-2xl md:text-3xl">
                <ClipboardList className="h-7 w-7 text-orange-400 sm:h-8 sm:w-8" />
                Pedidos

            </h1>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10 rounded-2xl border-border bg-card/70 text-foreground hover:bg-card sm:size-11"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
              <Button size="sm" className="h-10 rounded-2xl px-4 sm:h-11 sm:px-5" onClick={() => setIsCreateOrderDialogOpen(true)}>
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

          <div className="flex flex-col gap-3 border-y border-border py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <span className="w-16 shrink-0 text-sm text-muted-foreground sm:w-auto">Ordenar por:</span>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="h-10 min-w-0 flex-1 rounded-xl border-border bg-background text-foreground sm:min-w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-popover text-popover-foreground">
                  <SelectItem value="recent">Más recientes</SelectItem>
                  <SelectItem value="older">Más antiguos</SelectItem>
                  <SelectItem value="total-high">Mayor importe</SelectItem>
                  <SelectItem value="total-low">Menor importe</SelectItem>
                </SelectContent>
              </Select>
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card/70 text-muted-foreground">
                <ArrowUpDown className="h-4 w-4" />
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <span className="text-lg text-foreground sm:text-2xl">Total: {filteredOrders.length} pedidos</span>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-9 shrink-0 rounded-xl border-border bg-card/70 text-foreground sm:size-10"
                onClick={() => void loadOrders()}
                disabled={isLoadingOrders}
              >
                <RotateCw className={`h-4 w-4 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/60 p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2">
              <Checkbox
                checked={arePageOrdersSelected}
                onCheckedChange={togglePageSelection}
                aria-label="Seleccionar pedidos de esta página"
              />
              <span>Seleccionar página</span>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">
                {selectedOrders.length} seleccionados · {currencyFormatter.format(selectedOrdersTotal)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-xl border-border bg-card/70"
                onClick={clearOrderSelection}
                disabled={selectedOrders.length === 0}
              >
                Limpiar
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={() => openChargeDialog(selectedOrders)}
                disabled={selectedOrders.length === 0}
              >
                <CreditCard className="h-4 w-4" />
                Cobrar selección
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
                const isSelected = selectedOrderIds.includes(order.id);
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
                    className={`cursor-pointer rounded-2xl border bg-card/60 p-3 backdrop-blur-sm transition hover:bg-card sm:p-4 ${priorityStyle} ${isSelected ? 'ring-2 ring-primary/60' : ''}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 gap-3">
                        <div
                          className="pt-1"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                          onTouchStart={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleOrderSelection(order.id)}
                            aria-label={`Seleccionar pedido ${order.id}`}
                          />
                        </div>
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold text-foreground md:text-2xl">{order.id}</span>
                          <Badge variant="secondary" className={`${getStatusBadgeClass(getPriorityLabel(order))} text-xs`}>
                            {getPriorityLabel(order)}
                          </Badge>
                          </div>
                          <p className="break-words text-base text-foreground sm:text-lg">{order.customerName}</p>
                          <p className="break-words text-sm text-muted-foreground">{order.detail}</p>
                          <p className="text-sm text-muted-foreground">{order.status}</p>
                        </div>
                      </div>

                      <div className="flex flex-row flex-wrap items-center justify-between gap-2 sm:flex-col sm:items-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-9 w-9 rounded-xl border-border bg-card/70"
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="w-56 border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]"
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                          >
                            <DropdownMenuItem onClick={() => printOrder(order, 'comanda')}>
                              <ChefHat className="mr-2 h-4 w-4" />
                              Imprimir comanda
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => printOrder(order, 'factura')}>
                              <ReceiptText className="mr-2 h-4 w-4" />
                              Imprimir factura
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openChargeDialog([order])}>
                              <CreditCard className="mr-2 h-4 w-4" />
                              Cobrar pedido
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Badge
                          variant="secondary"
                          className={order.type === 'delivery' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-100' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-100'}
                        >
                          {order.type === 'delivery' ? 'Delivery' : 'Salón'}
                        </Badge>
                        <p className="text-base text-foreground sm:text-lg">{orderDateInfo.time}</p>
                        <p className="text-sm text-muted-foreground">{orderDateInfo.dayLabel}</p>
                        <p className="text-lg font-medium text-foreground sm:mt-4 sm:text-xl">{order.total}</p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-center gap-2 pb-2 pt-2">
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
        <DialogContent className={DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <ClipboardList size={18} />
            </div>
            <DialogTitle>Detalle del pedido {detailOrder?.id}</DialogTitle>
            <DialogDescription>Revisa la orden, imprime documentos o envíala a cobro.</DialogDescription>
          </DialogHeader>
          {detailOrder && (
            <>
              <div className="space-y-3 px-5 py-4 text-sm">
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
                <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
                  <p className="mb-2 text-muted-foreground">Items</p>
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
              </div>
              <DialogFooter className="flex-col gap-2 border-t border-[var(--app-line)] px-5 py-4 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)] sm:w-auto"
                  onClick={() => printOrder(detailOrder, 'comanda')}
                >
                  <Printer className="h-4 w-4" />
                  Comanda
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)] sm:w-auto"
                  onClick={() => printOrder(detailOrder, 'factura')}
                >
                  <ReceiptText className="h-4 w-4" />
                  Factura
                </Button>
                <Button className="w-full gap-2 sm:w-auto" onClick={() => openChargeDialog([detailOrder])}>
                  <CreditCard className="h-4 w-4" />
                  Cobrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={chargeOrders.length > 0} onOpenChange={(open) => !open && !isChargingOrders && setChargeOrders([])}>
        <DialogContent className={DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <CreditCard size={18} />
            </div>
            <DialogTitle>Cobrar {chargeOrders.length === 1 ? 'pedido' : 'pedidos'}</DialogTitle>
            <DialogDescription>Selecciona el método de pago y confirma la venta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
              <p className="mb-2 text-sm font-semibold text-[var(--app-strong)]">
                {chargeOrders.length} {chargeOrders.length === 1 ? 'pedido seleccionado' : 'pedidos seleccionados'}
              </p>
              <div className="max-h-44 space-y-2 overflow-y-auto pr-1 text-sm">
                {chargeOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[var(--app-muted)]">{order.id} · {order.customerName}</span>
                    <span className="shrink-0 font-medium text-[var(--app-strong)]">{order.total}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--app-line)] pt-3">
                <span className="text-sm text-[var(--app-muted)]">Total a cobrar</span>
                <span className="text-lg font-semibold text-[var(--app-strong)]">
                  {currencyFormatter.format(chargeOrders.reduce((total, order) => total + parseMoneyValue(order.total), 0))}
                </span>
              </div>
            </div>
            <Select value={finalizePaymentMethod} onValueChange={(v) => setFinalizePaymentMethod(v as PaymentMethod)}>
              <SelectTrigger className={FORM_CONTROL_CLASS}>
                <SelectValue placeholder="Método de pago" />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setChargeOrders([])}
              disabled={isChargingOrders}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button className="gap-2" onClick={() => { void handleFinalizeOrders(); }} disabled={isChargingOrders}>
              <CreditCard className="h-4 w-4" />
              {isChargingOrders ? 'Cobrando...' : 'Confirmar cobro'}
            </Button>
          </DialogFooter>
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
