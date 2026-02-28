import { FormEvent, useEffect, useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

interface ConnectionItem {
  id: string;
  name: string;
  type: string;
  endpoint: string;
}

const CONNECTIONS_STORAGE_KEY = 'savedConnections';

const defaultConnections: ConnectionItem[] = [];

export function ConnectionsView() {
  const [connections, setConnections] = useState<ConnectionItem[]>(defaultConnections);
  const [name, setName] = useState('');
  const [type, setType] = useState('api');
  const [endpoint, setEndpoint] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setConnections(parsed);
    } catch {
      toast.error('No se pudieron cargar las conexiones');
    }
  }, []);

  const persistConnections = (updatedConnections: ConnectionItem[]) => {
    setConnections(updatedConnections);
    localStorage.setItem(CONNECTIONS_STORAGE_KEY, JSON.stringify(updatedConnections));
  };

  const handleRegisterConnection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !endpoint.trim()) {
      toast.error('Completa nombre y endpoint de la conexión');
      return;
    }

    const newConnection: ConnectionItem = {
      id: crypto.randomUUID(),
      name: name.trim(),
      type,
      endpoint: endpoint.trim(),
    };

    const updatedConnections = [newConnection, ...connections];
    persistConnections(updatedConnections);
    setName('');
    setEndpoint('');
    toast.success('Conexión registrada');
  };

  const handleDeleteConnection = (id: string) => {
    const updatedConnections = connections.filter((connection) => connection.id !== id);
    persistConnections(updatedConnections);
    toast.success('Conexión eliminada');
  };

  return (
    <div className="h-full bg-[#25293c] overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-4xl mx-auto pb-20">
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Conexiones</h1>
          <p className="text-gray-400 text-sm">Registra y consulta tus conexiones</p>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6 mb-6">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Registrar conexión
          </h2>

          <form className="grid md:grid-cols-4 gap-4 items-end" onSubmit={handleRegisterConnection}>
            <div className="md:col-span-1">
              <Label className="text-gray-300">Nombre</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="bg-[#25293c] border-gray-600 text-white"
                placeholder="Mi API"
              />
            </div>

            <div className="md:col-span-1">
              <Label className="text-gray-300">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-[#25293c] border-gray-600 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="database">Base de datos</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <Label className="text-gray-300">Endpoint</Label>
              <Input
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                className="bg-[#25293c] border-gray-600 text-white"
                placeholder="https://..."
              />
            </div>

            <Button type="submit" className="md:col-span-1 w-full">
              <Plus className="h-4 w-4 mr-2" />
              Agregar
            </Button>
          </form>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Lista de conexiones
          </h2>

          {connections.length === 0 ? (
            <p className="text-gray-400 text-sm">Todavía no tienes conexiones registradas.</p>
          ) : (
            <div className="space-y-3">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between gap-4 bg-[#25293c] border border-gray-700 rounded-lg p-4"
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{connection.name}</p>
                    <p className="text-sm text-gray-400 truncate">{connection.endpoint}</p>
                    <p className="text-xs text-gray-500 mt-1 uppercase">{connection.type}</p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleDeleteConnection(connection.id)}
                    className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Eliminar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}