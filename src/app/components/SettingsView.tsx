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
import { createCustomerSlug, fetchCustomerSlugs, type StoreSlug } from '../slugApi';

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
  const [storeSlugs, setStoreSlugs] = useState<StoreSlug[]>([]);
  const [slugUrlInput, setSlugUrlInput] = useState('');
  const [slugStatusId, setSlugStatusId] = useState('1');
  const [isLoadingSlugs, setIsLoadingSlugs] = useState(false);
  const [isCreatingSlug, setIsCreatingSlug] = useState(false);

  const normalizeStoreUrl = (rawSlug: string) => {
    const trimmed = rawSlug.trim();

    if (!trimmed) {
      return '';
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }

    return `${window.location.origin.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`;
  };

  const loadStoreSlugs = async () => {
    setIsLoadingSlugs(true);

    try {
      const slugs = await fetchCustomerSlugs();
      setStoreSlugs(slugs);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los slugs');
    } finally {
      setIsLoadingSlugs(false);
    }
  };

  useEffect(() => {
    const storedUser = getLoggedUser() as Partial<AuthUser> | null;
    if (storedUser) {
      setLoggedUser(storedUser as AuthUser);
    }

    setTheme(getThemePreference());
    void loadStoreSlugs();
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

  const handleCreateSlug = async () => {
    const trimmedSlug = slugUrlInput.trim();
    const parsedStatusId = Number(slugStatusId);

    if (!trimmedSlug) {
      toast.error('Ingresa un slug o URL publica');
      return;
    }

    if (!Number.isInteger(parsedStatusId) || parsedStatusId <= 0) {
      toast.error('Selecciona un estado valido');
      return;
    }

    setIsCreatingSlug(true);

    try {
      await createCustomerSlug({
        slugUrl: trimmedSlug,
        statusId: parsedStatusId,
      });

      toast.success('Slug creado correctamente');
      setSlugUrlInput('');
      await loadStoreSlugs();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo crear el slug');
    } finally {
      setIsCreatingSlug(false);
    }
  };

  const handleCopyStoreUrl = async (slugUrl: string) => {
    const normalizedUrl = normalizeStoreUrl(slugUrl);

    if (!normalizedUrl) {
      toast.error('No hay URL para copiar');
      return;
    }

    try {
      await navigator.clipboard.writeText(normalizedUrl);
      toast.success('URL copiada al portapapeles');
    } catch {
      toast.error('No se pudo copiar la URL');
    }
  };

  return (
    <div className="h-full bg-body overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 space-y-6">
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
                  className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
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
                      className="bg-body border-orange-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Apellido</Label>
                    <Input
                      type="text"
                      value={loggedUser?.lastname ?? ''}
                      className="bg-body border-orange-600 text-white"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-300">Email</Label>
                    <Input
                      type="email"
                      value={loggedUser?.email ?? ''}
                      className="bg-body border-orange-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300">Rol</Label>
                    <Input
                      value={loggedUser?.role ?? ''}
                      className="bg-body border-orange-600 text-white"
                    />
                  </div>
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
                  <SelectTrigger className="bg-body border-orange-600 text-white">
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
                  <SelectTrigger className="bg-body border-orange-600 text-white">
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
                className="w-full justify-start bg-transparent border-orange-600 text-white hover:bg-gray-700"
              >
                Cambiar contraseña
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent border-orange-600 text-white hover:bg-gray-700"
              >
                Autenticación de dos factores
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent border-orange-600 text-white hover:bg-gray-700"
              >
                Dispositivos conectados
              </Button>
            </div>
          </div>

          {/* Storefront Slugs Section */}
          <div className="bg-card rounded-lg p-6 space-y-4">
            <h2 className="text-white font-medium">Tienda publica</h2>
            <p className="text-sm text-gray-400">
              Crea y gestiona URLs publicas para que tus clientes hagan pedidos.
            </p>

            <div className="grid md:grid-cols-[1fr_180px_auto] gap-3">
              <Input
                value={slugUrlInput}
                onChange={(event) => setSlugUrlInput(event.target.value)}
                className="bg-body border-orange-600 text-white"
                placeholder="Ej: tienda/mi-negocio o https://pedidos.mi-negocio.com"
              />
              <Select value={slugStatusId} onValueChange={setSlugStatusId}>
                <SelectTrigger className="bg-body border-orange-600 text-white">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Activo (1)</SelectItem>
                  <SelectItem value="2">Inactivo (2)</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => void handleCreateSlug()} disabled={isCreatingSlug}>
                {isCreatingSlug ? 'Creando...' : 'Crear slug'}
              </Button>
            </div>

            <div className="rounded-md border border-orange-700 bg-body p-3 space-y-2">
              {isLoadingSlugs ? (
                <p className="text-sm text-gray-400">Cargando slugs...</p>
              ) : null}

              {!isLoadingSlugs && storeSlugs.length === 0 ? (
                <p className="text-sm text-gray-500">Aun no tienes slugs creados</p>
              ) : null}

              {!isLoadingSlugs && storeSlugs.map((slug) => {
                const normalizedUrl = normalizeStoreUrl(slug.slugUrl);

                return (
                  <div key={slug.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-orange-700 p-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{slug.slugUrl}</p>
                      <p className="text-xs text-gray-400 truncate">{normalizedUrl}</p>
                      <p className="text-xs text-gray-500">Estado: {slug.statusId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
                        onClick={() => void handleCopyStoreUrl(slug.slugUrl)}
                      >
                        Copiar URL
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => window.open(normalizedUrl, '_blank', 'noopener,noreferrer')}
                      >
                        Abrir
                      </Button>
                    </div>
                  </div>
                );
              })}
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
