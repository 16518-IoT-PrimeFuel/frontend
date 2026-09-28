export type DeliveryStatus = 'ASSIGNED' | 'STARTED' | 'ARRIVED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'IN_TRANSIT' | 'DELIVERED';

import { BaseEntity } from '../../../shared/domain/model/base-entity';

/**
 * @summary Entidad de dominio que representa una entrega en progreso.
 * @remarks Vincula una orden con recursos logísticos (vehículo + conductor).
 * Rastrea estado de entrega desde asignación hasta completada.
 * @author FullTank Platform
 */
export class Delivery implements BaseEntity {
  id: number;
  orderId: number;
  vehicleId: number;
  driverId: number;
  status: DeliveryStatus; // ASSIGNED, IN_TRANSIT, DELIVERED, CANCELLED
  scheduledDate: string;
  actualDeliveryDate: string | null;
  notes: string;
  createdAt: string;

  constructor(params: {
    id: number;
    orderId: number;
    vehicleId: number;
    driverId: number;
    status: DeliveryStatus;
    scheduledDate: string;
    actualDeliveryDate: string | null;
    notes: string;
    createdAt: string;
  }) {
    this.id = params.id;
    this.orderId = params.orderId;
    this.vehicleId = params.vehicleId;
    this.driverId = params.driverId;
    this.status = params.status;
    this.scheduledDate = params.scheduledDate;
    this.actualDeliveryDate = params.actualDeliveryDate;
    this.notes = params.notes;
    this.createdAt = params.createdAt;
  }
}
