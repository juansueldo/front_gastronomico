import { ReactNode, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { MessageSquare, Calendar, Settings, LogOut, Bot, Link2, Megaphone, Bell, MoreHorizontal } from 'lucide-react';
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

  useEffect(() => {
    const storedUser = getLoggedUser();
    if (storedUser) {
      setLoggedUser(storedUser as AuthUser);
    }
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Chats' },
    { path: '/calendar', icon: Calendar, label: 'Calendario' },
    { path: '/campaigns', icon: Megaphone, label: 'Campañas' },
    { path: '/notifications', icon: Bell, label: 'Notificaciones' },
    { path: '/agent', icon: Bot, label: 'Agente IA' },
    { path: '/connections', icon: Link2, label: 'Conexiones' },
    { path: '/settings', icon: Settings, label: 'Configuración' },
  ];

  const mobilePrimaryPaths = ['/', '/calendar', '/campaigns', '/notifications'];
  const mobilePrimaryItems = navItems.filter((item) => mobilePrimaryPaths.includes(item.path));
  const mobileMoreItems = navItems.filter((item) => !mobilePrimaryPaths.includes(item.path));

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname.startsWith('/chat');
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

  return (
    <div className="flex h-screen bg-body">
      <Toaster />
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-20 lg:w-64 flex-col bg-card border-r border-gray-700">
        {/* User Profile */}
        <div className="p-4 border-b border-gray-700">
          {!loggedUser ? (
            <div className="text-gray-400">Cargando usuario...</div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-primary">
                    {getInitials(loggedUser.firstname + ' ' + loggedUser.lastname)}
                  </AvatarFallback>
                </Avatar>
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${statusColors[loggedUser.status ?? 'active']}`} />
              </div>
              <div className="hidden lg:block flex-1 min-w-0">
                <h3 className="text-white font-medium truncate">{loggedUser.firstname} {loggedUser.lastname}</h3>
                <p className="text-xs text-gray-400 truncate">{loggedUser.role}</p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? 'bg-primary'
                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="hidden lg:block">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-gray-700 hover:text-white rounded-lg transition-colors"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className="hidden lg:block">Cerrar sesión</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="md:hidden bg-card border-t border-gray-700 safe-area-bottom">
          <div className="grid grid-cols-5 gap-1 px-2 py-3">
            {mobilePrimaryItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition-colors ${
                    active
                      ? 'text-primary'
                      : 'text-gray-400'
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
                    mobileMoreItems.some((item) => isActive(item.path))
                      ? 'text-primary'
                      : 'text-gray-400'
                  }`}
                >
                  <MoreHorizontal className="h-6 w-6" />
                  <span className="text-xs">Más</span>
                </button>
              </SheetTrigger>

              <SheetContent side="bottom" className="bg-card border-gray-700 text-white">
                <SheetHeader>
                  <SheetTitle className="text-white">Más opciones</SheetTitle>
                </SheetHeader>
                <div className="p-4 pt-0 space-y-2">
                  {mobileMoreItems.map((item) => {
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
                            : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                        }`}
                      >
                        <Icon className="h-5 w-5 shrink-0" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </div>
  );
}