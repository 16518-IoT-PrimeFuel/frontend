import { Tanker } from '../domain/model/tanker.entity';
import { TankerResource } from './tanker-response';
import { BaseAssembler } from '../../shared/infrastructure/base-assembler';

export class TankerAssembler implements BaseAssembler<Tanker, TankerResource, TankerResource[]> {
  toEntitiesFromResponse(response: TankerResource[]): Tanker[] { return response.map((row) => this.toEntityFromResource(row)); }
  toEntityFromResource(resource: TankerResource): Tanker {
    return Object.assign(new Tanker({ ...resource, createdAt: '' }), { active: resource.active });
  }
  toResourceFromEntity(entity: Tanker): TankerResource { return entity as unknown as TankerResource; }
}
