import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { EquipmentApi, apiError } from '../infrastructure/equipment.api';
import { Customer, Site, Tank } from '../domain/model/equipment.entity';
import { IamStore } from '../../iam/application/iam.store';

@Injectable({ providedIn: 'root' })
export class EquipmentStore {
  private readonly api = inject(EquipmentApi);
  private readonly destroyRef = inject(DestroyRef);
  private sitesRequest?: Subscription;
  private sitesSequence = 0;
  private selectedCustomerId: number | null = null;
  private readonly iam = inject(IamStore);
  readonly customers = signal<Customer[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly tanks = signal<Tank[]>([]);
  readonly error = signal('');
  readonly creatingCustomer = signal(false);
  readonly creatingSite = signal(false);
  readonly creatingTank = signal(false);

  load(): void {
    this.error.set('');
    this.api.customers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.customers.set(rows), error: (e) => this.error.set(apiError(e)) });
    this.api.tanks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.tanks.set(rows), error: (e) => this.error.set(apiError(e)) });
  }
  loadSites(customerId: number): void {
    this.selectedCustomerId = customerId;
    const sequence = ++this.sitesSequence;
    this.sitesRequest?.unsubscribe();
    this.sites.set([]);
    this.sitesRequest = this.api.sites(customerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { if (sequence === this.sitesSequence) this.sites.set(rows); },
      error: e => { if (sequence === this.sitesSequence) this.error.set(apiError(e)); },
    });
  }
  createCustomer(value: Partial<Customer>, done?: () => void): void {
    if (this.creatingCustomer()) return;
    const legacyCompanyId = this.iam.companyId();
    this.error.set('');
    if (legacyCompanyId == null) { this.error.set('equipment.missing-company'); return; }
    this.creatingCustomer.set(true);
    this.api.createCustomer({ ...value, legacyCompanyId }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingCustomer.set(false))).subscribe({ next: () => { this.load(); done?.(); }, error: (e) => this.error.set(apiError(e)) });
  }
  createSite(id: number, value: { name: string; address: string }, done?: () => void): void {
    if (this.creatingSite()) return;
    this.error.set(''); this.creatingSite.set(true);
    this.api.createSite(id, { ...value }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingSite.set(false))).subscribe({
      next: () => { if (this.selectedCustomerId === id) { this.loadSites(id); done?.(); } },
      error: e => { if (this.selectedCustomerId === id) this.error.set(apiError(e)); },
    });
  }
  createTank(value: { customerAccountId: number; siteId: number | null; name: string; fuelType: string; capacity: number; unit: string; initialLevel: number }, done?: () => void): void {
    if (this.creatingTank()) return;
    this.error.set(''); this.creatingTank.set(true);
    this.api.createTank({ ...value }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.creatingTank.set(false))).subscribe({
      next: () => { this.load(); if (this.selectedCustomerId === value.customerAccountId) done?.(); },
      error: e => { if (this.selectedCustomerId === value.customerAccountId) this.error.set(apiError(e)); },
    });
  }
}
