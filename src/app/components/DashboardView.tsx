import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Polygon, Popup, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bike,
  Check,
  ClipboardList,
  Filter,
  MoreVertical,
  Plus,
  ReceiptText,
  ShoppingBag,
  Table2,
  Ticket,
  Utensils,
} from 'lucide-react';
import { AppLayout } from './AppLayout';
import { fetchProducts } from '../features/products';
import { fetchActiveOrders } from '../features/orders/services/orders.service';
import { fetchTables } from '../features/tables';
import { listHeadquarters } from '../features/headquarters';
import { fetchCashMovements, type CashMovement } from '../features/cash-register';
import { fetchDeliveryZones, type DeliveryZone } from '../features/delivery-zones';
import { getLoggedUser } from '../core/storage/authStorage';
import { getStorageItem } from '../shared/storage';
import { formatOrderNumber } from '../shared/utils/orderNumbers';

interface DashboardMetrics {
  activeOrders: number;
  preparingOrders: number;
  products: number;
  tables: number;
  occupiedTables: number;
  headquarters: number;
  totalCash: number;
  salesIncome: number;
  averageTicket: number;
}

const initialMetrics: DashboardMetrics = {
  activeOrders: 0,
  preparingOrders: 0,
  products: 0,
  tables: 0,
  occupiedTables: 0,
  headquarters: 0,
  totalCash: 0,
  salesIncome: 0,
  averageTicket: 0,
};

type DashboardOrderRow = {
  id: string;
  number: string;
  type: 'Delivery' | 'Salon';
  customer: string;
  contact: string;
  location: string;
  locationDetail: string;
  status: string;
  time: string;
  dayLabel: string;
  total: string;
};

type DashboardActivity = {
  icon: typeof ClipboardList;
  tone: string;
  title: string;
  detail: string;
  time: string;
};

type DashboardTopProduct = {
  name: string;
  quantity: number;
  total: number;
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

function useAnimatedNumber(target: number, duration = 900) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const normalizedTarget = Number.isFinite(target) ? Math.max(0, target) : 0;
    let frameId = 0;
    let startTime: number | null = null;

    setValue(0);

    const animate = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }

      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);

      setValue(normalizedTarget * easedProgress);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      } else {
        setValue(normalizedTarget);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [target, duration]);

  return value;
}

const DASHBOARD_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';
const DEFAULT_MAP_CENTER: LatLngExpression = [-34.603722, -58.381592];
const DASHBOARD_ZONE_COLORS = ['#22c55e', '#ff5a0a', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444'];

const sparkPoints = [10, 26, 18, 38, 31, 42, 36, 58, 51, 66, 59, 78];

const isSaleMovement = (movement: CashMovement) => {
  const normalizedDescription = movement.description.toLowerCase();
  return movement.legacyType === 'venta'
    || movement.type === 'income'
    || normalizedDescription.startsWith('orden ')
    || normalizedDescription.startsWith('pedido ')
    || normalizedDescription.startsWith('mesa ');
};

const parseMoneyValue = (value: unknown) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const normalized = String(value ?? '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
};

const getOrderNumber = (order: unknown) => {
  return formatOrderNumber(order, '-');
};

const getOrderDate = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  const rawDate = getRecordValue(record, ['createdAt', 'created_at', 'order_date', 'date']);
  const parsed = new Date(String(rawDate ?? ''));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatTime = (date: Date | null) => (
  date ? date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '--:--'
);

const formatDayLabel = (date: Date | null) => {
  if (!date) return '--';
  const today = new Date();
  return today.toDateString() === date.toDateString()
    ? 'Hoy'
    : date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
};

const formatElapsedTime = (date: Date | null) => {
  if (!date) return '--';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

const getOrderStatus = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  const statusRecord = record.Status as Record<string, unknown> | undefined;
  const rawStatus = String(getRecordValue(record, ['status']) ?? statusRecord?.name ?? 'pending');
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === 'pending' || normalized === 'nuevo') return 'Nuevo';
  if (normalized === 'processing' || normalized === 'preparing' || normalized.includes('prepar')) return 'En preparacion';
  if (normalized === 'ready' || normalized.includes('listo')) return 'Listo';
  if (normalized === 'completed' || normalized.includes('entregado')) return 'Entregado';
  if (normalized.includes('camino') || normalized.includes('delivery')) return 'En delivery';
  return rawStatus;
};

