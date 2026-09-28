import { BaseEntity } from '../domain/model/base-entity';
import { BaseResource } from './base-response';
import { BaseAssembler } from './base-assembler';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable } from 'rxjs';
import { ErrorHandlingEnabledBaseType } from './error-handling-enabled-base-type';

/**
 * Abstract base class for FullTank API endpoints handling CRUD operations.
 * @remarks Provides common GET/POST/PUT/DELETE methods using the FullTank
 * REST API conventions. All IDs are string UUIDs. Each bounded context endpoint
 * extends this class and passes the correct assembler for entity mapping.
 * @template TEntity    - The domain entity type extending BaseEntity.
 * @template TResource  - The API resource type extending BaseResource.
 * @template TResponse  - The API response envelope type extending BaseResponse.
 * @template TAssembler - The assembler type extending BaseAssembler.
 * @author FullTank Platform
 */
export abstract class BaseApiEndpoint<
  TEntity extends BaseEntity,
  TResource extends BaseResource,
  TResponse,
  TAssembler extends BaseAssembler<TEntity, TResource, TResponse>,
> extends ErrorHandlingEnabledBaseType {
  /**
   * Creates a new BaseApiEndpoint instance.
   * @param http        - The Angular HTTP client for making requests.
   * @param endpointUrl - The fully qualified URL for the API endpoint.
   * @param assembler   - The assembler for converting between entities and resources.
   */
  protected constructor(
    protected http: HttpClient,
    protected endpointUrl: string,
    protected assembler: TAssembler,
  ) {
    super();
  }

  /**
   * Retrieves all entities from the API endpoint.
   * @returns An observable of an array of domain entities.
   */
  getAll(): Observable<TEntity[]> {
    return this.http.get<TResource[]>(this.endpointUrl).pipe(
      map((response) => response.map((resource) => this.assembler.toEntityFromResource(resource))),
      catchError(this.handleError('Failed to fetch entities')),
    );
  }

  /**
   * Retrieves a single entity by its string UUID.
   * @param id - The UUID of the entity to retrieve.
   * @returns An observable of the domain entity.
   */
  getById(id: number): Observable<TEntity> {
    return this.http.get<TResource>(`${this.endpointUrl}/${id}`).pipe(
      map((resource) => this.assembler.toEntityFromResource(resource)),
      catchError(this.handleError(`Failed to fetch entity with id ${id}`)),
    );
  }

  /**
   * Creates a new entity via POST request.
   * @param entity - The domain entity to create.
   * @returns An observable of the created domain entity.
   */
  create(entity: TEntity): Observable<TEntity> {
    const resource = this.assembler.toResourceFromEntity(entity);
    return this.http.post<TResource>(this.endpointUrl, resource).pipe(
      map((createdResource) => this.assembler.toEntityFromResource(createdResource)),
      catchError(this.handleError('Failed to create entity')),
    );
  }

  /**
   * Updates an existing entity via PUT request.
   * @param entity - The domain entity with updated values.
   * @param id     - The UUID of the entity to update.
   * @returns An observable of the updated domain entity.
   */
  update(entity: TEntity, id: number): Observable<TEntity> {
    const resource = this.assembler.toResourceFromEntity(entity);
    return this.http.put<TResource>(`${this.endpointUrl}/${id}`, resource).pipe(
      map((updatedResource) => this.assembler.toEntityFromResource(updatedResource)),
      catchError(this.handleError(`Failed to update entity with id ${id}`)),
    );
  }

  /**
   * Deletes an entity by its string UUID via DELETE request.
   * @param id - The UUID of the entity to delete.
   * @returns An observable that completes when deletion is done.
   */
  delete(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.endpointUrl}/${id}`)
      .pipe(catchError(this.handleError(`Failed to delete entity with id ${id}`)));
  }
}
