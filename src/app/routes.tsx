import { createBrowserRouter } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ConversationList } from './components/ConversationList';
import { ChatView } from './components/ChatView';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { LoginView } from './components/LoginView';
import { ProtectedRoute } from './components/ProtectedRoute';

// Wrapper components
function ConversationListPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ConversationList />
      </AppLayout>
    </ProtectedRoute>
  );
}

function ChatViewPage() {
  return (
    <ProtectedRoute>
      <ChatView />
    </ProtectedRoute>
  );
}

function CalendarPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <CalendarView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function SettingsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <SettingsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginView,
  },
  {
    path: '/',
    Component: ConversationListPage,
  },
  {
    path: '/chat/:id',
    Component: ChatViewPage,
  },
  {
    path: '/calendar',
    Component: CalendarPage,
  },
  {
    path: '/settings',
    Component: SettingsPage,
  },
]);