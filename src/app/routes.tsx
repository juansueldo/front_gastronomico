import { createBrowserRouter } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ConversationList } from './components/ConversationList';
import { ChatView } from './components/ChatView';
import { CalendarView } from './components/CalendarView';
import { SettingsView } from './components/SettingsView';
import { AgentConfigView } from './components/AgentConfigView';
import { ConnectionsView } from './components/ConnectionsView';
import { CampaignsView } from './components/CampaignsView';
import { NotificationsView } from './components/NotificationsView';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PublicRoute } from './components/PublicRoute';

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

function AgentConfigPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <AgentConfigView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function ConnectionsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <ConnectionsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function CampaignsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <CampaignsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function NotificationsPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <NotificationsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: () => (
      <PublicRoute>
        <LoginView />
      </PublicRoute>
    ),
  },
  {
    path: '/register',
    Component: () => (
      <PublicRoute>
        <RegisterView />
      </PublicRoute>
    ),
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
  {
    path: '/agent',
    Component: AgentConfigPage,
  },
  {
    path: '/connections',
    Component: ConnectionsPage,
  },
  {
    path: '/campaigns',
    Component: CampaignsPage,
  },
  {
    path: '/notifications',
    Component: NotificationsPage,
  },
]);