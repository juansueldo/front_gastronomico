import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { LayoutDashboard, MessageSquare, Calendar, Settings, Building, MapPin, LogOut, Bot, Link2, Megaphone, Bell, MoreHorizontal, ClipboardList, LayoutGrid, Wallet, Tags, Package, ChefHat, Puzzle, Boxes, ChevronDown, ChevronLeft, ChevronRight, Moon, SunMedium, Laptop, Languages, CircleUserRound, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { clearAuthSession, getLoggedUser, updateLoggedUser, AUTH_CHANGED_EVENT, type AuthUser } from '../authStorage';
import { getThemePreference, setThemePreference, type ThemePreference, THEME_CHANGED_EVENT } from '../theme';
import { getLanguagePreference, setLanguagePreference, type LanguagePreference, LANGUAGE_CHANGED_EVENT } from '../language';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loggedUser, setLoggedUser] = useState<AuthUser | null>(null);
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>(() => getThemePreference());
  const [languagePreference, setLanguagePreferenceState] = useState<LanguagePreference>(() => getLanguagePreference());

  // Estado de colapso del sidebar completo (persistente)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('isSidebarCollapsed');
      return stored ? JSON.parse(stored) : false;
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const updated = !prev;
      try {
        localStorage.setItem('isSidebarCollapsed', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Estado de colapso por categoría (persistente)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    try {
      const stored = localStorage.getItem('collapsedCategories');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const updated = { ...prev, [category]: !prev[category] };
      try {
        localStorage.setItem('collapsedCategories', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  useEffect(() => {
    const syncUser = () => {
      setLoggedUser(getLoggedUser() as AuthUser | null);
    };

    const syncTheme = (event: Event) => {
      const customEvent = event as CustomEvent<ThemePreference>;
      setThemePreferenceState(customEvent.detail ?? getThemePreference());
    };

    const syncLanguage = (event: Event) => {
      const customEvent = event as CustomEvent<LanguagePreference>;
      setLanguagePreferenceState(customEvent.detail ?? getLanguagePreference());
    };

    syncUser();
    setThemePreferenceState(getThemePreference());
    setLanguagePreferenceState(getLanguagePreference());

    window.addEventListener(AUTH_CHANGED_EVENT, syncUser);
    window.addEventListener(THEME_CHANGED_EVENT, syncTheme);
    window.addEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncUser);
      window.removeEventListener(THEME_CHANGED_EVENT, syncTheme);
      window.removeEventListener(LANGUAGE_CHANGED_EVENT, syncLanguage);
    };
  }, []);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'selectedSection' && window.location.pathname === '/') {
        window.location.reload();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Define los roles permitidos para cada ruta aquí
  const navCategories = [
    {
      category: 'Operaciones',
      items: [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard', allowedRoles: ['admin', 'manager', 'user'] },
        //{ path: '/chats', icon: MessageSquare, label: 'Chats', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/orders', icon: ClipboardList, label: 'Pedidos', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/kitchen', icon: ChefHat, label: 'Cocina', allowedRoles: ['admin', 'manager'] },
        { path: '/tables', icon: LayoutGrid, label: 'Mesas', allowedRoles: ['admin', 'manager'] },
        { path: '/cash-register', icon: Wallet, label: 'Caja', allowedRoles: ['admin'] },
        { path: '/headquarters', icon: Building, label: 'Sedes', allowedRoles: ['admin', 'manager'] },
        { path: '/delivery-zones', icon: MapPin, label: 'Zonas de Entrega', allowedRoles: ['admin', 'manager'] },
      ],
    },
    {
      category: 'Catálogo',
      items: [
        { path: '/categories', icon: Tags, label: 'Categorías', allowedRoles: ['admin', 'manager'] },
        { path: '/products', icon: Package, label: 'Productos', allowedRoles: ['admin', 'manager'] },
        { path: '/inventory', icon: Boxes, label: 'Inventario', allowedRoles: ['admin', 'manager'] },
      ],
    },
    {
      category: 'Herramientas',
      items: [
        //{ path: '/calendar', icon: Calendar, label: 'Calendario', allowedRoles: ['admin', 'manager', 'user'] },
        //{ path: '/campaigns', icon: Megaphone, label: 'Campañas', allowedRoles: ['admin', 'manager'] },
        { path: '/notifications', icon: Bell, label: 'Notificaciones', allowedRoles: ['admin', 'manager', 'user'] },
        //{ path: '/agent', icon: Bot, label: 'Agente IA', allowedRoles: ['admin'] },
        //{ path: '/connections', icon: Link2, label: 'Conexiones', allowedRoles: ['admin'] },
        //{ path: '/integrations', icon: Puzzle, label: 'Integraciones', allowedRoles: ['admin'] },
      ],
    },
    {
      category: 'Configuración',
      items: [
        { path: '/settings', icon: Settings, label: 'Configuración', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/users', icon: Users, label: 'Usuarios', allowedRoles: ['admin'] },
      ],
    },
  ];

  const mobilePrimaryPaths = ['/', '/orders', '/tables', '/cash-register'];
  // Filtrar items según el rol del usuario logueado
  const userRole = loggedUser?.role;
  const filteredNavCategories = navCategories.map(cat => ({
    ...cat,
    items: cat.items.filter(item => !item.allowedRoles || item.allowedRoles.includes(userRole)),
  })).filter(cat => cat.items.length > 0);

  const allNavItems = filteredNavCategories.flatMap(cat => cat.items);
  const mobilePrimaryItems = allNavItems.filter((item) => mobilePrimaryPaths.includes(item.path));
  const mobileMoreItemsByCategory = filteredNavCategories
    .map(cat => ({
      category: cat.category,
      items: cat.items.filter(item => !mobilePrimaryPaths.includes(item.path)),
    }))
    .filter(cat => cat.items.length > 0);

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' ;
    }
    return location.pathname === path;
  };

  const statusColors = {
    active: 'bg-green-500',
    away: 'bg-yellow-500',
    busy: 'bg-red-500',
    offline: 'bg-gray-500',
  };

  const statusLabels: Record<NonNullable<AuthUser['status']>, string> = {
    active: 'Activo',
    away: 'Ausente',
    busy: 'Ocupado',
    offline: 'Desconectado',
  };

  const themeLabels: Record<ThemePreference, string> = {
    dark: 'Oscuro',
    light: 'Claro',
    auto: 'Sistema',
  };

  const languageLabels: Record<LanguagePreference, string> = {
    es: 'Español',
    en: 'English',
    pt: 'Português',
  };

  const handleLogout = () => {
    clearAuthSession();
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  const handleThemeChange = (nextTheme: ThemePreference) => {
    setThemePreferenceState(nextTheme);
    setThemePreference(nextTheme);
    toast.success(`Tema ${themeLabels[nextTheme].toLowerCase()}`);
  };

  const handleLanguageChange = (nextLanguage: LanguagePreference) => {
    setLanguagePreferenceState(nextLanguage);
    setLanguagePreference(nextLanguage);
    toast.success(`Idioma ${languageLabels[nextLanguage]}`);
  };

  const handleStatusChange = (nextStatus: NonNullable<AuthUser['status']>) => {
    updateLoggedUser({ status: nextStatus });
    setLoggedUser((prev) => (prev ? { ...prev, status: nextStatus } : prev));
    toast.success(`Estado ${statusLabels[nextStatus].toLowerCase()}`);
  };

  // Cuando el sidebar está colapsado, se comporta como el modo "md" (solo íconos, ancho w-20)
  const sidebarWidth = isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64';
  const showLabels = !isSidebarCollapsed;

  return (
    <div className="flex h-screen bg-body">
      <Toaster />

      {/* Desktop Sidebar */}
      <div className={`relative hidden md:flex md:w-20 ${sidebarWidth} flex-col bg-card border-r border-gray-600 transition-all duration-300`}>
        <button
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="absolute -right-3 top-16 z-20 hidden h-7 w-7 items-center justify-center rounded-full border border-gray-500 bg-card text-gray-300 shadow-md transition-colors hover:bg-orange-700 hover:text-white lg:flex"
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>

        {/* User Profile */}
        <div className="p-4 border-b border-gray-600">
          {!loggedUser ? (
            <div className="text-gray-400 text-sm">Cargando...</div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/10"
                >
                  <div className="relative shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="bg-primary text-sm">
                        {getInitials(`${loggedUser.firstname ?? ''} ${loggedUser.lastname ?? ''}`.trim() || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${statusColors[loggedUser.status ?? 'active']}`} />
                  </div>
                  {showLabels && (
                    <div className="hidden lg:block min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-medium text-white">
                          {loggedUser.firstname} {loggedUser.lastname}
                        </h3>
                        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                      </div>
                      <p className="truncate text-xs text-gray-400">{loggedUser.role}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64 border-gray-600 bg-card text-white">
                <DropdownMenuLabel className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CircleUserRound className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{loggedUser.firstname} {loggedUser.lastname}</span>
                  </div>
                  <p className="text-xs text-gray-400">{loggedUser.role}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <div className="flex items-center gap-2">
                      <Moon className="h-4 w-4" />
                      <span>Tema</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="border-gray-600 bg-card text-white">
                    <DropdownMenuRadioGroup
                      value={themePreference}
                      onValueChange={(value) => handleThemeChange(value as ThemePreference)}
                    >
                      <DropdownMenuRadioItem value="dark">
                        <div className="flex items-center gap-2">
                          <Moon className="h-4 w-4" />
                          <span>Oscuro</span>
                        </div>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="light">
                        <div className="flex items-center gap-2">
                          <SunMedium className="h-4 w-4" />
                          <span>Claro</span>
                        </div>
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="auto">
                        <div className="flex items-center gap-2">
                          <Laptop className="h-4 w-4" />
                          <span>Sistema</span>
                        </div>
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <div className="flex items-center gap-2">
                      <Languages className="h-4 w-4" />
                      <span>Idioma</span>
                    </div>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="border-gray-600 bg-card text-white">
                    <DropdownMenuRadioGroup
                      value={languagePreference}
                      onValueChange={(value) => handleLanguageChange(value as LanguagePreference)}
                    >
                      <DropdownMenuRadioItem value="es">Español</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="pt">Português</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>

                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-gray-400">
                  Estado del usuario
                </DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={loggedUser.status ?? 'active'}
                  onValueChange={(value) => handleStatusChange(value as NonNullable<AuthUser['status']>)}
                >
                  <DropdownMenuRadioItem value="active">Activo</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="away">Ausente</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="busy">Ocupado</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="offline">Desconectado</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="gap-2">
                  <LogOut className="h-4 w-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {filteredNavCategories.map((cat) => (
            <div key={cat.category}>
              {/* Category header — only shown when labels are visible */}
              {showLabels && (
                <button
                  type="button"
                  className="flex items-center w-full px-2 mb-2 gap-2 group"
                  onClick={() => toggleCategory(cat.category)}
                  tabIndex={-1}
                >
                  <span className="hidden lg:inline-block">
                    {collapsedCategories[cat.category]
                      ? <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />
                      : <ChevronDown className="h-4 w-4 text-gray-400 group-hover:text-white transition-colors" />}
                  </span>
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider hidden lg:block">
                    {cat.category}
                  </span>
                </button>
              )}

              {/* Items: always show when sidebar collapsed (icon-only), respect category collapse otherwise */}
              {(isSidebarCollapsed || !collapsedCategories[cat.category]) && (
                <div className="space-y-1">
                  {cat.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        title={isSidebarCollapsed ? item.label : undefined}
                        className={`w-full flex items-center rounded-lg py-3 transition-colors ${
                          showLabels ? 'justify-start gap-3 px-4' : 'justify-center px-0'
                        } ${
                          active
                            ? 'bg-primary text-white-700'
                            : 'text-gray-400 hover:bg-orange-700 hover:text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        {showLabels && <span className="hidden lg:block">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden bg-card border-t border-orange-700 safe-area-bottom">
          <div className="grid grid-cols-5 gap-1 px-2 py-3">
            {mobilePrimaryItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                    active ? 'text-primary' : 'text-white'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}

            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                    mobileMoreItemsByCategory.some(cat => cat.items.some(item => isActive(item.path)))
                      ? 'text-primary'
                      : 'text-white'
                  }`}
                >
                  <MoreHorizontal className="h-6 w-6" />
                  <span className="text-xs">Más</span>
                </button>
              </SheetTrigger>

              <SheetContent side="bottom" className="bg-card border-orange-700 text-white">
                <SheetHeader>
                  <SheetTitle className="text-white">Más opciones</SheetTitle>
                </SheetHeader>
                <div className="p-4 pt-0 space-y-4">
                  {mobileMoreItemsByCategory.map(cat => (
                    <div key={cat.category}>
                      <div className="text-xs text-gray-500 font-semibold uppercase px-2 mb-2 tracking-wider">
                        {cat.category}
                      </div>
                      <div className="space-y-2">
                        {cat.items.map((item) => {
                          const Icon = item.icon;
                          const active = isActive(item.path);
                          return (
                            <button
                              key={item.path}
                              onClick={() => {
                                navigate(item.path);
                                setIsMobileMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                                active
                                  ? 'bg-primary text-white'
                                  : 'text-white hover:bg-orange-700 hover:text-white'
                              }`}
                            >
                              <Icon className="h-5 w-5 shrink-0" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
}
