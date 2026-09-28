import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BaseApiEndpoint } from '../../shared/infrastructure/base-api-endpoint';
import { environment } from '../../../environments/environment';
import { Delivery } from '../domain/model/delivery.entity';
import { DeliveryResource, DeliveriesResponse } from './delivery-response';
import { DeliveryAssembler } from './delivery-assembler';

const deliveriesEndpointUrl = `${environment.serverBasePath}${environment.fulfillmentDeliveriesEndpointPath}`;

export class DeliveryApiEndpoint extends BaseApiEndpoint<
  Delivery,
  DeliveryResource,
  DeliveriesResponse,
  DeliveryAssembler
> {
  constructor(http: HttpClient) {
    super(http, deliveriesEndpointUrl, new DeliveryAssembler());
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
