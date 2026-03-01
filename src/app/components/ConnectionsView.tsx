import { FormEvent, useEffect, useState } from 'react';
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
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

  const resetForm = () => {
    setEditingConnectionId(null);
    setName('');
    setType('api');
    setEndpoint('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (connection: ConnectionItem) => {
    setEditingConnectionId(connection.id);
    setName(connection.name);
    setType(connection.type);
    setEndpoint(connection.endpoint);
    setIsModalOpen(true);
  };

  const handleSaveConnection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !endpoint.trim()) {
      toast.error('Completa nombre y endpoint de la conexión');
      return;
    }

    const normalizedName = name.trim();
    const normalizedEndpoint = endpoint.trim();

    const updatedConnections = editingConnectionId
      ? connections.map((connection) =>
          connection.id === editingConnectionId
            ? {
                ...connection,
                name: normalizedName,
                type,
                endpoint: normalizedEndpoint,
              }
            : connection,
        )
      : [
          {
            id: crypto.randomUUID(),
            name: normalizedName,
            type,
            endpoint: normalizedEndpoint,
          },
          ...connections,
        ];

    persistConnections(updatedConnections);
    setIsModalOpen(false);
    resetForm();
    toast.success(editingConnectionId ? 'Conexión actualizada' : 'Conexión registrada');
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
          <p className="text-gray-400 text-sm">Consulta y administra tus conexiones</p>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-white font-medium flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Lista de conexiones
            </h2>
            <Button onClick={openCreateModal}>
              <Plus className="h-4 w-4 mr-2" />
              Agregar conexión
            </Button>
          </div>

          {connections.length === 0 ? (
            <p className="text-gray-400 text-sm">Todavía no tienes conexiones registradas.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-transparent">
                  <TableHead className="text-gray-300">Nombre</TableHead>
                  <TableHead className="text-gray-300">Tipo</TableHead>
                  <TableHead className="text-gray-300">Endpoint</TableHead>
                  <TableHead className="text-gray-300 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow key={connection.id} className="border-gray-700 hover:bg-[#25293c]">
                    <TableCell className="text-white font-medium">{connection.name}</TableCell>
                    <TableCell className="text-gray-300 uppercase">{connection.type}</TableCell>
                    <TableCell className="text-gray-300 max-w-[360px] truncate">{connection.endpoint}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => openEditModal(connection)}
                          className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleDeleteConnection(connection.id)}
                          className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-[#2f3349] text-white border-gray-700 max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingConnectionId ? 'Editar conexión' : 'Agregar conexión'}</DialogTitle>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSaveConnection}>
              <div>
                <Label className="text-gray-300">Nombre</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white"
                  placeholder="Mi API"
                />
              </div>

              <div>
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

              <div>
                <Label className="text-gray-300">Endpoint</Label>
                <Input
                  value={endpoint}
                  onChange={(event) => setEndpoint(event.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white"
                  placeholder="https://..."
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    resetForm();
                  }}
                  className="bg-transparent border-gray-600 text-white hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button type="submit">{editingConnectionId ? 'Guardar cambios' : 'Agregar conexión'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}