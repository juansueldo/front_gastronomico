export interface CreateNotificationRequest {
  type?: string;
  title?: string;
  body?: string;
  source?: string;
  payload?: Record<string, unknown>;
  createdAt?: number;
}

export type NotificationDto = {
  id?: string | number;
  customer_id?: number;
  type?: string;
  title?: string;
  body?: string;
  description?: string;
  message?: string;
  content?: string;
  source?: string;
  receivedAt?: string;
  received_at?: string | number;
  read_at?: string | number | null;
  readAt?: string | number | null;
  createdAt?: string | number;
  created_at?: string | number;
  read?: boolean;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};
