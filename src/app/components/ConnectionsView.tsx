import { FormEvent, useEffect, useState } from 'react';
import { Link2, LogIn, MessageCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../shared/ui/components/badge';
import { Button } from '../shared/ui/components/button';
import { Input } from '../shared/ui/components/input';
import { Label } from '../shared/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../shared/ui/components/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../shared/ui/components/dialog';
import { toast } from 'sonner';
import { Toaster } from '../shared/ui/components/sonner';
import { getLoggedUser } from '../core/storage/authStorage';
import { ApiError } from '../core/http/errors';
import { createInstance, listInstances, listNetworks, loginInstance } from '../features/integrations/services/connections.service';
import { connectWhatsappAccount, getCurrentMessagingAccount } from '../features/chat';
import { APP_WHATSAPP_INSTANCE_EVENT, type AppWhatsappInstanceDetail } from '../realtime';
import { type DataTableColumn, DataTable } from '../shared/ui/components/data-table';
import type {
  ConnectionItem as ApiConnectionItem,
  LoginInstanceResponse,
  NetworkOption as ApiNetworkOption,
} from '../features/integrations/services/connections.service';

interface ConnectionItem {
  id: string;
  description: string;
  network: string;
  network_name?: string;
  phone: string;
}

interface NetworkOption {
  value: string;
  label: string;
}

interface InstanceStatusItem {
  status: string;
  connected: boolean;
  updatedAt: string;
}

const defaultConnections: ConnectionItem[] = [];
const defaultNetworkOptions: NetworkOption[] = [
  { value: '1', label: 'WhatsApp' },
  { value: '2', label: 'Telegram' },
  { value: '3', label: 'Facebook Messenger' },
  { value: '4', label: 'Instagram DM' },
  { value: '5', label: 'WebWidget' },
];

export function ConnectionsView() {
  const [connections, setConnections] = useState<ConnectionItem[]>(defaultConnections);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnectionId, setEditingConnectionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [description, setDescription] = useState('');
  const [network, setNetwork] = useState(defaultNetworkOptions[0]?.value ?? '1');
  const [phone, setPhone] = useState('');
  const [networkOptions, setNetworkOptions] = useState<NetworkOption[]>(defaultNetworkOptions);
  const [loggingInstanceId, setLoggingInstanceId] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [qrInstanceId, setQrInstanceId] = useState<string | null>(null);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<string>('unknown');
  const [qrConnectionName, setQrConnectionName] = useState<string>('');
  const [instanceStatuses, setInstanceStatuses] = useState<Record<string, InstanceStatusItem>>({});
  const [isConnectingWhatsapp, setIsConnectingWhatsapp] = useState(false);

  useEffect(() => {
    const loadInstances = async () => {
      try {
        const data = await listInstances();
        const parsedInstances: ApiConnectionItem[] = Array.isArray(data) ? data : [];
        const mappedConnections: ConnectionItem[] = parsedInstances.map((item) => ({
          id: String(item.id ?? item.instanceId ?? crypto.randomUUID()),
          description: String(item.description ?? ''),
          network: String(item.network ?? ''),
          network_name: String(item.network_name ?? item.network ?? ''),
          phone: String(item.phone ?? ''),
        }));

        setConnections(mappedConnections);
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        } else {
          toast.error('No se pudieron cargar las instancias');
        }
      }
    };

    void loadInstances();
  }, []);

  useEffect(() => {
    if (connections.length === 0 || networkOptions.length === 0) {
      return;
    }

    setConnections((prev) =>
      prev.map((connection) => {
        const resolvedLabel = networkOptions.find((option) => option.value === connection.network)?.label;
        if (!resolvedLabel || connection.network_name === resolvedLabel) {
          return connection;
        }

        return {
          ...connection,
          network_name: resolvedLabel,
        };
      }),
    );
  }, [networkOptions]);

  useEffect(() => {
    const loadNetworks = async () => {
      try {
        const data = await listNetworks();
        const parsedItems: ApiNetworkOption[] = Array.isArray(data) ? data : [];

        const mappedOptions: NetworkOption[] = parsedItems
          .filter((item) => item.status === undefined || Number(item.status) === 1)
          .map((item) => {
            const optionValue = String(item.id ?? item.key ?? item.code ?? item.value ?? '').trim();
            const optionLabel = String(item.name ?? item.label ?? item.description ?? optionValue).trim();

            if (!optionValue || !optionLabel) {
              return null;
            }

            return {
              value: optionValue,
              label: optionLabel,
            };
          })
          .filter((item): item is NetworkOption => item !== null);

        if (mappedOptions.length > 0) {
          setNetworkOptions(mappedOptions);
        }
      } catch {
        // fallback a opciones locales
      }
    };

    void loadNetworks();
  }, []);

  useEffect(() => {
    const loadMessagingAccount = async () => {
      try {
        const account = await getCurrentMessagingAccount();
        if (!account) return;

        const id = account.instanceId ?? account.id;
        if (!id) return;

        setInstanceStatuses((prev) => ({
          ...prev,
          [id]: {
            status: String(account.status ?? 'unknown').toLowerCase(),
            connected: account.status === 'ready' || account.status === 'authenticated' || account.status === 'connected',
            updatedAt: new Date().toISOString(),
          },
        }));
      } catch {
        // El endpoint nuevo puede no estar disponible en instalaciones legacy.
      }
    };

    void loadMessagingAccount();
  }, []);

  useEffect(() => {
    if (networkOptions.length === 0) {
      return;
    }

    if (!networkOptions.some((option) => option.value === network)) {
      setNetwork(networkOptions[0].value);
    }
  }, [networkOptions, network]);

  useEffect(() => {
    const handleWhatsappInstanceEvent = (event: Event) => {
      const customEvent = event as CustomEvent<AppWhatsappInstanceDetail>;
      const detail = customEvent.detail;

      if (!detail || !detail.instanceId) {
        return;
      }

      const normalizedId = String(detail.instanceId);
      const normalizedStatus = String(detail.status ?? 'unknown').toLowerCase();
      const eventQr = typeof detail.payload.qrCode === 'string'
        ? detail.payload.qrCode
        : typeof detail.payload.qr === 'string'
          ? detail.payload.qr
          : null;

      setInstanceStatuses((prev) => ({
        ...prev,
        [normalizedId]: {
          status: normalizedStatus,
          connected: Boolean(detail.connected),
          updatedAt: new Date().toISOString(),
        },
      }));

      if (!qrInstanceId || normalizedId !== String(qrInstanceId)) {
        return;
      }

      const isSuccess = Boolean(detail.connected) || normalizedStatus === 'ready' || normalizedStatus === 'authenticated';
      if (eventQr) {
        setQrValue(eventQr);
        setQrStatus(normalizedStatus);
        setIsQrDialogOpen(true);
      }

      if (isSuccess) {
        setIsQrDialogOpen(false);
        setQrValue(null);
        setQrStatus('ready');
        setQrConnectionName('');
        setQrInstanceId(null);
      }
    };

    window.addEventListener(APP_WHATSAPP_INSTANCE_EVENT, handleWhatsappInstanceEvent);
    return () => {
      window.removeEventListener(APP_WHATSAPP_INSTANCE_EVENT, handleWhatsappInstanceEvent);
    };
  }, [qrInstanceId]);

  const getStatusBadge = (connection: ConnectionItem) => {
    if (!isWhatsappConnection(connection)) {
      return null;
    }

    const state = instanceStatuses[connection.id];
    if (!state) {
      return <Badge className="bg-label-secondary">Sin estado</Badge>;
    }

    if (state.connected || state.status === 'ready' || state.status === 'authenticated') {
      return <Badge className="bg-label-success">Conectado</Badge>;
    }

    if (state.status === 'qr') {
      return <Badge className="bg-label-warning">Esperando QR</Badge>;
    }

    if (state.status === 'initializing') {
      return <Badge className="bg-label-info">Inicializando</Badge>;
    }

    if (state.status === 'disconnected' || state.status === 'auth_failure' || state.status === 'error') {
      return <Badge className="bg-label-danger">Desconectado</Badge>;
    }

    return <Badge className="bg-label-secondary uppercase">{state.status}</Badge>;
  };

  const persistConnections = (updatedConnections: ConnectionItem[]) => {
    setConnections(updatedConnections);
  };

  const resetForm = () => {
    setEditingConnectionId(null);
    setDescription('');
    setNetwork(networkOptions[0]?.value ?? defaultNetworkOptions[0]?.value ?? '1');
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

    const normalizedDescription = description.trim();
    const normalizedPhone = phone.trim();
    const networkId = Number(network);

    if (!Number.isFinite(networkId) || networkId <= 0) {
      toast.error('Selecciona una red válida');
      return;
    }

    if (!editingConnectionId) {
      const loggedUser = getLoggedUser() as { customerId?: number; customer_id?: number; id?: number } | null;
      const customerId = loggedUser?.customerId ?? loggedUser?.customer_id;

      if (!customerId) {
        toast.error('No se encontró customer_id del usuario logueado');
        return;
      }

      setIsSaving(true);
      try {
        const data = await createInstance({
          customer_id: customerId,
          phone: normalizedPhone,
          description: normalizedDescription,
          network: networkId,
        });

        const selectedNetworkLabel = String(
          networkOptions.find((option) => option.value === network)?.label ?? network,
        );
        const newConnection: ConnectionItem = {
          id: String(data.id ?? data.instanceId ?? crypto.randomUUID()),
          description: normalizedDescription,
          network,
          network_name: selectedNetworkLabel,
          phone: normalizedPhone,
        };

        persistConnections([newConnection, ...connections]);
        setIsModalOpen(false);
        resetForm();
        toast.success('Conexión registrada');
        if (isWhatsappConnection(newConnection)) {
          void handleLoginInstance(newConnection);
        }
        return;
      } catch (error) {
        if (error instanceof ApiError) {
          toast.error(error.message);
        } else {
          toast.error('No se pudo conectar al servidor');
        }
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
                network_name: String(networkOptions.find((option) => option.value === network)?.label ?? ''),
                phone: normalizedPhone,
              }
            : connection,
        )
      : [
          {
            id: crypto.randomUUID(),
            description: normalizedDescription,
            network,
            network_name: String(networkOptions.find((option) => option.value === network)?.label ?? ''),
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

  const isWhatsappConnection = (connection: ConnectionItem) => {
    const networkLabel = String(connection.network_name ?? '').toLowerCase();
    return networkLabel.includes('whatsapp');
  };

  const getQrImageSrc = (qr: string) => {
    const normalized = qr.trim();

    if (!normalized) {
      return null;
    }

    if (normalized.startsWith('data:image/')) {
      return normalized;
    }

    const looksLikeBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(normalized) && normalized.length > 100;
    if (looksLikeBase64) {
      return `data:image/png;base64,${normalized.replace(/\s+/g, '')}`;
    }

    return `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(normalized)}`;
  };

  const handleLoginInstance = async (connection: ConnectionItem) => {
    setLoggingInstanceId(connection.id);
    try {
      const data: LoginInstanceResponse = await loginInstance(connection.id);

      const status = data.snapshot?.status ?? data.status ?? data.whatsapp?.status ?? 'unknown';
      const qr = data.snapshot?.qrDataUrl ?? data.snapshot?.qr ?? data.qr ?? data.whatsapp?.qr ?? null;
      const hasQr = Boolean(String(qr ?? '').trim());

      setInstanceStatuses((prev) => ({
        ...prev,
        [connection.id]: {
          status: String(status).toLowerCase(),
          connected: status === 'ready' || status === 'authenticated',
          updatedAt: new Date().toISOString(),
        },
      }));

      if (qr) {
        setQrValue(qr);
        setQrStatus(status);
        setQrConnectionName(connection.description);
        setQrInstanceId(connection.id);
        setIsQrDialogOpen(true);
      }

      toast.success(hasQr ? `Login iniciado. Estado: ${status}. QR disponible.` : `Login iniciado. Estado: ${status}.`);
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo conectar al servidor');
      }
    } finally {
      setLoggingInstanceId(null);
    }
  };

  const handleConnectWhatsappAccount = async () => {
    setIsConnectingWhatsapp(true);
    try {
      const account = await connectWhatsappAccount();
      const id = account?.instanceId ?? account?.id ?? 'messaging-account';
      const status = account?.status ?? 'connecting';
      const qr = account?.qrCode ?? null;

      setQrInstanceId(id);
      setQrStatus(status);
      setQrConnectionName(account?.displayName ?? account?.instance?.name ?? 'WhatsApp');
      setQrValue(qr);
      setIsQrDialogOpen(true);

      setInstanceStatuses((prev) => ({
        ...prev,
        [id]: {
          status: String(status).toLowerCase(),
          connected: status === 'ready' || status === 'authenticated' || status === 'connected',
          updatedAt: new Date().toISOString(),
        },
      }));

      toast.success(qr ? 'QR de WhatsApp disponible' : 'Conexión iniciada. Esperando QR de WhatsApp.');
    } catch (error) {
      if (error instanceof ApiError) {
        toast.error(error.message);
      } else {
        toast.error('No se pudo iniciar la conexión de WhatsApp');
      }
    } finally {
      setIsConnectingWhatsapp(false);
    }
  };

  const connectionColumns: DataTableColumn<ConnectionItem>[] = [
    {
      key: 'description',
      header: 'Descripción',
      accessor: (connection) => connection.description,
      sortable: true,
      className: 'text-white font-medium',
    },
    {
      key: 'network',
      header: 'Network',
      accessor: (connection) => connection.network_name ?? connection.network,
      sortable: true,
      className: 'text-gray-300 uppercase',
      cell: (connection) => (
        <div className="flex flex-col gap-2 items-start">
          <span>{connection.network_name}</span>
          {getStatusBadge(connection)}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      accessor: (connection) => connection.phone,
      sortable: true,
      className: 'text-gray-300 max-w-[360px] truncate',
    },
    {
      key: 'actions',
      header: 'Acciones',
      accessor: () => '',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (connection) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => openEditModal(connection)}
            className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            onClick={() => handleDeleteConnection(connection.id)}
            className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          {isWhatsappConnection(connection) ? (
            <Button
              variant="outline"
              onClick={() => handleLoginInstance(connection)}
              className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
              disabled={loggingInstanceId === connection.id}
            >
              <LogIn className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full bg-body overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Conexiones</h1>
          <p className="text-gray-400 text-sm">Consulta y administra tus conexiones</p>
        </div>

        <div className="bg-card rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-white font-medium flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Lista de conexiones
            </h2>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleConnectWhatsappAccount}
                disabled={isConnectingWhatsapp}
                className="border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {isConnectingWhatsapp ? 'Conectando...' : 'Conectar WhatsApp'}
              </Button>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar conexión
              </Button>
            </div>
          </div>

          <DataTable
            data={connections}
            columns={connectionColumns}
            getRowId={(connection) => connection.id}
            emptyMessage="Todavía no tienes conexiones registradas."
            searchPlaceholder="Buscar por descripción, red o teléfono"
            defaultPageSize={10}
            pageSizeOptions={[10, 25, 50]}
          />
        </div>

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] border-orange-700 bg-card text-white sm:w-[70vw] sm:!max-w-[70vw]">
            <DialogHeader>
              <DialogTitle>{editingConnectionId ? 'Editar conexión' : 'Agregar conexión'}</DialogTitle>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSaveConnection}>
              <div>
                <Label className="text-gray-300">Descripción</Label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="bg-body border-orange-600 text-white"
                  placeholder="Instancia principal"
                  disabled={isSaving}
                />
              </div>

              <div>
                <Label className="text-gray-300">Network</Label>
                <Select value={network} onValueChange={setNetwork}>
                  <SelectTrigger className="bg-body border-orange-600 text-white" disabled={isSaving}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {networkOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-gray-300">Phone</Label>
                <Input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="bg-body border-orange-600 text-white"
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
                  className="bg-transparent border-orange-600 text-white hover:bg-gray-700"
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

        <Dialog
          open={isQrDialogOpen}
          onOpenChange={(open) => {
            setIsQrDialogOpen(open);
            if (!open) {
              setQrInstanceId(null);
              setQrValue(null);
              setQrStatus('unknown');
              setQrConnectionName('');
            }
          }}
        >
          <DialogContent className="bg-card text-white border-orange-700 max-w-md">
            <DialogHeader>
              <DialogTitle>Escanea el QR de WhatsApp</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Instancia: <span className="font-medium text-white">{qrConnectionName || 'Sin nombre'}</span>
              </p>
              <p className="text-sm text-gray-300">
                Estado: <span className="font-medium text-white uppercase">{qrStatus}</span>
              </p>

              {qrValue ? (
                getQrImageSrc(qrValue) ? (
                  <div className="rounded-md border border-orange-700 bg-white p-3">
                    <img
                      src={getQrImageSrc(qrValue) ?? ''}
                      alt="QR de WhatsApp"
                      className="w-full h-auto"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border border-orange-700 bg-body p-3">
                    <p className="text-xs text-gray-300 mb-2">El backend devolvió un QR en formato texto:</p>
                    <p className="text-xs break-all text-white">{qrValue}</p>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-300">
                  La conexión está iniciada. El QR aparecerá acá cuando el backend lo emita.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setIsQrDialogOpen(false)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
