import { type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppLayout } from '../layout/AppLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { PublicRoute } from './PublicRoute';
import { LoginPage } from '../../features/auth/pages/LoginPage';
import { RegisterPage } from '../../features/auth/pages/RegisterPage';
import { DashboardPage } from '../../features/dashboard/pages/DashboardPage';
import { ConversationListPage } from '../../features/chat/pages/ConversationListPage';
import { ChatPage } from '../../features/chat/pages/ChatPage';
import { CalendarPage } from '../../features/calendar/pages/CalendarPage';
import { SettingsPage } from '../../features/settings/pages/SettingsPage';
import { AgentConfigPage } from '../../features/agent/pages/AgentConfigPage';
import { ConnectionsPage } from '../../features/integrations/pages/ConnectionsPage';
import { CampaignsPage } from '../../features/campaigns/pages/CampaignsPage';
import { NotificationsPage } from '../../features/notifications/pages/NotificationsPage';
import { ActiveOrdersPage } from '../../features/orders/pages/ActiveOrdersPage';
import { TablesPage } from '../../features/tables/pages/TablesPage';
import { CashRegisterPage } from '../../features/cash-register/pages/CashRegisterPage';
import { CategoriesPage } from '../../features/categories/pages/CategoriesPage';
import { ProductsPage } from '../../features/products/pages/ProductsPage';
import { InventoryPage } from '../../features/inventory/pages/InventoryPage';
import { KitchenOrdersPage } from '../../features/kitchen/pages/KitchenOrdersPage';
import { IntegrationsPage } from '../../features/integrations/pages/IntegrationsPage';
import { PublicStorefrontPage } from '../../features/storefront/pages/PublicStorefrontPage';
import { HeadquartersPage } from '../../features/headquarters/pages/HeadquartersPage';
import { DeliveryZonesPage } from '../../features/delivery-zones/pages/DeliveryZonesPage';
import { UsersPage } from '../../features/users/pages/UsersPage';
import { CustomersPage } from '../../features/customers/pages/CustomersPage';

type Role = 'admin' | 'supervisor' | 'agent';

type ProtectedRouteConfig = {
  path: string;
  Component: () => JSX.Element;
  roles: Role[];
  layout?: boolean;
};

function withProtectedPage(Component: () => JSX.Element, roles: Role[], layout = true) {
  return function ProtectedPage() {
    const content = layout ? (
      <AppLayout>
        <Component />
      </AppLayout>
    ) : (
      <Component />
    );

    return (
      <ProtectedRoute allowedRoles={roles}>
        {content}
      </ProtectedRoute>
    );
  };
}

function withPublicPage(children: ReactNode) {
  return function PublicPage() {
    return <PublicRoute>{children}</PublicRoute>;
  };
}

function UnauthorizedPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1 style={{ fontSize: 32, color: '#e53e3e', marginBottom: 16 }}>Acceso no autorizado</h1>
      <p style={{ fontSize: 18 }}>No tienes permisos para acceder a esta página.</p>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <h1 style={{ fontSize: 32, color: '#e53e3e', marginBottom: 16 }}>404</h1>
      <p style={{ fontSize: 18 }}>La pagina que buscas no existe.</p>
    </div>
  );
}

export const protectedRouteConfig: ProtectedRouteConfig[] = [
  { path: '/', Component: DashboardPage, roles: ['admin', 'supervisor', 'agent'], layout: false },
  { path: '/chats', Component: ConversationListPage, roles: ['admin', 'supervisor', 'agent'] },
  { path: '/chat/:id', Component: ChatPage, roles: ['admin', 'supervisor', 'agent'], layout: false },
  { path: '/calendar', Component: CalendarPage, roles: ['admin', 'supervisor', 'agent'] },
  { path: '/settings', Component: SettingsPage, roles: ['admin', 'supervisor', 'agent'] },
  { path: '/agent', Component: AgentConfigPage, roles: ['admin'] },
  { path: '/connections', Component: ConnectionsPage, roles: ['admin'] },
  { path: '/campaigns', Component: CampaignsPage, roles: ['admin', 'supervisor'] },
  { path: '/notifications', Component: NotificationsPage, roles: ['admin', 'supervisor', 'agent'] },
  { path: '/orders', Component: ActiveOrdersPage, roles: ['admin', 'supervisor', 'agent'] },
  { path: '/customers', Component: CustomersPage, roles: ['admin', 'supervisor', 'agent'] },
  { path: '/tables', Component: TablesPage, roles: ['admin', 'supervisor'] },
  { path: '/cash-register', Component: CashRegisterPage, roles: ['admin'] },
  { path: '/categories', Component: CategoriesPage, roles: ['admin', 'supervisor'] },
  { path: '/products', Component: ProductsPage, roles: ['admin', 'supervisor'] },
  { path: '/inventory', Component: InventoryPage, roles: ['admin', 'supervisor'] },
  { path: '/kitchen', Component: KitchenOrdersPage, roles: ['admin', 'supervisor'] },
  { path: '/integrations', Component: IntegrationsPage, roles: ['admin'] },
  { path: '/headquarters', Component: HeadquartersPage, roles: ['admin', 'supervisor'] },
  { path: '/delivery-zones', Component: DeliveryZonesPage, roles: ['admin', 'supervisor'] },
  { path: '/users', Component: UsersPage, roles: ['admin'] },
];

export const router = createBrowserRouter([
  { path: '/unauthorized', Component: UnauthorizedPage },
  { path: '/404', Component: NotFoundPage },
  { path: '/login', Component: withPublicPage(<LoginPage />) },
  { path: '/register', Component: withPublicPage(<RegisterPage />) },
  { path: '/tienda/:slug', Component: PublicStorefrontPage },
  ...protectedRouteConfig.map((route) => ({
    path: route.path,
    Component: withProtectedPage(route.Component, route.roles, route.layout ?? true),
  })),
  { path: '*', Component: NotFoundPage },
]);
