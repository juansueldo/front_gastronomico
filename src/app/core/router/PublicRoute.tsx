import { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { isUserAuthenticated } from '../storage/authStorage';

interface PublicRouteProps {
  children: ReactNode;
}

export function PublicRoute({ children }: PublicRouteProps) {
  const isAuthenticated = isUserAuthenticated();
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
