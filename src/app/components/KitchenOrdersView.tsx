import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  ChefHat,
  Clock3,
  Maximize2,
  Minimize2,
  RefreshCcw,
  SlidersHorizontal,
  Soup,
  Wifi,
} from 'lucide-react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { toast } from 'sonner';
import { fetchActiveOrders, transitionOrderStatus } from '../features/orders/services/orders.service';

type KitchenOrderStatus = 'Nuevo' | 'En preparación' | 'Listo para servir' | 'Entregado';

interface KitchenOrderItem {
  id: string;
  customerName: string;
  type: 'delivery' | 'salon';
  status: KitchenOrderStatus;
  createdAt: string;
  scheduledDate?: string;
  scheduledTime?: string;
  detail: string;
  notes?: string;
  items: string[];
}

type DelayLevel = 'normal' | 'warning' | 'critical';

const WARNING_DELAY_MINUTES = 20;
const CRITICAL_DELAY_MINUTES = 35;

const statusColumns: Array<{ key: KitchenOrderStatus; label: string }> = [
  { key: 'Nuevo', label: 'Nuevo' },
  { key: 'En preparación', label: 'En preparación' },
  { key: 'Listo para servir', label: 'Listo para servir' },
];

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

const normalizeKitchenStatus = (status: string): KitchenOrderStatus => {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === 'nuevo' || normalizedStatus === 'pending') {
    return 'Nuevo';
  }

  if (
    normalizedStatus === 'en preparación'
    || normalizedStatus === 'en preparacion'
    || normalizedStatus === 'processing'
    || normalizedStatus === 'preparing'
  ) {
    return 'En preparación';
  }

  if (normalizedStatus === 'listo para servir' || normalizedStatus === 'ready') {
    return 'Listo para servir';
  }

  if (normalizedStatus === 'entregado' || normalizedStatus === 'delivered' || normalizedStatus === 'completed') {
    return 'Entregado';
  }

  return 'Nuevo';
};

const toNextStatus = (order: KitchenOrderItem): KitchenOrderStatus | null => {
  if (order.status === 'Nuevo') {
    return 'En preparación';
  }

  if (order.status === 'En preparación') {
    return 'Listo para servir';
  }

  if (order.status === 'Listo para servir') {
    return 'Entregado';
  }

  return null;
};

const getOrderReferenceDate = (order: KitchenOrderItem): Date | null => {
  const scheduledDate = buildDateFromScheduled(order.scheduledDate, order.scheduledTime);
  if (scheduledDate) {
    return scheduledDate;
  }

  if (order.createdAt.includes('T')) {
    const createdDate = new Date(order.createdAt);

    if (Number.isNaN(createdDate.getTime())) {
      return null;
    }

    return createdDate;
  }

  const [hoursText, minutesText] = order.createdAt.split(':');
  const hours = Number(hoursText);
  const minutes = Number(minutesText);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  const now = new Date();
  const createdDate = new Date(now);
  createdDate.setHours(hours, minutes, 0, 0);

  if (createdDate.getTime() > now.getTime()) {
    createdDate.setDate(createdDate.getDate() - 1);
  }

  return createdDate;
};

const getOrderDateLabel = (order: KitchenOrderItem) => {
  const referenceDate = getOrderReferenceDate(order);
  if (!referenceDate) {
    return '';
  }
  return toLocalDateLabel(referenceDate);
};

const getOrderAgeMinutes = (order: KitchenOrderItem) => {
  const referenceDate = getOrderReferenceDate(order);
  if (!referenceDate) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - referenceDate.getTime()) / 60000));
};

const getDelayLevel = (ageMinutes: number | null): DelayLevel => {
  if (ageMinutes === null) {
    return 'normal';
  }

  if (ageMinutes >= CRITICAL_DELAY_MINUTES) {
    return 'critical';
  }

  if (ageMinutes >= WARNING_DELAY_MINUTES) {
    return 'warning';
  }

  return 'normal';
};

const formatAgeMinutes = (order: KitchenOrderItem) => {
  const ageMinutes = getOrderAgeMinutes(order);
  return ageMinutes === null ? '--' : `${ageMinutes} min`;
};

