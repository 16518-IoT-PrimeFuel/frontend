export type TankerStatus = 'AVAILABLE' | 'IN_ROUTE' | 'MAINTENANCE' | 'SUSPENDED' | 'INACTIVE';

import { BaseEntity } from '../../../shared/domain/model/base-entity';

/**
 * @summary Entidad de dominio que representa una cisterna (tanker) de transporte.
 * @remarks Almacena información de vehículos (camiones cisterna) disponibles
 * para entregas de combustible. Incluye capacidad, estado y datos de registro.
 * @author FullTank Platform
 */
export class Tanker implements BaseEntity {
  id: number;
  providerId: number;
  active: boolean;
  licensePlate: string;
  model: string;
  brand: string;
  capacity: number; // Capacidad en litros
  unit: string; // LITERS, GALLONS
  status: TankerStatus;
  createdAt: string;

  constructor(params: {
    id: number;
    providerId: number;
    active?: boolean;
    licensePlate: string;
    model: string;
    brand: string;
    capacity: number;
    unit: string;
    status: TankerStatus;
    createdAt: string;
  }) {
    this.id = params.id;
    this.providerId = params.providerId;
    this.active = params.active ?? true;
    this.licensePlate = params.licensePlate;
    this.model = params.model;
    this.brand = params.brand;
    this.capacity = params.capacity;
    this.unit = params.unit;
    this.status = params.status;
    this.createdAt = params.createdAt;
  }
}
