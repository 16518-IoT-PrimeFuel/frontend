import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, forkJoin, map, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { EquipmentApi, apiError } from '../infrastructure/equipment.api';
import { Customer, NewSite, RefillEpisode, RefillPolicy, Site, Tank } from '../domain/model/equipment.entity';
import { ProviderTankReading } from '../domain/model/provider-equipment.entity';
import { IamStore } from '../../iam/application/iam.store';
import { IamApi } from '../../iam/infrastructure/iam-api';

const unresolved = () => throwError(() => ({ error: { code: 'equipment.customer-unresolved' } }));

@Injectable({ providedIn: 'root' })
export class EquipmentStore {
  private readonly api = inject(EquipmentApi);
  private readonly iamApi = inject(IamApi);
  private readonly destroyRef = inject(DestroyRef);
  private sitesRequest?: Subscription;
  private sitesSequence = 0;
  private readonly iam = inject(IamStore);
  /** Cuenta interna (CustomerAccount) de la organización activa; el comprador nunca la registra ni ve su ID. */
  readonly customer = signal<Customer | null>(null);
  readonly sites = signal<Site[]>([]);
  readonly tanks = signal<Tank[]>([]);
  /** Política de reposición por tanque; `null` si el tanque no tiene una o no se pudo leer. */
  readonly policies = signal<Record<number, RefillPolicy | null>>({});
  readonly episodes = signal<RefillEpisode[]>([]);
  readonly readings = signal<ProviderTankReading[]>([]);
  readonly readingsState = signal<'loading' | 'ready' | 'error'>('loading');
  private readingsRequest?: Subscription;
  readonly error = signal('');
  readonly loading = signal(false);
  readonly tanksLoading = signal(false);
  readonly sitesLoading = signal(false);
  private episodesRequest?: Subscription;
  readonly creatingSite = signal(false);
  readonly creatingTank = signal(false);

  /**
   * Resuelve la cuenta de la organización activa (el backend ya filtra /customers por organización):
   * 1) la enlazada a la empresa del usuario (legacyCompanyId); 2) la única sin enlace de la organización;
   * 3) si no hay ninguna, la crea desde su BuyerCompany. legacy_company_id es único en BD: ante una carrera,
   * el 409 del perdedor se resuelve releyendo la cuenta ganadora, sin duplicados.
   */
  resolveCustomer(): Observable<Customer> {
    const companyId = this.iam.companyId();
    const find = (rows: Customer[]) => rows.find(c => companyId != null && c.legacyCompanyId === companyId)
      ?? (rows.length === 1 && rows[0].legacyCompanyId == null ? rows[0] : null);
    return this.api.customers().pipe(switchMap(rows => {
      const found = find(rows);
      if (found) return of(found);
      if (rows.length || companyId == null) return unresolved();
      return this.iamApi.getBuyerCompany(companyId).pipe(
        switchMap(({ name, ruc, address, contactEmail, phone }) => this.api.createCustomer({ name, ruc, address, contactEmail, phone, legacyCompanyId: companyId })),
        catchError(e => e?.status === 409
          ? this.api.customers().pipe(switchMap(again => { const winner = find(again); return winner ? of(winner) : unresolved(); }))
          : throwError(() => e)));
    }), map(value => { this.customer.set(value); return value; }));
  }

  load(): void {
    this.error.set('');
    this.customer.set(null);
    this.sites.set([]);
    this.loading.set(true);
    this.loadTanks();
    this.resolveCustomer().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({ next: (value) => this.loadSites(value.id), error: (e) => this.error.set(apiError(e)) });
  }
  private loadTanks(): void {
    this.tanksLoading.set(true);
    this.api.tanks().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.tanksLoading.set(false))).subscribe({
      next: rows => { this.tanks.set(rows); this.loadPolicies(rows); },
      error: e => this.error.set(apiError(e)),
    });
  }
  // ponytail: una consulta de política por tanque (N+1); pasar a un endpoint de lote si un comprador llega a tener decenas de tanques.
  private loadPolicies(rows: Tank[]): void {
    if (!rows.length) { this.policies.set({}); return; }
    forkJoin(rows.map(tank => this.api.policy(tank.id).pipe(catchError(() => of(null))))).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(list => this.policies.set(Object.fromEntries(rows.map((tank, index) => [tank.id, list[index]]))));
  }
  /** Episodios del tanque mostrado; cambiar de tanque cancela la consulta anterior. Un 404 equivale a no tener episodios. */
  loadEpisodes(tankId: number): void {
    this.episodesRequest?.unsubscribe();
    this.episodes.set([]);
    this.episodesRequest = this.api.episodes(tankId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => this.episodes.set(rows),
      error: e => { if (e?.status !== 404) this.error.set(apiError(e)); },
    });
  }
  /** Lecturas aceptadas del tanque mostrado, en orden ascendente; su fallo no bloquea el resto de la pantalla. */
  loadReadings(tankId: number): void {
    this.readingsRequest?.unsubscribe();
    this.readings.set([]); this.readingsState.set('loading');
    this.readingsRequest = this.api.readings(tankId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.readings.set(rows); this.readingsState.set('ready'); },
      error: () => this.readingsState.set('error'),
    });
  }
  loadSites(customerId: number): void {
    const sequence = ++this.sitesSequence;
    this.sitesRequest?.unsubscribe();
    this.sites.set([]);
    this.sitesLoading.set(true);
    this.sitesRequest = this.api.sites(customerId).pipe(takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (sequence === this.sitesSequence) this.sitesLoading.set(false); })).subscribe({
      next: rows => { if (sequence === this.sitesSequence) this.sites.set(rows); },
      error: e => { if (sequence === this.sitesSequence) this.error.set(apiError(e)); },
    });
  }
  createSite(value: NewSite, done?: () => void): void {
    const customer = this.customer();
    if (this.creatingSite() || !customer) return;
    this.error.set(''); this.creatingSite.set(true);
    this.api.createSite(customer.id, { ...value }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingSite.set(false))).subscribe({
      next: site => {
        if (site.latitude !== value.latitude || site.longitude !== value.longitude || site.siteType !== value.siteType) {
          this.error.set('equipment.map.contract-pending'); return;
        }
        this.loadSites(customer.id); done?.();
      },
      error: e => this.error.set(apiError(e)),
    });
  }
  createTank(value: { siteId: number | null; name: string; fuelType: string; capacity: number; unit: string; initialLevel: number }, done?: () => void): void {
    const customer = this.customer();
    if (this.creatingTank() || !customer) return;
    this.error.set(''); this.creatingTank.set(true);
    this.api.createTank({ customerAccountId: customer.id, ...value }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingTank.set(false))).subscribe({
      next: () => { this.loadTanks(); done?.(); },
      error: e => this.error.set(apiError(e)),
    });
  }
}
