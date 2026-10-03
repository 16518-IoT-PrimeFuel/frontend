export type DriverStatus = 'AVAILABLE' | 'ASSIGNED' | 'SUSPENDED' | 'INACTIVE';

import { BaseEntity } from '../../../shared/domain/model/base-entity';

/**
 * @summary Entidad de dominio que representa un conductor.
 * @remarks Almacena información de conductores autorizados para realizar
 * entregas. Incluye licencia, contacto y estado de disponibilidad.
 * @author FullTank Platform
 */
export class Driver implements BaseEntity {
  id: number;
  providerId: number;
  userId: number | null;
  active: boolean;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  status: DriverStatus; // AVAILABLE, ASSIGNED, SUSPENDED, INACTIVE
  createdAt: string;

  constructor(params: {
    id: number;
    providerId: number;
    userId?: number | null;
    active?: boolean;
    firstName: string;
    lastName: string;
    licenseNumber: string;
    phoneNumber: string;
    email: string;
    status: DriverStatus;
    createdAt: string;
  }) {
    this.id = params.id;
    this.providerId = params.providerId;
    this.userId = params.userId ?? null;
    this.active = params.active ?? true;
    this.firstName = params.firstName;
    this.lastName = params.lastName;
    this.licenseNumber = params.licenseNumber;
    this.phoneNumber = params.phoneNumber;
    this.email = params.email;
    this.status = params.status;
    this.createdAt = params.createdAt;
  }
}