const mapBackendOrder = (order: any): KitchenOrderItem => {
  const backendType = String(order?.type ?? '');
  const type: KitchenOrderItem['type'] = backendType === 'delivery' ? 'delivery' : 'salon';
  const customerFullName = [order?.Customer?.name].filter(Boolean).join(' ').trim();

  const items = Array.isArray(order?.items)
    ? order.items.map((item: any) => String(item))
    : Array.isArray(order?.OrderItems)
      ? order.OrderItems.map((item: any) => {
        const name = item?.Product?.name ?? `Producto ${item?.productId ?? ''}`.trim();
        const quantity = Number(item?.quantity ?? 0);
        return quantity > 1 ? `${name} x${quantity}` : String(name);
      })
      : [];

  const customerName = order?.customerName
    || order?.Customer?.name
    || customerFullName
    || (order?.customerId ? `Cliente #${order.customerId}` : `Orden ${order?.order_number ?? order?.id ?? ''}`);

  return {
    id: String(order?.id ?? order?.order_number ?? crypto.randomUUID()),
    customerName: String(customerName),
    type,
    status: normalizeKitchenStatus(String(order?.status ?? order?.Status?.name ?? 'pending')),
    createdAt: String(order?.createdAt ?? order?.order_date ?? ''),
    scheduledDate: order?.scheduled_date ?? order?.scheduledDate ?? order?.requested_date ?? order?.requestedDate ?? undefined,
    scheduledTime: order?.scheduled_time ?? order?.scheduledTime ?? order?.requested_time ?? order?.requestedTime ?? undefined,
    detail: String(order?.detail ?? order?.order_number ?? 'Sin detalle'),
    notes: order?.notes ?? undefined,
    items,
  };
};

const statusCardClass: Record<KitchenOrderStatus, string> = {
  Nuevo: 'border-slate-500/60 bg-slate-500/10',
  'En preparación': 'border-amber-500/60 bg-amber-500/10',
  'Listo para servir': 'border-emerald-500/60 bg-emerald-500/10',
  Entregado: 'border-orange-700 bg-card',
};

const statusBadgeClass: Record<KitchenOrderStatus, string> = {
  Nuevo: 'bg-slate-500/85 text-white',
  'En preparación': 'bg-amber-500 text-black',
  'Listo para servir': 'bg-emerald-500/85 text-white',
  Entregado: 'bg-gray-500 text-white',
};

