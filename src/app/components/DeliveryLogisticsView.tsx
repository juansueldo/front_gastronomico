import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, CheckCircle2, Copy, LocateFixed, MapPinned, MessageCircle, Printer, RefreshCw, Route, UserRoundCheck } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '../shared/ui/components/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/components/select';
import {
  assignDeliveryRoute,
  fetchDeliveryBoard,
  markDeliveryRoutePrinted,
  updateDeliveryRouteLocation,
  updateDeliveryRouteStatus,
  type DeliveryBoard,
  type DeliveryOrder,
  type DeliveryRoute,
  type VehicleType,
} from '../features/delivery-logistics';
import { ApiError } from '../core/http/errors';

const DEFAULT_CENTER: LatLngExpression = [-34.603722, -58.381592];
const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';
const PUBLIC_FRONTEND_URL = ((import.meta as any).env?.VITE_PUBLIC_FRONTEND_URL || window.location.origin).replace(/\/$/, '');

const vehicleLabels: Record<VehicleType, string> = {
  motorcycle: 'Moto',
  bicycle: 'Bicicleta',
  car: 'Auto',
  other: 'Otro',
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError || error instanceof Error) return error.message;
  return fallback;
}

function getOrderLat(order: DeliveryOrder) {
  const value = Number(order.delivery_latitude);
  return Number.isFinite(value) ? value : null;
}

function getOrderLng(order: DeliveryOrder) {
  const value = Number(order.delivery_longitude);
  return Number.isFinite(value) ? value : null;
}

function getOrderPosition(order: DeliveryOrder): LatLngExpression | null {
  const lat = getOrderLat(order);
  const lng = getOrderLng(order);
  return lat !== null && lng !== null ? [lat, lng] : null;
}

function getOrderLabel(order: DeliveryOrder) {
  return order.order_number || `Pedido #${order.id}`;
}

function getCustomerName(order: DeliveryOrder) {
  return order.Customer?.name || 'Cliente sin nombre';
}

function getOrderItems(order: DeliveryOrder) {
  return (order.OrderItems ?? []).map((item) => {
    const name = item.Product?.name || `Producto #${item.Product?.id ?? item.id ?? ''}`.trim();
    const quantity = Number(item.quantity ?? 1);
    return `${quantity > 1 ? `${quantity}x ` : ''}${name}`;
  });
}

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(amount) ? amount : 0);
}

function getTrackingToken(order?: DeliveryOrder | null) {
  return order?.trackingToken || order?.tracking_token || null;
}

function getTrackingUrl(order?: DeliveryOrder | null) {
  const token = getTrackingToken(order);
  return token ? `${PUBLIC_FRONTEND_URL}/tracking/${token}` : null;
}

function normalizePhoneForWhatsApp(phone?: string | null) {
  return String(phone || '').replace(/[^\d]/g, '');
}

function getDistanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const earthRadius = 6371000;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLng = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const value = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function MapBounds({ orders, routes }: { orders: DeliveryOrder[]; routes: DeliveryRoute[] }) {
  const map = useMap();

  useEffect(() => {
    const points: [number, number][] = [];

    orders.forEach((order) => {
      const lat = getOrderLat(order);
      const lng = getOrderLng(order);
      if (lat !== null && lng !== null) points.push([lat, lng]);
    });

    routes.forEach((route) => {
      route.DeliveryRouteOrders?.forEach((routeOrder) => {
        const order = routeOrder.Order;
        if (!order) return;
        const lat = getOrderLat(order);
        const lng = getOrderLng(order);
        if (lat !== null && lng !== null) points.push([lat, lng]);
      });
    });

    if (points.length > 1) {
      map.fitBounds(points as LatLngBoundsExpression, { padding: [42, 42] });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, orders, routes]);

  return null;
}

function buildPrintHtml(route: DeliveryRoute) {
  const driver = route.DeliveryDriver;
  const routeOrders = [...(route.DeliveryRouteOrders ?? [])].sort((a, b) => Number(a.sequence) - Number(b.sequence));
  const rows = routeOrders.map((routeOrder) => {
    const order = routeOrder.Order;
    if (!order) return '';
    const items = getOrderItems(order).map((item) => `<li>${item}</li>`).join('');
    return `
      <section class="ticket">
        <div class="ticket-head">
          <strong>${getOrderLabel(order)}</strong>
          <span>Parada ${routeOrder.sequence}</span>
        </div>
        <p><b>Cliente:</b> ${getCustomerName(order)}</p>
        <p><b>Tel:</b> ${order.Customer?.phone || '-'}</p>
        <p><b>Dirección:</b> ${order.delivery_address || '-'}</p>
        <p><b>Total:</b> ${formatMoney(order.total_amount)}</p>
        <p><b>Zona:</b> ${order.DeliveryZone?.name || '-'}</p>
        <ul>${items}</ul>
      </section>
    `;
  }).join('');

  return `
    <!doctype html>
    <html>
      <head>
        <title>Comandas de moto</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
          .header { border-bottom: 2px solid #111827; margin-bottom: 16px; padding-bottom: 12px; }
          .header h1 { font-size: 22px; margin: 0 0 6px; }
          .header p { margin: 2px 0; }
          .ticket { break-inside: avoid; border: 1px solid #d1d5db; border-radius: 8px; margin: 0 0 14px; padding: 14px; }
          .ticket-head { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #e5e7eb; margin-bottom: 10px; padding-bottom: 8px; }
          p { margin: 5px 0; }
          ul { margin: 8px 0 0 18px; padding: 0; }
          @media print { button { display: none; } body { margin: 0; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Imprimir</button>
        <div class="header">
          <h1>Comandas de moto</h1>
          <p><b>Recorrido:</b> ${route.name || `#${route.id}`}</p>
          <p><b>Repartidor:</b> ${driver?.name || '-'} ${driver?.phone ? `(${driver.phone})` : ''}</p>
          <p><b>Pedidos:</b> ${routeOrders.length}</p>
        </div>
        ${rows}
      </body>
    </html>
  `;
}

export function DeliveryLogisticsView() {
  const navigate = useNavigate();
  const [board, setBoard] = useState<DeliveryBoard>({ drivers: [], orders: [], routes: [] });
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [sharingRouteId, setSharingRouteId] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<Record<string, string>>({});
  const [lastSentLocation, setLastSentLocation] = useState<Record<string, { latitude: number; longitude: number; sentAt: number }>>({});

  const unassignedOrders = useMemo(() => (
    board.orders.filter((order) => !order.DeliveryRouteOrder)
  ), [board.orders]);

  const selectedOrders = useMemo(() => (
    unassignedOrders.filter((order) => selectedOrderIds.includes(String(order.id)))
  ), [selectedOrderIds, unassignedOrders]);

  const activeDrivers = useMemo(() => (
    board.drivers.filter((driver) => driver.status !== 'inactive')
  ), [board.drivers]);

  const mapRoutes = useMemo(() => (
    board.routes.map((route) => ({
      route,
      points: (route.DeliveryRouteOrders ?? [])
        .slice()
        .sort((a, b) => Number(a.sequence) - Number(b.sequence))
        .map((routeOrder) => routeOrder.Order)
        .filter((order): order is DeliveryOrder => Boolean(order))
        .map((order) => getOrderPosition(order))
        .filter((position): position is LatLngExpression => Boolean(position)),
    }))
  ), [board.routes]);

  const loadBoard = async () => {
    setIsLoading(true);
    try {
      setBoard(await fetchDeliveryBoard());
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cargar logística'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadBoard();
  }, []);

  const toggleOrder = (orderId: string | number) => {
    const id = String(orderId);
    setSelectedOrderIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const handleAssignRoute = async () => {
    if (!selectedDriverId) {
      toast.error('Seleccioná un repartidor');
      return;
    }
    if (selectedOrderIds.length === 0) {
      toast.error('Seleccioná al menos un pedido');
      return;
    }

    setIsAssigning(true);
    try {
      await assignDeliveryRoute({
        driverId: selectedDriverId,
        orderIds: selectedOrderIds,
        name: `Recorrido ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      });
      setSelectedOrderIds([]);
      toast.success('Recorrido armado');
      await loadBoard();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo armar el recorrido'));
    } finally {
      setIsAssigning(false);
    }
  };

  const handlePrintRoute = async (route: DeliveryRoute) => {
    const printWindow = window.open('', '_blank', 'width=900,height=720');
    if (!printWindow) {
      toast.error('El navegador bloqueó la ventana de impresión');
      return;
    }

    printWindow.document.write(buildPrintHtml(route));
    printWindow.document.close();
    printWindow.focus();
    await markDeliveryRoutePrinted(route.id).catch(() => undefined);
    void loadBoard();
  };

  const handleRouteStatus = async (route: DeliveryRoute, status: 'in_transit' | 'completed') => {
    try {
      await updateDeliveryRouteStatus(route.id, status);
      await loadBoard();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar el recorrido'));
    }
  };

  const handleCopyTrackingLink = async (order: DeliveryOrder) => {
    const url = getTrackingUrl(order);
    if (!url) {
      toast.error('Este pedido todavía no tiene link de seguimiento');
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link de seguimiento copiado');
    } catch {
      toast.error('No se pudo copiar el link');
    }
  };

  const handleSendTrackingWhatsApp = (order: DeliveryOrder) => {
    const url = getTrackingUrl(order);
    if (!url) {
      toast.error('Este pedido todavía no tiene link de seguimiento');
      return;
    }

    const phone = normalizePhoneForWhatsApp(order.Customer?.phone);
    if (!phone) {
      toast.error('El cliente no tiene teléfono cargado');
      return;
    }

    const text = encodeURIComponent(`Hola ${getCustomerName(order)}, podés seguir tu pedido ${getOrderLabel(order)} en tiempo real acá: ${url}`);
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const sendRouteLocation = async (route: DeliveryRoute, position: GeolocationPosition) => {
    const routeId = String(route.id);
    const nextLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    };
    const previous = lastSentLocation[routeId];
    const now = Date.now();
    const shouldSend = !previous
      || now - previous.sentAt >= 5000
      || getDistanceMeters(previous, nextLocation) >= 20;

    if (!shouldSend) return;

    try {
      await updateDeliveryRouteLocation(route.id, {
        ...nextLocation,
        accuracy: position.coords.accuracy,
      });
      setLastSentLocation((current) => ({
        ...current,
        [routeId]: { ...nextLocation, sentAt: now },
      }));
      setLocationStatus((current) => ({
        ...current,
        [routeId]: `Última ubicación enviada ${new Date(now).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`,
      }));
    } catch (error) {
      setLocationStatus((current) => ({
        ...current,
        [routeId]: getApiErrorMessage(error, 'No se pudo enviar la ubicación'),
      }));
    }
  };

  const handleShareRouteLocation = (route: DeliveryRoute) => {
    if (sharingRouteId === String(route.id)) {
      setSharingRouteId(null);
      setLocationStatus((current) => ({ ...current, [String(route.id)]: 'Ubicación pausada' }));
      return;
    }

    if (!navigator.geolocation) {
      toast.error('GPS no disponible en este dispositivo');
      return;
    }

    setSharingRouteId(String(route.id));
    setLocationStatus((current) => ({ ...current, [String(route.id)]: 'Solicitando permiso de ubicación...' }));
  };

  useEffect(() => {
    if (!sharingRouteId) return undefined;

    const route = board.routes.find((item) => String(item.id) === sharingRouteId);
    if (!route) return undefined;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        void sendRouteLocation(route, position);
      },
      (error) => {
        setLocationStatus((current) => ({
          ...current,
          [sharingRouteId]: error.code === error.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado'
            : 'No se pudo obtener la ubicación',
        }));
        setSharingRouteId(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [board.routes, sharingRouteId, lastSentLocation]);

  return (
    <div className="flex min-h-0 flex-col gap-5 p-3 text-[var(--app-strong)] md:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">Operaciones</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950 dark:text-white sm:text-3xl">Delivery y repartidores</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="gap-2 border-[var(--app-line)] bg-[var(--app-panel)]"
            onClick={() => navigate('/delivery-logistics/drivers')}
          >
            <UserRoundCheck className="h-4 w-4" />
            Ver repartidores
          </Button>
          <Button type="button" variant="outline" className="gap-2 border-[var(--app-line)] bg-[var(--app-panel)]" onClick={() => void loadBoard()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserRoundCheck className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Repartidores</h2>
              </div>
              <Button type="button" size="sm" variant="outline" className="gap-2 border-[var(--app-line)]" onClick={() => navigate('/delivery-logistics/drivers')}>
                Administrar
              </Button>
            </div>

            <div className="space-y-2">
              {board.drivers.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--app-line)] p-3 text-sm text-[var(--app-muted)]">Todavía no hay repartidores. Crealos desde la vista de administración.</p>
              ) : board.drivers.map((driver) => (
                <div key={driver.id} className="rounded-md border border-[var(--app-line)] bg-[var(--app-surface)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{driver.name}</p>
                      <p className="text-xs text-[var(--app-muted)]">{vehicleLabels[driver.vehicleType]}{driver.plate ? ` · ${driver.plate}` : ''}</p>
                      <p className="text-xs text-[var(--app-muted)]">{driver.phone || 'Sin teléfono'}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      driver.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200'
                        : driver.status === 'busy' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                    >
                      {driver.status === 'active' ? 'Activo' : driver.status === 'busy' ? 'En reparto' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Route className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="font-semibold">Armar recorrido</h2>
            </div>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger className={FORM_CONTROL_CLASS}>
                <SelectValue placeholder="Seleccionar repartidor" />
              </SelectTrigger>
              <SelectContent className={SELECT_CONTENT_CLASS}>
                {activeDrivers.map((driver) => (
                  <SelectItem key={driver.id} value={String(driver.id)}>{driver.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="mt-3 rounded-md bg-[var(--app-soft)] p-3 text-sm">
              <p className="font-semibold">{selectedOrders.length} pedidos seleccionados</p>
              <p className="text-[var(--app-muted)]">Total estimado: {formatMoney(selectedOrders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0))}</p>
            </div>
            <Button type="button" className="mt-3 w-full gap-2" onClick={() => void handleAssignRoute()} disabled={isAssigning}>
              <Bike className="h-4 w-4" />
              {isAssigning ? 'Asignando...' : 'Asignar recorrido'}
            </Button>
          </section>
        </aside>

        <main className="min-w-0 space-y-4">
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
              <p className="text-sm text-[var(--app-muted)]">Pedidos para entregar</p>
              <p className="mt-1 text-3xl font-bold">{unassignedOrders.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
              <p className="text-sm text-[var(--app-muted)]">Recorridos activos</p>
              <p className="mt-1 text-3xl font-bold">{board.routes.length}</p>
            </div>
            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
              <p className="text-sm text-[var(--app-muted)]">Repartidores disponibles</p>
              <p className="mt-1 text-3xl font-bold">{board.drivers.filter((driver) => driver.status === 'active').length}</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)]">
            <div className="flex items-center justify-between border-b border-[var(--app-line)] px-4 py-3">
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Mapa de entregas</h2>
              </div>
              <p className="text-sm text-[var(--app-muted)]">Seleccioná pedidos en la lista o desde el mapa</p>
            </div>
            <div className="h-[460px] min-h-[360px]">
              <MapContainer center={DEFAULT_CENTER} zoom={12} className="h-full w-full" zoomControl={false}>
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomControl position="bottomright" />
                <MapBounds orders={unassignedOrders} routes={board.routes} />
                {unassignedOrders.map((order) => {
                  const position = getOrderPosition(order);
                  if (!position) return null;
                  const selected = selectedOrderIds.includes(String(order.id));
                  return (
                    <CircleMarker
                      key={order.id}
                      center={position}
                      radius={selected ? 10 : 8}
                      pathOptions={{
                        color: selected ? '#16a34a' : '#ff5a0a',
                        fillColor: selected ? '#22c55e' : '#ff7a1a',
                        fillOpacity: 0.85,
                        weight: 2,
                      }}
                      eventHandlers={{ click: () => toggleOrder(order.id) }}
                    >
                      <Tooltip>{getOrderLabel(order)}</Tooltip>
                      <Popup>
                        <div className="space-y-1 text-sm">
                          <p className="font-semibold">{getOrderLabel(order)}</p>
                          <p>{getCustomerName(order)}</p>
                          <p>{order.delivery_address}</p>
                          <button type="button" onClick={() => toggleOrder(order.id)} className="font-semibold text-orange-600">
                            {selected ? 'Quitar del recorrido' : 'Agregar al recorrido'}
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
                {mapRoutes.map(({ route, points }) => (
                  points.length > 1 ? (
                    <Polyline key={route.id} positions={points} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.75 }} />
                  ) : null
                ))}
              </MapContainer>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)]">
              <div className="border-b border-[var(--app-line)] px-4 py-3">
                <h2 className="font-semibold">Pedidos pendientes de reparto</h2>
              </div>
              <div className="divide-y divide-[var(--app-line)]">
                {unassignedOrders.length === 0 ? (
                  <p className="p-4 text-sm text-[var(--app-muted)]">No hay pedidos delivery pendientes con coordenadas.</p>
                ) : unassignedOrders.map((order) => {
                  const selected = selectedOrderIds.includes(String(order.id));
                  return (
                    <button
                      type="button"
                      key={order.id}
                      onClick={() => toggleOrder(order.id)}
                      className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-[var(--app-soft)] ${selected ? 'bg-orange-500/10' : ''}`}
                    >
                      <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selected ? 'border-orange-500 bg-orange-500 text-white' : 'border-[var(--app-line)]'}`}>
                        {selected ? <CheckCircle2 className="h-4 w-4" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{getOrderLabel(order)}</span>
                          <span className="rounded-full bg-[var(--app-soft)] px-2 py-0.5 text-xs text-[var(--app-muted)]">{order.status}</span>
                          <span className="text-sm font-semibold text-[var(--primary)]">{formatMoney(order.total_amount)}</span>
                        </span>
                        <span className="mt-1 block text-sm text-[var(--app-muted)]">{getCustomerName(order)} · {order.delivery_address}</span>
                        <span className="mt-1 block truncate text-xs text-[var(--app-muted)]">{getOrderItems(order).join(', ') || 'Sin items cargados'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)]">
              <div className="border-b border-[var(--app-line)] px-4 py-3">
                <h2 className="font-semibold">Recorridos activos</h2>
              </div>
              <div className="space-y-3 p-4">
                {board.routes.length === 0 ? (
                  <p className="text-sm text-[var(--app-muted)]">Todavía no hay recorridos armados.</p>
                ) : board.routes.map((route) => (
                  <div key={route.id} className="rounded-md border border-[var(--app-line)] bg-[var(--app-surface)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{route.name || `Recorrido #${route.id}`}</p>
                        <p className="text-sm text-[var(--app-muted)]">{route.DeliveryDriver?.name || 'Sin repartidor'} · {route.DeliveryRouteOrders?.length ?? 0} pedidos</p>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">{route.status}</span>
                    </div>
                    <ol className="mt-3 space-y-2 text-sm">
                      {(route.DeliveryRouteOrders ?? []).slice().sort((a, b) => Number(a.sequence) - Number(b.sequence)).map((routeOrder) => (
                        <li key={routeOrder.id} className="flex gap-2 rounded-md border border-[var(--app-line)] bg-[var(--app-panel)] p-2">
                          <span className="font-semibold text-[var(--primary)]">{routeOrder.sequence}.</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{getOrderLabel(routeOrder.Order as DeliveryOrder)}</span>
                            <span className="block truncate text-xs text-[var(--app-muted)]">{routeOrder.Order?.delivery_address}</span>
                            <span className="mt-2 flex flex-wrap gap-2">
                              <Button type="button" variant="outline" size="sm" className="h-8 border-[var(--app-line)]" onClick={() => routeOrder.Order && void handleCopyTrackingLink(routeOrder.Order)}>
                                <Copy className="mr-1 h-3.5 w-3.5" />
                                Link
                              </Button>
                              <Button type="button" variant="outline" size="sm" className="h-8 border-[var(--app-line)]" onClick={() => routeOrder.Order && handleSendTrackingWhatsApp(routeOrder.Order)}>
                                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                                WhatsApp
                              </Button>
                            </span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    {locationStatus[String(route.id)] ? (
                      <p className="mt-3 rounded-md bg-[var(--app-soft)] p-2 text-xs font-semibold text-[var(--app-muted)]">
                        {locationStatus[String(route.id)]}
                      </p>
                    ) : null}
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Button type="button" variant="outline" size="sm" className="border-[var(--app-line)]" onClick={() => void handlePrintRoute(route)}>
                        <Printer className="mr-1 h-4 w-4" />
                        Imprimir
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="border-[var(--app-line)]" onClick={() => handleShareRouteLocation(route)}>
                        <LocateFixed className="mr-1 h-4 w-4" />
                        {sharingRouteId === String(route.id) ? 'Pausar GPS' : 'Compartir GPS'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="border-[var(--app-line)]" onClick={() => void handleRouteStatus(route, 'in_transit')}>
                        En camino
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="border-[var(--app-line)]" onClick={() => void handleRouteStatus(route, 'completed')}>
                        Cerrar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      </section>

    </div>
  );
}
