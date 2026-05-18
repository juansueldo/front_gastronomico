import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { Camera, Bell, Shield, Globe, Moon, LogOut, Save } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
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
import { updateStoreProfileImage } from '../api';
import { createCustomerSlug, fetchCustomerSlugs, updateCustomerSlug, type StoreSlug } from '../slugApi';

export function SettingsView() {
  const userImageInputRef = useRef<HTMLInputElement | null>(null);
  const storeImageInputRef = useRef<HTMLInputElement | null>(null);
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
  const [storeSlug, setStoreSlug] = useState<StoreSlug | null>(null);
  const [slugUrlInput, setSlugUrlInput] = useState('');
  const [slugStatusId, setSlugStatusId] = useState('1');
  const [isLoadingSlugs, setIsLoadingSlugs] = useState(false);
  const [isSavingSlug, setIsSavingSlug] = useState(false);
  const [userProfileImagePreviewUrl, setUserProfileImagePreviewUrl] = useState<string | null>(null);
  const [storeImagePreviewUrl, setStoreImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingStoreImage, setIsUploadingStoreImage] = useState(false);
  const USER_PROFILE_IMAGE_STORAGE_KEY = 'settings:user-profile-image';

  const readFileAsDataUrl = (file: File): Promise<string> => (
    new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('No se pudo leer la imagen seleccionada'));
          return;
        }

        resolve(reader.result);
      };

      reader.onerror = () => {
        reject(new Error('No se pudo leer la imagen seleccionada'));
      };

      reader.readAsDataURL(file);
    })
  );

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
      const currentSlug = slugs[0] ?? null;
      setStoreSlug(currentSlug);
      setSlugUrlInput(currentSlug?.slugUrl ?? '');
      setSlugStatusId(String(currentSlug?.statusId ?? 1));
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

    try {
      const storedProfileImage = localStorage.getItem(USER_PROFILE_IMAGE_STORAGE_KEY);
      if (storedProfileImage) {
        setUserProfileImagePreviewUrl(storedProfileImage);
      }
    } catch {
      // no-op: localStorage can fail in restricted contexts
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

  const handleUserPhotoUpload = () => {
    userImageInputRef.current?.click();
  };

  const handleStorePhotoUpload = () => {
    storeImageInputRef.current?.click();
  };

  const handleUserProfileImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen valido');
      return;
    }

    try {
      const base64Image = await readFileAsDataUrl(file);
      setUserProfileImagePreviewUrl(base64Image);
      localStorage.setItem(USER_PROFILE_IMAGE_STORAGE_KEY, base64Image);
      toast.success('Foto de perfil actualizada');
    } catch {
      toast.error('No se pudo actualizar la foto de perfil');
    } finally {
      event.target.value = '';
    }
  };

  const handleStoreImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Selecciona un archivo de imagen valido');
      return;
    }

    setIsUploadingStoreImage(true);

    try {
      const base64Image = await readFileAsDataUrl(file);
      await updateStoreProfileImage({ image: base64Image });
      setStoreImagePreviewUrl(base64Image);
      toast.success('Imagen de la tienda actualizada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la imagen de la tienda');
    } finally {
      event.target.value = '';
      setIsUploadingStoreImage(false);
    }
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

  const handleSaveSlug = async () => {
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

    setIsSavingSlug(true);

    try {
      if (storeSlug) {
        const updated = await updateCustomerSlug({
          slugId: storeSlug.id,
          slugUrl: trimmedSlug,
          statusId: parsedStatusId,
        });
        setStoreSlug(updated);
        setSlugUrlInput(updated.slugUrl);
        setSlugStatusId(String(updated.statusId));
        toast.success('Slug actualizado correctamente');
      } else {
        const created = await createCustomerSlug({
          slugUrl: trimmedSlug,
          statusId: parsedStatusId,
        });
        setStoreSlug(created);
        setSlugUrlInput(created.slugUrl);
        setSlugStatusId(String(created.statusId));
        toast.success('Slug creado correctamente');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo guardar el slug');
    } finally {
      setIsSavingSlug(false);
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
                    {userProfileImagePreviewUrl ? (
                      <AvatarImage src={userProfileImagePreviewUrl} alt="Foto de perfil del usuario" />
                    ) : null}
                    <AvatarFallback className="bg-primary text-2xl">
                      {loggedUser ? getInitials(loggedUser.firstname + ' ' + loggedUser.lastname) : ''}
                    </AvatarFallback>
                  </Avatar>
                  <input
                    ref={userImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void handleUserProfileImageSelected(event)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUserPhotoUpload}
                    className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Cambiar foto de perfil
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

          {/* Store Image Section */}
          <div className="bg-card rounded-lg p-6 space-y-4">
            <h2 className="text-white font-medium mb-1 flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Imagen de la tienda
            </h2>
            <p className="text-sm text-gray-400">
              Esta imagen se usa en el storefront público de la tienda.
            </p>

            <div className="grid gap-4 md:grid-cols-[220px_1fr]">
              <div className="space-y-3">
                <div className="h-44 w-full overflow-hidden rounded-md border border-orange-700 bg-body">
                  {storeImagePreviewUrl ? (
                    <img
                      src={storeImagePreviewUrl}
                      alt="Vista previa de la tienda"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-500">
                      Sin imagen cargada
                    </div>
                  )}
                </div>
                <input
                  ref={storeImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleStoreImageSelected(event)}
                />
                <Button
                  variant="outline"
                  onClick={handleStorePhotoUpload}
                  disabled={isUploadingStoreImage}
                  className="w-full bg-transparent border-orange-600 text-white hover:bg-gray-700"
                >
                  {isUploadingStoreImage ? 'Subiendo imagen...' : 'Subir imagen de tienda'}
                </Button>
              </div>

              <div className="rounded-md border border-orange-700 bg-body p-4">
                <p className="text-sm text-gray-300">
                  Recomendado: imagen cuadrada con buena resolución para que se vea bien en catálogo y portada.
                </p>
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
              Configura el slug público de tu tienda (uno por cuenta).
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
              <Button onClick={() => void handleSaveSlug()} disabled={isSavingSlug}>
                {isSavingSlug ? 'Guardando...' : (storeSlug ? 'Actualizar slug' : 'Crear slug')}
              </Button>
            </div>

            <div className="rounded-md border border-orange-700 bg-body p-3 space-y-2">
              {isLoadingSlugs ? (
                <p className="text-sm text-gray-400">Cargando slugs...</p>
              ) : null}

              {!isLoadingSlugs && !storeSlug ? (
                <p className="text-sm text-gray-500">Todavía no tienes slug creado</p>
              ) : null}

              {!isLoadingSlugs && storeSlug ? (() => {
                const normalizedUrl = normalizeStoreUrl(storeSlug.slugUrl);

                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-orange-700 p-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{storeSlug.slugUrl}</p>
                      <p className="text-xs text-gray-400 truncate">{normalizedUrl}</p>
                      <p className="text-xs text-gray-500">Estado: {storeSlug.statusId}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
                        onClick={() => void handleCopyStoreUrl(storeSlug.slugUrl)}
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
              })() : null}
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
