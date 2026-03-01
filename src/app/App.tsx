import { useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes.tsx';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { APP_NOTIFICATION_EVENT, type AppNotificationDetail } from './pushNotifications';
import { AUTH_CHANGED_EVENT, isUserAuthenticated } from './authStorage';
import { startRealtimeChannel, stopRealtimeChannel } from './realtime';

export default function App() {
  useEffect(() => {
    const handleNotification = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotificationDetail>;
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
    <div className="size-full dark">
      <Toaster />
      <RouterProvider router={router} />
    </div>
  );
}