import { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  Check,
  ClipboardList,
  Filter,
  MapPin,
  MoreVertical,
  Plus,
  ReceiptText,
  ShoppingBag,
  Table2,
  Ticket,
  TrendingUp,
  UserRound,
  Utensils,
} from 'lucide-react';
import { AppLayout } from './AppLayout';
import { fetchProducts } from '../api/catalog';
import { fetchActiveOrders } from '../api/orders';
import { fetchTables } from '../api/tables';
import { listHeadquarters } from '../api/headquarter';
import { fetchCashMovements, type CashMovement } from '../api/cash';
import { getLoggedUser } from '../authStorage';

interface DashboardMetrics {
  activeOrders: number;
  products: number;
  tables: number;
  headquarters: number;
  totalCash: number;
  salesIncome: number;
}

const initialMetrics: DashboardMetrics = {
  activeOrders: 0,
  products: 0,
  tables: 0,
  headquarters: 0,
  totalCash: 0,
  salesIncome: 0,
};

const currencyFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
});

const DASHBOARD_HEADQUARTER_STORAGE_KEY = 'cash:selected-headquarter-id';

const salesPoints = [5, 12, 18, 32, 24, 38, 72, 86, 122, 116, 148, 132, 142, 156];
const sparkPoints = [10, 26, 18, 38, 31, 42, 36, 58, 51, 66, 59, 78];

const orders = [
  ['#1258', 'Salon', 'Maria Fernandez', 'Mesa 7', 'En preparacion', '18 min', '$ 28.500'],
  ['#1257', 'Delivery', 'Lucas Romero', 'Av. Libertador 1234', 'En delivery', '32 min', '$ 19.800'],
  ['#1256', 'Salon', 'Ana Sosa', 'Mesa 12', 'Listo', '5 min', '$ 35.200'],
  ['#1255', 'Delivery', 'Tomas Perez', 'Juramento 2563', 'En preparacion', '22 min', '$ 22.450'],
  ['#1254', 'Salon', 'Carla Mendez', 'Mesa 3', 'Listo', '2 min', '$ 16.300'],
];

const activities = [
  { icon: ShoppingBag, tone: 'orange', title: 'Nuevo pedido #1258', detail: 'Mesa 7 - Salon', time: '14:32' },
  { icon: Check, tone: 'green', title: 'Pedido #1253 marcado como listo', detail: 'Mesa 5', time: '14:25' },
  { icon: Bike, tone: 'blue', title: 'Pedido #1252 salio a delivery', detail: 'Av. Cabildo 3100', time: '14:18' },
  { icon: Utensils, tone: 'amber', title: 'Carpaccio de res agotado', detail: 'Inventario', time: '14:10' },
  { icon: UserRound, tone: 'purple', title: 'Nuevo cliente registrado', detail: 'Sofia Bianchi', time: '14:02' },
];

const topProducts = [
  ['Lomo al malbec', '92 vendidos', '$ 276.000'],
  ['Risotto de hongos', '74 vendidos', '$ 222.000'],
  ['Hamburguesa gourmet', '68 vendidos', '$ 204.000'],
  ['Tiramisu', '63 vendidos', '$ 189.000'],
];

