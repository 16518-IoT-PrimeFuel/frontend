import { Notification } from '../domain/model/notification.entity';
import { NotificationResource } from './notification-response';

export class NotificationAssembler {
  toEntity(resource: NotificationResource): Notification {
    return new Notification(resource.id, resource.userId, resource.type, resource.title,
      resource.message, resource.read, resource.referenceId, resource.createdAt);
  }
}
