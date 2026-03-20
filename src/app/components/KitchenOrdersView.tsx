import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ChefHat, Clock3, Maximize2, Minimize2, RefreshCcw } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { toast } from 'sonner';
import { fetchActiveOrders, type BackendOrderItem, updateOrderStatus } from '../ordersApi';

type KitchenOrderStatus = 'Nuevo' | 'En preparación' | 'Listo para servir' | 'En camino' | 'Entregado';

interface KitchenOrderItem {
  id: string;
  customerName: string;
  type: 'delivery' | 'salon';
  status: KitchenOrderStatus;
  createdAt: string;
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

const normalizeKitchenStatus = (status: string): KitchenOrderStatus => {
  const normalizedStatus = status.trim().toLowerCase();

  if (normalizedStatus === 'nuevo' || normalizedStatus === 'pending') {
    return 'Nuevo';
  }

  if (normalizedStatus === 'en preparación' || normalizedStatus === 'preparing') {
    return 'En preparación';
  }

  if (normalizedStatus === 'listo para servir' || normalizedStatus === 'ready') {
    return 'Listo para servir';
  }

  if (normalizedStatus === 'en camino' || normalizedStatus === 'on-the-way') {
    return 'En camino';
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
    return order.type === 'delivery' ? 'En camino' : 'Entregado';
  }

  return null;
};

const getOrderAgeMinutes = (createdAt: string) => {
  if (createdAt.includes('T')) {
    const createdDate = new Date(createdAt);

    if (Number.isNaN(createdDate.getTime())) {
      return null;
    }

    return Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 60000));
  }

  const [hoursText, minutesText] = createdAt.split(':');
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

  return Math.max(0, Math.floor((now.getTime() - createdDate.getTime()) / 60000));
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

const formatAgeMinutes = (createdAt: string) => {
  const createdDate = new Date(createdAt);

  if (!Number.isNaN(createdDate.getTime())) {
    const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdDate.getTime()) / 60000));
    return `${elapsedMinutes} min`;
  }

  return '--';
};

const mapBackendOrder = (order: BackendOrderItem): KitchenOrderItem => ({
  id: order.id,
  customerName: order.customerName,
  type: order.type,
  status: normalizeKitchenStatus(order.status),
  createdAt: order.createdAt,
  detail: order.detail,
  notes: order.notes,
  items: Array.isArray(order.items) ? order.items : [],
});

const statusCardClass: Record<KitchenOrderStatus, string> = {
  Nuevo: 'border-slate-500/60 bg-slate-500/10',
  'En preparación': 'border-amber-500/60 bg-amber-500/10',
  'Listo para servir': 'border-emerald-500/60 bg-emerald-500/10',
  'En camino': 'border-sky-500/60 bg-sky-500/10',
  Entregado: 'border-gray-700 bg-card',
};

const statusBadgeClass: Record<KitchenOrderStatus, string> = {
  Nuevo: 'bg-slate-500 text-white',
  'En preparación': 'bg-amber-500 text-black',
  'Listo para servir': 'bg-emerald-500 text-white',
  'En camino': 'bg-sky-500 text-white',
  Entregado: 'bg-gray-600 text-white',
};