const getOrderType = (order: unknown): 'Delivery' | 'Salon' => {
  const record = (order ?? {}) as Record<string, unknown>;
  return String(record.type ?? '').toLowerCase() === 'delivery' ? 'Delivery' : 'Salon';
};

const getOrderCustomerName = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  const customer = record.Customer as Record<string, unknown> | undefined;
  return String(
    getRecordValue(record, ['customerName', 'customer_name'])
    ?? customer?.name
    ?? '',
  ).trim();
};

const getOrderContact = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  const customer = record.Customer as Record<string, unknown> | undefined;
  return String(
    getRecordValue(record, ['customerPhone', 'customer_phone', 'phone'])
    ?? customer?.phone
    ?? '',
  ).trim();
};

const getOrderTableLabel = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  const table = (record.Table ?? record.table) as Record<string, unknown> | undefined;
  const tableNumber = getRecordValue(record, ['tableNumber', 'table_number'])
    ?? table?.table_number
    ?? table?.tableNumber
    ?? getRecordValue(record, ['tableId', 'table_id']);
  return tableNumber ? `Mesa ${tableNumber}` : 'Salon';
};

const getOrderAddress = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  return String(getRecordValue(record, ['address', 'delivery_address']) ?? '').trim();
};

const getOrderTotal = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  return parseMoneyValue(getRecordValue(record, ['total_amount', 'total', 'amount']));
};

const getOrderItems = (order: unknown) => {
  const record = (order ?? {}) as Record<string, unknown>;
  if (Array.isArray(record.items)) return record.items.map((item) => String(item).trim()).filter(Boolean);
  const orderItems = (record.OrderItems ?? record.orderItems ?? record.order_items) as unknown;
  if (!Array.isArray(orderItems)) return [];
  return orderItems.map((item) => {
    const itemRecord = (item ?? {}) as Record<string, unknown>;
    const product = (itemRecord.Product ?? itemRecord.product) as Record<string, unknown> | undefined;
    const name = String(product?.name ?? itemRecord.name ?? 'Producto').trim();
    const quantity = Number(itemRecord.quantity ?? 1);
    return { name, quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1, total: parseMoneyValue(itemRecord.total ?? itemRecord.total_amount) };
  });
};

const buildDashboardOrderRows = (orders: unknown[]): DashboardOrderRow[] => (
  orders
    .slice()
    .sort((left, right) => (getOrderDate(right)?.getTime() ?? 0) - (getOrderDate(left)?.getTime() ?? 0))
    .slice(0, 8)
    .map((order) => {
      const record = (order ?? {}) as Record<string, unknown>;
      const date = getOrderDate(order);
      const type = getOrderType(order);
      const address = getOrderAddress(order);
      const customer = getOrderCustomerName(order);
      return {
        id: String(record.id ?? getOrderNumber(order)),
        number: getOrderNumber(order),
        type,
        customer: customer || (type === 'Delivery' ? 'Cliente sin nombre' : getOrderTableLabel(order)),
        contact: getOrderContact(order) || 'Sin telefono',
        location: type === 'Delivery' ? (address || 'Direccion sin cargar') : getOrderTableLabel(order),
        locationDetail: type === 'Delivery' ? 'Delivery' : 'Salon',
        status: getOrderStatus(order),
        time: formatElapsedTime(date),
        dayLabel: `${formatDayLabel(date)}, ${formatTime(date)}`,
        total: currencyFormatter.format(getOrderTotal(order)),
      };
    })
);

