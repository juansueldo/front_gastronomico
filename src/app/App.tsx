import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes.tsx';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { APP_NOTIFICATION_EVENT, type AppNotificationDetail } from './pushNotifications';
import { AUTH_CHANGED_EVENT, isUserAuthenticated } from './authStorage';
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

    window.addEventListener(APP_NOTIFICATION_EVENT, handleNotification);
    window.addEventListener(AUTH_CHANGED_EVENT, syncRealtimeChannel);
    syncRealtimeChannel();

    return () => {
      window.removeEventListener(APP_NOTIFICATION_EVENT, handleNotification);
      window.removeEventListener(AUTH_CHANGED_EVENT, syncRealtimeChannel);
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