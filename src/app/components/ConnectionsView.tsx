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
import { getAuthSession, getLoggedUser } from '../authStorage';

interface ConnectionItem {
  id: string;
  description: string;
  network: string;
  phone: string;
}
const API_URL = import.meta.env?.VITE_API_URL;
const CREATE_INSTANCE_PATH = import.meta.env?.VITE_INSTANCE_CREATE_PATH ?? '/instance';
const CONNECTIONS_STORAGE_KEY = 'savedConnections';

const defaultConnections: ConnectionItem[] = [];

export function ConnectionsView() {
  const [connections, setConnections] = useState<ConnectionItem[]>(defaultConnections);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [network, setNetwork] = useState('whatsapp');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(CONNECTIONS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      const normalizedConnections = Array.isArray(parsed)
        ? parsed.map((item) => ({
            id: String(item.id ?? crypto.randomUUID()),
            description: String(item.description ?? item.name ?? ''),
            network: String(item.network ?? item.type ?? 'whatsapp'),
            phone: String(item.phone ?? item.endpoint ?? ''),
          }))
        : [];
      setConnections(normalizedConnections);
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
    setDescription('');
    setNetwork('whatsapp');
    setPhone('');
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (connection: ConnectionItem) => {
    setEditingConnectionId(connection.id);
    setDescription(connection.description);
    setNetwork(connection.network);
    setPhone(connection.phone);
    setIsModalOpen(true);
  };

  const handleSaveConnection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!description.trim() || !phone.trim()) {
      toast.error('Completa descripción y teléfono de la conexión');
      return;
    }

    if (!API_URL) {
      toast.error('VITE_API_URL no está configurada');
      return;
    }

    const normalizedDescription = description.trim();
    const normalizedPhone = phone.trim();

    if (!editingConnectionId) {
      const loggedUser = getLoggedUser() as { customerId?: number; customer_id?: number; id?: number } | null;
      const customerId = loggedUser?.customerId ?? loggedUser?.customer_id ?? loggedUser?.id;

      if (!customerId) {
        toast.error('No se encontró customer_id del usuario logueado');
        return;
      }

      const authToken = getAuthSession()?.accessToken;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (authToken) {
        headers.Authorization = `Bearer ${authToken}`;
      }

      setIsSaving(true);
      try {
        const response = await fetch(`${API_URL}${CREATE_INSTANCE_PATH}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customer_id: customerId,
            phone: normalizedPhone,
            description: normalizedDescription,
            network,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          toast.error(errorData?.detail || 'No se pudo crear la conexión en backend');
          return;
        }

        const data = await response.json();
        const newConnection: ConnectionItem = {
          id: String(data.instanceId ?? crypto.randomUUID()),
          description: normalizedDescription,
          network,
          phone: normalizedPhone,
        };

        persistConnections([newConnection, ...connections]);
        setIsModalOpen(false);
        resetForm();
        toast.success('Conexión registrada');
        return;
      } catch {
        toast.error('No se pudo conectar al servidor');
        return;
      } finally {
        setIsSaving(false);
      }
    }

    const updatedConnections = editingConnectionId
      ? connections.map((connection) =>
          connection.id === editingConnectionId
            ? {
                ...connection,
                description: normalizedDescription,
                network,
                phone: normalizedPhone,
              }
            : connection,
        )
      : [
          {
            id: crypto.randomUUID(),
            description: normalizedDescription,
            network,
            phone: normalizedPhone,
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
                  <TableHead className="text-gray-300">Descripción</TableHead>
                  <TableHead className="text-gray-300">Network</TableHead>
                  <TableHead className="text-gray-300">Phone</TableHead>
                  <TableHead className="text-gray-300 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connections.map((connection) => (
                  <TableRow key={connection.id} className="border-gray-700 hover:bg-[#25293c]">
                    <TableCell className="text-white font-medium">{connection.description}</TableCell>
                    <TableCell className="text-gray-300 uppercase">{connection.network}</TableCell>
                    <TableCell className="text-gray-300 max-w-[360px] truncate">{connection.phone}</TableCell>
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
                <Label className="text-gray-300">Descripción</Label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white"
                  placeholder="Instancia principal"
                  disabled={isSaving}
                />
              </div>

              <div>
                <Label className="text-gray-300">Network</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="bg-[#25293c] border-gray-600 text-white" disabled={isSaving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="webwidget">WebWidget</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="fbmessenger">FB Messenger</SelectItem>
                    <SelectItem value="instagramdm">Instagram DM</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300">Phone</Label>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white"
                  placeholder="54911..."
                  disabled={isSaving}
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
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving ? 'Guardando...' : editingConnectionId ? 'Guardar cambios' : 'Agregar conexión'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}