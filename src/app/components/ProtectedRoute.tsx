import { ReactNode } from 'react';
import { Navigate } from 'react-router';
import { getAuthSession, getLoggedUser } from '../authStorage';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const session = getAuthSession();
  if (!session) {
    // No autenticado o sesión expirada
    return <Navigate to="/login" replace />;
  }
  const user = session.user;
  if (allowedRoles && allowedRoles.length > 0) {
    if (!user || !user.role || !allowedRoles.includes(user.role)) {
      return <Navigate to="/unauthorized" replace />;
    }
  }
  return <>{children}</>;
}
