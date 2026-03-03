import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Search, Filter, MessageSquarePlus, Star, Archive, Trash2, Edit, Menu, UserPlus, Tag, X } from 'lucide-react';
import { conversations, agents, type Conversation } from '../data/mockData';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Label } from './ui/label';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';
import { APP_NEW_MESSAGE_EVENT, type AppNewMessageDetail } from '../pushNotifications';
import { getAuthSession, getLoggedUser } from '../authStorage';

interface InstanceItem {
  id: number;
  description?: string;
  network?: string;
  phone?: string;
}

interface ContactApiItem {
  id: number;
  name?: string;
  phone?: string;
  label?: number;
  last_message?: string | null;
  last_message_date?: string | null;
  instance_id?: number | string;
  instance_description?: string;
  network?: string;
}

const API_URL = import.meta.env?.VITE_API_URL;

const statusByLabel: Record<number, Conversation['status']> = {
  1: 'new',
  2: 'assigned',
  3: 'starred',
  4: 'closed',
  5: 'deleted',
};

function mapContactToConversation(
  contact: ContactApiItem,
  getInstanceDescription?: (instanceId?: number | string) => string | undefined,
): Conversation {
  const labelValue = Number(contact.label);
  const mappedStatus = statusByLabel[labelValue] ?? 'draft';
  const parsedDate = contact.last_message_date ? new Date(contact.last_message_date) : new Date();
  const resolvedInstanceDescription =
    contact.instance_description ||
    getInstanceDescription?.(contact.instance_id) ||
    contact.network ||
    'whatsapp';

  return {
    id: String(contact.id),
    contactName: contact.name || contact.phone || `Contacto ${contact.id}`,
    contactAvatar: '',
    lastMessage: contact.last_message || 'Sin mensajes',
    timestamp: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
    unreadCount: mappedStatus === 'new' ? 1 : 0,
    status: mappedStatus,
    instance_description: resolvedInstanceDescription,
  };
}

const statusFilters = [
  { id: 'all', label: 'Todos', icon: null },
  { id: 'new', label: 'Nuevos', icon: MessageSquarePlus  },
  { id: 'assigned', label: 'Asignados', icon: Filter },
  { id: 'starred', label: 'Destacados', icon: Star },
  { id: 'closed', label: 'Cerrados', icon: Archive },
  { id: 'deleted', label: 'Eliminados', icon: Trash2 },
  { id: 'draft', label: 'Borradores', icon: Edit },
];

const labels = [
  { id: 'demorado', label: 'Demorado', color: 'bg-green-500' },
  { id: 'escalado', label: 'Escalado', color: 'bg-blue-500' },
  { id: 'cancelado', label: 'Cancelado', color: 'bg-orange-500' },
];