const buildDashboardActivities = (orders: unknown[], movements: CashMovement[]): DashboardActivity[] => {
  const orderActivities = orders.slice(0, 4).map((order) => {
    const type = getOrderType(order);
    return {
      icon: type === 'Delivery' ? Bike : ShoppingBag,
      tone: type === 'Delivery' ? 'blue' : 'orange',
      title: `Pedido #${getOrderNumber(order)}`,
      detail: `${getOrderStatus(order)} - ${type}`,
      time: formatTime(getOrderDate(order)),
      timestamp: getOrderDate(order)?.getTime() ?? 0,
    };
  });

  const movementActivities = movements
    .filter(isSaleMovement)
    .slice(0, 4)
    .map((movement) => {
      const date = getMovementDate(movement);
      return {
        icon: Check,
        tone: 'green',
        title: movement.concept || movement.description || 'Venta registrada',
        detail: currencyFormatter.format(Math.abs(movement.amount)),
        time: formatTime(date),
        timestamp: date?.getTime() ?? 0,
      };
    });

  return [...orderActivities, ...movementActivities]
    .sort((left, right) => right.timestamp - left.timestamp)
    .slice(0, 5)
    .map(({ timestamp: _timestamp, ...activity }) => activity);
};

const buildTopProducts = (orders: unknown[]): DashboardTopProduct[] => {
  const productsByName = new Map<string, DashboardTopProduct>();
  orders.forEach((order) => {
    getOrderItems(order).forEach((item) => {
      if (typeof item === 'string') {
        const current = productsByName.get(item) ?? { name: item, quantity: 0, total: 0 };
        current.quantity += 1;
        productsByName.set(item, current);
        return;
      }
      const current = productsByName.get(item.name) ?? { name: item.name, quantity: 0, total: 0 };
      current.quantity += item.quantity;
      current.total += item.total;
      productsByName.set(item.name, current);
    });
  });
  return Array.from(productsByName.values())
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 4);
};

