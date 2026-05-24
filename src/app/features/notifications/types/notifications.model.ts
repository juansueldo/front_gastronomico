export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  receivedAt: string;
  read: boolean;
}

export interface ListNotificationsParams {
  limit?: number;
  offset?: number;
}
