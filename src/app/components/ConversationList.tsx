import { useState, useRef } from 'react';
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

const statusFilters = [
  { id: 'all', label: 'Todos', icon: null },
  { id: 'new', label: 'Nuevos', icon: MessageSquarePlus, count: 3 },
  { id: 'assigned', label: 'Asignados', icon: Filter, count: 4 },
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
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [contextMenuConv, setContextMenuConv] = useState<Conversation | null>(null);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showLabelDialog, setShowLabelDialog] = useState(false);
  const [tempAssignedAgent, setTempAssignedAgent] = useState('');
  const [tempLabel, setTempLabel] = useState('');
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const filteredConversations = conversations.filter((conv) => {
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
      navigate(`/chat/${conv.id}`);
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

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-[#2d3748] text-white">
      <div className="p-4 space-y-4">
        <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
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
                    ? 'bg-indigo-600'
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
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#1a202c]">
      <Toaster />

      {/* Context Menu Dialog */}
      <Dialog open={!!contextMenuConv} onOpenChange={() => setContextMenuConv(null)}>
        <DialogContent className="bg-[#2d3748] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Opciones de conversación</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setContextMenuConv(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
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
        <DialogContent className="bg-[#2d3748] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Asignar conversación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Selecciona un agente</Label>
              <Select value={tempAssignedAgent} onValueChange={setTempAssignedAgent}>
                <SelectTrigger className="bg-[#1a202c] border-gray-600 text-white mt-2">
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
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
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
        <DialogContent className="bg-[#2d3748] text-white border-gray-700">
          <DialogHeader>
            <DialogTitle>Agregar etiqueta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">Selecciona una etiqueta</Label>
              <Select value={tempLabel} onValueChange={setTempLabel}>
                <SelectTrigger className="bg-[#1a202c] border-gray-600 text-white mt-2">
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
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
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
        <Sidebar />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-[#2d3748] p-4 space-y-3">
          <div className="flex items-center gap-2">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-white">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 bg-[#2d3748]">
                <Sidebar />
              </SheetContent>
            </Sheet>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar chat"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1a202c] border-gray-600 text-white placeholder:text-gray-400"
              />
            </div>
          </div>

          <Select value={selectedAgent} onValueChange={setSelectedAgent}>
            <SelectTrigger className="bg-[#1a202c] border-gray-600 text-white">
              <SelectValue placeholder="Asignar a:" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.name}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
                  className="p-4 hover:bg-[#2d3748] cursor-pointer transition-colors select-none"
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
                          <Badge variant="secondary" className="bg-orange-600 text-white text-xs">
                            {conv.assignedTo}
                          </Badge>
                        )}
                        {conv.label && (
                          <Badge variant="secondary" className={`${getLabelColor(conv.label)} text-white text-xs`}>
                            {conv.label}
                          </Badge>
                        )}
                        {conv.unreadCount > 0 && (
                          <Badge variant="secondary" className="bg-indigo-600 text-white text-xs">
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
