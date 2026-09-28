import { BaseEntity } from '../domain/model/base-entity';
import { BaseResource } from './base-response';

/**
 * Base assembler interface for FullTank bounded contexts.
 * @remarks Defines the contract for transforming API resources into domain
 * entities and vice versa. Each bounded context implements this interface
 * in its own assembler class using the Fluent Builder static pattern.
 * @template TEntity  - Domain entity extending BaseEntity.
 * @template TResource - API resource extending BaseResource.
 * @template TResponse - API response envelope extending BaseResponse.
 * @author FullTank Platform
 */
export interface BaseAssembler<
  TEntity extends BaseEntity,
  TResource extends BaseResource,
  TResponse,
> {
  /**
   * Converts an API resource to a domain entity.
   * @param resource - The resource received from the FullTank REST API.
   * @returns The mapped domain entity.
   */
  toEntityFromResource(resource: TResource): TEntity;

  /**
   * Converts a domain entity to an API resource for POST/PUT requests.
   * @param entity - The domain entity to serialize.
   * @returns The resource ready to be sent to the REST API.
   */
  toResourceFromEntity(entity: TEntity): TResource;

  /**
   * Converts a wrapped API response to an array of domain entities.
   * @param response - The envelope response from the REST API.
   * @returns An array of mapped domain entities.
   */
  toEntitiesFromResponse(response: TResponse): TEntity[];
}
