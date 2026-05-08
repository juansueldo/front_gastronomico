import { useEffect, useState } from 'react';
import { Building2, ClipboardList, LayoutGrid, Package, TrendingUp, Wallet } from 'lucide-react';
import { AppLayout } from './AppLayout';
import { fetchProducts } from '../api/catalog';
import { fetchActiveOrders } from '../api/orders';
import { fetchTables } from '../api/tables';
import { listHeadquarters } from '../api/headquarter';
import { fetchCashMovements, type CashMovement } from '../api/cash';
import { DashboardMetricCard } from './dashboard/DashboardMetricCard';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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

const isSaleMovement = (movement: CashMovement) => {
  const normalizedDescription = movement.description.toLowerCase();
  return movement.legacyType === 'venta'
    || normalizedDescription.startsWith('orden ')
    || normalizedDescription.startsWith('mesa ');
};

export function DashboardView() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(initialMetrics);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadMetrics = async () => {
      setLoading(true);

      try {
        const [orders, products, tables, headquarters, cashMovements] = await Promise.all([
          fetchActiveOrders(),
          fetchProducts(),
          fetchTables(),
          listHeadquarters({ page: 1, pageSize: 1 }),
          fetchCashMovements(undefined, { sinceLastClosing: true }),
        ]);

        if (cancelled) {
          return;
        }

        const totalCash = cashMovements
          .filter((movement) => movement.paymentMethod === 'efectivo')
          .reduce((accumulator, movement) => accumulator + movement.amount, 0);
        const salesIncome = cashMovements
          .filter(isSaleMovement)
          .reduce((accumulator, movement) => accumulator + Math.abs(movement.amount), 0);

        setMetrics({
          activeOrders: orders.length,
          products: products.length,
          tables: tables.length,
          headquarters: headquarters.total,
          totalCash,
          salesIncome,
        });
      } catch {
        if (!cancelled) {
          setMetrics(initialMetrics);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout>
      <div className="h-full bg-body overflow-y-auto">
        <div className="space-y-6 p-4 md:p-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white md:text-3xl">Dashboard</h1>
            <p className="text-sm text-gray-400">Vista rapida del estado operativo del negocio.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardMetricCard
              title="Pedidos activos"
              value={String(metrics.activeOrders)}
              description={loading ? 'Actualizando metricas...' : 'Pedidos en curso ahora mismo'}
              icon={ClipboardList}
              accentClassName="bg-gradient-to-br from-card to-orange-950/30"
            />
            <DashboardMetricCard
              title="Productos"
              value={String(metrics.products)}
              description={loading ? 'Actualizando metricas...' : 'Catalogo disponible para venta'}
              icon={Package}
              accentClassName="bg-gradient-to-br from-card to-cyan-950/30"
            />
            <DashboardMetricCard
              title="Mesas"
              value={String(metrics.tables)}
              description={loading ? 'Actualizando metricas...' : 'Mesas configuradas en el sistema'}
              icon={LayoutGrid}
              accentClassName="bg-gradient-to-br from-card to-emerald-950/30"
            />
            <DashboardMetricCard
              title="Sedes"
              value={String(metrics.headquarters)}
              description={loading ? 'Actualizando metricas...' : 'Sucursales disponibles'}
              icon={Building2}
              accentClassName="bg-gradient-to-br from-card to-amber-950/30"
            />
            <DashboardMetricCard
              title="Total en caja"
              value={currencyFormatter.format(metrics.totalCash)}
              description={loading ? 'Actualizando metricas...' : 'Efectivo acumulado del turno actual'}
              icon={Wallet}
              accentClassName="bg-gradient-to-br from-card to-lime-950/30"
            />
            <DashboardMetricCard
              title="Ingresos por ventas"
              value={currencyFormatter.format(metrics.salesIncome)}
              description={loading ? 'Actualizando metricas...' : 'Ventas cobradas desde el ultimo cierre'}
              icon={TrendingUp}
              accentClassName="bg-gradient-to-br from-card to-sky-950/30"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <Card className="card">
              <CardHeader>
                <CardTitle className="text-white">Resumen operativo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="card bg-body p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Ritmo</p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {metrics.activeOrders > 0 ? 'Operacion activa' : 'Operacion tranquila'}
                  </p>
                </div>
                <div className="card bg-body p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Capacidad</p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {metrics.tables > 0 ? `${metrics.tables} mesas registradas` : 'Sin mesas configuradas'}
                  </p>
                </div>
                <div className="card bg-body p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Cobertura</p>
                  <p className="mt-2 text-lg font-medium text-white">
                    {metrics.headquarters > 0 ? `${metrics.headquarters} sedes activas` : 'Sin sedes cargadas'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-700/60">
              <CardHeader>
                <CardTitle className="text-white">Siguiente paso sugerido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-300">
                <p>
                  La base ya quedo preparada para migrar listados a paginacion server-side sin rehacer la UI.
                </p>
                <p>
                  El mejor siguiente candidato para mover a esta misma estrategia es `CategoriesView` o `ProductsView`.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
