export interface User {
  id: string;
  name: string;
  avatar: string;
}

export interface LoggedUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  phone: string;
  role: string;
  status: 'active' | 'away' | 'busy' | 'offline';
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  startTime: string;
  endTime: string;
  type: 'meeting' | 'task' | 'reminder';
  contactId?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: 'contact' | 'agent';
  content: string;
  timestamp: Date;
}

export interface Conversation {
  id: string;
  contactName: string;
  contactAvatar: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  status: 'new' | 'assigned' | 'starred' | 'closed' | 'deleted' | 'draft';
  assignedTo?: string;
  label?: 'demorado' | 'escalado' | 'cancelado';
  channel: 'whatsapp' | 'facebook' | 'instagram' | 'email';
}

export const agents: User[] = [
  { id: '1', name: 'Dweb Widget_ES_F', avatar: '' },
  { id: '2', name: 'Dweb Widget_PT', avatar: '' },
  { id: '3', name: 'Ana García', avatar: '' },
  { id: '4', name: 'Carlos Ruiz', avatar: '' },
];

export const loggedUser: LoggedUser = {
  id: 'logged-1',
  name: 'Ana García',
  email: 'ana.garcia@empresa.com',
  avatar: '',
  phone: '+1 234 567 890',
  role: 'Agente Senior',
  status: 'active',
};

export const calendarEvents: CalendarEvent[] = [
  {
    id: 'e1',
    title: 'Reunión con cliente María González',
    description: 'Seguimiento de caso',
    date: new Date('2026-02-26T10:00:00'),
    startTime: '10:00',
    endTime: '11:00',
    type: 'meeting',
    contactId: '1',
  },
  {
    id: 'e2',
    title: 'Revisar casos pendientes',
    description: 'Verificar todos los casos sin asignar',
    date: new Date('2026-02-26T14:00:00'),
    startTime: '14:00',
    endTime: '15:00',
    type: 'task',
  },
  {
    id: 'e3',
    title: 'Llamar a Pedro Santos',
    description: 'Seguimiento de solicitud',
    date: new Date('2026-02-27T09:00:00'),
    startTime: '09:00',
    endTime: '09:30',
    type: 'reminder',
    contactId: '2',
  },
  {
    id: 'e4',
    title: 'Capacitación equipo',
    description: 'Nuevas funcionalidades del sistema',
    date: new Date('2026-02-27T16:00:00'),
    startTime: '16:00',
    endTime: '17:30',
    type: 'meeting',
  },
  {
    id: 'e5',
    title: 'Revisar reportes mensuales',
    description: 'Análisis de métricas de febrero',
    date: new Date('2026-02-28T11:00:00'),
    startTime: '11:00',
    endTime: '12:00',
    type: 'task',
  },
];

export const conversations: Conversation[] = [
  {
    id: '1',
    contactName: 'María González',
    contactAvatar: '',
    lastMessage: 'Hola — soy el asistente de Chatbot',
    timestamp: new Date('2026-02-26T09:16:00'),
    unreadCount: 0,
    status: 'new',
    assignedTo: 'Dweb Widget_ES_F',
    channel: 'whatsapp',
  },
  {
    id: '2',
    contactName: 'Pedro Santos',
    contactAvatar: '',
    lastMessage: 'ads',
    timestamp: new Date('2026-02-26T17:27:00'),
    unreadCount: 1,
    status: 'assigned',
    assignedTo: 'Dweb Widget_PT',
    channel: 'facebook',
  },
  {
    id: '3',
    contactName: 'Laura Martínez',
    contactAvatar: '',
    lastMessage: '¿Tienen disponibilidad para mañana?',
    timestamp: new Date('2026-02-26T14:30:00'),
    unreadCount: 2,
    status: 'new',
    label: 'demorado',
    channel: 'instagram',
  },
  {
    id: '4',
    contactName: 'Juan Pérez',
    contactAvatar: '',
    lastMessage: 'Gracias por la información',
    timestamp: new Date('2026-02-26T11:45:00'),
    unreadCount: 0,
    status: 'assigned',
    assignedTo: 'Ana García',
    label: 'escalado',
    channel: 'whatsapp',
  },
  {
    id: '5',
    contactName: 'Sofia Rodríguez',
    contactAvatar: '',
    lastMessage: 'Necesito cambiar mi pedido',
    timestamp: new Date('2026-02-26T10:20:00'),
    unreadCount: 3,
    status: 'new',
    channel: 'email',
  },
  {
    id: '6',
    contactName: 'Diego López',
    contactAvatar: '',
    lastMessage: 'Ok, perfecto',
    timestamp: new Date('2026-02-25T16:00:00'),
    unreadCount: 0,
    status: 'starred',
    assignedTo: 'Carlos Ruiz',
    channel: 'whatsapp',
  },
];

export const messages: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1',
      conversationId: '1',
      sender: 'contact',
      content: 'Hola, necesito información sobre sus servicios',
      timestamp: new Date('2026-02-26T09:10:00'),
    },
    {
      id: 'm2',
      conversationId: '1',
      sender: 'agent',
      content: 'Hola — soy el asistente de Chatbot',
      timestamp: new Date('2026-02-26T09:16:00'),
    },
  ],
  '2': [
    {
      id: 'm3',
      conversationId: '2',
      sender: 'contact',
      content: 'ads',
      timestamp: new Date('2026-02-26T17:27:00'),
    },
  ],
  '3': [
    {
      id: 'm4',
      conversationId: '3',
      sender: 'contact',
      content: '¿Tienen disponibilidad para mañana?',
      timestamp: new Date('2026-02-26T14:30:00'),
    },
  ],
  '4': [
    {
      id: 'm5',
      conversationId: '4',
      sender: 'contact',
      content: '¿Cuál es el precio del producto X?',
      timestamp: new Date('2026-02-26T11:30:00'),
    },
    {
      id: 'm6',
      conversationId: '4',
      sender: 'agent',
      content: 'El precio del producto X es $299',
      timestamp: new Date('2026-02-26T11:35:00'),
    },
    {
      id: 'm7',
      conversationId: '4',
      sender: 'contact',
      content: 'Gracias por la información',
      timestamp: new Date('2026-02-26T11:45:00'),
    },
  ],
  '5': [
    {
      id: 'm8',
      conversationId: '5',
      sender: 'contact',
      content: 'Hola, hice un pedido ayer',
      timestamp: new Date('2026-02-26T10:15:00'),
    },
    {
      id: 'm9',
      conversationId: '5',
      sender: 'contact',
      content: 'Necesito cambiar mi pedido',
      timestamp: new Date('2026-02-26T10:20:00'),
    },
  ],
  '6': [
    {
      id: 'm10',
      conversationId: '6',
      sender: 'agent',
      content: 'Tu pedido está listo para envío',
      timestamp: new Date('2026-02-25T15:50:00'),
    },
    {
      id: 'm11',
      conversationId: '6',
      sender: 'contact',
      content: 'Ok, perfecto',
      timestamp: new Date('2026-02-25T16:00:00'),
    },
  ],
};