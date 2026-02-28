import { ReactNode } from 'react';
import { Navigate } from 'react-router';

interface PublicRouteProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true' && !!localStorage.getItem('access_token');
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
