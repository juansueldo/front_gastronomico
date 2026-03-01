import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Send, Paperclip, Smile, MoreVertical, Star, Archive, Trash2, Check, CheckCheck } from 'lucide-react';
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
import { APP_NEW_MESSAGE_EVENT, type AppNewMessageDetail } from '../pushNotifications';

export function ChatView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversation = conversations.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>(mockMessages[id || ''] || []);
  // Simular estado de mensaje: 'sent', 'delivered', 'read'
  const [messageStatus, setMessageStatus] = useState<Record<string, 'sent' | 'delivered' | 'read'>>({});
  const [newMessage, setNewMessage] = useState('');
  const [assignedAgent, setAssignedAgent] = useState(conversation?.assignedTo || '');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const quickEmojis = ['😀', '😂', '😍', '🙏', '👍', '🎉', '❤️', '🤖'];

  useEffect(() => {
    setMessages(mockMessages[id || ''] || []);
  }, [id]);

  useEffect(() => {
    const handleIncomingMessage = (event: Event) => {
      const customEvent = event as CustomEvent<AppNewMessageDetail>;
      const payload = customEvent.detail;

      if (payload.conversationId !== id) {
        return;
      }

      setMessages((prev) => {
        if (prev.some((message) => message.id === payload.messageId)) {
          return prev;
        }

        const timestamp = new Date(payload.timestamp);
        const normalizedDate = Number.isNaN(timestamp.getTime()) ? new Date() : timestamp;

        const nextMessage: Message = {
          id: payload.messageId,
          conversationId: payload.conversationId,
          sender: payload.sender,
          content: payload.content,
          timestamp: normalizedDate,
        };

        return [...prev, nextMessage];
      });
    };

    window.addEventListener(APP_NEW_MESSAGE_EVENT, handleIncomingMessage);
    return () => {
      window.removeEventListener(APP_NEW_MESSAGE_EVENT, handleIncomingMessage);
    };
  }, [id]);

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
    const cleanedMessage = newMessage.trim();
    if (!cleanedMessage && attachedFiles.length === 0) {
      return;
    }
    const attachmentText = attachedFiles.length > 0
      ? attachedFiles.map((file) => `📎 ${file.name}`).join('\n')
      : '';
    const fullContent = [cleanedMessage, attachmentText].filter(Boolean).join('\n\n');
    const messageId = `m${Date.now()}`;
    const message: Message = {
      id: messageId,
      conversationId: id || '',
      sender: 'agent',
      content: fullContent,
      timestamp: new Date(),
    };
    setMessages([...messages, message]);
    setMessageStatus((prev) => ({ ...prev, [messageId]: 'sent' }));
    setNewMessage('');
    setAttachedFiles([]);
    setShowEmojiPicker(false);
    // Simular cambio de estado a 'delivered' y 'read'
    setTimeout(() => {
      setMessageStatus((prev) => ({ ...prev, [messageId]: 'delivered' }));
      setTimeout(() => {
        setMessageStatus((prev) => ({ ...prev, [messageId]: 'read' }));
      }, 1200);
    }, 800);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAttachFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files;
    if (!selected || selected.length === 0) {
      return;
    }

    const nextFiles = Array.from(selected);
    setAttachedFiles((prev) => [...prev, ...nextFiles]);
    event.target.value = '';
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

  const addEmoji = (emoji: string) => {
    setNewMessage((prev) => `${prev}${emoji}`);
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
              {dateMessages.map((message) => {
                const isAgent = message.sender === 'agent';
                const status = isAgent ? messageStatus[message.id] : undefined;
                return (
                  <div
                    key={message.id}
                    className={`flex w-full ${isAgent ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'} max-w-[75%]`}>
                      <div
                        className={`rounded-2xl px-4 py-2 w-fit ${
                          isAgent
                            ? 'bg-primary text-white'
                            : 'bg-[#2f3349] text-white'
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                      </div>
                      <div className={`flex items-center gap-1 mt-1 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                        <span className={`text-xs ${isAgent ? 'text-indigo-200' : 'text-gray-400'}`}>{formatTime(message.timestamp)}</span>
                        {isAgent && (
                          <span className="ml-1 flex items-center">
                            {status === 'sent' && <Check className="h-4 w-4 text-indigo-300" />}
                            {status === 'delivered' && <CheckCheck className="h-4 w-4 text-indigo-300" />}
                            {status === 'read' && <CheckCheck className="h-4 w-4 text-green-400" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-[#2f3349] p-4 border-t border-gray-700">
        {showEmojiPicker && (
          <div className="mb-3 bg-[#25293c] border border-gray-600 rounded-lg p-2 grid grid-cols-8 gap-2">
            {quickEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => addEmoji(emoji)}
                className="text-xl hover:bg-gray-700 rounded-md py-1"
                type="button"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {attachedFiles.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <button
                key={`${file.name}-${index}`}
                onClick={() => removeAttachedFile(index)}
                className="text-xs px-2 py-1 rounded-full bg-[#25293c] border border-gray-600 text-gray-300 hover:bg-gray-700"
                type="button"
              >
                {file.name} ×
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white shrink-0"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleAttachFiles}
          />

          <div className="flex-1 bg-[#25293c] rounded-lg border border-gray-600 px-4 py-2">
            <Input
              placeholder="Escribe un mensaje..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-0 p-0 text-white placeholder:text-gray-400 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white shrink-0"
            onClick={() => setShowEmojiPicker((prev) => !prev)}
            type="button"
          >
            <Smile className="h-5 w-5" />
          </Button>

          <Button
            onClick={handleSendMessage}
            size="icon"
            className="shrink-0"
            disabled={!newMessage.trim() && attachedFiles.length === 0}
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
