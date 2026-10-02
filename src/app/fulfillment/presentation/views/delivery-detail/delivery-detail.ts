import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of, Subscription, switchMap } from 'rxjs';
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
  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());
  private reloadRequests = new Subscription();
  private valveRequest?: Subscription;
  readonly commandBusy = signal(false);
  readonly geofenceBusy = signal(false);
  readonly trackingError = signal(false);
  readonly samplesError = signal(false);
  readonly transitionsError = signal(false);
  readonly timelineError = signal(false);
  readonly tankLevelError = signal(false);
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
  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
    this.reload();
  }
  reload(): void {
    this.reloadRequests.unsubscribe();
    this.reloadRequests = new Subscription();
    this.loadError.set(false);
    this.tankReading.set(null);
    this.tankLevelError.set(false);
    this.trackingError.set(false);
    this.samplesError.set(false);
    this.transitionsError.set(false);
    this.timelineError.set(false);
    this.reloadRequests.add(this.api.delivery(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => { this.loadError.set(false); this.delivery.set(x); this.loadParties(x); this.loadTankLevel(x.orderId); }, error: () => { this.delivery.set(null); this.loadError.set(true); } }));
    this.reloadRequests.add(this.api.tracking(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.tracking.set(x), error: () => { this.tracking.set(null); this.trackingError.set(true); } }));
    this.reloadRequests.add(this.api.trackingSamples(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.samples.set(x), error: () => { this.samples.set([]); this.samplesError.set(true); } }));
    this.reloadRequests.add(this.api.deliveryTransitions(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.transitions.set(x), error: () => { this.transitions.set([]); this.transitionsError.set(true); } }));
    this.reloadRequests.add(this.api.deliveryTimeline(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.timeline.set(x), error: () => { this.timeline.set([]); this.timelineError.set(true); } }));
    this.loadValve();
  }
  loadValve(): void {
    this.valveRequest?.unsubscribe();
    this.valve.set(null);
    this.valveError.set(false);
    this.valveRequest = this.api.valveObservations(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.valve.set(x), error: () => { this.valve.set(null); this.valveError.set(true); } });
  }
  /** US-52: orden -> solicitud -> tanque -> última lectura. Si falta un eslabón la sección no se muestra. */
  private loadTankLevel(orderId: number): void {
    const from = new Date(Date.now() - 48 * 3_600_000).toISOString();
    this.reloadRequests.add(this.ordering.order(orderId).pipe(
      switchMap(o => o.requestId ? this.ordering.request(o.requestId) : of(null)),
      switchMap(r => r?.tankId ? this.equipment.readings(r.tankId, from) : of([])),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({ next: rows => this.tankReading.set(rows.at(-1) ?? null), error: e => { this.tankReading.set(null); this.tankLevelError.set(e?.status !== 404); } }));
  }
  tankAgeMinutes(r: ProviderTankReading): number { return Math.max(0, Math.floor((this.now() - new Date(r.capturedAt).getTime()) / 60_000)); }
  private loadParties(d: any): void {
    this.reloadRequests.add(this.api.getDriverById(d.driverId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.driverName.set(`${x.firstName} ${x.lastName}`), error: () => this.driverName.set('') }));
    this.reloadRequests.add(this.api.getTankerById(d.vehicleId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: x => this.tankerName.set(`${x.brand} ${x.model} · ${x.licensePlate}`), error: () => this.tankerName.set('') }));
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
    if (this.commandBusy() || !this.can(action)) return;
    if (action === 'complete' && (this.deliveredVolume === null || !Number.isFinite(this.deliveredVolume) || this.deliveredVolume <= 0)) return;
    if (['fail', 'cancel'].includes(action) && !this.reason.trim()) return;
    const body = action === 'complete' ? { deliveredVolume: this.deliveredVolume } : ['fail','cancel'].includes(action) ? { reason: this.reason } : {};
    this.commandBusy.set(true);
    this.api.deliveryCommand(this.id, action, body).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: () => { this.commandBusy.set(false); this.message.set(''); this.reason = ''; this.reload(); }, error: () => { this.commandBusy.set(false); this.message.set('fulfillment.command-failed'); } });
  }
  /** Rangos del backend (GeofencePolicy): latitud [-90, 90], longitud [-180, 180], radio > 0. */
  get latitudeInvalid(): boolean { return this.centerLatitude != null && (!Number.isFinite(this.centerLatitude) || this.centerLatitude < -90 || this.centerLatitude > 90); }
  get longitudeInvalid(): boolean { return this.centerLongitude != null && (!Number.isFinite(this.centerLongitude) || this.centerLongitude < -180 || this.centerLongitude > 180); }
  get radiusInvalid(): boolean { return this.radiusMeters != null && (!Number.isFinite(this.radiusMeters) || this.radiusMeters <= 0); }
  get geofenceValid(): boolean { return this.centerLatitude != null && this.centerLongitude != null && this.radiusMeters != null && !this.latitudeInvalid && !this.longitudeInvalid && !this.radiusInvalid; }
  saveGeofence(): void {
    if (!this.geofenceValid || this.geofenceBusy()) return;
    this.geofenceBusy.set(true);
    this.api.createGeofence(this.id, { centerLatitude: this.centerLatitude, centerLongitude: this.centerLongitude, radiusMeters: this.radiusMeters! })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => { this.geofenceBusy.set(false); this.message.set('fulfillment.geofence-saved'); },
        error: e => { this.geofenceBusy.set(false); this.message.set(e.status === 409 ? 'fulfillment.geofence-exists' : 'fulfillment.geofence-failed'); },
      });
  }
  print(): void { window.print(); }
}
