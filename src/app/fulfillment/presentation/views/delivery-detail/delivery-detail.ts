import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { FulfillmentApi } from '../../../infrastructure/fulfillment-api';
import { TranslatePipe } from '@ngx-translate/core';

@Component({ selector: 'app-delivery-detail', standalone: true, imports: [FormsModule, DatePipe, TranslatePipe], templateUrl: './delivery-detail.html', styleUrl: './delivery-detail.css' })
export class DeliveryDetail {
  private readonly api = inject(FulfillmentApi);
  readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  readonly delivery = signal<any>(null);
  readonly tracking = signal<any>(null);
  readonly samples = signal<any[]>([]);
  readonly transitions = signal<any[]>([]);
  readonly timeline = signal<any[]>([]);
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
    this.api.delivery(this.id).subscribe({ next: x => { this.loadError.set(false); this.delivery.set(x); this.loadParties(x); }, error: () => this.loadError.set(true) });
    this.api.tracking(this.id).subscribe({ next: x => this.tracking.set(x), error: () => this.tracking.set(null) });
    this.api.trackingSamples(this.id).subscribe(x => this.samples.set(x));
    this.api.deliveryTransitions(this.id).subscribe(x => this.transitions.set(x));
    this.api.deliveryTimeline(this.id).subscribe(x => this.timeline.set(x));
  }
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
  saveGeofence(): void {
    if (this.centerLatitude == null || this.centerLongitude == null || !this.radiusMeters) return;
    this.api.createGeofence(this.id, { centerLatitude: this.centerLatitude, centerLongitude: this.centerLongitude, radiusMeters: this.radiusMeters })
      .subscribe({ next: () => this.message.set('fulfillment.geofence-saved'), error: e => this.message.set(e.status === 409 ? 'fulfillment.geofence-exists' : (e?.error?.message ?? 'fulfillment.geofence-failed')) });
  }
  print(): void { window.print(); }
}
