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
  phone?: string;
  lastMessage: string;
  timestamp: Date;
  unreadCount: number;
  status: 'new' | 'assigned' | 'starred' | 'closed' | 'deleted' | 'draft';
  assignedTo?: string;
  label?: 'demorado' | 'escalado' | 'cancelado';
  instance_description: string;
  instanceId?: string;
}

export const agents: User[] = [
];



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

];

export const messages: Record<string, Message[]> = {

};