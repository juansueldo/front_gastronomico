import { useEffect, useRef, useState } from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
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

const getPriorityMapPinColor = (priority: OrderVisualPriority) => {
  if (priority === 'old') return '#ef4444';
  if (priority === 'delayed') return '#eab308';
  if (priority === 'on-time') return '#22c55e';
  return '#6b7280';
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

  const deliveryOrders = orders.filter((order) => order.type === 'delivery');
  const salonOrders = orders.filter((order) => order.type === 'salon');
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
      await createCashMovement({ type: 'venta', concept: `Orden ${order.id}`, amount, paymentMethod: finalizePaymentMethod });
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

  const getOrderAgeMinutes = (createdAt: string) => {
    if (createdAt.includes('T')) {
      const d = new Date(createdAt);
      return Number.isNaN(d.getTime()) ? 0 : Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
    }
    const [h, m] = createdAt.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return 0;
    const now = new Date();
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 1);
    return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60000));
  };

  const getOrderVisualPriority = (order: ActiveOrderItem): OrderVisualPriority => {
    const age = getOrderAgeMinutes(order.createdAt);
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

  const getPriorityBadgeClass = (order: ActiveOrderItem) => {
    const p = getOrderVisualPriority(order);
    if (p === 'old') return 'bg-red-500 text-white text-xs';
    if (p === 'delayed') return 'bg-yellow-500 text-black text-xs';
    if (p === 'on-time') return 'bg-green-500 text-white text-xs';
    return 'bg-gray-600 text-white text-xs';
  };

  const getPriorityLabel = (order: ActiveOrderItem) => {
    const p = getOrderVisualPriority(order);
    if (p === 'old') return 'Antiguo';
    if (p === 'delayed') return 'Demorado';
    if (p === 'on-time') return 'En horario';
    return 'Recién ingresado';
  };

  // ── Render ────────────────────────────────────────────────────────────────────

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
            {/* ← Mismo botón, ahora abre CreateOrderDialog */}
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
                <div className="p-4 rounded-lg border card bg-card text-sm text-gray-400">Sin pedidos de delivery</div>
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
                <div className="p-4 rounded-lg border card bg-card text-sm text-gray-400">Sin pedidos en salón</div>
              ) : (
                salonOrders.map(renderOrderCard)
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialog detalle de orden ── */}
      <Dialog open={!!detailOrder} onOpenChange={() => setDetailOrder(null)}>
        <DialogContent className="bg-card card text-white">
          <DialogHeader>
            <DialogTitle>Detalle del pedido {detailOrder?.id}</DialogTitle>
          </DialogHeader>
          {detailOrder && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400">Tipo</span>
                <Badge variant="secondary" className={detailOrder.type === 'delivery' ? 'bg-label-info text-white text-xs' : 'bg-label-success text-white text-xs'}>
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