export function KitchenOrdersView() {
  const [orders, setOrders] = useState<KitchenOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSoundEnabled, setIsSoundEnabled] = useState(true);
  const [channelFilter, setChannelFilter] = useState<'all' | KitchenOrderItem['type']>('all');
  const [clockTick, setClockTick] = useState(() => Date.now());
  const delayedAlertedOrdersRef = useRef<Set<string>>(new Set());
  const kdsContainerRef = useRef<HTMLDivElement | null>(null);

  const loadOrders = async (showErrorToast = true) => {
    setIsLoading(true);

    try {
      const backendOrders = await fetchActiveOrders();
      const todayLabel = toLocalDateLabel(new Date());
      const normalizedOrders = backendOrders
        .map(mapBackendOrder)
        .filter((order) => order.status !== 'Entregado')
        .filter((order) => getOrderDateLabel(order) === todayLabel);

      normalizedOrders.sort((a, b) => {
        const aTime = getOrderReferenceDate(a)?.getTime() ?? 0;
        const bTime = getOrderReferenceDate(b)?.getTime() ?? 0;
        return aTime - bTime;
      });

      setOrders(normalizedOrders);
    } catch (error) {
      if (showErrorToast) {
        toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los pedidos de cocina');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();

    const intervalId = window.setInterval(() => {
      void loadOrders(false);
    }, 20_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockTick(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const nextDelayedIds = new Set<string>();

    orders.forEach((order) => {
      const ageMinutes = getOrderAgeMinutes(order);
      const delayLevel = getDelayLevel(ageMinutes);

      if (delayLevel === 'normal') {
        return;
      }

      nextDelayedIds.add(order.id);

      if (delayedAlertedOrdersRef.current.has(order.id)) {
        return;
      }

      delayedAlertedOrdersRef.current.add(order.id);
      toast.warning(`Pedido ${order.id} demorado (${ageMinutes ?? '--'} min)`);
    });

    delayedAlertedOrdersRef.current.forEach((orderId) => {
      if (!nextDelayedIds.has(orderId)) {
        delayedAlertedOrdersRef.current.delete(orderId);
      }
    });
  }, [orders, clockTick]);

  const visibleOrders = useMemo(() => {
    if (channelFilter === 'all') {
      return orders;
    }

    return orders.filter((order) => order.type === channelFilter);
  }, [channelFilter, orders]);

  const ordersByStatus = useMemo(() => {
    return statusColumns.reduce((accumulator, column) => {
      accumulator[column.key] = visibleOrders.filter((order) => order.status === column.key);
      return accumulator;
    }, {} as Record<KitchenOrderStatus, KitchenOrderItem[]>);
  }, [visibleOrders]);

  const delayedOrdersCount = useMemo(() => {
    return visibleOrders.filter((order) => getDelayLevel(getOrderAgeMinutes(order)) !== 'normal').length;
  }, [visibleOrders, clockTick]);

  const criticalOrdersCount = useMemo(() => {
    return visibleOrders.filter((order) => getDelayLevel(getOrderAgeMinutes(order)) === 'critical').length;
  }, [visibleOrders, clockTick]);

  const averagePrepMinutes = useMemo(() => {
    const preparingOrders = visibleOrders.filter((order) => order.status === 'En preparación');
    if (preparingOrders.length === 0) {
      return 0;
    }

    const totalMinutes = preparingOrders.reduce((accumulator, order) => {
      const ageMinutes = getOrderAgeMinutes(order);
      return accumulator + (ageMinutes ?? 0);
    }, 0);

    return Math.round(totalMinutes / preparingOrders.length);
  }, [visibleOrders, clockTick]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      if (kdsContainerRef.current) {
        await kdsContainerRef.current.requestFullscreen();
      }
    } catch {
      toast.error('No se pudo cambiar a pantalla completa');
    }
  };

  const handleAdvanceOrder = async (order: KitchenOrderItem) => {
    const nextStatus = toNextStatus(order);

    if (!nextStatus) {
      return;
    }

    setUpdatingOrderId(order.id);

    try {
      await transitionOrderStatus(order.id, order.status, nextStatus);

      setOrders((prev) => prev
        .map((currentOrder) => (
          currentOrder.id === order.id
            ? { ...currentOrder, status: nextStatus }
            : currentOrder
        ))
        .filter((currentOrder) => currentOrder.status !== 'Entregado'));

      toast.success(`Pedido ${order.id} actualizado a ${nextStatus}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el pedido');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return (
    <div
      ref={kdsContainerRef}
      className={`h-full overflow-y-auto bg-body p-4 md:p-6 ${isFullscreen ? 'kds-fullscreen' : ''}`}
    >
      <div className="relative">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        </div>

        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-semibold text-white md:text-3xl">
                <ChefHat className="h-8 w-8 text-orange-400" />
                Cocina
              </h1>
              <p className="mt-1 text-sm text-muted-foreground md:text-1xl">Tablero en tiempo real de preparación de pedidos</p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 rounded-xl border-border bg-card/70 text-foreground hover:bg-card"
                onClick={() => setIsSoundEnabled((prev) => !prev)}
              >
                <BellRing className="h-4 w-4" />
                Sonido: {isSoundEnabled ? 'Activado' : 'Silenciado'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-border bg-card/70 text-foreground hover:bg-card"
              >
                <SlidersHorizontal className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-border bg-card/70 text-foreground hover:bg-card"
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <div className="rounded-xl border border-orange-500/70 bg-orange-500/10 p-3">
              <p className="text-sm text-orange-700 dark:text-orange-200">Nuevos</p>
              <p className="text-3xl font-semibold text-orange-800 dark:text-orange-100">{ordersByStatus.Nuevo?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-amber-500/70 bg-amber-500/10 p-3">
              <p className="text-sm text-amber-700 dark:text-amber-200">En preparación</p>
              <p className="text-3xl font-semibold text-amber-800 dark:text-amber-100">{ordersByStatus['En preparación']?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/70 bg-emerald-500/10 p-3">
              <p className="text-sm text-emerald-700 dark:text-emerald-200">Listos para servir</p>
              <p className="text-3xl font-semibold text-emerald-800 dark:text-emerald-100">{ordersByStatus['Listo para servir']?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-slate-400/60 bg-slate-500/10 p-3">
              <p className="text-sm text-slate-700 dark:text-slate-200">Prom. preparación</p>
              <p className="text-3xl font-semibold text-slate-800 dark:text-slate-100">{averagePrepMinutes} min</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card/60 p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm ${
                  channelFilter === 'all' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setChannelFilter('all')}
              >
                Todos {orders.length}
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm ${
                  channelFilter === 'salon' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setChannelFilter('salon')}
              >
                Salón {orders.filter((order) => order.type === 'salon').length}
              </button>
              <button
                type="button"
                className={`rounded-xl px-4 py-2 text-sm ${
                  channelFilter === 'delivery' ? 'bg-primary text-white' : 'bg-background text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setChannelFilter('delivery')}
              >
                Delivery {orders.filter((order) => order.type === 'delivery').length}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => void loadOrders()}
                disabled={isLoading}
              >
                <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                {isFullscreen ? 'Salir KDS' : 'Entrar KDS'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            {statusColumns.map((column) => {
              const columnOrders = ordersByStatus[column.key] ?? [];

              return (
                <section key={column.key} className="rounded-2xl border border-border bg-card/60 p-3 backdrop-blur-sm">
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                    <h2 className="text-xl font-medium text-foreground">{column.label}</h2>
                    <Badge variant="secondary" className="border border-border bg-muted/70 text-foreground">
                      {columnOrders.length}
                    </Badge>
                  </div>

                  <div className="space-y-3">
                    {columnOrders.length === 0 ? (
                      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-dashed border-orange-500/40 p-4 text-center text-sm text-muted-foreground">
                        <div className="space-y-2">
                          <Soup className="mx-auto h-8 w-8 text-muted-foreground" />
                          <p>Sin pedidos</p>
                        </div>
                      </div>
                    ) : (
                      columnOrders.map((order) => {
                        const nextStatus = toNextStatus(order);
                        const ageMinutes = getOrderAgeMinutes(order);
                        const delayLevel = getDelayLevel(ageMinutes);
                        const delayClass = delayLevel === 'critical'
                          ? 'ring-2 ring-red-500/80 border-red-500 bg-red-500/10'
                          : delayLevel === 'warning'
                            ? 'ring-1 ring-amber-400/70 border-amber-400 bg-amber-500/10'
                            : '';

                        return (
                          <article
                            key={order.id}
                            className={`rounded-xl border p-3 ${statusCardClass[order.status]} ${delayClass}`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="text-lg font-semibold text-foreground">{order.id}</span>
                              <Badge variant="secondary" className={`text-xs ${statusBadgeClass[order.status]}`}>
                                {order.type === 'delivery' ? 'Delivery' : 'Salón'}
                              </Badge>
                            </div>

                            <p className="truncate text-base text-foreground">{order.customerName}</p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{order.detail}</p>

                            {order.items.length > 0 ? (
                              <ul className="mt-3 space-y-1 text-sm text-foreground">
                                {order.items.slice(0, 3).map((item) => (
                                  <li key={`${order.id}-${item}`} className="truncate">• {item}</li>
                                ))}
                                {order.items.length > 3 ? (
                                  <li className="text-muted-foreground">+{order.items.length - 3} más</li>
                                ) : null}
                              </ul>
                            ) : null}

                            <div className="mt-4 flex items-center justify-between gap-2">
                              <span className={`inline-flex items-center gap-1 text-sm ${
                                delayLevel === 'critical' ? 'text-red-700 dark:text-red-200' : delayLevel === 'warning' ? 'text-amber-700 dark:text-amber-200' : 'text-muted-foreground'
                              }`}>
                                <Clock3 className="h-4 w-4" />
                                {ageMinutes !== null ? `${ageMinutes} min` : formatAgeMinutes(order)}
                              </span>

                              <Button
                                type="button"
                                size="sm"
                                className="rounded-xl"
                                onClick={() => void handleAdvanceOrder(order)}
                                disabled={!nextStatus || updatingOrderId === order.id}
                              >
                                {nextStatus ? `Pasar a ${nextStatus}` : 'Sin acción'}
                              </Button>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between rounded-2xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <span>Última actualización: {new Date(clockTick).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
            <span className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Wifi className="h-4 w-4" />
              Conectado
            </span>
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${criticalOrdersCount > 0 ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`} />
              {delayedOrdersCount} demorados
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
