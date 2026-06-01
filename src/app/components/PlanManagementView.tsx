import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, CreditCard, Layers3, PackagePlus, RefreshCw, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../shared/ui/components/sonner';
import { Button } from '../shared/ui/components/button';
import { Badge } from '../shared/ui/components/badge';
import { Progress } from '../shared/ui/components/progress';
import { getLoggedUser, updateLoggedUser, type AuthUser } from '../core/storage/authStorage';
import {
  cancelSubscription,
  listPlans,
  listStoreSubscriptions,
  listSubscriptionAddons,
  updateSubscriptionAddons,
  updateSubscriptionPlan,
  type AddonOption,
  type PlanOption,
  type StoreSubscription,
} from '../features/settings/services/settings.service';

const ACTIVE_STATUS_ID = 1;
const PAID_PAYMENT = 1;

function formatCurrency(value: number, currency = 'ARS') {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function parsePrice(plan?: PlanOption | null) {
  if (!plan || plan.isFree) return { amount: 0, currency: 'ARS' };
  const prices = plan.PlanPrices ?? [];
  const price = prices.find((item) => String(item.currency || '').toUpperCase() === 'ARS') ?? prices[0];
  return {
    amount: Number(price?.price ?? 0),
    currency: price?.currency ?? 'ARS',
  };
}

function parseAddonPrice(addon: AddonOption) {
  const prices = addon.AddonPrices ?? [];
  const price = prices.find((item) => String(item.currency || '').toUpperCase() === 'ARS') ?? prices[0];
  return {
    amount: Number(price?.price ?? 0),
    currency: price?.currency ?? 'ARS',
  };
}

function paymentLabel(subscription?: StoreSubscription | null) {
  if (!subscription) return 'Sin suscripcion';
  if (Number(subscription.payment) === PAID_PAYMENT && Number(subscription.statusId ?? subscription.Status?.id) === ACTIVE_STATUS_ID) {
    return 'Activa';
  }
  if (Number(subscription.payment) === 0) return 'Pendiente';
  if (subscription.providerStatus === 'cancelled' || subscription.cancelledAt) return 'Cancelada';
  return subscription.Status?.name ?? 'Inactiva';
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function subscriptionProgress(subscription?: StoreSubscription | null) {
  if (!subscription?.startDate || !subscription?.endDate) return 0;
  const start = new Date(subscription.startDate).getTime();
  const end = new Date(subscription.endDate).getTime();
  const now = Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

function daysRemaining(subscription?: StoreSubscription | null) {
  if (!subscription?.endDate) return null;
  const diff = new Date(subscription.endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function isUsableSubscription(subscription: StoreSubscription) {
  return Number(subscription.statusId ?? subscription.Status?.id ?? 0) === ACTIVE_STATUS_ID
    && Number(subscription.payment ?? 0) === PAID_PAYMENT;
}

export function PlanManagementView() {
  const [loggedUser, setLoggedUser] = useState<AuthUser | null>(null);
  const [subscriptions, setSubscriptions] = useState<StoreSubscription[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [addons, setAddons] = useState<AddonOption[]>([]);
  const [selectedAddonIds, setSelectedAddonIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPlanId, setIsSavingPlanId] = useState<number | null>(null);
  const [isSavingAddons, setIsSavingAddons] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const currentSubscription = useMemo(() => (
    subscriptions.find(isUsableSubscription) ?? subscriptions[0] ?? loggedUser?.subscription ?? null
  ), [loggedUser?.subscription, subscriptions]);
  const currentPlan = currentSubscription?.Plan ?? null;
  const planPrice = parsePrice(currentPlan);
  const progress = subscriptionProgress(currentSubscription);
  const remainingDays = daysRemaining(currentSubscription);
  const selectedAddons = addons.filter((addon) => selectedAddonIds.includes(addon.id));
  const addonsTotal = selectedAddons.reduce((total, addon) => total + parseAddonPrice(addon).amount, 0);

  const syncCurrentSubscription = (subscription: StoreSubscription | null) => {
    updateLoggedUser({
      subscription,
      hasSubscription: Boolean(subscription && isUsableSubscription(subscription)),
    });
    setLoggedUser((current) => current ? {
      ...current,
      subscription,
      hasSubscription: Boolean(subscription && isUsableSubscription(subscription)),
    } : current);
  };

  const loadBilling = async () => {
    setIsLoading(true);
    try {
      const [nextSubscriptions, nextPlans] = await Promise.all([
        listStoreSubscriptions(),
        listPlans(),
      ]);
      const nextCurrent = nextSubscriptions.find(isUsableSubscription) ?? nextSubscriptions[0] ?? null;
      setSubscriptions(nextSubscriptions);
      setPlans(nextPlans);
      syncCurrentSubscription(nextCurrent);

      if (nextCurrent?.id) {
        const nextAddons = await listSubscriptionAddons(nextCurrent.id);
        setAddons(nextAddons);
        setSelectedAddonIds(nextAddons.filter((addon) => addon.selected).map((addon) => addon.id));
      } else {
        setAddons([]);
        setSelectedAddonIds([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cargar la informacion del plan');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setLoggedUser(getLoggedUser() as AuthUser | null);
    void loadBilling();
  }, []);

  const handleChangePlan = async (plan: PlanOption) => {
    if (!currentSubscription?.id || plan.id === currentSubscription.planId) return;
    setIsSavingPlanId(plan.id);
    try {
      const updated = await updateSubscriptionPlan(currentSubscription.id, plan.id, plan.billingCycleId);
      setSubscriptions((current) => [updated, ...current.filter((subscription) => subscription.id !== updated.id)]);
      syncCurrentSubscription(updated);
      const nextAddons = await listSubscriptionAddons(updated.id);
      setAddons(nextAddons);
      setSelectedAddonIds(nextAddons.filter((addon) => addon.selected).map((addon) => addon.id));
      toast.success(`Plan actualizado a ${plan.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cambiar el plan');
    } finally {
      setIsSavingPlanId(null);
    }
  };

  const handleToggleAddon = (addonId: number) => {
    setSelectedAddonIds((current) => (
      current.includes(addonId)
        ? current.filter((id) => id !== addonId)
        : [...current, addonId]
    ));
  };

  const handleSaveAddons = async () => {
    if (!currentSubscription?.id) return;
    setIsSavingAddons(true);
    try {
      const result = await updateSubscriptionAddons(currentSubscription.id, selectedAddonIds);
      setSubscriptions((current) => [result.subscription, ...current.filter((subscription) => subscription.id !== result.subscription.id)]);
      syncCurrentSubscription(result.subscription);
      const nextAddons = await listSubscriptionAddons(result.subscription.id);
      setAddons(nextAddons);
      setSelectedAddonIds(nextAddons.filter((addon) => addon.selected).map((addon) => addon.id));
      toast.success('Complementos actualizados');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron guardar los complementos');
    } finally {
      setIsSavingAddons(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!currentSubscription?.id) return;
    const confirmed = window.confirm('Vas a dar de baja tu plan actual. Esta accion desactiva la suscripcion. Queres continuar?');
    if (!confirmed) return;

    setIsCancelling(true);
    try {
      const cancelled = await cancelSubscription(currentSubscription.id);
      setSubscriptions((current) => [cancelled, ...current.filter((subscription) => subscription.id !== cancelled.id)]);
      syncCurrentSubscription(cancelled);
      toast.success('Suscripcion cancelada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo cancelar la suscripcion');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <Toaster />
      <div className="space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold text-orange-500">Facturacion</p>
            <h1 className="mt-1 text-2xl font-bold tracking-normal text-app-strong sm:text-3xl">Mi plan</h1>
            <p className="mt-2 max-w-2xl text-sm text-app-muted">
              Consulta tu suscripcion, suma complementos y cambia de plan cuando tu operacion lo necesite.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadBilling()} disabled={isLoading} className="w-full md:w-auto">
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </header>

        {isLoading ? (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-app-muted">Cargando informacion de facturacion...</div>
        ) : !currentSubscription ? (
          <div className="rounded-lg border border-orange-500/40 bg-card p-6">
            <h2 className="text-xl font-semibold text-app-strong">Todavia no tenes un plan activo</h2>
            <p className="mt-2 text-sm text-app-muted">Elegí uno de los planes disponibles para habilitar la operacion de tu tienda.</p>
          </div>
        ) : (
          <>
            <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-app-strong">{currentPlan?.name ?? 'Plan actual'}</h2>
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500">{paymentLabel(currentSubscription)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-app-muted">{currentPlan?.description ?? 'Suscripcion activa para tu tienda.'}</p>
                  </div>
                  <div className="rounded-md border border-border bg-body px-4 py-3 text-right">
                    <p className="text-xs text-app-muted">Costo base</p>
                    <p className="text-2xl font-bold text-app-strong">{formatCurrency(planPrice.amount, planPrice.currency)}</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-border bg-body p-4">
                    <p className="text-xs text-app-muted">Inicio</p>
                    <p className="mt-1 font-semibold text-app-strong">{formatDate(currentSubscription.startDate)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-body p-4">
                    <p className="text-xs text-app-muted">Renovacion</p>
                    <p className="mt-1 font-semibold text-app-strong">{formatDate(currentSubscription.endDate)}</p>
                  </div>
                  <div className="rounded-md border border-border bg-body p-4">
                    <p className="text-xs text-app-muted">Proveedor</p>
                    <p className="mt-1 font-semibold capitalize text-app-strong">{currentSubscription.provider ?? 'manual'}</p>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-app-strong">Progreso del ciclo</span>
                    <span className="text-app-muted">{remainingDays === null ? '-' : `${remainingDays} dias restantes`}</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <p className="mt-2 text-xs text-app-muted">{progress}% del periodo consumido</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold text-app-strong">
                  <CreditCard className="h-5 w-5 text-orange-500" />
                  Resumen mensual
                </h2>
                <div className="mt-5 space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-app-muted">Plan</span>
                    <span className="font-semibold text-app-strong">{formatCurrency(planPrice.amount, planPrice.currency)}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-app-muted">Complementos</span>
                    <span className="font-semibold text-app-strong">{formatCurrency(addonsTotal, planPrice.currency)}</span>
                  </div>
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold text-app-strong">Total estimado</span>
                      <span className="text-xl font-bold text-app-strong">{formatCurrency(planPrice.amount + addonsTotal, planPrice.currency)}</span>
                    </div>
                    <p className="mt-2 text-xs text-app-muted">El importe final lo valida el backend y el proveedor de pago configurado.</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="mt-5 w-full border-red-500/40 bg-transparent text-red-500 hover:bg-red-500/10"
                  onClick={() => void handleCancelSubscription()}
                  disabled={isCancelling}
                >
                  <X className="mr-2 h-4 w-4" />
                  {isCancelling ? 'Cancelando...' : 'Darme de baja'}
                </Button>
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-app-strong">
                    <Layers3 className="h-5 w-5 text-orange-500" />
                    Cambiar de plan
                  </h2>
                  <p className="text-sm text-app-muted">Compara las opciones disponibles y actualiza tu suscripcion.</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {plans.map((plan) => {
                  const price = parsePrice(plan);
                  const isCurrent = plan.id === currentSubscription.planId;
                  return (
                    <article key={plan.id} className={`rounded-lg border p-4 ${isCurrent ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-body'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-app-strong">{plan.name}</h3>
                          <p className="mt-1 text-sm text-app-muted">{plan.description ?? 'Plan disponible'}</p>
                        </div>
                        {isCurrent ? <Badge>Actual</Badge> : null}
                      </div>
                      <p className="mt-4 text-2xl font-bold text-app-strong">{plan.isFree ? 'Gratis' : formatCurrency(price.amount, price.currency)}</p>
                      <ul className="mt-4 space-y-2 text-sm text-app-muted">
                        {(plan.PlanFeatures ?? []).slice(0, 4).map((feature) => (
                          <li key={feature.id ?? feature.name} className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span>{feature.name ?? feature.description ?? feature.value}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="mt-5 w-full"
                        variant={isCurrent ? 'outline' : 'default'}
                        disabled={isCurrent || isSavingPlanId === plan.id}
                        onClick={() => void handleChangePlan(plan)}
                      >
                        {isCurrent ? 'Plan actual' : isSavingPlanId === plan.id ? 'Actualizando...' : 'Cambiar a este plan'}
                      </Button>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-app-strong">
                    <PackagePlus className="h-5 w-5 text-orange-500" />
                    Complementos del plan
                  </h2>
                  <p className="text-sm text-app-muted">Activa capacidades puntuales sin cambiar de plan base.</p>
                </div>
                <Button onClick={() => void handleSaveAddons()} disabled={isSavingAddons || !currentSubscription?.id} className="w-full md:w-auto">
                  {isSavingAddons ? 'Guardando...' : 'Guardar complementos'}
                </Button>
              </div>

              {addons.length === 0 ? (
                <div className="mt-5 flex gap-3 rounded-lg border border-border bg-body p-4 text-sm text-app-muted">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-orange-500" />
                  No hay complementos disponibles para el plan actual.
                </div>
              ) : (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {addons.map((addon) => {
                    const checked = selectedAddonIds.includes(addon.id);
                    const price = parseAddonPrice(addon);
                    return (
                      <button
                        key={addon.id}
                        type="button"
                        onClick={() => handleToggleAddon(addon.id)}
                        className={`flex min-h-28 w-full items-start gap-4 rounded-lg border p-4 text-left transition ${checked ? 'border-orange-500 bg-orange-500/10' : 'border-border bg-body hover:border-orange-500/50'}`}
                      >
                        <span className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${checked ? 'border-orange-500 bg-orange-500 text-white' : 'border-border'}`}>
                          {checked ? <Check className="h-4 w-4" /> : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-app-strong">{addon.feature}</span>
                          <span className="mt-1 block text-sm text-app-muted">{addon.description ?? `${addon.key ?? 'extra'}: ${addon.value ?? '-'}`}</span>
                          <span className="mt-3 flex items-center gap-2 text-sm font-semibold text-app-strong">
                            <TrendingUp className="h-4 w-4 text-orange-500" />
                            {formatCurrency(price.amount, price.currency)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-app-strong">
                <ShieldCheck className="h-5 w-5 text-orange-500" />
                Historial reciente
              </h2>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-border text-xs uppercase text-app-muted">
                    <tr>
                      <th className="py-3 pr-4">ID</th>
                      <th className="py-3 pr-4">Plan</th>
                      <th className="py-3 pr-4">Estado</th>
                      <th className="py-3 pr-4">Pago</th>
                      <th className="py-3 pr-4">Inicio</th>
                      <th className="py-3 pr-4">Fin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscriptions.map((subscription) => (
                      <tr key={subscription.id} className="border-b border-border last:border-0">
                        <td className="py-3 pr-4 text-app-muted">#{subscription.id}</td>
                        <td className="py-3 pr-4 font-medium text-app-strong">{subscription.Plan?.name ?? `Plan #${subscription.planId}`}</td>
                        <td className="py-3 pr-4">{paymentLabel(subscription)}</td>
                        <td className="py-3 pr-4 text-app-muted">{subscription.providerStatus ?? (subscription.payment === 1 ? 'paid' : 'pending')}</td>
                        <td className="py-3 pr-4 text-app-muted">{formatDate(subscription.startDate)}</td>
                        <td className="py-3 pr-4 text-app-muted">{formatDate(subscription.endDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