const getMovementDate = (movement: CashMovement) => {
  const parsed = new Date(String(movement.movementDate ?? movement.createdAt ?? movement.created_at ?? ''));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const buildSalesPoints = (movements: CashMovement[]) => {
  const points = Array.from({ length: 7 }, () => 0);
  movements.filter(isSaleMovement).forEach((movement) => {
    const date = getMovementDate(movement);
    if (!date) return;
    const bucket = Math.min(6, Math.floor(date.getHours() / 4));
    points[bucket] += Math.abs(movement.amount);
  });
  return points;
};

const getEntityHeadquarterId = (entity: unknown): number | null => {
  if (!entity || typeof entity !== 'object') return null;
  const candidate = entity as Record<string, unknown>;
  const parsedHeadquarterId = Number(
    candidate.headquarterId
    ?? candidate.headquarter_id
    ?? (candidate.headquarter as Record<string, unknown> | undefined)?.id
    ?? (candidate.Headquarter as Record<string, unknown> | undefined)?.id
    ?? (candidate.metadata as Record<string, unknown> | undefined)?.headquarterId
    ?? (candidate.metadata as Record<string, unknown> | undefined)?.headquarter_id,
  );
  return Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0 ? parsedHeadquarterId : null;
};

const getLoggedUserHeadquarterId = (): number | null => {
  const loggedUser = getLoggedUser();
  if (!loggedUser || typeof loggedUser !== 'object') return null;
  const candidate = loggedUser as Record<string, unknown>;
  const parsedHeadquarterId = Number(
    candidate.headquarterId
    ?? candidate.headquarter_id
    ?? (candidate.headquarter as Record<string, unknown> | undefined)?.id
    ?? (candidate.Headquarter as Record<string, unknown> | undefined)?.id
    ?? candidate.userHeadquarterId,
  );
  return Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0 ? parsedHeadquarterId : null;
};

const getStoredHeadquarterId = (): number | null => {
  const parsedHeadquarterId = Number(getStorageItem(DASHBOARD_HEADQUARTER_STORAGE_KEY));
  return Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0 ? parsedHeadquarterId : null;
};

const resolveDashboardHeadquarterId = (): number | null => getLoggedUserHeadquarterId() ?? getStoredHeadquarterId();

function Sparkline({ points = sparkPoints }: { points?: number[] }) {
  const d = useMemo(() => {
    const max = Math.max(...points);
    const min = Math.min(...points);
    return points
      .map((point, index) => {
        const x = (index / (points.length - 1)) * 112;
        const y = 48 - ((point - min) / Math.max(max - min, 1)) * 42;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [points]);

  return (
    <svg viewBox="0 0 112 54" className="h-14 w-28" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500" />
    </svg>
  );
}

function SalesChart({ points }: { points: number[] }) {
  const chartPoints = points.length > 1 && points.some((point) => point > 0) ? points : [0, 0, 0, 0, 0, 0, 0];
  const path = useMemo(() => {
    const max = Math.max(...chartPoints);
    const min = Math.min(...chartPoints);
    return chartPoints
      .map((point, index) => {
        const x = (index / Math.max(chartPoints.length - 1, 1)) * 520;
        const y = 170 - ((point - min) / Math.max(max - min, 1)) * 150;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [chartPoints]);

  return (
    <svg viewBox="0 0 560 210" className="h-full min-h-[210px] w-full" aria-label="Ventas del dia">
      <defs>
        <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ff5a0a" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#ff5a0a" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[40, 80, 120, 160].map((y) => (
        <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="currentColor" strokeDasharray="6 6" className="text-app-grid" />
      ))}
      <path d={`${path} L 520 190 L 0 190 Z`} fill="url(#salesFill)" />
      <path d={path} fill="none" stroke="#ff5a0a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="520" cy="20" r="5" fill="#ff5a0a" />
      {['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'].map((label, index) => (
        <text key={label} x={index * 86} y="208" className="fill-app-muted text-[13px]">{label}</text>
      ))}
    </svg>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof ClipboardList;
  tone: string;
}) {
  return (
    <section className="dashboard-card metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-app-muted">{title}</p>
        <p className="mt-1 truncate text-2xl font-semibold text-app-strong">{value}</p>
        <p className="mt-1 text-sm font-semibold text-emerald-500">{detail}</p>
      </div>
  
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const normalizedStatus = status.trim().toLowerCase();
  const className = normalizedStatus.includes('listo')
    ? 'status-pill green'
    : normalizedStatus.includes('delivery') || normalizedStatus.includes('camino')
      ? 'status-pill blue'
      : 'status-pill orange';
  return <span className={className}>{status}</span>;
}

function DashboardMapBounds({ bounds }: { bounds?: LatLngBoundsExpression }) {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }
  }, [bounds, map]);

  return null;
}

function DeliveryZonesDashboardMap({ zones }: { zones: DeliveryZone[] }) {
  const validZones = useMemo(
    () => zones.filter((zone) => zone.polygon.length >= 3),
    [zones],
  );
  const bounds = useMemo<LatLngBoundsExpression | undefined>(() => {
    const points = validZones.flatMap((zone) => zone.polygon.map((point) => [point.lat, point.lng] as [number, number]));
    return points.length > 0 ? points : undefined;
  }, [validZones]);

  return (
    <div className="delivery-map">
      {validZones.length > 0 ? (
        <div className="map-legend">
          {validZones.slice(0, 4).map((zone, index) => (
            <span key={zone.id ?? `${zone.name}-${index}`}>
              <i style={{ backgroundColor: DASHBOARD_ZONE_COLORS[index % DASHBOARD_ZONE_COLORS.length] }} />
              {zone.name ?? `Zona ${index + 1}`}
              <small>{zone.active === false ? 'Inactiva' : 'Activa'} · {zone.polygon.length} puntos</small>
            </span>
          ))}
          {validZones.length > 4 ? (
            <span>
              <i style={{ backgroundColor: '#94a3b8' }} />
              +{validZones.length - 4} zonas
              <small>Configuradas</small>
            </span>
          ) : null}
        </div>
      ) : null}

      {validZones.length === 0 ? (
        <div className="flex h-full min-h-[230px] items-center justify-center px-6 text-center text-sm text-app-muted">
          No hay zonas de delivery configuradas.
        </div>
      ) : (
        <MapContainer
          center={DEFAULT_MAP_CENTER}
          zoom={12}
          className="h-full min-h-[230px] w-full"
          scrollWheelZoom={false}
          zoomControl={false}
        >
          <ZoomControl position="bottomright" />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <DashboardMapBounds bounds={bounds} />
          {validZones.map((zone, index) => {
            const color = DASHBOARD_ZONE_COLORS[index % DASHBOARD_ZONE_COLORS.length];
            const positions = zone.polygon.map((point) => [point.lat, point.lng] as [number, number]);
            return (
              <Polygon
                key={zone.id ?? `${zone.name}-${index}`}
                positions={positions}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.18,
                  opacity: zone.active === false ? 0.45 : 0.95,
                  weight: 2,
                }}
              >
                <Tooltip sticky>{zone.name ?? `Zona ${index + 1}`}</Tooltip>
                <Popup>
                  <div className="text-sm">
                    <strong>{zone.name ?? `Zona ${index + 1}`}</strong>
                    <br />
                    {zone.active === false ? 'Inactiva' : 'Activa'} · {zone.polygon.length} puntos
                  </div>
                </Popup>
              </Polygon>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}

export function DashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [dashboardOrders, setDashboardOrders] = useState<DashboardOrderRow[]>([]);
  const [recentActivities, setRecentActivities] = useState<DashboardActivity[]>([]);
  const [dashboardTopProducts, setDashboardTopProducts] = useState<DashboardTopProduct[]>([]);
  const [salesChartPoints, setSalesChartPoints] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [deliveryZones, setDeliveryZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      setLoading(true);
      try {
        const userHeadquarterId = resolveDashboardHeadquarterId();
        const [activeOrders, products, tables, headquarters, cashMovements, zones] = await Promise.all([
          fetchActiveOrders(),
          fetchProducts(),
          userHeadquarterId ? fetchTables(userHeadquarterId) : Promise.resolve([]),
          listHeadquarters({ page: 1, pageSize: 100 }),
          userHeadquarterId ? fetchCashMovements(userHeadquarterId, { sinceLastClosing: true }) : Promise.resolve([]),
          fetchDeliveryZones(),
        ]);

        if (cancelled) return;

        const scopedOrders = userHeadquarterId && activeOrders.some((order) => getEntityHeadquarterId(order) !== null)
          ? activeOrders.filter((order) => getEntityHeadquarterId(order) === userHeadquarterId)
          : activeOrders;
        const totalCash = cashMovements
          .filter((movement) => movement.paymentMethod === 'efectivo')
          .reduce((accumulator, movement) => accumulator + movement.amount, 0);
        const salesIncome = cashMovements
          .filter(isSaleMovement)
          .reduce((accumulator, movement) => accumulator + Math.abs(movement.amount), 0);
        const preparingOrders = scopedOrders.filter((order) => getOrderStatus(order).toLowerCase().includes('prepar')).length;
        const activeTableIds = new Set(scopedOrders
          .map((order) => {
            const record = (order ?? {}) as Record<string, unknown>;
            const table = (record.Table ?? record.table) as Record<string, unknown> | undefined;
            return String(record.tableId ?? record.table_id ?? table?.id ?? '').trim();
          })
          .filter(Boolean));
        const occupiedTables = activeTableIds.size;
        const averageTicket = scopedOrders.length > 0
          ? scopedOrders.reduce((accumulator, order) => accumulator + getOrderTotal(order), 0) / scopedOrders.length
          : 0;

        setMetrics({
          activeOrders: scopedOrders.length,
          preparingOrders,
          products: products.length,
          tables: tables.length,
          occupiedTables,
          headquarters: userHeadquarterId ? 1 : headquarters.total,
          totalCash,
          salesIncome,
          averageTicket,
        });
        setDashboardOrders(buildDashboardOrderRows(scopedOrders));
        setRecentActivities(buildDashboardActivities(scopedOrders, cashMovements));
        setDashboardTopProducts(buildTopProducts(scopedOrders));
        setSalesChartPoints(buildSalesPoints(cashMovements));
        setDeliveryZones(zones);
      } catch {
        if (!cancelled) {
          setMetrics(initialMetrics);
          setDashboardOrders([]);
          setRecentActivities([]);
          setDashboardTopProducts([]);
          setSalesChartPoints([0, 0, 0, 0, 0, 0, 0]);
          setDeliveryZones([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesTarget = metrics.salesIncome;
  const activeOrdersTarget = metrics.activeOrders;
  const occupiedTablesTarget = metrics.occupiedTables;
  const totalTablesTarget = metrics.tables;
  const averageTicketTarget = metrics.averageTicket;
  const animatedSales = useAnimatedNumber(salesTarget, 1000);
  const animatedActiveOrders = useAnimatedNumber(activeOrdersTarget, 850);
  const animatedOccupiedTables = useAnimatedNumber(occupiedTablesTarget, 850);
  const animatedTotalTables = useAnimatedNumber(totalTablesTarget, 850);
  const animatedAverageTicket = useAnimatedNumber(averageTicketTarget, 950);
  const salesValue = currencyFormatter.format(Math.round(animatedSales));
  const tableValue = `${Math.round(animatedOccupiedTables)} / ${Math.round(animatedTotalTables)}`;
  const activeOrders = String(Math.round(animatedActiveOrders));
  const averageTicket = currencyFormatter.format(Math.round(animatedAverageTicket));
  const occupancyPercent = metrics.tables > 0 ? Math.round((metrics.occupiedTables / metrics.tables) * 100) : 0;
  const salesGoal = Math.max(metrics.salesIncome, 1_500_000);
  const salesGoalPercent = Math.min(100, Math.round((metrics.salesIncome / salesGoal) * 100));

  return (
    <AppLayout>
      <div className="dashboard-page">
        <section className="dashboard-metrics">
          <MetricCard title="Ventas de hoy" value={salesValue} detail={loading ? 'Actualizando...' : `${metrics.activeOrders} pedidos activos`} icon={ShoppingBag} tone="green" />
          <MetricCard title="Pedidos activos" value={activeOrders} detail={`${metrics.preparingOrders} en preparacion`} icon={ReceiptText} tone="orange" />
          <MetricCard title="Mesas ocupadas" value={tableValue} detail={`${occupancyPercent}% de ocupacion`} icon={Table2} tone="amber" />
          <MetricCard title="Ticket promedio" value={averageTicket} detail={metrics.activeOrders > 0 ? 'Sobre pedidos activos' : 'Sin pedidos activos'} icon={Ticket} tone="coral" />
        </section>

        <section className="dashboard-grid-main">
          <div className="dashboard-card orders-card">
            <div className="section-heading">
              <div className="flex min-w-0 items-center gap-4">
                <h1>Pedidos</h1>
                <div className="order-tabs">
                  <button className="active">Todos <span>{metrics.activeOrders}</span></button>
                  <button>En preparacion <span>{metrics.preparingOrders}</span></button>
                  <button>Listos <span>{dashboardOrders.filter((order) => order.status.toLowerCase().includes('listo')).length}</span></button>
                  <button>En delivery <span>{dashboardOrders.filter((order) => order.type === 'Delivery').length}</span></button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="ghost-action"><Filter className="h-4 w-4" /> Filtros</button>
                <button type="button" className="primary-action"><Plus className="h-4 w-4" /> Nuevo pedido</button>
              </div>
            </div>

            <div className="orders-table">
              <div className="orders-row orders-head">
                <span>Pedido</span>
                <span>Tipo</span>
                <span>Cliente</span>
                <span>Mesa / Direccion</span>
                <span>Estado</span>
                <span>Tiempo</span>
                <span>Total</span>
                <span />
              </div>
              {dashboardOrders.length === 0 ? (
                <div className="orders-row">
                  <span><strong>Sin pedidos</strong><small>{loading ? 'Cargando datos...' : 'No hay pedidos activos'}</small></span>
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ) : dashboardOrders.map((order) => (
                <div className="orders-row" key={order.id}>
                  <span><strong>#{order.number}</strong><small>{order.dayLabel}</small></span>
                  <span className="inline-type">{order.type === 'Delivery' ? <Bike /> : <Utensils />} {order.type}</span>
                  <span><strong>{order.customer}</strong><small>{order.contact}</small></span>
                  <span><strong>{order.location}</strong><small>{order.locationDetail}</small></span>
                  <span><StatusPill status={order.status} /></span>
                  <span>{order.time}</span>
                  <span><strong>{order.total}</strong></span>
                  <span><MoreVertical className="h-5 w-5 text-app-muted" /></span>
                </div>
              ))}
            </div>
            <button type="button" className="link-action">Ver todos los pedidos</button>
          </div>

          <aside className="dashboard-card activity-card">
            <div className="section-heading compact">
              <h2>Actividad reciente</h2>
              <button type="button" className="link-action small">Ver todo</button>
            </div>
            <div className="space-y-5">
              {recentActivities.length === 0 ? (
                <div className="text-sm text-app-muted">{loading ? 'Cargando actividad...' : 'Sin actividad reciente'}</div>
              ) : recentActivities.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div className="activity-item" key={activity.title}>
                    <span className={`activity-icon ${activity.tone}`}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0 flex-1">
                      <strong>{activity.title}</strong>
                      <small>{activity.detail}</small>
                    </span>
                    <time>{activity.time}</time>
                  </div>
                );
              })}
            </div>
          </aside>
        </section>

        <section className="dashboard-grid-bottom">
          <div className="dashboard-card sales-card">
            <div className="section-heading compact">
              <h2>Ventas del dia</h2>
              <button type="button" className="ghost-action compact">Hoy <span>⌄</span></button>
            </div>
            <div className="sales-layout">
              <SalesChart points={salesChartPoints} />
              <div className="sales-summary">
                <span>Total ventas</span>
                <strong>{salesValue}</strong>
                <small className="text-emerald-500">{metrics.activeOrders} pedidos activos</small>
                <span>Meta del dia</span>
                <strong>{currencyFormatter.format(salesGoal)}</strong>
                <div className="goal-track"><span style={{ width: `${salesGoalPercent}%` }} /></div>
                <small>{salesGoalPercent}%</small>
              </div>
            </div>
          </div>

          <div className="dashboard-card products-card">
            <div className="section-heading compact">
              <h2>Productos en pedidos activos</h2>
              <button type="button" className="link-action small">Ver todo</button>
            </div>
            <div className="space-y-3">
              {dashboardTopProducts.length === 0 ? (
                <div className="text-sm text-app-muted">{loading ? 'Cargando productos...' : 'Sin productos en pedidos activos'}</div>
              ) : dashboardTopProducts.map((product, index) => (
                <div className="product-item" key={product.name}>
                  <span className="rank">{index + 1}</span>
                  <span className={`food-thumb food-${index + 1}`} />
                  <span className="min-w-0 flex-1">
                    <strong>{product.name}</strong>
                    <small>{product.quantity} pedidos</small>
                  </span>
                  <strong>{product.total > 0 ? currencyFormatter.format(product.total) : '-'}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card map-card">
            <div className="section-heading compact">
              <h2>Zonas de delivery</h2>
              <button type="button" className="link-action small">Ver todas</button>
            </div>
            <DeliveryZonesDashboardMap zones={deliveryZones} />
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
