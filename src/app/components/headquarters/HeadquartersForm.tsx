import type { ChangeEvent, FormEvent } from 'react';
import type { CreateHeadquarterRequest } from '../../api/headquarter';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { DialogFormShell } from '../forms/DialogFormShell';
import { FormField } from '../forms/FormField';

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
      <DialogFormShell
        title={title}
        description={description}
        error={error}
      >
        <FormField label="Nombre">
          <Input
            name="name"
            value={form.name}
            onChange={handleInputChange}
            placeholder="Nombre"
            className="border-orange-700"
            required
          />
        </FormField>
        <FormField label="Telefono">
          <Input
            name="phone"
            value={form.phone ?? ''}
            onChange={handleInputChange}
            placeholder="Telefono"
            className="border-orange-700"
          />
        </FormField>
        <FormField label="Ubicacion">
          <Input
            name="location"
            value={form.location ?? ''}
            onChange={handleInputChange}
            placeholder="Ubicacion"
            className="border-orange-700"
          />
        </FormField>

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? 'Guardando...' : submitLabel}
        </Button>
      </DialogFormShell>
    </form>
  );
}
