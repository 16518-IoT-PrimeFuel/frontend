import { BaseResource, BaseResponse } from '../../shared/infrastructure/base-response';
import { DeliveryStatus } from '../domain/model/delivery.entity';

/**
 * @summary Resource DTO para entregas.
 * @remarks Define la estructura de respuesta del backend para entregas.
 * @author FullTank Platform
 */
export interface DeliveryResource extends BaseResource {
  id: number;
  orderId: number;
  vehicleId: number;
  driverId: number;
  status: DeliveryStatus;
  scheduledDate: string;
  actualDeliveryDate: string | null;
  notes: string;
  createdAt: string;
}

export interface DeliveriesResponse extends BaseResponse {
  deliveries: DeliveryResource[];
}
