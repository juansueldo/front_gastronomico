import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { ApiError } from '../core/http/errors';
import { register as registerUser } from '../features/auth/services/auth.service';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import { Label } from '../shared/ui/components/label';
import { Toaster } from '../shared/ui/components/sonner';

const getDefaultTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const slugify = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export function RegisterView() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    usuario: '',
    email: '',
    storename: '',
    slug: '',
    timezone: getDefaultTimezone(),
    location: '',
    password: '',
    agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => {
      const nextValue = type === 'checkbox' ? checked : value;
      const nextForm = {
        ...prev,
        [name]: nextValue,
      };

      if (name === 'storename') {
        const shouldAutofillSlug = !prev.slug || prev.slug === slugify(prev.storename);
        if (shouldAutofillSlug) {
          nextForm.slug = slugify(String(value));
        }
      }

      if (name === 'slug') {
        nextForm.slug = slugify(String(value));
      }

      return nextForm;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedNombre = form.nombre.trim();
    const trimmedApellido = form.apellido.trim();
    const trimmedUsuario = form.usuario.trim();
    const trimmedEmail = form.email.trim();
    const trimmedStoreName = form.storename.trim();
    const trimmedSlug = form.slug.trim();
    const trimmedTimezone = form.timezone.trim();
    const trimmedLocation = form.location.trim();
    const trimmedPassword = form.password.trim();

    if (
      !trimmedNombre
      || !trimmedApellido
      || !trimmedUsuario
      || !trimmedEmail
      || !trimmedStoreName
      || !trimmedSlug
      || !trimmedPassword
    ) {
      toast.error('Completá los campos obligatorios para crear la cuenta');
      return;
    }

    if (!form.agree) {
      toast.error('Necesitás aceptar los términos para registrarte');
      return;
    }

    setIsLoading(true);

    try {
      await registerUser({
        firstname: trimmedNombre,
        lastname: trimmedApellido,
        username: trimmedUsuario,
        email: trimmedEmail,
        password: trimmedPassword,
        storename: trimmedStoreName,
        slug: trimmedSlug,
        timezone: trimmedTimezone || undefined,
        location: trimmedLocation || undefined,
      });

      toast.success('Cuenta creada. Ahora podés iniciar sesión');
      window.setTimeout(() => {
        navigate('/login');
      }, 150);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo completar el registro');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-body p-4">
      <Toaster />
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-4">
          <img src="" alt="" className="mb-2 h-12" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-transparent">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nombre" className="text-gray-300">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                type="text"
                placeholder="Ingrese su nombre"
                value={form.nombre}
                onChange={handleChange}
                className="border border-[--border] bg-[#23264a] text-white"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="apellido" className="text-gray-300">Apellido</Label>
              <Input
                id="apellido"
                name="apellido"
                type="text"
                placeholder="Ingrese su apellido"
                value={form.apellido}
                onChange={handleChange}
                className="border border-[--border] bg-[#23264a] text-white"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="usuario" className="text-gray-300">Nombre de usuario</Label>
            <Input
              id="usuario"
              name="usuario"
              type="text"
              placeholder="Ingrese su nombre de usuario"
              value={form.usuario}
              onChange={handleChange}
              className="border border-[--border] bg-[#23264a] text-white"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="email" className="text-gray-300">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Correo electrónico"
              value={form.email}
              onChange={handleChange}
              className="border border-[--border] bg-[#23264a] text-white"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="storename" className="text-gray-300">Nombre de la tienda</Label>
            <Input
              id="storename"
              name="storename"
              type="text"
              placeholder="Nombre de la tienda"
              value={form.storename}
              onChange={handleChange}
              className="border border-[--border] bg-[#23264a] text-white"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="slug" className="text-gray-300">Slug de la tienda</Label>
            <Input
              id="slug"
              name="slug"
              type="text"
              placeholder="mi-restaurante"
              value={form.slug}
              onChange={handleChange}
              className="border border-[--border] bg-[#23264a] text-white"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="timezone" className="text-gray-300">Zona horaria</Label>
              <Input
                id="timezone"
                name="timezone"
                type="text"
                placeholder="America/Argentina/Buenos_Aires"
                value={form.timezone}
                onChange={handleChange}
                className="border border-[--border] bg-[#23264a] text-white"
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="location" className="text-gray-300">Ubicación</Label>
              <Input
                id="location"
                name="location"
                type="text"
                placeholder="Montevideo"
                value={form.location}
                onChange={handleChange}
                className="border border-[--border] bg-[#23264a] text-white"
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-gray-300">Contraseña</Label>
            <div className="relative mt-2">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                className="border border-[--border] bg-[#23264a] pr-10 text-white"
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-400"
                tabIndex={-1}
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="agree"
              name="agree"
              checked={form.agree}
              onChange={handleChange}
              className="h-4 w-4 rounded border-orange-600 bg-[#23264a] text-orange-600 focus:ring-orange-600"
              disabled={isLoading}
            />
            <label htmlFor="agree" className="text-sm text-gray-400">
              Estoy de acuerdo con <a href="#" className="text-orange-400 underline">Política de privacidad y términos</a>
            </label>
          </div>

          <Button
            type="submit"
            className="w-full rounded-lg bg-primary py-2 text-base font-semibold text-white hover:bg-primary/90"
            disabled={isLoading}
          >
            {isLoading ? 'Registrando...' : 'Registrate'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <span className="text-sm text-gray-400">¿Ya tiene una cuenta? </span>
          <a href="/login" className="text-sm font-medium text-orange-400 hover:text-orange-300">Inicie sesión en su lugar</a>
        </div>
      </div>
    </div>
  );
}
