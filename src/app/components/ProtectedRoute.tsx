import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router';
import { AUTH_CHANGED_EVENT, getAuthSession } from '../authStorage';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const [session, setSession] = useState(() => getAuthSession());

  useEffect(() => {
    const syncSession = () => {
      setSession(getAuthSession());
    };

    window.addEventListener(AUTH_CHANGED_EVENT, syncSession);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncSession);
    };
  }, []);

  if (!session) {
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
