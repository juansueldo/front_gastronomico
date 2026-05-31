import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bike, CheckCircle2, MapPinned, Printer, RefreshCw, Route, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../shared/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../shared/ui/components/dialog';
import { Input } from '../shared/ui/components/input';
import { Label } from '../shared/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/components/select';
import {
  assignDeliveryRoute,
  createDeliveryDriver,
  deleteDeliveryDriver,
  fetchDeliveryBoard,
  markDeliveryRoutePrinted,
  updateDeliveryDriver,
  updateDeliveryRouteStatus,
  type DeliveryBoard,
  type DeliveryDriver,
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
const COMPACT_DIALOG_CONTENT_CLASS = 'w-[calc(100vw-2rem)] max-w-[560px] gap-0 overflow-visible p-0';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';
const SELECT_CONTENT_CLASS = 'border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]';

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
  const [board, setBoard] = useState<DeliveryBoard>({ drivers: [], orders: [], routes: [] });
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverPlate, setDriverPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('motorcycle');
  const [isDriverDialogOpen, setIsDriverDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingDriver, setIsSavingDriver] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

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

  const handleCreateDriver = async () => {
    if (!driverName.trim()) {
      toast.error('Ingresá el nombre del repartidor');
      return;
    }

    setIsSavingDriver(true);
    try {
      await createDeliveryDriver({
        name: driverName.trim(),
        phone: driverPhone.trim(),
        plate: driverPlate.trim(),
        vehicleType,
      });
      setDriverName('');
      setDriverPhone('');
      setDriverPlate('');
      setVehicleType('motorcycle');
      setIsDriverDialogOpen(false);
      toast.success('Repartidor creado');
      await loadBoard();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo crear el repartidor'));
    } finally {
      setIsSavingDriver(false);
    }
  };

  const handleToggleDriverStatus = async (driver: DeliveryDriver) => {
    try {
      await updateDeliveryDriver(driver.id, {
        status: driver.status === 'inactive' ? 'active' : 'inactive',
      });
      await loadBoard();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo actualizar el repartidor'));
    }
  };

  const handleDeleteDriver = async (driver: DeliveryDriver) => {
    try {
      await deleteDeliveryDriver(driver.id);
      await loadBoard();
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo eliminar el repartidor'));
    }
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

  return (
    <div className="flex min-h-0 flex-col gap-5 p-3 text-[var(--app-strong)] md:p-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--primary)]">Operaciones</p>
          <h1 className="mt-1 text-2xl font-bold tracking-normal text-slate-950 dark:text-white sm:text-3xl">Delivery y repartidores</h1>
        </div>
        <Button type="button" variant="outline" className="gap-2 border-[var(--app-line)] bg-[var(--app-panel)]" onClick={() => void loadBoard()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </header>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-[var(--primary)]" />
                <h2 className="font-semibold">Repartidores</h2>
              </div>
              <Button type="button" size="sm" className="gap-2" onClick={() => setIsDriverDialogOpen(true)}>
                <UserPlus className="h-4 w-4" />
                Crear
              </Button>
            </div>

            <div className="space-y-2">
              {board.drivers.length === 0 ? (
                <p className="rounded-md border border-dashed border-[var(--app-line)] p-3 text-sm text-[var(--app-muted)]">Todavía no hay repartidores.</p>
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
                  <div className="mt-3 flex gap-2">
                    <Button type="button" variant="outline" size="sm" className="flex-1 border-[var(--app-line)]" onClick={() => void handleToggleDriverStatus(driver)}>
                      {driver.status === 'inactive' ? 'Activar' : 'Pausar'}
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="border-[var(--app-line)]" onClick={() => void handleDeleteDriver(driver)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
                        <li key={routeOrder.id} className="flex gap-2">
                          <span className="font-semibold text-[var(--primary)]">{routeOrder.sequence}.</span>
                          <span className="min-w-0">
                            <span className="block truncate">{getOrderLabel(routeOrder.Order as DeliveryOrder)}</span>
                            <span className="block truncate text-xs text-[var(--app-muted)]">{routeOrder.Order?.delivery_address}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <Button type="button" variant="outline" size="sm" className="border-[var(--app-line)]" onClick={() => void handlePrintRoute(route)}>
                        <Printer className="mr-1 h-4 w-4" />
                        Imprimir
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

      <Dialog
        open={isDriverDialogOpen}
        onOpenChange={(open) => {
          setIsDriverDialogOpen(open);
          if (!open && !isSavingDriver) {
            setDriverName('');
            setDriverPhone('');
            setDriverPlate('');
            setVehicleType('motorcycle');
          }
        }}
      >
        <DialogContent className={COMPACT_DIALOG_CONTENT_CLASS}>
          <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
            <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
              <Bike size={18} />
            </div>
            <DialogTitle>Nuevo repartidor</DialogTitle>
            <DialogDescription>Creá un perfil para asignarle recorridos y comandas de moto.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={driverName}
                onChange={(event) => setDriverName(event.target.value)}
                placeholder="Ej: Juan Pérez"
                className={`mt-2 ${FORM_CONTROL_CLASS}`}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Teléfono</Label>
                <Input
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  placeholder="Ej: 11 2345-6789"
                  className={`mt-2 ${FORM_CONTROL_CLASS}`}
                />
              </div>
              <div>
                <Label>Patente</Label>
                <Input
                  value={driverPlate}
                  onChange={(event) => setDriverPlate(event.target.value)}
                  placeholder="Ej: A123BCD"
                  className={`mt-2 ${FORM_CONTROL_CLASS}`}
                />
              </div>
            </div>

            <div>
              <Label>Vehículo</Label>
              <Select value={vehicleType} onValueChange={(value) => setVehicleType(value as VehicleType)}>
                <SelectTrigger className={`mt-2 ${FORM_CONTROL_CLASS}`}>
                  <SelectValue placeholder="Seleccionar vehículo" />
                </SelectTrigger>
                <SelectContent className={SELECT_CONTENT_CLASS}>
                  {Object.entries(vehicleLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDriverDialogOpen(false)}
              disabled={isSavingDriver}
              className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleCreateDriver()} disabled={isSavingDriver}>
              {isSavingDriver ? 'Guardando...' : 'Crear repartidor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
