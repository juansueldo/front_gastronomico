import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { isUserAuthenticated, saveAuthSession } from '../authStorage';

export function LoginView() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const API_URL = import.meta.env?.VITE_API_URL;
  const isAuthenticated = isUserAuthenticated();
  // Redirige solo una vez si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);
  if (isAuthenticated) {
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.detail || 'Error de autenticación');
        setIsLoading(false);
        return;
      }
      const data = await response.json();
      saveAuthSession({
        username,
        user: data.user,
        accessToken: data.token,
        rememberMe,
      });
      toast.success('Inicio de sesión exitoso');
      setTimeout(() => {
        navigate('/');
      }, 100);
    } catch (err) {
      toast.error('No se pudo conectar al servidor');
    }
    setIsLoading(false);
  };

  return (
    <div className="h-screen bg-[#25293c] flex items-center justify-center p-4">
      <Toaster />
      <div className="w-full max-w-sm mx-auto">
        {/* Logo */}
        <div>
          <img src="/logoTomatina.png" alt="Tomatina" className="h-12 mb-2" />
        </div>
        <div className="mb-6">
          <p className="text-gray-200 text-base">Por favor, inicie sesión en su cuenta para continuar</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-5 bg-transparent">
          <div>
            <Label htmlFor="username" className="text-gray-300">Nombre de usuario</Label>
            <div className="relative mt-2">
              <Input
                id="username"
                type="text"
                placeholder="Ingrese su nombre de usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="pl-10 bg-[#23264a] border border-[#3c4060] text-white"
                disabled={isLoading}
              />
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            </div>
          </div>
          <div>
            <Label htmlFor="password" className="text-gray-300">Contraseña</Label>
            <div className="relative mt-2">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10 bg-[#23264a] border border-[#3c4060] text-white"
                disabled={isLoading}
              />
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-400"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="flex justify-end mt-1">
              <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300">¿Olvidaste la contraseña?</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-[#23264a] text-indigo-600 focus:ring-indigo-600"
            />
            <label htmlFor="remember" className="text-sm text-gray-400">Recuérdame por 30 días</label>
          </div>
          <Button type="submit" className="w-full bg-[#6c63ff] hover:bg-[#554fd8] text-white font-semibold text-base py-2 rounded-lg" disabled={isLoading}>
            {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </Button>
        </form>
        <div className="text-center mt-6">
          <span className="text-gray-400 text-sm">¿Nuevo en nuestra plataforma? </span>
          <a href="/register" className="text-indigo-400 hover:text-indigo-300 text-sm font-medium">Crear una cuenta</a>
        </div>
      </div>
    </div>
  );
}
