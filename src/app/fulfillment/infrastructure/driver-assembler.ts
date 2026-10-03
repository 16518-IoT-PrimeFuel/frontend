import { BaseAssembler } from '../../shared/infrastructure/base-assembler';
import { Driver } from '../domain/model/driver.entity';
import { DriverResource } from './driver-response';

/**
 * @summary Assembler para transformar conductores entre capas.
 * @remarks Convierte DriverResource ↔ Driver entity.
 * @author FullTank Platform
 */
export class DriverAssembler implements BaseAssembler<Driver, DriverResource, DriverResource[]>
{
  toEntitiesFromResponse(response: DriverResource[]): Driver[] {
    return response.map((resource) => this.toEntityFromResource(resource));
  }

  toEntityFromResource(resource: DriverResource): Driver {
    return new Driver({
      id: resource.id,
      providerId: resource.providerId,
      userId: resource.userId,
      active: resource.active,
      firstName: resource.firstName,
      lastName: resource.lastName,
      licenseNumber: resource.licenseNumber,
      phoneNumber: resource.phoneNumber,
      email: resource.email,
      status: resource.status,
      createdAt: '',
    });
  }

  toResourceFromEntity(entity: Driver): DriverResource {
    return {
      id: entity.id,
      providerId: entity.providerId,
      userId: entity.userId,
      firstName: entity.firstName,
      lastName: entity.lastName,
      licenseNumber: entity.licenseNumber,
      phoneNumber: entity.phoneNumber,
      email: entity.email,
      status: entity.status,
      active: entity.active,
    } as DriverResource;
  }
}
