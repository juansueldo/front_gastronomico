import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Send, Paperclip, Smile, MoreVertical, Star, Archive, Trash2 } from 'lucide-react';
import { conversations, messages as mockMessages, agents, type Message } from '../data/mockData';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export function ChatView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const conversation = conversations.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>(mockMessages[id || ''] || []);
  const [newMessage, setNewMessage] = useState('');
  const [assignedAgent, setAssignedAgent] = useState(conversation?.assignedTo || '');

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#25293c] text-white">
        <div className="text-center">
          <p className="mb-4">Conversación no encontrada</p>
          <Button onClick={() => navigate('/')}>Volver a la lista</Button>
        </div>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: Message = {
      id: `m${Date.now()}`,
      conversationId: id || '',
      sender: 'agent',
      content: newMessage,
      timestamp: new Date(),
    };

    setMessages([...messages, message]);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: Date) => {
    const today = new Date();
    const messageDate = new Date(date);
    
    if (messageDate.toDateString() === today.toDateString()) {
      return 'Hoy';
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (messageDate.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    }
    
    return messageDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = formatDate(message.timestamp);
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {} as Record<string, Message[]>);

  return (
    <div className="flex flex-col h-screen bg-[#25293c]">
      {/* Header */}
      <div className="bg-[#2f3349] p-4 border-b border-gray-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-white shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-indigo-600 text-white">
                {getInitials(conversation.contactName)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-white truncate">
                {conversation.contactName}
              </h2>
              <p className="text-xs text-gray-400">
                {conversation.channel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Star className="mr-2 h-4 w-4" />
                  Destacar
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Archive className="mr-2 h-4 w-4" />
                  Archivar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Assignment */}
        <div className="mt-3">
          <Select value={assignedAgent} onValueChange={setAssignedAgent}>
            <SelectTrigger className="bg-[#25293c] border-gray-600 text-white">
              <SelectValue placeholder="Asignar a un agente" />
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
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {Object.entries(groupedMessages).map(([date, dateMessages]) => (
          <div key={date}>
            {/* Date separator */}
            <div className="flex items-center justify-center mb-4">
              <div className="bg-[#2f3349] px-3 py-1 rounded-full">
                <span className="text-xs text-gray-400">{date}</span>
              </div>
            </div>

            {/* Messages for this date */}
            <div className="space-y-3">
              {dateMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      message.sender === 'agent'
                        ? 'bg-primary text-white'
                        : 'bg-[#2f3349] text-white'
                    }`}
                  >
                    <p className="text-sm break-words">{message.content}</p>
                    <p
                      className={`text-xs mt-1 ${
                        message.sender === 'agent' ? 'text-indigo-200' : 'text-gray-400'
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-[#2f3349] p-4 border-t border-gray-700">
        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <div className="flex-1 bg-[#25293c] rounded-lg border border-gray-600 px-4 py-2">
            <Input
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              className="bg-transparent border-0 p-0 text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white shrink-0"
          >
            <Smile className="h-5 w-5" />
          </Button>

          <Button
            onClick={handleSendMessage}
            size="icon"
            className="shrink-0"
            disabled={!newMessage.trim()}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
