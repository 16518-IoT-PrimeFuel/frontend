import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { ErrorHandlingEnabledBaseType } from '../../shared/infrastructure/error-handling-enabled-base-type';
import { environment } from '../../../environments/environment';
import { DeliveryRecommendation, ProviderDelivery, ValveObservation } from '../domain/model/provider-delivery.entity';

export class DeliveryApiEndpoint extends ErrorHandlingEnabledBaseType {
  private readonly endpointUrl = `${environment.serverBasePath}${environment.fulfillmentDeliveriesEndpointPath}`;

  constructor(private readonly http: HttpClient) { super(); }

  /** Entregas del distribuidor del token; `date` (yyyy-MM-dd) filtra por scheduledDate. */
  list(date?: string): Observable<ProviderDelivery[]> {
    const params = date ? new HttpParams().set('date', date) : undefined;
    return this.http.get<ProviderDelivery[]>(this.endpointUrl, { params })
      .pipe(catchError(this.handleError('Failed to load deliveries', true)));
  }
  recommendation(orderId: number, windowStart?: string, windowEnd?: string): Observable<DeliveryRecommendation> {
    let params = new HttpParams().set('orderId', orderId);
    if (windowStart && windowEnd) params = params.set('windowStart', windowStart).set('windowEnd', windowEnd);
    return this.http.get<DeliveryRecommendation>(`${this.endpointUrl}/recommendation`, { params })
      .pipe(catchError(this.handleError('Failed to load delivery recommendation', true)));
  }
  valveObservations(id: number): Observable<ValveObservation[]> {
    return this.http.get<ValveObservation[]>(`${this.endpointUrl}/${id}/valve-observations`)
      .pipe(catchError(this.handleError(`Failed to load valve observations ${id}`, true)));
  }
  detail(id: number): Observable<any> { return this.http.get(`${this.endpointUrl}/${id}`); }
  tracking(id: number): Observable<any> { return this.http.get(`${this.endpointUrl}/${id}/tracking`); }
  samples(id: number): Observable<any[]> { return this.http.get<any[]>(`${this.endpointUrl}/${id}/tracking/samples`); }
  transitions(id: number): Observable<any[]> { return this.http.get<any[]>(`${this.endpointUrl}/${id}/transitions`); }
  timeline(id: number): Observable<any[]> { return this.http.get<any[]>(`${this.endpointUrl}/${id}/timeline`); }
  command(id: number, action: string, body: object = {}): Observable<any> { return this.http.post(`${this.endpointUrl}/${id}/${action}`, body); }
  geofence(id: number, body: object): Observable<any> { return this.http.post(`${this.endpointUrl}/${id}/geofence-policies`, body); }
  assign(body: object): Observable<any> { return this.http.post(this.endpointUrl, body); }
}
