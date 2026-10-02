import { DestroyRef, Injectable, signal } from '@angular/core';
import { Observable, Subscription, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FulfillmentApi } from '../infrastructure/fulfillment-api';
import { Tanker } from '../domain/model/tanker.entity';
import { Driver } from '../domain/model/driver.entity';
import { ProviderDelivery } from '../domain/model/provider-delivery.entity';

type TankerRequest = Omit<Tanker, 'id' | 'providerId' | 'createdAt'>;
type DriverRequest = Omit<Driver, 'id' | 'providerId' | 'createdAt'>;

/**
 * @summary Store de estado para el BC Fulfillment.
 * @remarks Gestiona estado de cisternas (tankers) y conductores usando signals.
 * @author FullTank Platform
 */
@Injectable({ providedIn: 'root' })
export class FulfillmentStore {
  private deliveryRequest?: Subscription;
  private readonly _tankerList = signal<Tanker[]>([]);
  private readonly _selectedTanker = signal<Tanker | null>(null);
  private readonly _driverList = signal<Driver[]>([]);
  private readonly _selectedDriver = signal<Driver | null>(null);
  private readonly _deliveries = signal<ProviderDelivery[]>([]);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string>('');
  private readonly _successMsg = signal<string>('');
  private readonly _driverEligibility = signal<Record<number, { outcome: string; reason: string }>>({});

  private readonly _tankerEligibility = signal<Record<number, { outcome: string; reason: string }>>({});
  private readonly _tankerEligibilityLoading = signal<Record<number, boolean>>({});
  private readonly _tankerEligibilityError = signal<Record<number, string>>({});
  private readonly _driverEligibilityLoading = signal<Record<number, boolean>>({});
  private readonly _driverEligibilityError = signal<Record<number, string>>({});

  public readonly tankerEligibility = this._tankerEligibility.asReadonly();
  public readonly tankerEligibilityLoading = this._tankerEligibilityLoading.asReadonly();
  public readonly tankerEligibilityError = this._tankerEligibilityError.asReadonly();
  public readonly driverEligibilityLoading = this._driverEligibilityLoading.asReadonly();
  public readonly driverEligibilityError = this._driverEligibilityError.asReadonly();
  public readonly tankerList = this._tankerList.asReadonly();
  public readonly selectedTanker = this._selectedTanker.asReadonly();
  public readonly driverList = this._driverList.asReadonly();
  public readonly selectedDriver = this._selectedDriver.asReadonly();
  public readonly deliveries = this._deliveries.asReadonly();
  public readonly isLoading = this._isLoading.asReadonly();
  public readonly error = this._error.asReadonly();
  public readonly successMsg = this._successMsg.asReadonly();
  public readonly driverEligibility = this._driverEligibility.asReadonly();

  constructor(private api: FulfillmentApi) {}

  checkDriverEligibility(id: number, destroyRef: DestroyRef): void {
    if (this._driverEligibilityLoading()[id]) return;
    this._driverEligibilityLoading.update((current) => ({ ...current, [id]: true }));
    this._driverEligibilityError.update((current) => ({ ...current, [id]: '' }));
    this._driverEligibility.update((current) => { const next = { ...current }; delete next[id]; return next; });
    this.api.checkDriverEligibility(id).pipe(
      takeUntilDestroyed(destroyRef),
      finalize(() => this._driverEligibilityLoading.update((current) => ({ ...current, [id]: false }))),
    ).subscribe({
      next: (result) => this._driverEligibility.update((current) => ({ ...current, [id]: result })),
      error: (err) => this._driverEligibilityError.update((current) => ({ ...current, [id]: err.message || 'errors.generic' })),
    });
  }

  checkTankerEligibility(id: number, destroyRef: DestroyRef): void {
    if (this._tankerEligibilityLoading()[id]) return;
    this._tankerEligibilityLoading.update((current) => ({ ...current, [id]: true }));
    this._tankerEligibilityError.update((current) => ({ ...current, [id]: '' }));
    this._tankerEligibility.update((current) => { const next = { ...current }; delete next[id]; return next; });
    this.api.checkTankerEligibility(id).pipe(
      takeUntilDestroyed(destroyRef),
      finalize(() => this._tankerEligibilityLoading.update((current) => ({ ...current, [id]: false }))),
    ).subscribe({
      next: (result) => this._tankerEligibility.update((current) => ({ ...current, [id]: result })),
      error: (err) => this._tankerEligibilityError.update((current) => ({ ...current, [id]: err.message || 'errors.generic' })),
    });
  }

  // ── Deliveries ───────────────────────────────────────────────────────────
  loadDeliveries(date: string | undefined, destroyRef: DestroyRef): void {
    this.deliveryRequest?.unsubscribe();
    this._deliveries.set([]);
    this._error.set('');
    this._isLoading.set(true);
    this.deliveryRequest = this.api.deliveries(date).pipe(
      takeUntilDestroyed(destroyRef),
      finalize(() => this._isLoading.set(false)),
    ).subscribe({
      next: rows => this._deliveries.set(rows),
      error: err => this._error.set(err.message || 'errors.generic'),
    });
  }

