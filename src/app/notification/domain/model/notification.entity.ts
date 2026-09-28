import { BaseEntity } from '../../../shared/domain/model/base-entity';

export type NotificationType =
  | 'NEW_REQUEST' | 'REQUEST_PENDING' | 'ORDER_ACCEPTED' | 'ORDER_REJECTED' | 'ORDER_DISPATCHED' | 'ORDER_DELIVERED'
  | 'ORDER_CONFIRMED' | 'ORDER_CANCELLED' | 'DELIVERY_DISPATCHED' | 'DELIVERY_COMPLETED' | 'DELIVERY_FAILED'
  | 'PAYMENT_RECEIVED' | 'PAYMENT_COMPLETED' | 'PAYMENT_REFUNDED' | 'GENERAL';

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
  isPaymentEvent(): boolean { return this.type.startsWith('PAYMENT_'); }
  isRequestEvent(): boolean { return this.type.endsWith('_REQUEST') || this.type === 'REQUEST_PENDING'; }
}
