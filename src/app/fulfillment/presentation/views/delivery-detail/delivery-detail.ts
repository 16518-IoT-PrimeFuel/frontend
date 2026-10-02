import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FulfillmentApi } from '../../../infrastructure/fulfillment-api';
import { TranslatePipe } from '@ngx-translate/core';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { ProviderEquipmentApi, unitKey } from '../../../../equipment/infrastructure/provider-equipment.api';
import { ProviderTankReading } from '../../../../equipment/domain/model/provider-equipment.entity';
import { ValveObservation } from '../../../domain/model/provider-delivery.entity';

@Component({ selector: 'app-delivery-detail', standalone: true, imports: [FormsModule, DatePipe, DecimalPipe, TranslatePipe], templateUrl: './delivery-detail.html', styleUrl: './delivery-detail.css' })
export class DeliveryDetail {
  private readonly api = inject(FulfillmentApi);
  private readonly ordering = inject(OrderingApi);
  private readonly equipment = inject(ProviderEquipmentApi);
  protected readonly unitKey = unitKey;
  readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  readonly delivery = signal<any>(null);
  readonly tracking = signal<any>(null);
  readonly samples = signal<any[]>([]);
  readonly transitions = signal<any[]>([]);
  readonly timeline = signal<any[]>([]);
  /** null = sin cargar; [] = sin observaciones (no equivale a válvula cerrada). */
  readonly valve = signal<ValveObservation[] | null>(null);
  readonly valveError = signal(false);
  /** Última lectura del tanque asociado; null oculta la sección (eslabón faltante de la cadena orden->solicitud->tanque). */
  readonly tankReading = signal<ProviderTankReading | null>(null);
  readonly message = signal('');
  readonly loadError = signal(false);
  readonly driverName = signal('');
  readonly tankerName = signal('');
  deliveredVolume: number | null = null;
  reason = '';
  centerLatitude: number | null = null;
  centerLongitude: number | null = null;
  radiusMeters: number | null = null;
  constructor() { this.reload(); }
  reload(): void {
    this.api.delivery(this.id).subscribe({ next: x => { this.loadError.set(false); this.delivery.set(x); this.loadParties(x); this.loadTankLevel(x.orderId); }, error: () => this.loadError.set(true) });
    this.api.tracking(this.id).subscribe({ next: x => this.tracking.set(x), error: () => this.tracking.set(null) });
    this.api.trackingSamples(this.id).subscribe(x => this.samples.set(x));
    this.api.deliveryTransitions(this.id).subscribe(x => this.transitions.set(x));
    this.api.deliveryTimeline(this.id).subscribe(x => this.timeline.set(x));
    this.loadValve();
  }
  loadValve(): void {
    this.valveError.set(false);
    this.api.valveObservations(this.id).subscribe({ next: x => this.valve.set(x), error: () => { this.valve.set(null); this.valveError.set(true); } });
  }
  /** US-52: orden -> solicitud -> tanque -> última lectura. Si falta un eslabón la sección no se muestra. */
  private loadTankLevel(orderId: number): void {
    const from = new Date(Date.now() - 48 * 3_600_000).toISOString();
    this.ordering.order(orderId).subscribe({ next: o => {
      if (!o.requestId) return;
      this.ordering.request(o.requestId).subscribe({ next: r => {
        if (!r.tankId) return;
        this.equipment.readings(r.tankId, from).subscribe({ next: rows => this.tankReading.set(rows.at(-1) ?? null), error: () => undefined });
      }, error: () => undefined });
    }, error: () => undefined });
  }
  tankAgeMinutes(r: ProviderTankReading): number { return Math.max(0, Math.round((Date.now() - new Date(r.capturedAt).getTime()) / 60_000)); }
  private loadParties(d: any): void {
    this.api.getDriverById(d.driverId).subscribe({ next: x => this.driverName.set(`${x.firstName} ${x.lastName}`), error: () => this.driverName.set('') });
    this.api.getTankerById(d.vehicleId).subscribe({ next: x => this.tankerName.set(`${x.brand} ${x.model} · ${x.licensePlate}`), error: () => this.tankerName.set('') });
  }
  mapUrl(t: any): string { return `https://www.google.com/maps?q=${t.lastLatitude},${t.lastLongitude}`; }
  can(action: string): boolean {
    const state = this.delivery()?.physicalState;
    return action === 'start' ? state === 'ASSIGNED'
      : action === 'arrive' ? state === 'STARTED'
      : action === 'complete' ? ['ARRIVED','DELIVERING'].includes(state)
      : action === 'fail' || action === 'cancel' ? ['ASSIGNED','STARTED','ARRIVED','DELIVERING'].includes(state)
      : false;
  }
  command(action: string): void {
    const body = action === 'complete' ? { deliveredVolume: this.deliveredVolume } : ['fail','cancel'].includes(action) ? { reason: this.reason } : {};
    this.api.deliveryCommand(this.id, action, body).subscribe({ next: () => { this.message.set(''); this.reason = ''; this.reload(); }, error: e => this.message.set(e?.error?.message ?? 'fulfillment.command-failed') });
  }
  /** Rangos del backend (GeofencePolicy): latitud [-90, 90], longitud [-180, 180], radio > 0. */
  get latitudeInvalid(): boolean { return this.centerLatitude != null && (this.centerLatitude < -90 || this.centerLatitude > 90); }
  get longitudeInvalid(): boolean { return this.centerLongitude != null && (this.centerLongitude < -180 || this.centerLongitude > 180); }
  get radiusInvalid(): boolean { return this.radiusMeters != null && this.radiusMeters <= 0; }
  get geofenceValid(): boolean { return this.centerLatitude != null && this.centerLongitude != null && this.radiusMeters != null && !this.latitudeInvalid && !this.longitudeInvalid && !this.radiusInvalid; }
  saveGeofence(): void {
    if (!this.geofenceValid) return;
    this.api.createGeofence(this.id, { centerLatitude: this.centerLatitude, centerLongitude: this.centerLongitude, radiusMeters: this.radiusMeters! })
      .subscribe({ next: () => this.message.set('fulfillment.geofence-saved'), error: e => this.message.set(e.status === 409 ? 'fulfillment.geofence-exists' : (e?.error?.message ?? 'fulfillment.geofence-failed')) });
  }
  print(): void { window.print(); }
}
