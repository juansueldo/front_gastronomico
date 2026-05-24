import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { CreateHeadquarterRequest } from '../../features/headquarters';
import { Button } from '../../shared/ui/components/button';
import { Input } from '../../shared/ui/components/input';
import { searchAddressSuggestions, type AddressSuggestion } from '../../shared/services/geocoding.service';

interface HeadquartersFormProps {
  form: CreateHeadquarterRequest;
  loading: boolean;
  error: string | null;
  submitLabel?: string;
  onChange: (field: keyof CreateHeadquarterRequest, value: string | number | null) => void;
  onSubmit: () => Promise<void>;
}

export function HeadquartersForm({
  form,
  loading,
  error,
  submitLabel = 'Crear sede',
  onChange,
  onSubmit,
}: HeadquartersFormProps) {
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState(form.location ?? '');
  const abortRef = useRef<AbortController | null>(null);
  const hasValidCoordinates = Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude));

  useEffect(() => {
    if (hasValidCoordinates) {
      setSelectedAddress(form.location ?? '');
    }
  }, [form.latitude, form.longitude, form.location, hasValidCoordinates]);

  useEffect(() => {
    const query = String(form.location ?? '').trim();
    if (query.length < 4 || query === selectedAddress) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      setIsSearchingAddress(false);
      return;
    }

    setIsSearchingAddress(true);
    const timeoutId = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      void searchAddressSuggestions(query, controller.signal)
        .then((suggestions) => {
          setAddressSuggestions(suggestions);
          setShowAddressSuggestions(suggestions.length > 0);
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearchingAddress(false);
          }
        });
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [form.location, selectedAddress]);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const field = event.target.name as keyof CreateHeadquarterRequest;
    if (field === 'location') {
      setSelectedAddress('');
      onChange('latitude', null);
      onChange('longitude', null);
    }
    onChange(field, event.target.value);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void onSubmit();
  };

  const inputClass = 'h-11 rounded-lg border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)]';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-[var(--app-strong)]">Nombre</span>
        <Input
          name="name"
          value={form.name}
          onChange={handleInputChange}
          placeholder="Ej: Central"
          className={inputClass}
          required
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-[var(--app-strong)]">Teléfono</span>
        <Input
          name="phone"
          value={form.phone ?? ''}
          onChange={handleInputChange}
          placeholder="Ej: 5491154174802"
          className={inputClass}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-[var(--app-strong)]">Ubicación</span>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--app-muted)]" />
          <Input
            name="location"
            value={form.location ?? ''}
            onChange={handleInputChange}
            onFocus={() => {
              if (addressSuggestions.length > 0) setShowAddressSuggestions(true);
            }}
            onBlur={() => {
              window.setTimeout(() => setShowAddressSuggestions(false), 130);
            }}
            placeholder="Buscar dirección válida"
            className={`${inputClass} pl-9`}
            required
          />
          {showAddressSuggestions ? (
            <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-[70] max-h-56 overflow-y-auto rounded-lg border border-[var(--app-line)] bg-[var(--app-panel)] p-1 shadow-[0_18px_46px_rgb(0_0_0_/_28%)]">
              {addressSuggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange('location', suggestion.label);
                    onChange('latitude', suggestion.latitude);
                    onChange('longitude', suggestion.longitude);
                    setSelectedAddress(suggestion.label);
                    setShowAddressSuggestions(false);
                  }}
                  className="flex w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--app-strong)] transition hover:bg-[var(--app-soft)]"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]" />
                  <span>{suggestion.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <span className="text-xs text-[var(--app-muted)]">
          {isSearchingAddress
            ? 'Buscando direcciones...'
            : selectedAddress && selectedAddress === form.location && hasValidCoordinates
              ? 'Dirección seleccionada correctamente.'
              : 'Seleccioná una sugerencia para validar la ubicación.'}
        </span>
      </label>

      <input type="hidden" name="latitude" value={form.latitude ?? ''} />
      <input type="hidden" name="longitude" value={form.longitude ?? ''} />

      <Button type="submit" disabled={loading || !form.name.trim() || !form.location?.trim()} className="primary-action h-11 w-full rounded-lg">
        {loading ? 'Guardando...' : submitLabel}
      </Button>
    </form>
  );
}