export function KitchenOrdersView() {
  const [orders, setOrders] = useState<KitchenOrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clockTick, setClockTick] = useState(() => Date.now());
  const delayedAlertedOrdersRef = useRef<Set<string>>(new Set());
  const kdsContainerRef = useRef<HTMLDivElement | null>(null);

  const loadOrders = async (showErrorToast = true) => {
    setIsLoading(true);

    try {
      const backendOrders = await fetchActiveOrders();
      const normalizedOrders = backendOrders
        .map(mapBackendOrder)
        .filter((order) => order.status !== 'Entregado');

      normalizedOrders.sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();

        if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
          return 0;
        }

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
      const ageMinutes = getOrderAgeMinutes(order.createdAt);
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

  const ordersByStatus = useMemo(() => {
    return statusColumns.reduce((accumulator, column) => {
      accumulator[column.key] = orders.filter((order) => order.status === column.key);
      return accumulator;
    }, {} as Record<KitchenOrderStatus, KitchenOrderItem[]>);
  }, [orders]);

  const delayedOrdersCount = useMemo(() => {
    return orders.filter((order) => getDelayLevel(getOrderAgeMinutes(order.createdAt)) !== 'normal').length;
  }, [orders, clockTick]);

  const criticalOrdersCount = useMemo(() => {
    return orders.filter((order) => getDelayLevel(getOrderAgeMinutes(order.createdAt)) === 'critical').length;
  }, [orders, clockTick]);

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
      await updateOrderStatus(order.id, nextStatus);

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold text-white md:text-2xl">
            <ChefHat className="h-6 w-6 text-orange-400" />
            Cocina
          </h1>
          <p className="text-sm text-gray-400">Tablero en tiempo real de preparación de pedidos</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-label-warning text-white">
            {orders.length} activos
          </Badge>
          <Badge variant="secondary" className={criticalOrdersCount > 0 ? 'bg-red-500 text-white' : 'bg-amber-500 text-black'}>
            <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            {delayedOrdersCount} demorados
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void loadOrders()}
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => void toggleFullscreen()}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            {isFullscreen ? 'Salir KDS' : 'Fullscreen KDS'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {statusColumns.map((column) => {
          const columnOrders = ordersByStatus[column.key] ?? [];

          return (
            <section key={column.key} className="rounded-lg border border-gray-700 bg-card p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-medium text-gray-200">{column.label}</h2>
                <Badge variant="secondary" className="bg-gray-700 text-white text-xs">
                  {columnOrders.length}
                </Badge>
              </div>

              <div className="space-y-3">
                {columnOrders.length === 0 ? (
                  <div className="rounded-md border border-dashed border-gray-700 p-4 text-center text-xs text-gray-500">
                    Sin pedidos
                  </div>
                ) : (
                  columnOrders.map((order) => {
                    const nextStatus = toNextStatus(order);
                    const ageMinutes = getOrderAgeMinutes(order.createdAt);
                    const delayLevel = getDelayLevel(ageMinutes);
                    const delayClass = delayLevel === 'critical'
                      ? 'ring-2 ring-red-500/80 border-red-500 bg-red-500/10'
                      : delayLevel === 'warning'
                      ? 'ring-1 ring-amber-400/70 border-amber-400 bg-amber-500/10'
                      : '';

                    return (
                      <article
                        key={order.id}
                        className={`rounded-md border p-3 ${statusCardClass[order.status]} ${delayClass}`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-300">{order.id}</span>
                          <Badge variant="secondary" className={`text-[10px] ${statusBadgeClass[order.status]}`}>
                            {order.type === 'delivery' ? 'Delivery' : 'Salón'}
                          </Badge>
                        </div>

                        <p className="truncate text-sm text-white">{order.customerName}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-300">{order.detail}</p>

                        {order.items.length > 0 ? (
                          <ul className="mt-2 space-y-1 text-xs text-gray-200">
                            {order.items.slice(0, 4).map((item) => (
                              <li key={`${order.id}-${item}`} className="truncate">• {item}</li>
                            ))}
                            {order.items.length > 4 ? (
                              <li className="text-gray-400">+{order.items.length - 4} más</li>
                            ) : null}
                          </ul>
                        ) : null}

                        {order.notes ? (
                          <p className="mt-2 rounded bg-black/20 px-2 py-1 text-[11px] text-gray-300 line-clamp-2">
                            Nota: {order.notes}
                          </p>
                        ) : null}

                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 text-xs ${delayLevel === 'critical' ? 'text-red-200' : delayLevel === 'warning' ? 'text-amber-200' : 'text-gray-300'}`}>
                            <Clock3 className="h-3.5 w-3.5" />
                            {ageMinutes !== null ? `${ageMinutes} min` : formatAgeMinutes(order.createdAt)}
                          </span>

                          <Button
                            type="button"
                            size="sm"
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
    </div>
  );
}
