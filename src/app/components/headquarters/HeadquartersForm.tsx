import type { ChangeEvent, FormEvent } from 'react';
import type { CreateHeadquarterRequest } from '../../api/headquarter';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface HeadquartersFormProps {
  form: CreateHeadquarterRequest;
  loading: boolean;
  error: string | null;
  title?: string;
  submitLabel?: string;
  description?: string;
  onChange: (field: keyof CreateHeadquarterRequest, value: string) => void;
  onSubmit: () => Promise<void>;
}

export function HeadquartersForm({
  form,
  loading,
  error,
  title = 'Nueva sede',
  submitLabel = 'Crear sede',
  description = 'Crea una sede y refresca la tabla automaticamente.',
  onChange,
  onSubmit,
}: HeadquartersFormProps) {
  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof CreateHeadquarterRequest;
    onChange(field, event.target.value);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-medium text-white">{title}</h2>
        <p className="text-xs text-gray-400">{description}</p>
      </div>

      <Input
        name="name"
        value={form.name}
        onChange={handleInputChange}
        placeholder="Nombre"
        className="border-orange-700"
        required
      />
      <Input
        name="phone"
        value={form.phone ?? ''}
        onChange={handleInputChange}
        placeholder="Telefono"
        className="border-orange-700"
      />
      <Input
        name="location"
        value={form.location ?? ''}
        onChange={handleInputChange}
        placeholder="Ubicacion"
        className="border-orange-700"
      />

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Guardando...' : submitLabel}
      </Button>

      {error ? (
        <div className="rounded-md border border-red-700/60 bg-red-950/20 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      ) : null}
    </form>
  );
}
