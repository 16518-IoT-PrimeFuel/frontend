import { BaseAssembler } from '../../shared/infrastructure/base-assembler';
import { Request } from '../domain/model/request.entity';
import { RequestResource, RequestsResponse } from './requests-response';
export class RequestAssembler implements BaseAssembler<Request, RequestResource, RequestsResponse> {
  toEntityFromResource(resource: RequestResource): Request { return resource; }
  toResourceFromEntity(entity: Request): RequestResource { return entity; }
  toEntitiesFromResponse(response: RequestsResponse): Request[] { return response; }
}
