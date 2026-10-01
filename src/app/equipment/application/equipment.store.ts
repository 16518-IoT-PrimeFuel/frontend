import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, finalize, map, Observable, of, Subscription, switchMap, throwError } from 'rxjs';
import { EquipmentApi, apiError } from '../infrastructure/equipment.api';
import { Customer, Site, Tank } from '../domain/model/equipment.entity';
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
  readonly error = signal('');
  readonly loading = signal(false);
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
    this.api.tanks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.tanks.set(rows), error: (e) => this.error.set(apiError(e)) });
    this.resolveCustomer().pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.loading.set(false))).subscribe({ next: (value) => this.loadSites(value.id), error: (e) => this.error.set(apiError(e)) });
  }
  loadSites(customerId: number): void {
    const sequence = ++this.sitesSequence;
    this.sitesRequest?.unsubscribe();
    this.sites.set([]);
    this.sitesRequest = this.api.sites(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { if (sequence === this.sitesSequence) this.sites.set(rows); },
      error: e => { if (sequence === this.sitesSequence) this.error.set(apiError(e)); },
    });
  }
  createSite(value: { name: string; address: string }, done?: () => void): void {
    const customer = this.customer();
    if (this.creatingSite() || !customer) return;
    this.error.set(''); this.creatingSite.set(true);
    this.api.createSite(customer.id, { ...value }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingSite.set(false))).subscribe({
      next: () => { this.loadSites(customer.id); done?.(); },
      error: e => this.error.set(apiError(e)),
    });
  }
  createTank(value: { siteId: number | null; name: string; fuelType: string; capacity: number; unit: string; initialLevel: number }, done?: () => void): void {
    const customer = this.customer();
    if (this.creatingTank() || !customer) return;
    this.error.set(''); this.creatingTank.set(true);
    this.api.createTank({ customerAccountId: customer.id, ...value }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingTank.set(false))).subscribe({
      next: () => { this.api.tanks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: rows => this.tanks.set(rows), error: e => this.error.set(apiError(e)) }); done?.(); },
      error: e => this.error.set(apiError(e)),
    });
  }
}
