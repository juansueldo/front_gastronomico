import { useState } from 'react';
import { useNavigate } from 'react-router';
import { MessageSquare, Lock, User } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

export function LoginView() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    
    // Simular autenticación
    setTimeout(() => {
      // En producción, aquí harías una llamada a tu API
      if (email && password) {
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userEmail', email);
        toast.success('Inicio de sesión exitoso');
        navigate('/');
      } else {
        toast.error('Credenciales inválidas');
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="h-screen bg-[#2f3349] flex items-center justify-center p-4">
      <Toaster />
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl mb-4">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-white text-3xl mb-2">Omnicanal Chat</h1>
          <p className="text-gray-400">Inicia sesión para continuar</p>
        </div>

        {/* Login Form */}
        <div className="p-6 md:p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <Label htmlFor="email" className="text-gray-300">
                Correo electrónico
              </Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 bg-[#25293c] border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-300">
                Contraseña
              </Label>
              <div className="relative mt-2">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-[#25293c] border-gray-600 text-white"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-600 bg-[#25293c] text-indigo-600 focus:ring-indigo-600"
                />
                <span className="text-sm text-gray-400">Recordarme</span>
              </label>
              <button type="button" className="text-sm text-indigo-400 hover:text-indigo-300">
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>

          {/* Demo credentials */}
          <div className="mt-6 p-4 bg-[#25293c] rounded-lg border border-gray-700">
            <p className="text-xs text-gray-400 mb-2">Para demo, usa cualquier email y contraseña:</p>
            <p className="text-xs text-gray-500">Email: demo@ejemplo.com</p>
            <p className="text-xs text-gray-500">Contraseña: cualquier contraseña</p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-400 text-sm mt-6">
          ¿No tienes una cuenta?{' '}
          <button className="text-indigo-400 hover:text-indigo-300">
            Regístrate
          </button>
        </p>
      </div>
    </div>
  );
}
