import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { BaseApiEndpoint } from '../../shared/infrastructure/base-api-endpoint';
import { environment } from '../../../environments/environment';
import { Driver } from '../domain/model/driver.entity';
import { DriverResource } from './driver-response';
import { DriverAssembler } from './driver-assembler';

export class DriverApiEndpoint extends BaseApiEndpoint<Driver, DriverResource, DriverResource[], DriverAssembler> {
  constructor(http: HttpClient) { super(http, `${environment.serverBasePath}/drivers`, new DriverAssembler()); }
  list(eligible = false): Observable<Driver[]> {
    return this.http.get<DriverResource[]>(`${this.endpointUrl}${eligible ? '/eligible' : ''}`).pipe(
      map((rows) => rows.map((row) => this.assembler.toEntityFromResource(row))),
      catchError(this.handleError('Failed to load drivers')),
    );
  }
  get(id: number): Observable<Driver> {
    return this.http.get<DriverResource>(`${this.endpointUrl}/${id}`).pipe(
      map((row) => this.assembler.toEntityFromResource(row)), catchError(this.handleError(`Failed to load driver ${id}`)));
  }
  save(body: Partial<Driver>, id?: number): Observable<Driver> {
    const request = { userId: body.userId ?? null, firstName: body.firstName, lastName: body.lastName,
      licenseNumber: body.licenseNumber, phoneNumber: body.phoneNumber, email: body.email, status: body.status };
    const call = id ? this.http.put<DriverResource>(`${this.endpointUrl}/${id}`, request)
      : this.http.post<DriverResource>(this.endpointUrl, request);
    return call.pipe(map((row) => this.assembler.toEntityFromResource(row)), catchError(this.handleError('Failed to save driver')));
  }
  setActive(id: number, active: boolean): Observable<Driver> {
    return this.http.post<DriverResource>(`${this.endpointUrl}/${id}/${active ? 'activate' : 'deactivate'}`, {}).pipe(
      map((row) => this.assembler.toEntityFromResource(row)), catchError(this.handleError(`Failed to update driver ${id}`)));
  }
  eligibility(id: number): Observable<{ outcome: 'ELIGIBLE' | 'BUSY' | 'INELIGIBLE'; reason: string }> {
    return this.http.get<{ outcome: 'ELIGIBLE' | 'BUSY' | 'INELIGIBLE'; reason: string }>(`${this.endpointUrl}/${id}/eligibility`)
      .pipe(catchError(this.handleError(`Failed to check driver eligibility ${id}`)));
  }
}
