import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { LayoutDashboard, MessageSquare, Calendar, Settings, LogOut, Bot, Link2, Megaphone, Bell, MoreHorizontal, ClipboardList, LayoutGrid, Wallet, Tags, Package, ChefHat, Puzzle, Boxes, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { clearAuthSession, getLoggedUser } from '../authStorage';
import { AuthUser } from '../authStorage';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loggedUser, setLoggedUser] = useState<AuthUser | null>(null);

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
    const storedUser = getLoggedUser();
    if (storedUser) {
      setLoggedUser(storedUser as AuthUser);
    }
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
        { path: '/chats', icon: MessageSquare, label: 'Chats', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/orders', icon: ClipboardList, label: 'Pedidos', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/kitchen', icon: ChefHat, label: 'Cocina', allowedRoles: ['admin', 'manager'] },
        { path: '/tables', icon: LayoutGrid, label: 'Mesas', allowedRoles: ['admin', 'manager'] },
        { path: '/cash-register', icon: Wallet, label: 'Caja', allowedRoles: ['admin'] },
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
        { path: '/calendar', icon: Calendar, label: 'Calendario', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/campaigns', icon: Megaphone, label: 'Campañas', allowedRoles: ['admin', 'manager'] },
        { path: '/notifications', icon: Bell, label: 'Notificaciones', allowedRoles: ['admin', 'manager', 'user'] },
        { path: '/agent', icon: Bot, label: 'Agente IA', allowedRoles: ['admin'] },
        { path: '/connections', icon: Link2, label: 'Conexiones', allowedRoles: ['admin'] },
        { path: '/integrations', icon: Puzzle, label: 'Integraciones', allowedRoles: ['admin'] },
      ],
    },
    {
      category: 'Configuración',
      items: [
        { path: '/settings', icon: Settings, label: 'Configuración', allowedRoles: ['admin', 'manager', 'user'] },
      ],
    },
  ];

  const mobilePrimaryPaths = ['/', '/calendar', '/campaigns', '/notifications'];
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

  const handleLogout = () => {
    clearAuthSession();
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  // Cuando el sidebar está colapsado, se comporta como el modo "md" (solo íconos, ancho w-20)
  const sidebarWidth = isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64';
  const showLabels = !isSidebarCollapsed;

  return (
    <div className="flex h-screen bg-body">
      <Toaster />

      {/* Desktop Sidebar */}
      <div className={`hidden md:flex md:w-20 ${sidebarWidth} flex-col bg-card border-r border-gray-600 transition-all duration-300`}>

        {/* User Profile */}
        <div className="p-4 border-b border-gray-600">
          {!loggedUser ? (
            <div className="text-gray-400 text-sm">Cargando...</div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary text-sm">
                    {getInitials(loggedUser.firstname + ' ' + loggedUser.lastname)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${statusColors[loggedUser.status ?? 'active']}`} />
              </div>
              {showLabels && (
                <div className="hidden lg:block flex-1 min-w-0">
                  <h3 className="text-white font-medium truncate">{loggedUser.firstname} {loggedUser.lastname}</h3>
                  <p className="text-xs text-gray-400 truncate">{loggedUser.role}</p>
                </div>
              )}
            </div>
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
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
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

        {/* Bottom actions: collapse toggle + logout */}
        <div className="p-4 border-t border-gray-600 space-y-1">
          {/* Toggle sidebar collapse — only visible on lg+ */}
          <button
            onClick={toggleSidebar}
            title={isSidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            className="w-full hidden lg:flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-orange-700 hover:text-white rounded-lg transition-colors"
          >
            {isSidebarCollapsed
              ? <PanelLeftOpen className="h-5 w-5 shrink-0" />
              : <PanelLeftClose className="h-5 w-5 shrink-0" />}
            {showLabels && <span className="hidden lg:block">Colapsar menú</span>}
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-orange-700 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {showLabels && <span className="hidden lg:block">Cerrar sesión</span>}
          </button>
        </div>
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