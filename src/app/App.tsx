import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './core/router/routes';
import { toast } from 'sonner';
import { Toaster } from './shared/ui/components/sonner';
import { APP_NOTIFICATION_EVENT, type AppNotificationDetail } from './pushNotifications';
import { AUTH_CHANGED_EVENT, AUTH_EXPIRED_EVENT, isUserAuthenticated } from './core/storage/authStorage';
import { createNotification } from './api';
import { startRealtimeChannel, stopRealtimeChannel } from './realtime';

export default function App() {
  useEffect(() => {
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotificationDetail>;
      const detail = customEvent.detail;
      const eventType =
        typeof detail.data?.eventType === 'string'
          ? detail.data.eventType
          : typeof detail.data?.type === 'string'
          ? detail.data.type
          : undefined;

      void createNotification({
        type: eventType,
        title: detail.title,
        body: detail.body,
        source: 'realtime',
        payload: detail.data,
        createdAt: Math.floor(Date.now() / 1000),
      }).catch(() => {
        // No bloquear UI si falla persistencia.
      });

      toast.info(customEvent.detail.body, {
        description: customEvent.detail.title,
      });
    };

    const syncRealtimeChannel = () => {
      if (isUserAuthenticated()) {
        startRealtimeChannel();
        return;
      }

      stopRealtimeChannel();
    };

    const handleAuthExpired = () => {
      toast.error('Tu sesión finalizó o hubo un problema de conexión. Volvé a iniciar sesión.');
      void router.navigate('/login', { replace: true });
    };

    window.addEventListener(APP_NOTIFICATION_EVENT, handleNotification);
    window.addEventListener(AUTH_CHANGED_EVENT, syncRealtimeChannel);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    syncRealtimeChannel();

    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotification);
      window.removeEventListener(AUTH_CHANGED_EVENT, syncRealtimeChannel);
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
      stopRealtimeChannel();
    };
  }, []);

  return (
    <div className="size-full">
      <Toaster />
      <RouterProvider router={router} />
    </div>
  );
}
