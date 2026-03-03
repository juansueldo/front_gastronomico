import { useEffect, useState } from 'react';
import { Camera, Bell, Shield, Globe, Moon, LogOut, Save } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { AuthUser } from '../authStorage';
import { clearAuthSession, getLoggedUser } from '../authStorage';
import { useNavigate } from 'react-router';
import { getThemePreference, setThemePreference, type ThemePreference } from '../theme';

export function SettingsView() {
  const navigate = useNavigate();
  const [loggedUser, setLoggedUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState({
    newMessages: true,
    emailNotifications: true,
    desktopNotifications: false,
    soundEnabled: true,
  });
  const [theme, setTheme] = useState<ThemePreference>('dark');
  const [language, setLanguage] = useState('es');

  useEffect(() => {
    const storedUser = getLoggedUser() as Partial<AuthUser> | null;
    if (storedUser) {
      setLoggedUser(storedUser as AuthUser);
    }

    setTheme(getThemePreference());
  }, []);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleSaveProfile = () => {
    toast.success('Perfil actualizado correctamente');
  };

  const handlePhotoUpload = () => {
    toast.info('Función de carga de foto no disponible en demo');
  };

  const handleLogout = () => {
    clearAuthSession();
    toast.success('Sesión cerrada correctamente');
    navigate('/login');
  };

  const handleThemeChange = (value: string) => {
    const nextTheme = value as ThemePreference;
    setTheme(nextTheme);
    setThemePreference(nextTheme);
  };

  const statusOptions = [
    { value: 'active', label: 'Activo', color: 'bg-green-500' },
    { value: 'away', label: 'Ausente', color: 'bg-yellow-500' },
    { value: 'busy', label: 'Ocupado', color: 'bg-red-500' },
    { value: 'offline', label: 'Desconectado', color: 'bg-gray-500' },
  ];

  return (
    <div className="h-full bg-body overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-4xl mx-auto pb-20">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Configuración</h1>
          <p className="text-gray-400 text-sm">Gestiona tu perfil y preferencias</p>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-card rounded-lg p-6">
            <h2 className="text-white font-medium mb-4 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Información del Perfil
            </h2>

            <div className="flex flex-col md:flex-row gap-6">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <Avatar className="h-24 w-24">
                  <AvatarFallback className="bg-primary text-2xl">
                    {loggedUser ? getInitials(loggedUser.firstname + ' ' + loggedUser.lastname) : ''}
                  </AvatarFallback>
                </Avatar>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePhotoUpload}
                  className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Cambiar foto
                </Button>
              </div>

              {/* Form */}
              <div className="flex-1 space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Nombre</Label>
                    <Input
                      value={loggedUser?.firstname ?? ''}
                      className="bg-body border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Apellido</Label>
                    <Input
                      type="text"
                      value={loggedUser?.lastname ?? ''}
                      //onChange={(e) => setLoggedUser({ ...loggedUser, lastname: e.target.value })}
                      className="bg-body border-gray-600 text-white"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Email</Label>
                    <Input
                      type="email"
                      value={loggedUser?.email ?? ''}
                      //onChange={(e) => setLoggedUser({ ...loggedUser, email: e.target.value })}
                      className="bg-body border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Rol</Label>
                    <Input
                      value={loggedUser?.role ?? ''}
                      //onChange={(e) => setLoggedUser({ ...loggedUser, role: e.target.value })}
                      className="bg-body border-gray-600 text-white"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-gray-300">Estado</Label>
                  <Select
                    //value={loggedUser.status}
                    //onValueChange={(value: any) => setLoggedUser({ ...loggedUser, status: value })}
                  >
                    <SelectTrigger className="bg-body border-gray-600 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${option.color}`} />
                            {option.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleSaveProfile}
                  className="w-full md:w-auto"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Guardar cambios
                </Button>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="bg-card rounded-lg p-6">
            <h2 className="text-white font-medium mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificaciones
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Nuevos mensajes</p>
                  <p className="text-sm text-gray-400">Recibe notificaciones de nuevos chats</p>
                </div>
                <Switch
                  checked={notifications.newMessages}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, newMessages: checked })
                  }
                />
              </div>

              <Separator className="bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Notificaciones por email</p>
                  <p className="text-sm text-gray-400">Recibe resumen diario por correo</p>
                </div>
                <Switch
                  checked={notifications.emailNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, emailNotifications: checked })
                  }
                />
              </div>

              <Separator className="bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Notificaciones de escritorio</p>
                  <p className="text-sm text-gray-400">Muestra alertas en tu sistema</p>
                </div>
                <Switch
                  checked={notifications.desktopNotifications}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, desktopNotifications: checked })
                  }
                />
              </div>

              <Separator className="bg-gray-700" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Sonidos</p>
                  <p className="text-sm text-gray-400">Reproducir sonido al recibir mensaje</p>
                </div>
                <Switch
                  checked={notifications.soundEnabled}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, soundEnabled: checked })
                  }
                />
              </div>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="bg-card rounded-lg p-6">
            <h2 className="text-white font-medium mb-4 flex items-center gap-2">
              <Moon className="h-5 w-5" />
              Apariencia
            </h2>

            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Tema</Label>
                <Select value={theme} onValueChange={handleThemeChange}>
                  <SelectTrigger className="bg-body border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dark">Oscuro</SelectItem>
                    <SelectItem value="light">Claro</SelectItem>
                    <SelectItem value="auto">Automático</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300 flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Idioma
                </Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="bg-body border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="pt">Português</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="bg-card rounded-lg p-6">
            <h2 className="text-white font-medium mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Seguridad
            </h2>

            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent border-gray-600 text-white hover:bg-gray-700"
              >
                Cambiar contraseña
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent border-gray-600 text-white hover:bg-gray-700"
              >
                Autenticación de dos factores
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent border-gray-600 text-white hover:bg-gray-700"
              >
                Dispositivos conectados
              </Button>
            </div>
          </div>

          {/* Logout Section */}
          <div className="bg-card rounded-lg p-6">
            <Button
              variant="danger"
              className="w-full text-white"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
