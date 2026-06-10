import { ChangeEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  Bell,
  Bike,
  Boxes,
  BriefcaseBusiness,
  ChefHat,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  ClipboardList,
  CreditCard,
  Home,
  LayoutGrid,
  LogOut,
  MessageSquareText,
  Moon,
  MoreHorizontal,
  Search,
  Settings,
  MonitorCog,
  ShoppingBag,
  SunMedium,
  Tags,
  Truck,
  Plus,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '../shared/ui/components/sonner';
import { Avatar, AvatarFallback, AvatarImage } from '../shared/ui/components/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../shared/ui/components/dropdown-menu';
import { clearAuthSession, getLoggedUser, updateLoggedUser, AUTH_CHANGED_EVENT, type AuthUser } from '../core/storage/authStorage';
import { getThemePreference, setThemePreference, THEME_CHANGED_EVENT, type ThemePreference } from '../theme';
import {
  createMercadoPagoPreapproval,
  createSubscription,
  listStoreSubscriptions,
  listPlans,
  updateStoreProfile,
  updateStoreProfileImage,
  type PlanOption,
} from '../features/settings/services/settings.service';
import { logout as logoutRequest } from '../features/auth/services/auth.service';
import { updateCurrentUserPresence, type UserPresenceStatus } from '../features/users';
import {
  listNotifications,
  markNotificationAsRead,
  type NotificationItem,
} from '../features/notifications';
import {
  fetchActiveOrders as fetchNavbarActiveOrders,
} from '../features/orders/services/orders.service';
import {
  fetchProductCategories,
  fetchProducts,
  type ProductCategory,
  type ProductItem,
} from '../features/products';
import { getJsonStorageItem, setJsonStorageItem } from '../shared/storage';
import { formatOrderNumber } from '../shared/utils/orderNumbers';
import { CreateOrderDialog } from './orders/CreateOrderDialog';

const NOTIFICATIONS_CHANGED_EVENT = 'app:notifications-changed';

interface AppLayoutProps {
  children: ReactNode;
}

type NavItem = {
  path: string;
  icon: typeof Home;
  label: string;
  allowedRoles: string[];
};

const navCategories: Array<{ category: string; items: NavItem[] }> = [
  {
    category: 'Operaciones',
    items: [
      { path: '/', icon: Home, label: 'Dashboard', allowedRoles: ['admin', 'manager', 'user', 'supervisor', 'agent'] },
      { path: '/orders', icon: ClipboardList, label: 'Pedidos', allowedRoles: ['admin', 'manager', 'user', 'supervisor', 'agent'] },
      { path: '/customers', icon: CircleUserRound, label: 'Clientes', allowedRoles: ['admin', 'manager', 'user', 'supervisor', 'agent'] },
      { path: '/kitchen', icon: ChefHat, label: 'Cocina', allowedRoles: ['admin', 'manager', 'supervisor'] },
      { path: '/waiters', icon: UserRoundCheck, label: 'Mozos', allowedRoles: ['admin', 'supervisor'] },
      { path: '/tables', icon: LayoutGrid, label: 'Mesas', allowedRoles: ['admin', 'manager', 'supervisor'] },
      { path: '/delivery-logistics', icon: Bike, label: 'Delivery', allowedRoles: ['admin', 'manager', 'supervisor'] },
      { path: '/cash-register', icon: Wallet, label: 'Caja', allowedRoles: ['admin'] },
      { path: '/headquarters', icon: BriefcaseBusiness, label: 'Sedes', allowedRoles: ['admin', 'manager', 'supervisor'] },
      { path: '/delivery-zones', icon: Truck, label: 'Zonas de Entrega', allowedRoles: ['admin', 'manager', 'supervisor'] },
    ],
  },
  {
    category: 'Catalogo',
    items: [
      { path: '/categories', icon: Tags, label: 'Categorias', allowedRoles: ['admin', 'manager', 'supervisor'] },
      { path: '/products', icon: ShoppingBag, label: 'Productos', allowedRoles: ['admin', 'manager', 'supervisor'] },
      { path: '/inventory', icon: Boxes, label: 'Inventario', allowedRoles: ['admin', 'manager', 'supervisor'] },
    ],
  },
  {
    category: 'Herramientas',
    items: [
      { path: '/chats', icon: MessageSquareText, label: 'Mensajes', allowedRoles: ['admin', 'manager', 'user', 'supervisor', 'agent'] },
      { path: '/connections', icon: MonitorCog, label: 'Conexiones', allowedRoles: ['admin', 'manager'] },
      { path: '/notifications', icon: Bell, label: 'Notificaciones', allowedRoles: ['admin', 'manager', 'user', 'supervisor', 'agent'] },
    ],
  },
  {
    category: 'Configuracion',
    items: [
      { path: '/billing', icon: CreditCard, label: 'Mi plan', allowedRoles: ['admin'] },
      { path: '/settings', icon: Settings, label: 'Configuracion', allowedRoles: ['admin', 'manager', 'user', 'supervisor', 'agent'] },
      { path: '/users', icon: Users, label: 'Usuarios', allowedRoles: ['admin'] },
    ],
  },
];

const themeLabels: Record<ThemePreference, string> = {
  dark: 'Oscuro',
  light: 'Claro',
  auto: 'Sistema',
};

const statusLabels: Record<NonNullable<AuthUser['status']>, string> = {
  active: 'Activo',
  away: 'Ausente',
  busy: 'Ocupado',
  offline: 'Desconectado',
};

const statusIndicatorClasses: Record<NonNullable<AuthUser['status']>, string> = {
  active: 'bg-emerald-500',
  away: 'bg-amber-400',
  busy: 'bg-rose-500',
  offline: 'bg-slate-400',
};

const onlyDigits = (value: string) => value.replace(/\D/g, '');

const getOrderSearchId = (order: any) => String(order?.id ?? order?.order_number ?? '').trim();
const getOrderDisplayId = (order: any) => formatOrderNumber(order, String(order?.id ?? order?.order_number ?? '').trim());
const getOrderCustomerName = (order: any) => String(
  order?.customerName
  ?? order?.Customer?.name
  ?? order?.customer?.name
  ?? order?.clientName
  ?? 'Cliente',
).trim();
const getOrderCustomerPhone = (order: any) => String(
  order?.customerPhone
  ?? order?.Customer?.phone
  ?? order?.customer?.phone
  ?? order?.phone
  ?? '',
).trim();
const getOrderStatusText = (order: any) => String(order?.status ?? order?.Status?.name ?? 'Activo').trim();
const getOrderTotalText = (order: any) => {
  const rawTotal = order?.total_amount ?? order?.total;
  const parsedTotal = Number(rawTotal);
  if (!Number.isFinite(parsedTotal)) {
    return String(rawTotal ?? '');
  }

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(parsedTotal);
};

const matchesOrderSearch = (order: any, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  const digitQuery = onlyDigits(query);
  const textHaystack = [
    getOrderSearchId(order),
    getOrderDisplayId(order),
    getOrderCustomerName(order),
    order?.detail,
  ].map((value) => String(value ?? '').toLowerCase()).join(' ');
  const phoneHaystack = onlyDigits(getOrderCustomerPhone(order));

  return textHaystack.includes(normalizedQuery)
    || (digitQuery.length > 0 && phoneHaystack.includes(digitQuery));
};

function getInitials(user: AuthUser | null) {
  const name = user ? `${user.firstname ?? ''} ${user.lastname ?? ''}`.trim() : '';
  if (!name) return 'SN';
  return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
}

const getStringValue = (source: unknown, keys: string[]) => {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const record = source as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const getNestedStore = (user: AuthUser | null) => {
  const candidate = user as Record<string, unknown> | null;
  const store = candidate?.store ?? candidate?.Store ?? candidate?.restaurant ?? candidate?.tenant;
  return store && typeof store === 'object' ? store : undefined;
};

const getStoreDisplay = (user: AuthUser | null) => {
  const store = getNestedStore(user);
  const storeName =
    getStringValue(store, ['name', 'storename', 'storeName', 'businessName', 'displayName'])
    ?? getStringValue(user, ['storeName', 'storename', 'businessName', 'store_name'])
    ?? 'Mi tienda';
  const profileImageUrl =
    getStringValue(store, ['profile_image_url', 'profileImageUrl', 'profileImage', 'logoUrl', 'logo_url'])
    ?? getStringValue(user, ['storeProfileImageUrl', 'store_profile_image_url', 'storeLogoUrl', 'store_logo_url']);

  return { storeName, profileImageUrl };
};

const getUserAvatarUrl = (user: AuthUser | null) => (
  getStringValue(user, ['profile_image_url', 'profileImageUrl', 'avatarUrl', 'avatar_url', 'userImageUrl', 'user_image_url'])
);

const getStoreSlug = (user: AuthUser | null) => {
  const store = getNestedStore(user);
  return getStringValue(store, ['slug'])
    ?? getStringValue(user, ['slug', 'storeSlug', 'store_slug'])
    ?? '';
};

const isStoreProfileConfigured = (user: AuthUser | null) => {
  const { storeName, profileImageUrl } = getStoreDisplay(user);
  const slug = getStoreSlug(user);

  return Boolean(storeName && storeName !== 'Mi tienda' && slug && profileImageUrl);
};

const isPaidSubscription = (subscription: AuthUser['subscription'] | null | undefined) => (
  Boolean(subscription)
  && Number(subscription?.payment ?? 0) === 1
  && Number(subscription?.statusId ?? subscription?.Status?.id ?? 0) === 1
);

const isPaidPlan = (plan: PlanOption) => {
  if (plan.isFree) return false;
  const price = plan.PlanPrices?.[0]?.price;
  return Number(price ?? 0) > 0 || !plan.isFree;
};

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [loggedUser, setLoggedUser] = useState<AuthUser | null>(null);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getThemePreference());
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(false);
  const [isCreatingSubscription, setIsCreatingSubscription] = useState(false);
  const [hasCheckedSubscription, setHasCheckedSubscription] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'plans' | 'store' | null>(null);
  const [storeNameInput, setStoreNameInput] = useState('');
  const [storeSlugInput, setStoreSlugInput] = useState('');
  const [storeImageBase64, setStoreImageBase64] = useState<string | null>(null);
  const [isSavingStoreProfile, setIsSavingStoreProfile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => getJsonStorageItem('isSidebarCollapsed', false));
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => getJsonStorageItem('collapsedCategories', {}));
  const [navbarSearchValue, setNavbarSearchValue] = useState('');
  const [isNavbarSearchFocused, setIsNavbarSearchFocused] = useState(false);
  const [navbarOrderResults, setNavbarOrderResults] = useState<any[]>([]);
  const [isLoadingNavbarOrders, setIsLoadingNavbarOrders] = useState(false);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [isCreateOrderDialogMinimized, setIsCreateOrderDialogMinimized] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<ProductItem[]>([]);
  const [availableCategories, setAvailableCategories] = useState<ProductCategory[]>([]);
  const [hasLoadedOrderCatalog, setHasLoadedOrderCatalog] = useState(false);
  const navbarSearchFieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncUser = () => setLoggedUser(getLoggedUser() as AuthUser | null);
    const syncTheme = (event: Event) => {
      const customEvent = event as CustomEvent<ThemePreference>;
      setThemePreferenceState(customEvent.detail ?? getThemePreference());
    };

    syncUser();
    setThemePreferenceState(getThemePreference());
    window.addEventListener(AUTH_CHANGED_EVENT, syncUser);
    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncUser);
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
    };
  }, []);

  const userRole = loggedUser?.role ?? 'admin';
  const { storeName, profileImageUrl } = getStoreDisplay(loggedUser);
  const filteredNavCategories = useMemo(
    () => navCategories
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => item.allowedRoles.includes(userRole)),
      }))
      .filter((category) => category.items.length > 0),
    [userRole],
  );
  const allNavItems = filteredNavCategories.flatMap((category) => category.items);
  const mobilePrimaryItems = allNavItems.filter((item) => ['/', '/orders', '/tables', '/cash-register'].includes(item.path));
  const mobileMoreItems = allNavItems.filter((item) => !mobilePrimaryItems.includes(item));

  const isActive = (path: string) => (path === '/' ? location.pathname === '/' : location.pathname === path);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((previous) => {
      const next = !previous;
      setJsonStorageItem('isSidebarCollapsed', next);
      return next;
    });
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories((previous) => {
      const next = { ...previous, [category]: !previous[category] };
      setJsonStorageItem('collapsedCategories', next);
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await logoutRequest();
    } catch {
      // Si el token ya expiró o el backend no responde, igual cerramos la sesión local.
    }
    clearAuthSession();
    toast.success('Sesion cerrada correctamente');
    navigate('/login');
  };

  const handleThemeChange = (nextTheme: ThemePreference) => {
    setThemePreferenceState(nextTheme);
    setThemePreference(nextTheme);
    toast.success(`Tema ${themeLabels[nextTheme].toLowerCase()}`);
  };

  const handleStatusChange = async (nextStatus: UserPresenceStatus) => {
    const previousStatus = loggedUser?.status ?? 'active';
    updateLoggedUser({ status: nextStatus, presenceStatus: nextStatus });
    setLoggedUser((prev) => (prev ? { ...prev, status: nextStatus, presenceStatus: nextStatus } : prev));

    try {
      const updatedUser = await updateCurrentUserPresence(nextStatus);
      const persistedStatus = (updatedUser.presenceStatus ?? nextStatus) as AuthUser['status'];
      updateLoggedUser({
        status: persistedStatus,
        presenceStatus: persistedStatus,
        lastPresenceAt: updatedUser.lastPresenceAt,
      });
      setLoggedUser((prev) => (prev ? {
        ...prev,
        status: persistedStatus,
        presenceStatus: persistedStatus,
        lastPresenceAt: updatedUser.lastPresenceAt,
      } : prev));
      toast.success(`Estado ${statusLabels[nextStatus].toLowerCase()}`);
    } catch (error) {
      updateLoggedUser({ status: previousStatus, presenceStatus: previousStatus });
      setLoggedUser((prev) => (prev ? { ...prev, status: previousStatus, presenceStatus: previousStatus } : prev));
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el estado');
    }
  };

  useEffect(() => {
    if (!loggedUser) return;

    if (loggedUser.hasSubscription === false || loggedUser.subscription === null) {
      setOnboardingStep('plans');
      setHasCheckedSubscription(true);
      return;
    }

    if ((loggedUser.hasSubscription === true || loggedUser.subscription) && isPaidSubscription(loggedUser.subscription)) {
      if (!isStoreProfileConfigured(loggedUser)) {
        setOnboardingStep('store');
      }
      setHasCheckedSubscription(true);
      return;
    }

    if (loggedUser.subscription && !isPaidSubscription(loggedUser.subscription)) {
      setOnboardingStep('plans');
      setHasCheckedSubscription(true);
      return;
    }

    if (hasCheckedSubscription) return;

    const checkSubscription = async () => {
      try {
        const subscriptions = await listStoreSubscriptions();
        const activeSubscription = subscriptions.find((subscription) => (
          Number(subscription.statusId ?? subscription.Status?.id ?? 0) === 1
          && Number(subscription.payment ?? 0) === 1
        )) ?? null;

        updateLoggedUser({
          subscription: activeSubscription,
          hasSubscription: Boolean(activeSubscription),
        });
        setLoggedUser((prev) => (
          prev
            ? { ...prev, subscription: activeSubscription, hasSubscription: Boolean(activeSubscription) }
            : prev
        ));

        if (!activeSubscription) {
          setOnboardingStep('plans');
          return;
        }

        const nextUser = {
          ...loggedUser,
          subscription: activeSubscription,
          hasSubscription: true,
        };

        if (!isStoreProfileConfigured(nextUser)) {
          setOnboardingStep('store');
        }
      } catch {
        setOnboardingStep('plans');
      } finally {
        setHasCheckedSubscription(true);
      }
    };

    void checkSubscription();
  }, [hasCheckedSubscription, loggedUser]);

  useEffect(() => {
    if (onboardingStep !== 'plans' || plans.length > 0 || isLoadingPlans) return;

    const loadPlans = async () => {
      setIsLoadingPlans(true);
      try {
        setPlans(await listPlans());
      } catch {
        toast.error('No se pudieron cargar los planes');
      } finally {
        setIsLoadingPlans(false);
      }
    };

    void loadPlans();
  }, [isLoadingPlans, onboardingStep, plans.length]);

  useEffect(() => {
    if (onboardingStep !== 'store') return;

    const store = getNestedStore(loggedUser);
    const currentSlug = getStoreSlug(loggedUser);
    setStoreNameInput(storeName === 'Mi tienda' ? '' : storeName);
    setStoreSlugInput(currentSlug);
  }, [loggedUser, onboardingStep, storeName]);

  const loadNotificationDropdown = useCallback(async (showError = true) => {
    setIsLoadingNotifications(true);
    try {
      setNotifications(await listNotifications(100, 0));
    } catch {
      if (showError) {
        toast.error('No se pudieron cargar las notificaciones');
      }
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    if (!loggedUser) {
      setNotifications([]);
      return;
    }

    void loadNotificationDropdown(false);
  }, [loadNotificationDropdown, loggedUser?.id, loggedUser?.storeId, loggedUser?.headquarterId]);

  useEffect(() => {
    const handleNotificationsChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; all?: boolean }>).detail;
      if (detail?.all) {
        setNotifications([]);
        return;
      }

      if (detail?.id) {
        setNotifications((prev) => prev.filter((item) => item.id !== detail.id));
        return;
      }

      void loadNotificationDropdown(false);
    };

    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    return () => {
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, handleNotificationsChanged);
    };
  }, [loadNotificationDropdown]);

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    const previous = notifications;
    setNotifications((prev) => prev.filter((item) => item.id !== notificationId));

    try {
      if (!notificationId.startsWith('local-')) {
        await markNotificationAsRead(notificationId);
      }
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT, { detail: { id: notificationId } }));
    } catch {
      setNotifications(previous);
      toast.error('No se pudo marcar la notificación como leída');
    }
  };

  const handleCreateSubscription = async (plan: PlanOption) => {
    if (isCreatingSubscription) return;

    setIsCreatingSubscription(true);
    try {
      if (isPaidPlan(plan)) {
        const { subscription, initPoint } = await createMercadoPagoPreapproval(plan.id, plan.billingCycleId);
        updateLoggedUser({ subscription, hasSubscription: false });
        setLoggedUser((prev) => (prev ? { ...prev, subscription, hasSubscription: false } : prev));
        if (initPoint) {
          window.location.href = initPoint;
          return;
        }
        toast.info('La suscripción quedó pendiente de confirmación de pago');
        return;
      }

      const subscription = await createSubscription(plan.id, plan.billingCycleId);
      updateLoggedUser({ subscription, hasSubscription: isPaidSubscription(subscription) });
      setLoggedUser((prev) => (prev ? { ...prev, subscription, hasSubscription: isPaidSubscription(subscription) } : prev));
      toast.success('Suscripcion creada correctamente');
      setOnboardingStep('store');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear la suscripcion');
    } finally {
      setIsCreatingSubscription(false);
    }
  };

  const handleStoreImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setStoreImageBase64(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveStoreProfile = async () => {
    const nextName = storeNameInput.trim();
    const nextSlug = storeSlugInput.trim().toLowerCase();

    if (!nextName || !nextSlug) {
      toast.error('Completa el nombre y slug de la tienda');
      return;
    }

    setIsSavingStoreProfile(true);
    try {
      let uploadedProfileImageUrl: string | undefined;
      if (storeImageBase64) {
        const imageResponse = await updateStoreProfileImage({ image: storeImageBase64 });
        uploadedProfileImageUrl = imageResponse.profileImageUrl ?? imageResponse.profile_image_url ?? undefined;
      }

      const updatedStore = await updateStoreProfile({
        name: nextName,
        slug: nextSlug,
        ...(uploadedProfileImageUrl ? { profile_image_url: uploadedProfileImageUrl } : {}),
      });
      const nextStore = {
        ...(loggedUser?.store && typeof loggedUser.store === 'object' ? loggedUser.store : {}),
        ...updatedStore,
      };
      updateLoggedUser({ store: nextStore });
      setLoggedUser((prev) => (prev ? { ...prev, store: nextStore } : prev));
      toast.success('Tienda configurada correctamente');
      setOnboardingStep(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo configurar la tienda');
    } finally {
      setIsSavingStoreProfile(false);
    }
  };

  const unreadCount = notifications.filter((item) => !item.read).length;
  const notificationCount = unreadCount || notifications.length;
  const userAvatarUrl = getUserAvatarUrl(loggedUser);
  const currentUserStatus = (loggedUser?.status ?? loggedUser?.presenceStatus ?? 'active') as NonNullable<AuthUser['status']>;
  const trimmedNavbarSearch = navbarSearchValue.trim();
  const shouldShowNavbarSearchResults = isNavbarSearchFocused && trimmedNavbarSearch.length >= 2;

  useEffect(() => {
    if (trimmedNavbarSearch.length < 2) {
      setNavbarOrderResults([]);
      setIsLoadingNavbarOrders(false);
      return;
    }

    let cancelled = false;
    setIsLoadingNavbarOrders(true);
    const timeoutId = window.setTimeout(() => {
      void fetchNavbarActiveOrders()
        .then((orders) => {
          if (cancelled) return;
          setNavbarOrderResults(
            orders
              .filter((order) => matchesOrderSearch(order, trimmedNavbarSearch))
              .slice(0, 8),
          );
        })
        .catch(() => {
          if (!cancelled) {
            setNavbarOrderResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingNavbarOrders(false);
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [trimmedNavbarSearch]);

  const loadOrderCatalog = useCallback(async () => {
    if (hasLoadedOrderCatalog) return;

    const [productsResult, categoriesResult] = await Promise.allSettled([
      fetchProducts(),
      fetchProductCategories(),
    ]);

    if (productsResult.status === 'fulfilled') {
      const products = productsResult.value as any;
      setAvailableProducts(Array.isArray(products) ? products : products?.rows ?? products?.products ?? products?.data ?? []);
    } else {
      toast.error('No se pudieron cargar los productos');
    }

    if (categoriesResult.status === 'fulfilled') {
      const categories = categoriesResult.value as any;
      setAvailableCategories(Array.isArray(categories) ? categories : categories?.rows ?? categories?.categories ?? categories?.data ?? []);
    } else {
      toast.error('No se pudieron cargar las categorías');
    }

    setHasLoadedOrderCatalog(true);
  }, [hasLoadedOrderCatalog]);

  const openCreateOrderDialog = () => {
    setIsCreateOrderDialogOpen(true);
    setIsCreateOrderDialogMinimized(false);
    void loadOrderCatalog();
  };

  const closeCreateOrderDialog = () => {
    setIsCreateOrderDialogOpen(false);
    setIsCreateOrderDialogMinimized(false);
  };

  const handleNavbarOrderCreated = () => {
    closeCreateOrderDialog();
    window.dispatchEvent(new CustomEvent('app:orders-changed'));
    if (location.pathname !== '/orders') {
      navigate('/orders');
    }
  };

  const handleSelectNavbarOrder = (order: any) => {
    const orderId = getOrderSearchId(order);
    if (!orderId) return;

    setNavbarSearchValue('');
    if (navbarSearchFieldRef.current) {
      navbarSearchFieldRef.current.textContent = '';
    }
    setNavbarOrderResults([]);
    setIsNavbarSearchFocused(false);
    navigate(`/orders?orderId=${encodeURIComponent(orderId)}`);
  };

  const clearNavbarSearch = () => {
    setNavbarSearchValue('');
    setNavbarOrderResults([]);
    if (navbarSearchFieldRef.current) {
      navbarSearchFieldRef.current.textContent = '';
      navbarSearchFieldRef.current.blur();
    }
  };

  const renderUserMenu = (align: 'start' | 'end' = 'start', triggerClassName = 'legacy-user-trigger') => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={triggerClassName}>
          <div className="relative flex-none">
            <Avatar className="h-11 w-11">
              {userAvatarUrl ? <AvatarImage src={userAvatarUrl} alt="Foto de perfil" /> : null}
              <AvatarFallback className="bg-orange-500 text-white">{getInitials(loggedUser)}</AvatarFallback>
            </Avatar>
            <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[var(--app-sidebar)] ${statusIndicatorClasses[currentUserStatus] ?? statusIndicatorClasses.active}`} />
          </div>
          {!isSidebarCollapsed && (
            <span className="hidden min-w-0 flex-1 text-left lg:block">
              <span className="block truncate text-sm font-semibold text-app-strong">
                {loggedUser ? `${loggedUser.firstname} ${loggedUser.lastname}` : 'Juan Garcia'}
              </span>
              <span className="block truncate text-xs text-app-muted">{loggedUser?.role ?? 'Administrador'}</span>
            </span>
          )}
          {!isSidebarCollapsed && <ChevronDown className="hidden h-4 w-4 text-app-muted lg:block" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="app-menu-surface w-64">
        <DropdownMenuLabel className="flex items-center gap-2">
          <CircleUserRound className="h-4 w-4 text-app-muted" />
          {loggedUser ? `${loggedUser.firstname} ${loggedUser.lastname}` : 'Juan Garcia'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={themePreference} onValueChange={(value) => handleThemeChange(value as ThemePreference)}>
          <DropdownMenuRadioItem value="dark"><Moon className="mr-2 h-4 w-4" /> Oscuro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light"><SunMedium className="mr-2 h-4 w-4" /> Claro</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="auto"><MonitorCog className="mr-2 h-4 w-4" /> Sistema</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Estado</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={currentUserStatus}
          onValueChange={(value) => void handleStatusChange(value as UserPresenceStatus)}
        >
          <DropdownMenuRadioItem value="active">Activo</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="away">Ausente</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="busy">Ocupado</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="offline">Desconectado</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void handleLogout()}><LogOut className="mr-2 h-4 w-4" /> Cerrar sesion</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const SidebarContent = (
    <>
      <div className="legacy-sidebar-profile">
        {renderUserMenu()}
      </div>

      <nav className="legacy-sidebar-nav">
        {filteredNavCategories.map((category) => (
          <div key={category.category}>
            {!isSidebarCollapsed && (
              <button type="button" className="legacy-category-button" onClick={() => toggleCategory(category.category)}>
                {collapsedCategories[category.category] ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                <span>{category.category}</span>
              </button>
            )}

            {(isSidebarCollapsed || !collapsedCategories[category.category]) && (
              <div className="space-y-1">
                {category.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      title={isSidebarCollapsed ? item.label : undefined}
                      onClick={() => {
                        navigate(item.path);
                        setIsMobileMoreOpen(false);
                      }}
                      className={`legacy-nav-item ${isSidebarCollapsed ? 'collapsed' : ''} ${active ? 'active' : ''}`}
                    >
                      <Icon className="h-5 w-5" />
                      {!isSidebarCollapsed && <span className="hidden lg:block">{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </nav>
    </>
  );

  return (
    <div className="app-shell">
      <Toaster />

      <aside className={`legacy-sidebar hidden md:flex ${isSidebarCollapsed ? 'collapsed' : ''}`}>
        <button type="button" className="legacy-collapse-button" onClick={toggleSidebar} aria-label="Alternar sidebar">
          {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {SidebarContent}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="app-topbar">
          <div className="mobile-user-menu md:hidden">
            {renderUserMenu('start', 'legacy-user-trigger mobile-user-trigger')}
          </div>

          <div className="app-search-wrap">
            <div className="app-search">
              <Search className="h-5 w-5 text-app-muted" />
              <div
                ref={navbarSearchFieldRef}
                role="textbox"
                aria-label="Buscar pedidos activos"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Buscar pedidos, clientes..."
                className="app-search-field"
                onInput={(event) => setNavbarSearchValue(event.currentTarget.textContent ?? '')}
                onFocus={() => setIsNavbarSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setIsNavbarSearchFocused(false), 150)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const firstOrder = navbarOrderResults[0];
                    if (firstOrder) handleSelectNavbarOrder(firstOrder);
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    clearNavbarSearch();
                  }
                }}
                style={{
                  outline: 'none',
                  border: 'none',
                  boxShadow: 'none',
                }}
              />
            </div>
            {shouldShowNavbarSearchResults ? (
              <div className="app-search-results" onMouseDown={(event) => event.preventDefault()}>
                {isLoadingNavbarOrders ? (
                  <div className="px-3 py-3 text-sm text-app-muted">Buscando pedidos activos...</div>
                ) : navbarOrderResults.length === 0 ? (
                  <div className="px-3 py-3 text-sm text-app-muted">No hay pedidos activos para esa búsqueda.</div>
                ) : (
                  navbarOrderResults.map((order) => {
                    const orderId = getOrderSearchId(order);
                    const displayId = getOrderDisplayId(order) || orderId;
                    const customerPhone = getOrderCustomerPhone(order);
                    return (
                      <button
                        key={orderId}
                        type="button"
                        className="app-search-result-item"
                        onClick={() => handleSelectNavbarOrder(order)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-app-strong">
                            Pedido {displayId} - {getOrderCustomerName(order)}
                          </span>
                          <span className="block truncate text-xs text-app-muted">
                            {customerPhone ? `${customerPhone} - ` : ''}{getOrderStatusText(order)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-app-strong">{getOrderTotalText(order)}</span>
                      </button>
                    );
                  })
                )}
              </div>
            ) : null}
          </div>

          <button type="button" className="app-order-button" onClick={openCreateOrderDialog}>
            <Plus className="h-4 w-4" />
            <span>Pedido</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="app-store-switcher">
                <span
                  className="app-store-photo"
                  style={profileImageUrl ? { backgroundImage: `url("${profileImageUrl}")` } : undefined}
                />
                <span className="hidden min-w-0 text-left sm:block">
                  <span className="block truncate text-sm font-semibold text-app-strong">{storeName}</span>
                  <span className="block truncate text-xs text-app-muted">Restaurante</span>
                </span>
                <ChevronDown className="h-4 w-4 text-app-muted" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="app-menu-surface w-56">
              <DropdownMenuLabel>{storeName}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => navigate('/settings')}>Configuracion</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/headquarters')}>Sedes</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu onOpenChange={(open) => {
            if (open) void loadNotificationDropdown();
          }}>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Notificaciones" className="app-icon-button relative">
                <Bell className="h-5 w-5" />
                {notificationCount > 0 ? (
                  <span className="absolute right-1.5 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[11px] font-bold text-white">
                    {notificationCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="app-menu-surface notification-dropdown">
              <div className="flex items-center justify-between gap-3 px-3 py-2">
                <DropdownMenuLabel className="p-0">Notificaciones</DropdownMenuLabel>
                <button type="button" className="text-xs font-semibold text-orange-500" onClick={() => navigate('/notifications')}>
                  Ver todas
                </button>
              </div>
              <DropdownMenuSeparator />
              {isLoadingNotifications ? (
                <div className="px-3 py-4 text-sm text-app-muted">Cargando...</div>
              ) : notifications.length === 0 ? (
                <div className="px-3 py-4 text-sm text-app-muted">No hay notificaciones.</div>
              ) : (
                <div className="max-h-96 overflow-y-auto py-1">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="notification-dropdown-item"
                    >
                      <span className={notification.read ? 'read-dot' : 'unread-dot'} />
                      <span className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-semibold text-app-strong">{notification.title}</span>
                        <span className="block truncate text-xs text-app-muted">{notification.description || 'Sin detalle'}</span>
                      </span>
                      <button
                        type="button"
                        aria-label="Marcar como leída"
                        title="Marcar como leída"
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-app-muted transition hover:bg-app-soft hover:text-orange-500"
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleMarkNotificationAsRead(notification.id);
                        }}
                      >
                        <CheckCheck className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" aria-label="Ayuda" className="app-icon-button">
            <CircleHelp className="h-5 w-5" />
          </button>
        </header>

        <main className="app-main min-h-0 flex-1">{children}</main>

        {isCreateOrderDialogOpen && isCreateOrderDialogMinimized ? (
          <button
            type="button"
            className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] px-4 py-3 text-sm font-semibold text-app-strong shadow-[0_18px_44px_rgb(0_0_0_/_26%)] transition hover:bg-[var(--app-soft)]"
            onClick={() => setIsCreateOrderDialogMinimized(false)}
          >
            <ClipboardList className="h-4 w-4 text-orange-500" />
            Pedido en curso
          </button>
        ) : null}

        {isMobileMoreOpen ? (
          <div className="mobile-more-backdrop md:hidden" onClick={() => setIsMobileMoreOpen(false)}>
            <section className="mobile-more-sheet" onClick={(event) => event.stopPropagation()}>
              <span className="mobile-more-handle" />
              <h2>Accesos rápidos</h2>
              <div className="mobile-more-list">
                {mobileMoreItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={item.path}
                      type="button"
                      className={active ? 'active' : ''}
                      onClick={() => {
                        navigate(item.path);
                        setIsMobileMoreOpen(false);
                      }}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : null}

        <div className="mobile-bottom-nav md:hidden">
          {mobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => {
                  navigate(item.path);
                  setIsMobileMoreOpen(false);
                }}
                className={active ? 'active' : ''}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={isMobileMoreOpen || mobileMoreItems.some((item) => isActive(item.path)) ? 'active' : ''}
            onClick={() => setIsMobileMoreOpen((current) => !current)}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>Mas</span>
          </button>
        </div>
      </div>

      {onboardingStep && (
        <div className="onboarding-backdrop">
          <section className="onboarding-modal">
            {onboardingStep === 'plans' ? (
              <>
                <div className="space-y-1">
                  <h2>Elegí un plan para continuar</h2>
                  <p>Tu tienda todavía no tiene una suscripción activa.</p>
                </div>
                <div className="plan-grid">
                  {isLoadingPlans ? (
                    <p className="text-sm text-app-muted">Cargando planes...</p>
                  ) : plans.length === 0 ? (
                    <p className="text-sm text-app-muted">No hay planes disponibles.</p>
                  ) : plans.map((plan) => (
                    <button
                      key={plan.id}
                      type="button"
                      className="plan-option"
                      disabled={isCreatingSubscription}
                      onClick={() => void handleCreateSubscription(plan)}
                    >
                      <strong>{plan.name}</strong>
                      <span>{plan.description || (plan.isFree ? 'Plan gratuito' : 'Suscripción disponible')}</span>
                      <em>{plan.isFree ? 'Gratis' : 'Seleccionar'}</em>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <h2>Configurá tu tienda</h2>
                  <p>Completá estos pasos para publicar tu tienda online.</p>
                </div>
                <div className="store-setup-form">
                  <label>
                    Nombre de la tienda
                    <input value={storeNameInput} onChange={(event) => setStoreNameInput(event.target.value)} placeholder="Sabor Nuestro" />
                  </label>
                  <label>
                    Slug público
                    <input value={storeSlugInput} onChange={(event) => setStoreSlugInput(event.target.value)} placeholder="sabor-nuestro" />
                  </label>
                  <label>
                    Foto de la tienda
                    <input type="file" accept="image/*" onChange={handleStoreImageChange} />
                  </label>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" className="ghost-action" onClick={() => setOnboardingStep(null)}>Más tarde</button>
                  <button type="button" className="primary-action" disabled={isSavingStoreProfile} onClick={() => void handleSaveStoreProfile()}>
                    {isSavingStoreProfile ? 'Guardando...' : 'Guardar tienda'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      <CreateOrderDialog
        open={isCreateOrderDialogOpen && !isCreateOrderDialogMinimized}
        onClose={closeCreateOrderDialog}
        onCreated={handleNavbarOrderCreated}
        onMinimize={() => setIsCreateOrderDialogMinimized(true)}
        availableProducts={availableProducts}
        availableCategories={availableCategories}
      />
    </div>
  );
}
