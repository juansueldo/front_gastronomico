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
import { ActiveOrdersView } from './components/ActiveOrdersView';
import { TablesView } from './components/TablesView';
import { CashRegisterView } from './components/CashRegisterView';
import { CategoriesView } from './components/CategoriesView';
import { ProductsView } from './components/ProductsView';
import { InventoryView } from './components/InventoryView';
import { KitchenOrdersView } from './components/KitchenOrdersView';
import { IntegrationsView } from './components/IntegrationsView';
import { PublicStorefrontView } from './components/PublicStorefrontView';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { ProtectedRoute } from './components/ProtectedRoute';
import { HeadquartersView } from './components/HeadquartersView';
import { PublicRoute } from './components/PublicRoute';

import { DashboardView } from './components/DashboardView';

// Wrapper components
function DashboardPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <DashboardView />
    </ProtectedRoute>
  );
}
function ConversationListPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <AppLayout>
        <ConversationList />
      </AppLayout>
    </ProtectedRoute>
  );
}

function ChatViewPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <ChatView />
    </ProtectedRoute>
  );
}

function CalendarPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <AppLayout>
        <CalendarView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function SettingsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <AppLayout>
        <SettingsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function AgentConfigPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <AgentConfigView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function ConnectionsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <ConnectionsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function CampaignsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <CampaignsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function NotificationsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <AppLayout>
        <NotificationsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function ActiveOrdersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user"]}>
      <AppLayout>
        <ActiveOrdersView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function TablesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <TablesView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function CashRegisterPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <CashRegisterView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function CategoriesPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <CategoriesView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function ProductsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <ProductsView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function InventoryPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <InventoryView />
      </AppLayout>
    </ProtectedRoute>
  );
}

function KitchenOrdersPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <KitchenOrdersView />
      </AppLayout>
    </ProtectedRoute>
  );
}
function HeadquarterPage() {
  return (
    <ProtectedRoute allowedRoles={["admin", "manager"]}>
      <AppLayout>
        <HeadquartersView />
      </AppLayout>
    </ProtectedRoute>
  );
}


function IntegrationsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AppLayout>
        <IntegrationsView />
      </AppLayout>
    </ProtectedRoute>
  );
}
// Página de acceso no autorizado
function UnauthorizedPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1 style={{ fontSize: 32, color: '#e53e3e', marginBottom: 16 }}>Acceso no autorizado</h1>
      <p style={{ fontSize: 18 }}>No tienes permisos para acceder a esta página.</p>
    </div>
  );
}

export const router = createBrowserRouter([
    {
      path: '/unauthorized',
      Component: UnauthorizedPage,
    },
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
    Component: DashboardPage,
  },
  {
    
    path: '/chats',
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
  {
    path: '/orders',
    Component: ActiveOrdersPage,
  },
  {
    path: '/tables',
    Component: TablesPage,
  },
  {
    path: '/cash-register',
    Component: CashRegisterPage,
  },
  {
    path: '/categories',
    Component: CategoriesPage,
  },
  {
    path: '/products',
    Component: ProductsPage,
  },
  {
    path: '/inventory',
    Component: InventoryPage,
  },
  {
    path: '/kitchen',
    Component: KitchenOrdersPage,
  },
  {
    path: '/integrations',
    Component: IntegrationsPage,
  },
  {
    path: '/tienda/:slug',
    Component: PublicStorefrontView,
  },
  {
    path: '/headquarters',
    Component: HeadquarterPage,
  },
]);