export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'DISPATCHED' | 'PENDING_PAYMENT' | 'PAID' | 'IN_PROGRESS' | 'DELIVERED' | 'CANCELLED';

export interface Order {
  id: number;
  requestId: number;
  companyId: number;
  providerId: number;
  fuelProductId: number;
  equipmentId: number | null;
  requestedQuantity: number;
  totalPrice: number;
  status: OrderStatus;
  deliveryAddress: string;
  scheduledDate: string | null;
}
