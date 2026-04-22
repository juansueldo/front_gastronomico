import React, { useEffect, useState } from 'react';
import { Headquarter, CreateHeadquarterRequest } from '../api/headquarter';
import { endpoints} from '../api/enpoints';
import { Button } from './ui/button';

export function HeadquartersView() {
  const [headquarters, setHeadquarters] = useState<Headquarter[]>([]);
  const [form, setForm] = useState<CreateHeadquarterRequest>({ name: '', phone: '', location: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHeadquarters = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await endpoints.fetchHeadquarters();
      setHeadquarters(data);
    } catch (err: any) {
      setError(err.message || 'Error al cargar sedes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHeadquarters();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await endpoints.createHeadquarter(form);
      setForm({ name: '', phone: '', location: '' });
      await loadHeadquarters();
    } catch (err: any) {
      setError(err.message || 'Error al crear sede');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='p-6'>
      <h2 className="text-xl font-bold mb-4">Sedes</h2>
      <form onSubmit={handleSubmit} className="mb-6 space-y-2">
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Nombre"
          className="border p-2 rounded w-full"
          required
        />
        <input
          name="phone"
          value={form.phone}
          onChange={handleChange}
          placeholder="Teléfono"
          className="border p-2 rounded w-full"
        />
        <input
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="Ubicación"
          className="border p-2 rounded w-full"
        />
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Crear Sede'}
        </Button>
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </form>
      <ul className="space-y-2">
        {headquarters.map((hq) => (
          <li key={hq.id} className="border p-3 rounded">
            <div className="font-semibold">{hq.name}</div>
            {hq.phone && <div>Tel: {hq.phone}</div>}
            {hq.location && <div>Ubicación: {hq.location}</div>}
          </li>
        ))}
        {headquarters.length === 0 && !loading && <li>No hay sedes registradas.</li>}
      </ul>
    </div>
  );
}
