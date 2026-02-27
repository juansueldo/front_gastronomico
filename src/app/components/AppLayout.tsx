import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { MessageSquare, Calendar, Settings, LogOut } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { loggedUser } from '../data/mockData';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const navItems = [
    { path: '/', icon: MessageSquare, label: 'Chats' },
    { path: '/calendar', icon: Calendar, label: 'Calendario' },
    { path: '/settings', icon: Settings, label: 'Configuración' },
  ];

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
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userEmail');
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-[#25293c]">
      <Toaster />
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-20 lg:w-64 flex-col bg-[#2f3349] border-r border-gray-700">
        {/* User Profile */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-indigo-600 text-white">
                  {getInitials(loggedUser.name)}
                </AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#2f3349] ${statusColors[loggedUser.status]}`} />
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <h3 className="text-white font-medium truncate">{loggedUser.name}</h3>
              <p className="text-xs text-gray-400 truncate">{loggedUser.role}</p>
            </div>
          </div>
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
                    ? 'bg-primary text-white'
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
        <div className="md:hidden bg-[#2f3349] border-t border-gray-700 safe-area-bottom">
          <div className="flex items-center justify-around px-2 py-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-colors ${
                    active
                      ? 'text-indigo-400'
                      : 'text-gray-400'
                  }`}
                >
                  <Icon className="h-6 w-6" />
                  <span className="text-xs">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}