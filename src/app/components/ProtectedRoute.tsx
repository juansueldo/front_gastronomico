import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const auth = localStorage.getItem('isAuthenticated') === 'true';
    setIsAuthenticated(auth);
    
    if (!auth) {
      navigate('/login');
    }
  }, [navigate]);

  if (isAuthenticated === null) {
    return (
      <div className="h-screen bg-[#25293c] flex items-center justify-center">
        <div className="text-white">Cargando...</div>
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : null;
}