  // ── Tankers ──────────────────────────────────────────────────────────────
  loadTankers(): void { this.clearTankerEligibility(); this.run(this.api.getTankers(), 'errors.generic', (rows) => this._tankerList.set(rows)); }
  loadAvailableTankers(): void { this.clearTankerEligibility(); this.run(this.api.getEligibleTankers(), 'errors.generic', (rows) => this._tankerList.set(rows)); }
  loadTankerById(id: number): void { this.run(this.api.getTankerById(id), 'errors.generic', (row) => this._selectedTanker.set(row)); }

  registerTanker(request: TankerRequest, onSuccess?: () => void): void {
    this._successMsg.set('');
    this.run(this.api.registerTanker(request), 'errors.generic', (row) => {
      this._tankerList.update((list) => [...list, row]);
      this._successMsg.set('tanker-form.saved-created');
      onSuccess?.();
    });
  }

  updateTanker(id: number, request: Partial<TankerRequest>, onSuccess?: () => void): void {
    this._successMsg.set('');
    this.run(this.api.updateTanker(id, request), 'errors.generic', (row) => {
      this._tankerList.update((list) => list.map((t) => (t.id === id ? row : t)));
      this._selectedTanker.set(row);
      this._successMsg.set('tanker-form.saved');
      onSuccess?.();
    });
  }

  updateTankerStatus(id: number, request: Pick<Tanker, 'status'>): void {
    this._successMsg.set('');
    this.run(this.api.updateTankerStatus(id, request), 'errors.generic', (row) => {
      this._tankerList.update((list) => list.map((t) => (t.id === id ? row : t)));
      this.clearTankerEligibility(id);
      this._successMsg.set('tanker-form.saved');
    });
  }

  // ── Drivers ──────────────────────────────────────────────────────────────
  loadDrivers(): void { this.clearDriverEligibility(); this.run(this.api.getDrivers(), 'errors.generic', (rows) => this._driverList.set(rows)); }
  loadAvailableDrivers(): void { this.clearDriverEligibility(); this.run(this.api.getEligibleDrivers(), 'errors.generic', (rows) => this._driverList.set(rows)); }
  loadDriverById(id: number): void { this.run(this.api.getDriverById(id), 'errors.generic', (row) => this._selectedDriver.set(row)); }

  registerDriver(request: DriverRequest, onSuccess?: () => void): void {
    this._successMsg.set('');
    this.run(this.api.registerDriver(request), 'errors.generic', (row) => {
      this._driverList.update((list) => [...list, row]);
      this._successMsg.set('driver-form.saved-created');
      onSuccess?.();
    });
  }

  updateDriver(id: number, request: Partial<DriverRequest>, onSuccess?: () => void): void {
    this._successMsg.set('');
    this.run(this.api.updateDriver(id, request), 'errors.generic', (row) => {
      this._driverList.update((list) => list.map((d) => (d.id === id ? row : d)));
      this._selectedDriver.set(row);
      this._successMsg.set('driver-form.saved');
      onSuccess?.();
    });
  }

  updateDriverStatus(id: number, request: Pick<Driver, 'status'>): void {
    this._successMsg.set('');
    this.run(this.api.updateDriverStatus(id, request), 'errors.generic', (row) => {
      this._driverList.update((list) => list.map((d) => (d.id === id ? row : d)));
      this.clearDriverEligibility(id);
      this._successMsg.set('driver-form.saved');
    });
  }

  /** Un resultado de elegibilidad deja de ser válido al recargar la lista o cambiar el estado de la fila. */
  private clearTankerEligibility(id?: number): void {
    this._tankerEligibility.update((current) => dropEntry(current, id));
    this._tankerEligibilityError.update((current) => dropEntry(current, id));
  }

  private clearDriverEligibility(id?: number): void {
    this._driverEligibility.update((current) => dropEntry(current, id));
    this._driverEligibilityError.update((current) => dropEntry(current, id));
  }

  clearMessages(): void { this._error.set(''); this._successMsg.set(''); }

  private run<T>(request: Observable<T>, fallback: string, done: (value: T) => void): void {
    this._isLoading.set(true);
    this._error.set('');
    request.subscribe({
      next: (value) => { done(value); this._isLoading.set(false); },
      error: (err) => { this._error.set(err.message || fallback); this._isLoading.set(false); },
    });
  }
}

/** Sin id vacía el mapa; con id quita solo esa entrada. */
function dropEntry<T>(current: Record<number, T>, id?: number): Record<number, T> {
  if (id === undefined) return {};
  const next = { ...current };
  delete next[id];
  return next;
}