export function ConversationList() {
  const navigate = useNavigate();
  const [conversationItems, setConversationItems] = useState<Conversation[]>(conversations);
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [isCreatingChat, setIsCreatingChat] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [contextMenuConv, setContextMenuConv] = useState<Conversation | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [tempAssignedAgent, setTempAssignedAgent] = useState('');
  const [tempLabel, setTempLabel] = useState('');
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredConversations = conversationItems.filter((conv) => {
    const matchesFilter = selectedFilter === 'all' || conv.status === selectedFilter;
    const matchesSearch = conv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAgent = selectedAgent === 'all' || conv.assignedTo === selectedAgent;
    return matchesFilter && matchesSearch && matchesAgent;
  });

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getLabelColor = (label?: string) => {
    const labelObj = labels.find(l => l.id === label);
    return labelObj?.color || 'bg-gray-500';
  };

  const handleLongPressStart = (conv: Conversation) => {
    longPressTimer.current = setTimeout(() => {
      setContextMenuConv(conv);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, conv: Conversation) => {
    e.preventDefault();
    setContextMenuConv(conv);
  };

  const handleConversationClick = (conv: Conversation) => {
    if (!contextMenuConv) {
      navigate(`/chat/${conv.id}`, {
        state: {
          contactName: conv.contactName,
          //channel: conv.channel,
        },
      });
    }
  };

  const handleAssignUser = () => {
    setShowAssignDialog(true);
  };

  const handleConfirmAssign = () => {
    if (tempAssignedAgent && contextMenuConv) {
      toast.success(`Conversación asignada a ${tempAssignedAgent}`);
      setShowAssignDialog(false);
      setContextMenuConv(null);
      setTempAssignedAgent('');
    }
  };

  const handleAddLabel = () => {
    setShowLabelDialog(true);
  };

  const handleConfirmLabel = () => {
    if (tempLabel && contextMenuConv) {
      toast.success(`Etiqueta "${tempLabel}" agregada`);
      setShowLabelDialog(false);
      setContextMenuConv(null);
      setTempLabel('');
    }
  };

  const handleCloseConversation = () => {
    if (contextMenuConv) {
      toast.success('Conversación cerrada');
      setContextMenuConv(null);
    }
  };

  const handleDeleteConversation = () => {
    if (contextMenuConv) {
      toast.success('Conversación eliminada');
      setContextMenuConv(null);
    }
  };

  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [contactName, setContactName] = useState('');

  const getInstanceDescription = (instanceId?: number | string) => {
    if (instanceId === undefined || instanceId === null || instanceId === '') {
      return undefined;
    }

    const foundInstance = instances.find((instance) => String(instance.id) === String(instanceId));
    return foundInstance?.description || foundInstance?.network;
  };

  useEffect(() => {
    const handleNewMessage = (event: Event) => {
      const customEvent = event as CustomEvent<AppNewMessageDetail>;
      const payload = customEvent.detail;

      setConversationItems((prev) => {
        const now = new Date(payload.timestamp);
        const existing = prev.find((conversation) => conversation.id === payload.conversationId);

        if (!existing) {
          const newConversation: Conversation = {
            id: payload.conversationId,
            contactName: payload.contactName ?? 'Nuevo contacto',
            contactAvatar: '',
            lastMessage: payload.content,
            timestamp: Number.isNaN(now.getTime()) ? new Date() : now,
            unreadCount: payload.sender === 'contact' ? 1 : 0,
            status: 'new',
            instance_description: payload.channel ?? 'whatsapp',
          };

          return [newConversation, ...prev];
        }

        const updatedConversation: Conversation = {
          ...existing,
          lastMessage: payload.content,
          timestamp: Number.isNaN(now.getTime()) ? new Date() : now,
          unreadCount: payload.sender === 'contact' ? existing.unreadCount + 1 : existing.unreadCount,
          instance_description: payload.channel ?? existing.instance_description,
        };

        return [updatedConversation, ...prev.filter((conversation) => conversation.id !== existing.id)];
      });
    };

    window.addEventListener(APP_NEW_MESSAGE_EVENT, handleNewMessage);
    return () => {
      window.removeEventListener(APP_NEW_MESSAGE_EVENT, handleNewMessage);
    };
  }, []);

  useEffect(() => {
    const loadInstances = async () => {
      if (!API_URL) {
        return;
      }

      const token = getAuthSession()?.accessToken;
      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/instance`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const parsedInstances = Array.isArray(data) ? data : [];
        setInstances(parsedInstances);

        if (parsedInstances.length > 0) {
          setSelectedInstance(String(parsedInstances[0].id));
        }
      } catch {
        toast.error('No se pudieron cargar las instancias');
      }
    };

    void loadInstances();
  }, []);

  useEffect(() => {
    const loadContacts = async () => {
      if (!API_URL) {
        return;
      }

      const token = getAuthSession()?.accessToken;
      const loggedUser = getLoggedUser() as { customerId?: number; customer_id?: number; id?: number } | null;
      const customerId = loggedUser?.customerId ?? loggedUser?.customer_id ?? loggedUser?.id;

      if (!token || !customerId) {
        return;
      }

      try {
        const response = await fetch(`${API_URL}/contact?customerId=${customerId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          toast.error('No se pudieron cargar los contactos');
          return;
        }

        const data = await response.json();
        const parsedContacts: ContactApiItem[] = Array.isArray(data) ? data : [];
        setConversationItems(parsedContacts.map((contact) => mapContactToConversation(contact, getInstanceDescription)));
      } catch {
        toast.error('No se pudieron cargar los contactos');
      }
    };

    void loadContacts();
  }, [instances]);

  useEffect(() => {
    if (!selectedContactId || selectedContactId === 'none') {
      return;
    }

    const selectedConversation = conversationItems.find((conversation) => conversation.id === selectedContactId);
    if (selectedConversation) {
      setContactName(selectedConversation.contactName);
    }
  }, [selectedContactId, conversationItems]);

  const handleStartChat = async () => {
    if (!API_URL) {
      toast.error('VITE_API_URL no está configurada');
      return;
    }

    if (selectedContactId && selectedContactId !== 'none') {
      const selectedConversation = conversationItems.find((conversation) => conversation.id === selectedContactId);

      if (!selectedConversation) {
        toast.error('No se encontró el contacto seleccionado');
        return;
      }

      setShowNewChatModal(false);
      setPhone('');
      setContactName('');
      setSelectedContactId('none');
      navigate(`/chat/${selectedConversation.id}`, {
        state: {
          contactName: selectedConversation.contactName,
          channel: selectedConversation.channel,
        },
      });
      return;
    }

    if (!selectedInstance || !phone.trim() || !contactName.trim()) {
      toast.error('Completa instancia, teléfono y nombre');
      return;
    }

    const token = getAuthSession()?.accessToken;
    if (!token) {
      toast.error('Tu sesión expiró. Inicia sesión nuevamente');
      return;
    }

    const loggedUser = getLoggedUser() as {
      seat_id?: number;
      seatId?: number;
      customerId?: number;
      customer_id?: number;
      id?: number;
    } | null;
    const seatId = loggedUser?.seat_id ?? loggedUser?.seatId ?? loggedUser?.id;
    const customerId = loggedUser?.customerId ?? loggedUser?.customer_id ?? loggedUser?.id;

    if (!seatId || !customerId) {
      toast.error('No se encontró seat_id/customer_id del usuario logueado');
      return;
    }

    setIsCreatingChat(true);
    try {
      const response = await fetch(`${API_URL}/contact/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer_id: customerId,
          instance_id: Number(selectedInstance),
          phone: phone.trim(),
          name: contactName.trim(),
          seat_id: seatId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        toast.error(errorData?.detail || 'No se pudo crear el contacto');
        return;
      }

      const data = await response.json();
      const newConversationId = String(data.contactId ?? crypto.randomUUID());

      const newConversation: Conversation = {
        id: newConversationId,
        contactName: contactName.trim(),
        contactAvatar: '',
        lastMessage: 'Chat iniciado',
        timestamp: new Date(),
        unreadCount: 0,
        status: 'assigned',
        instance_description: getInstanceDescription(selectedInstance) || 'whatsapp',
      };

      setConversationItems((prev) => [newConversation, ...prev]);
      toast.success(`Nuevo chat con ${contactName.trim()} creado`);
      setShowNewChatModal(false);
      setPhone('');
      setContactName('');
      setSelectedContactId('none');
      if (instances.length > 0) {
        setSelectedInstance(String(instances[0].id));
      }
      navigate(`/chat/${newConversationId}`, {
        state: {
          contactName: contactName.trim(),
          channel: 'whatsapp',
        },
      });
    } catch {
      toast.error('No se pudo conectar al servidor');
    } finally {
      setIsCreatingChat(false);
    }
  };

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-[#2f3349] text-white">
      <div className="p-4 space-y-4 mt-6">
        <Button className="w-full" onClick={() => setShowNewChatModal(true)}>
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Nuevo Chat
        </Button>

        <div className="space-y-1">
          {statusFilters.map((filter) => {
            const Icon = filter.icon;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  selectedFilter === filter.id
                    ? 'bg-primary'
                    : 'hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span className="text-sm">{filter.label}</span>
                </div>
                {filter.count && (
                  <Badge variant="secondary" className="bg-red-500 text-white">
                    {filter.count}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        <div className="pt-4 border-t border-gray-600">
          <p className="text-xs text-gray-400 mb-2 px-3">ETIQUETAS</p>
          <div className="space-y-1">
            {labels.map((label) => (
              <div
                key={label.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 rounded-lg cursor-pointer"
              >
                <div className={`w-2 h-2 rounded-full ${label.color}`} />
                <span className="text-sm">{label.label}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Nuevo Chat Modal */}
        <Dialog open={showNewChatModal} onOpenChange={setShowNewChatModal}>
          <DialogContent className="bg-[#2f3349] text-white border-gray-700 max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Chat</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300">Instancia</Label>
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger className="bg-[#25293c] border-gray-600 text-white mt-2">
                    <SelectValue placeholder="Selecciona una instancia" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((instance) => (
                      <SelectItem key={instance.id} value={String(instance.id)}>
                        {instance.description || `Instancia ${instance.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">Nombre del contacto</Label>
                <Input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white mt-2"
                />
              </div>
              <div>
                <Label className="text-gray-300">Número de teléfono</Label>
                <Input
                  type="text"
                  placeholder="Ej: +54 9 11 1234-5678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white mt-2"
                />
              </div>
              <div>
                <Label className="text-gray-300">O seleccionar contacto existente</Label>
                <Select value={selectedContactId} onValueChange={setSelectedContactId}>
                  <SelectTrigger className="bg-[#25293c] border-gray-600 text-white mt-2">
                    <SelectValue placeholder="Selecciona un contacto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguno</SelectItem>
                    {conversationItems.map((conv) => (
                      <SelectItem key={conv.id} value={conv.id}>{conv.contactName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={handleStartChat} disabled={isCreatingChat || instances.length === 0}>
                {isCreatingChat ? 'Creando...' : 'Iniciar Chat'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );

  return (
    <div className="flex h-full bg-[#25293c]">
      <Toaster />

      {/* Context Menu Dialog */}
      <Dialog open={!!contextMenuConv} onOpenChange={() => setContextMenuConv(null)}>
        <DialogContent className="bg-[#2f3349] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Opciones de conversación</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-gray-700"
              onClick={handleAssignUser}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Asignar a usuario
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-gray-700"
              onClick={handleAddLabel}
            >
              <Tag className="mr-2 h-4 w-4" />
              Agregar etiqueta
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-white hover:bg-gray-700"
              onClick={handleCloseConversation}
            >
              <Archive className="mr-2 h-4 w-4" />
              Cerrar conversación
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-red-400 hover:bg-red-900/20"
              onClick={handleDeleteConversation}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar chat
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign User Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="bg-[#2f3349] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Asignar conversación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Selecciona un agente</Label>
              <Select value={tempAssignedAgent} onValueChange={setTempAssignedAgent}>
                <SelectTrigger className="bg-[#25293c] border-gray-600 text-white mt-2">
                  <SelectValue placeholder="Selecciona un agente" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.name}>
                      {agent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 bg-transparent border-gray-600 text-white hover:bg-gray-700"
                onClick={() => {
                  setShowAssignDialog(false);
                  setTempAssignedAgent('');
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmAssign}
                disabled={!tempAssignedAgent}
              >
                Asignar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Label Dialog */}
      <Dialog open={showLabelDialog} onOpenChange={setShowLabelDialog}>
        <DialogContent className="bg-[#2f3349] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Agregar etiqueta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Selecciona una etiqueta</Label>
              <Select value={tempLabel} onValueChange={setTempLabel}>
                <SelectTrigger className="bg-[#25293c] border-gray-600 text-white mt-2">
                  <SelectValue placeholder="Selecciona una etiqueta" />
                </SelectTrigger>
                <SelectContent>
                  {labels.map((label) => (
                    <SelectItem key={label.id} value={label.id}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${label.color}`} />
                        {label.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 bg-transparent border-gray-600 text-white hover:bg-gray-700"
                onClick={() => {
                  setShowLabelDialog(false);
                  setTempLabel('');
                }}
              >
                Cancelar
              </Button>
              <Button
                className="flex-1"
                onClick={handleConfirmLabel}
                disabled={!tempLabel}
              >
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sidebar for desktop */}
      <div className="hidden md:block w-64 border-r border-gray-700">
        {renderSidebar()}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#2f3349] p-4 space-y-3">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-[#2f3349]">
                {renderSidebar()}
              </SheetContent>
            </Sheet>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#25293c] border-gray-600 text-white placeholder:text-gray-400"
              />
            </div>
          </div>

         
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>No hay conversaciones</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-700">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleConversationClick(conv)}
                  onContextMenu={(e) => handleContextMenu(e, conv)}
                  onTouchStart={() => handleLongPressStart(conv)}
                  onTouchEnd={handleLongPressEnd}
                  onMouseDown={() => handleLongPressStart(conv)}
                  onMouseUp={handleLongPressEnd}
                  onMouseLeave={handleLongPressEnd}
                  className="p-4 hover:bg-[#2f3349] cursor-pointer transition-colors select-none"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-indigo-600 text-white">
                        {getInitials(conv.contactName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-medium text-white truncate">
                          {conv.contactName}
                        </h3>
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {formatTime(conv.timestamp)}
                        </span>
                      </div>

                      <p className="text-sm text-gray-400 truncate mb-2">
                        {conv.lastMessage}
                      </p>

                      <div className="flex items-center gap-2 flex-wrap">
                        {conv.assignedTo && (
                          <Badge variant="secondary" className="bg-label-info">
                            {conv.assignedTo}
                          </Badge>
                        )}
                        {conv.label && (
                          <Badge variant="secondary" className={`${getLabelColor(conv.label)} text-white text-xs`}>
                            {conv.label}
                          </Badge>
                        )}
                        {conv.instance_description && (
                          <Badge variant="secondary" className="bg-label-success text-white text-xs">
                            {conv.instance_description}
                          </Badge>
                        )}
                        {conv.unreadCount > 0 && (
                          <Badge variant="secondary" className="bg-primary text-white text-xs">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
