import { BaseResource } from '../../shared/infrastructure/base-response';
import { DriverStatus } from '../domain/model/driver.entity';

/**
 * @summary Resource DTO para conductores.
 * @remarks Define la estructura de respuesta del backend para conductores.
 * @author FullTank Platform
 */
export interface DriverResource extends BaseResource {
  id: number;
  providerId: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  status: DriverStatus;
  active: boolean;
}
