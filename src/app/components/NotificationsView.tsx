import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

interface AppNotification {
  id: string;
  title: string;
  description: string;
  receivedAt: string;
  read: boolean;
}

const NOTIFICATIONS_STORAGE_KEY = 'receivedNotifications';

const defaultNotifications: AppNotification[] = [
  {
    id: 'n1',
    title: 'Nuevo mensaje recibido',
    description: 'María González envió un nuevo mensaje por WhatsApp.',
    receivedAt: new Date('2026-02-28T09:25:00').toISOString(),
    read: false,
  },
  {
    id: 'n2',
    title: 'Campaña enviada',
    description: 'La campaña "Promoción semanal" fue enviada correctamente.',
    receivedAt: new Date('2026-02-28T08:10:00').toISOString(),
    read: true,
  },
];

export function NotificationsView() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!stored) {
      setNotifications(defaultNotifications);
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(defaultNotifications));
      return;
    }

    try {
      setNotifications(JSON.parse(stored));
    } catch {
      setNotifications(defaultNotifications);
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(defaultNotifications));
      toast.error('No se pudieron cargar las notificaciones guardadas');
    }
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.read).length;
  }, [notifications]);

  const persistNotifications = (updatedNotifications: AppNotification[]) => {
    setNotifications(updatedNotifications);
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updatedNotifications));
  };

  const markAllAsRead = () => {
    const updated = notifications.map((item) => ({ ...item, read: true }));
    persistNotifications(updated);
    toast.success('Notificaciones marcadas como leídas');
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full bg-[#25293c] overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-4xl mx-auto pb-20">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-white text-2xl mb-1">Notificaciones</h1>
            <p className="text-gray-400 text-sm">Visualiza todas las notificaciones recibidas</p>
          </div>

          <Button onClick={markAllAsRead} variant="outline" className="bg-transparent border-gray-600 text-white hover:bg-gray-700">
            <CheckCheck className="h-4 w-4 mr-2" />
            Marcar todo como leído
          </Button>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Historial de notificaciones
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-red-500 text-white ml-2">
                {unreadCount}
              </Badge>
            )}
          </h2>

          {notifications.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay notificaciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`border rounded-lg p-4 ${
                    notification.read
                      ? 'bg-[#25293c] border-gray-700'
                      : 'bg-indigo-900/20 border-indigo-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-white font-medium">{notification.title}</p>
                    {!notification.read && (
                      <Badge variant="secondary" className="bg-indigo-600 text-white">
                        Nueva
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-300">{notification.description}</p>
                  <p className="text-xs text-gray-500 mt-2">{formatDate(notification.receivedAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}