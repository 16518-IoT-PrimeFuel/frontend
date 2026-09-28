import { BaseEntity } from '../../../shared/domain/model/base-entity';

export type NotificationType = 'ORDER_ACCEPTED' | 'ORDER_REJECTED' | 'DELIVERY_COMPLETED' | 'DELIVERY_FAILED';

export class Notification implements BaseEntity {
  constructor(
    public id: number,
    public userId: number,
    public type: NotificationType,
    public title: string,
    public message: string,
    public read: boolean,
    public referenceId: number | null,
    public createdAt: string,
  ) {}

  isOrderEvent(): boolean { return this.type.startsWith('ORDER_'); }
  isDeliveryEvent(): boolean { return this.type.startsWith('DELIVERY_'); }
}
