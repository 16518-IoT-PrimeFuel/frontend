import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Tanker } from '../domain/model/tanker.entity';
import { Driver } from '../domain/model/driver.entity';

import { TankerApiEndpoint } from './tanker-api-endpoint';
import { DriverApiEndpoint } from './driver-api-endpoint';
import { DeliveryApiEndpoint } from './delivery-api-endpoint';

/**
 * @summary API gateway para el bounded context Fulfillment.
 * @remarks Agrega TankerApiEndpoint, DriverApiEndpoint y DeliveryApiEndpoint.
 * El distribuidor lo deriva el backend del token, por eso ningún método recibe providerId.
 * @author FullTank Platform
 */
@Injectable({ providedIn: 'root' })
export class FulfillmentApi {
  private readonly _tankerEndpoint: TankerApiEndpoint;
  private readonly _driverEndpoint: DriverApiEndpoint;
  private readonly _deliveryEndpoint: DeliveryApiEndpoint;

  constructor(http: HttpClient) {
    this._tankerEndpoint = new TankerApiEndpoint(http);
    this._driverEndpoint = new DriverApiEndpoint(http);
    this._deliveryEndpoint = new DeliveryApiEndpoint(http);
  }

  // ── Tankers ──────────────────────────────────────────────────────────────
  getTankers(): Observable<Tanker[]> { return this._tankerEndpoint.list(); }
  getEligibleTankers(): Observable<Tanker[]> { return this._tankerEndpoint.list(true); }
  getTankerById(id: number): Observable<Tanker> { return this._tankerEndpoint.get(id); }
  registerTanker(request: Omit<Tanker, 'id' | 'providerId' | 'createdAt'>): Observable<Tanker> { return this._tankerEndpoint.save(request); }
  updateTanker(id: number, request: Partial<Omit<Tanker, 'id' | 'providerId' | 'createdAt'>>): Observable<Tanker> { return this._tankerEndpoint.save(request, id); }
  updateTankerStatus(id: number, request: Pick<Tanker, 'status'>): Observable<Tanker> { return this._tankerEndpoint.setActive(id, request.status !== 'INACTIVE'); }

  // ── Drivers ──────────────────────────────────────────────────────────────
  getDrivers(): Observable<Driver[]> { return this._driverEndpoint.list(); }
  getEligibleDrivers(): Observable<Driver[]> { return this._driverEndpoint.list(true); }
  getDriverById(id: number): Observable<Driver> { return this._driverEndpoint.get(id); }
  registerDriver(request: Omit<Driver, 'id' | 'providerId' | 'createdAt'>): Observable<Driver> { return this._driverEndpoint.save(request); }
  updateDriver(id: number, request: Partial<Omit<Driver, 'id' | 'providerId' | 'createdAt'>>): Observable<Driver> { return this._driverEndpoint.save(request, id); }
  updateDriverStatus(id: number, request: Pick<Driver, 'status'>): Observable<Driver> { return this._driverEndpoint.setActive(id, request.status !== 'INACTIVE'); }
  checkDriverEligibility(id: number) { return this._driverEndpoint.eligibility(id); }

  // ── Deliveries ───────────────────────────────────────────────────────────
  delivery(id: number) { return this._deliveryEndpoint.detail(id); }
  tracking(id: number) { return this._deliveryEndpoint.tracking(id); }
  trackingSamples(id: number) { return this._deliveryEndpoint.samples(id); }
  deliveryTransitions(id: number) { return this._deliveryEndpoint.transitions(id); }
  deliveryTimeline(id: number) { return this._deliveryEndpoint.timeline(id); }
  deliveryCommand(id: number, action: string, body: object = {}) { return this._deliveryEndpoint.command(id, action, body); }
  createGeofence(id: number, body: object) { return this._deliveryEndpoint.geofence(id, body); }
  assignDelivery(body: object) { return this._deliveryEndpoint.assign(body); }
}
