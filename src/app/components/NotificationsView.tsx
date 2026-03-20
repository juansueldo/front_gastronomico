import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { APP_NOTIFICATION_EVENT, type AppNotificationDetail } from '../pushNotifications';
import { listNotifications, markAllNotificationsAsRead, markNotificationAsRead } from '../api';

interface AppNotification {
  id: string;
  title: string;
  description: string;
  receivedAt: string;
  read: boolean;
}

export function NotificationsView() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    const loadNotifications = async () => {
      setIsLoading(true);
      try {
        const data = await listNotifications(50, 0);
        setNotifications(data);
      } catch {
        toast.error('No se pudieron cargar las notificaciones');
      } finally {
        setIsLoading(false);
      }
    };

    void loadNotifications();
  }, []);

  useEffect(() => {
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotificationDetail>;
      const detail = customEvent.detail;

      const incoming: AppNotification = {
        id: `local-${Date.now()}`,
        title: detail.title,
        description: detail.body,
        receivedAt: new Date().toISOString(),
        read: false,
      };

      setNotifications((prev) => [incoming, ...prev]);
    };

    window.addEventListener(APP_NOTIFICATION_EVENT, handleNotification);
    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotification);
    };
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((item) => !item.read).length;
  }, [notifications]);

  const markAllAsRead = async () => {
    if (isMarkingAll) {
      return;
    }

    const previous = notifications;
    const updated = notifications.map((item) => ({ ...item, read: true }));
    setNotifications(updated);
    setIsMarkingAll(true);

    try {
      await markAllNotificationsAsRead();
      toast.success('Notificaciones marcadas como leídas');
    } catch {
      setNotifications(previous);
      toast.error('No se pudieron marcar todas como leídas');
    } finally {
      setIsMarkingAll(false);
    }
  };

  const markOneAsRead = async (notificationId: string) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.read || markingId === notificationId) {
      return;
    }

    const previous = notifications;
    setNotifications((prev) => prev.map((item) => (item.id === notificationId ? { ...item, read: true } : item)));
    setMarkingId(notificationId);

    try {
      await markNotificationAsRead(notificationId);
    } catch {
      setNotifications(previous);
      toast.error('No se pudo marcar la notificación como leída');
    } finally {
      setMarkingId(null);
    }
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
    <div className="h-full bg-body overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-4xl mx-auto pb-20">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-white text-2xl mb-1">Notificaciones</h1>
            <p className="text-gray-400 text-sm">Visualiza todas las notificaciones recibidas</p>
          </div>

          <Button
            onClick={() => {
              void markAllAsRead();
            }}
            variant="outline"
            className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
            disabled={isMarkingAll || unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            {isMarkingAll ? 'Marcando...' : 'Marcar todo como leído'}
          </Button>
        </div>

        <div className="bg-card rounded-lg p-6">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Historial de notificaciones
            {unreadCount > 0 && (
              <Badge variant="secondary" className="bg-red-500 text-white ml-2">
                {unreadCount}
              </Badge>
            )}
          </h2>

          {isLoading ? (
            <p className="text-gray-400 text-sm">Cargando notificaciones...</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400 text-sm">No hay notificaciones registradas.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    void markOneAsRead(notification.id);
                  }}
                  className={`border rounded-lg p-4 ${
                    notification.read
                      ? 'bg-body border-gray-700'
                      : 'bg-indigo-900/20 border-indigo-700'
                  } ${notification.read ? '' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <p className="text-white font-medium">{notification.title}</p>
                    {!notification.read && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-indigo-600 text-white">
                          Nueva
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="bg-transparent border-indigo-600 text-indigo-200 hover:bg-indigo-900/40"
                          disabled={markingId === notification.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void markOneAsRead(notification.id);
                          }}
                        >
                          {markingId === notification.id ? 'Guardando...' : 'Marcar leída'}
                        </Button>
                      </div>
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