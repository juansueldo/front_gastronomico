import { useState } from 'react';
import { User, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

export function RegisterView() {
  const [form, setForm] = useState({
    nombre: '',
    apellido: '',
    usuario: '',
    email: '',
    storename: '',
    slug: '',
    password: '',
    agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.apellido || !form.usuario || !form.email || !form.storename || !form.slug || !form.password || !form.agree) {
      alert('Por favor completa todos los campos y acepta los términos.');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      alert('Registro exitoso');
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="h-screen bg-body flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        {/* Logo */}
        <div className='mb-4'>
          <img src="" alt="" className="h-12 mb-2" />
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
                className="bg-[#23264a] border border-[--border] text-white"
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
                className="bg-[#23264a] border border-[--border] text-white"
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
              className="bg-[#23264a] border border-[--border] text-white"
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
              className="bg-[#23264a] border border-[--border] text-white"
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
              className="bg-[#23264a] border border-[--border] text-white"
              disabled={isLoading}
            />
          </div>
          <div>
            <Label htmlFor="slug" className="text-gray-300">Slug de la tienda</Label>
            <Input
              id="slug"
              name="slug"
              type="text"
              placeholder="Slug de la tienda"
              value={form.slug}
              onChange={handleChange}
              className="bg-[#23264a] border border-[--border] text-white"
              disabled={isLoading}
            />
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
                className="pr-10 bg-[#23264a] border border-[--border] text-white"
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
              className="w-4 h-4 rounded border-orange-600 bg-[#23264a] text-orange-600 focus:ring-orange-600"
              disabled={isLoading}
            />
            <label htmlFor="agree" className="text-sm text-gray-400">
              Estoy de acuerdo con <a href="#" className="text-orange-400 underline">Política de privacidad y términos</a>
            </label>
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white font-semibold text-base py-2 rounded-lg" disabled={isLoading}>
            {isLoading ? 'Registrando...' : 'Registrate'}
          </Button>
        </form>
        <div className="text-center mt-6">
          <span className="text-gray-400 text-sm">¿Ya tiene una cuenta? </span>
          <a href='/login' className="text-orange-400 hover:text-orange-300 text-sm font-medium">Inicie sesión en su lugar</a>
        </div>
      </div>
    </div>
  );
}
