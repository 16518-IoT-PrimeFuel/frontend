import { inject, Injectable, signal } from '@angular/core';
import { EquipmentApi, apiError } from '../infrastructure/equipment.api';
import { Customer, Site, Tank } from '../domain/model/equipment.entity';
import { IamStore } from '../../iam/application/iam.store';

@Injectable({ providedIn: 'root' })
export class EquipmentStore {
  private readonly api = inject(EquipmentApi);
  private readonly iam = inject(IamStore);
  readonly customers = signal<Customer[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly tanks = signal<Tank[]>([]);
  readonly error = signal('');

  load(): void {
    this.error.set('');
    this.api.customers().subscribe({ next: (rows) => this.customers.set(rows), error: (e) => this.error.set(apiError(e)) });
    this.api.tanks().subscribe({ next: (rows) => this.tanks.set(rows), error: (e) => this.error.set(apiError(e)) });
  }
  loadSites(customerId: number): void {
    this.sites.set([]);
    this.api.sites(customerId).subscribe({ next: (rows) => this.sites.set(rows), error: (e) => this.error.set(apiError(e)) });
  }
  createCustomer(value: Partial<Customer>): void {
    const legacyCompanyId = this.iam.companyId();
    if (legacyCompanyId == null) { this.error.set('equipment.missing-company'); return; }
    this.api.createCustomer({ ...value, legacyCompanyId }).subscribe({ next: () => this.load(), error: (e) => this.error.set(apiError(e)) });
  }
  createSite(id: number, value: { name: string; address: string }): void { this.api.createSite(id, value).subscribe({ next: () => this.loadSites(id), error: (e) => this.error.set(apiError(e)) }); }
  createTank(value: { customerAccountId: number; siteId: number | null; name: string; fuelType: string; capacity: number; unit: string; initialLevel: number }): void { this.api.createTank(value).subscribe({ next: () => this.load(), error: (e) => this.error.set(apiError(e)) }); }
}
