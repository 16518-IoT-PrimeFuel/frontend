import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { BaseApiEndpoint } from '../../shared/infrastructure/base-api-endpoint';
import { environment } from '../../../environments/environment';
import { Tanker } from '../domain/model/tanker.entity';
import { TankerResource } from './tanker-response';
import { TankerAssembler } from './tanker-assembler';

export class TankerApiEndpoint extends BaseApiEndpoint<Tanker, TankerResource, TankerResource[], TankerAssembler> {
  constructor(http: HttpClient) {
    super(http, `${environment.serverBasePath}/tankers`, new TankerAssembler());
  }

  list(eligible = false): Observable<Tanker[]> {
    return this.http.get<TankerResource[]>(`${this.endpointUrl}${eligible ? '/eligible' : ''}`).pipe(
      map((rows) => rows.map((row) => this.assembler.toEntityFromResource(row))),
      catchError(this.handleError('Failed to load tankers')),
    );
  }

  get(id: number): Observable<Tanker> {
    return this.http.get<TankerResource>(`${this.endpointUrl}/${id}`).pipe(
      map((row) => this.assembler.toEntityFromResource(row)),
      catchError(this.handleError(`Failed to load tanker ${id}`)),
    );
  }

  save(body: Partial<Tanker>, id?: number): Observable<Tanker> {
    const request = { licensePlate: body.licensePlate, brand: body.brand, model: body.model,
      capacity: body.capacity, unit: body.unit, status: body.status };
    const call = id ? this.http.put<TankerResource>(`${this.endpointUrl}/${id}`, request)
      : this.http.post<TankerResource>(this.endpointUrl, request);
    return call.pipe(map((row) => this.assembler.toEntityFromResource(row)),
      catchError(this.handleError('Failed to save tanker')));
  }

  eligibility(id: number): Observable<{ outcome: string; reason: string }> {
    return this.http.get<{ outcome: string; reason: string }>(`${this.endpointUrl}/${id}/eligibility`)
      .pipe(catchError(this.handleError(`Failed to check tanker eligibility ${id}`, true)));
  }

  setActive(id: number, active: boolean): Observable<Tanker> {
    return this.http.post<TankerResource>(`${this.endpointUrl}/${id}/${active ? 'activate' : 'deactivate'}`, {}).pipe(
      map((row) => this.assembler.toEntityFromResource(row)),
      catchError(this.handleError(`Failed to ${active ? 'activate' : 'deactivate'} tanker ${id}`)),
    );
  }
}