const isSaleMovement = (movement: CashMovement) => {
  const normalizedDescription = movement.description.toLowerCase();
  return movement.legacyType === 'venta'
    || normalizedDescription.startsWith('orden ')
    || normalizedDescription.startsWith('mesa ');
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
  try {
    const parsedHeadquarterId = Number(localStorage.getItem(DASHBOARD_HEADQUARTER_STORAGE_KEY));
    return Number.isInteger(parsedHeadquarterId) && parsedHeadquarterId > 0 ? parsedHeadquarterId : null;
  } catch {
    return null;
  }
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

function SalesChart() {
  const path = useMemo(() => {
    const max = Math.max(...salesPoints);
    const min = Math.min(...salesPoints);
    return salesPoints
      .map((point, index) => {
        const x = (index / (salesPoints.length - 1)) * 520;
        const y = 170 - ((point - min) / Math.max(max - min, 1)) * 150;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, []);

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
      <Sparkline />
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const className = status === 'Listo'
    ? 'status-pill green'
    : status === 'En delivery'
      ? 'status-pill blue'
      : 'status-pill orange';
  return <span className={className}>{status}</span>;
}

export function DashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      setLoading(true);
      try {
        const userHeadquarterId = resolveDashboardHeadquarterId();
        const [activeOrders, products, tables, headquarters, cashMovements] = await Promise.all([
          fetchActiveOrders(),
          fetchProducts(),
          userHeadquarterId ? fetchTables(userHeadquarterId) : Promise.resolve([]),
          listHeadquarters({ page: 1, pageSize: 100 }),
          userHeadquarterId ? fetchCashMovements(userHeadquarterId, { sinceLastClosing: true }) : Promise.resolve([]),
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

        setMetrics({
          activeOrders: scopedOrders.length,
          products: products.length,
          tables: tables.length,
          headquarters: userHeadquarterId ? 1 : headquarters.total,
          totalCash,
          salesIncome,
        });
      } catch {
        if (!cancelled) setMetrics(initialMetrics);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesValue = metrics.salesIncome > 0 ? currencyFormatter.format(metrics.salesIncome) : '$ 1.250.000';
  const tableValue = metrics.tables > 0 ? `${Math.min(18, metrics.tables)} / ${metrics.tables}` : '18 / 32';
  const activeOrders = metrics.activeOrders > 0 ? String(metrics.activeOrders) : '24';

  return (
    <AppLayout>
      <div className="dashboard-page">
        <section className="dashboard-metrics">
          <MetricCard title="Ventas de hoy" value={salesValue} detail={loading ? 'Actualizando...' : '18% vs ayer'} icon={ShoppingBag} tone="orange" />
          <MetricCard title="Pedidos activos" value={activeOrders} detail="12 en preparacion" icon={ReceiptText} tone="orange" />
          <MetricCard title="Mesas ocupadas" value={tableValue} detail="56% de ocupacion" icon={Table2} tone="amber" />
          <MetricCard title="Ticket promedio" value="$ 34.722" detail="8% vs ayer" icon={Ticket} tone="coral" />
        </section>

        <section className="dashboard-grid-main">
          <div className="dashboard-card orders-card">
            <div className="section-heading">
              <div className="flex min-w-0 items-center gap-4">
                <h1>Pedidos</h1>
                <div className="order-tabs">
                  <button className="active">Todos <span>24</span></button>
                  <button>En preparacion <span>12</span></button>
                  <button>Listos <span>6</span></button>
                  <button>En delivery <span>4</span></button>
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
              {orders.map((order) => (
                <div className="orders-row" key={order[0]}>
                  <span><strong>{order[0]}</strong><small>Hoy, 14:32</small></span>
                  <span className="inline-type">{order[1] === 'Delivery' ? <Bike /> : <Utensils />} {order[1]}</span>
                  <span><strong>{order[2]}</strong><small>+54 9 11 2345-6789</small></span>
                  <span><strong>{order[3]}</strong><small>{order[1] === 'Delivery' ? 'Belgrano, CABA' : 'Salon principal'}</small></span>
                  <span><StatusPill status={order[4]} /></span>
                  <span>{order[5]}</span>
                  <span><strong>{order[6]}</strong></span>
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
              {activities.map((activity) => {
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
              <SalesChart />
              <div className="sales-summary">
                <span>Total ventas</span>
                <strong>{salesValue}</strong>
                <small className="text-emerald-500">18% vs ayer</small>
                <span>Meta del dia</span>
                <strong>$ 1.500.000</strong>
                <div className="goal-track"><span /></div>
                <small>83%</small>
              </div>
            </div>
          </div>

          <div className="dashboard-card products-card">
            <div className="section-heading compact">
              <h2>Productos mas vendidos</h2>
              <button type="button" className="link-action small">Ver todo</button>
            </div>
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div className="product-item" key={product[0]}>
                  <span className="rank">{index + 1}</span>
                  <span className={`food-thumb food-${index + 1}`} />
                  <span className="min-w-0 flex-1">
                    <strong>{product[0]}</strong>
                    <small>{product[1]}</small>
                  </span>
                  <strong>{product[2]}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card map-card">
            <div className="section-heading compact">
              <h2>Zonas de delivery</h2>
              <button type="button" className="link-action small">Ver todas</button>
            </div>
            <div className="delivery-map">
              <div className="map-legend">
                <span><i className="bg-emerald-500" /> Zona Norte <small>30-45 min</small></span>
                <span><i className="bg-orange-500" /> Zona Centro <small>20-35 min</small></span>
                <span><i className="bg-blue-500" /> Zona Sur <small>30-50 min</small></span>
              </div>
              <svg viewBox="0 0 520 260" aria-hidden="true">
                <path d="M20 36 L150 18 L250 56 L390 30 L500 90 L458 230 L300 236 L176 214 L54 242 Z" className="map-roads" />
                <path d="M260 42 L355 64 L324 132 L220 112 Z" className="zone north" />
                <path d="M250 122 L332 104 L386 150 L318 198 L230 180 Z" className="zone center" />
                <path d="M300 190 L430 178 L468 216 L390 250 L276 236 Z" className="zone south" />
                <text x="285" y="88">BELGRANO</text>
                <text x="327" y="155">ALMAGRO</text>
                <text x="346" y="220">FLORES</text>
                <text x="168" y="120">CABALLITO</text>
              </svg>
              <div className="map-controls">
                <button>+</button>
                <button>-</button>
                <button><MapPin className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
