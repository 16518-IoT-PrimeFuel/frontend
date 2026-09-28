import { NotificationType } from '../domain/model/notification.entity';

export interface NotificationResource {
  id: number;
  userId: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  referenceId: number | null;
  createdAt: string;
}
