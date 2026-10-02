import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { OrderingStore } from '../../../application/ordering.store';
import { IamStore } from '../../../../iam/application/iam.store';
import { Request } from '../../../domain/model/request.entity';

registerLocaleData(localeEs);

export function missingRequestFields(request: Request): string[] {
  const fields: string[] = [];
  if (!request.organizationId || request.organizationId < 1) fields.push('organization');
  if (!['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'].includes(request.status)) fields.push('status');
  if (!request.customerAccountId || request.customerAccountId < 1) fields.push('customer');
  if (!request.fuelProductId || request.fuelProductId < 1) fields.push('product');
  if (!request.providerId || request.providerId < 1) fields.push('provider');
  if (!Number.isFinite(request.quantity) || request.quantity <= 0) fields.push('quantity');
  if (!request.unit?.trim()) fields.push('unit');
  if (request.unitPrice == null || !Number.isFinite(request.unitPrice) || request.unitPrice < 0) fields.push('price');
  if (!request.deliveryAddress?.trim()) fields.push('address');
  const date = request.deliveryDate;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) fields.push('date');
  return fields;
}

@Component({ selector: 'app-request-list', providers: [OrderingStore], imports: [CurrencyPipe, RouterLink, DatePipe, FormsModule, TranslatePipe, MatButtonModule, MatIconModule], templateUrl: './request-list.html', styleUrl: './request-list.css' })
export class RequestList {
  readonly store = inject(OrderingStore);
  readonly iam = inject(IamStore);
  private readonly translate = inject(TranslateService);
  readonly locale = toSignal(this.translate.onLangChange.pipe(map(event => event.lang), startWith(this.translate.getCurrentLang() || 'es')), { requireSync: true });
  readonly status = signal('');
  readonly search = signal('');
  readonly incompleteOnly = signal(false);
  readonly expandedId = signal<number | null>(null);
  readonly decision = signal<'accept' | 'reject' | null>(null);
  rejectionReason = '';
  readonly statuses = ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED'];
  readonly counts = computed(() => this.statuses.map(value => ({ value, count: this.store.requests().filter(request => request.status === value).length })));
  readonly incompleteCount = computed(() => this.store.requests().filter(row => missingRequestFields(row).length).length);
  readonly filtered = computed(() => {
    const search = this.search().trim().toLocaleLowerCase();
    return this.store.requests().filter(row => (!this.status() || row.status === this.status())
      && (!this.incompleteOnly() || missingRequestFields(row).length > 0)
      && (!search || [row.id, row.customerAccountId, row.deliveryAddress, this.store.productNames()[row.fuelProductId], this.store.providerNames()[row.providerId]].join(' ').toLocaleLowerCase().includes(search)))
      .sort((a, b) => b.id - a.id);
  });
  readonly missing = missingRequestFields;
  statusKey(row: Request): string { return this.statuses.includes(row.status) ? row.status.toLowerCase() : 'unknown'; }
  constructor() { this.store.loadRequests(); this.store.loadNames(); }
  refresh(): void { if (!this.store.loading()) { this.store.loadRequests(); this.store.loadNames(); } }
  clearFilters(): void { this.search.set(''); this.status.set(''); this.incompleteOnly.set(false); }
  toggleTracking(id: number): void { this.expandedId.set(this.expandedId() === id ? null : id); this.decision.set(null); this.rejectionReason = ''; }
  canDecide(row: Request): boolean { return this.store.isProvider() && this.iam.providerId() === row.providerId && row.status === 'PENDING' && !this.store.loading(); }
  prepareDecision(action: 'accept' | 'reject'): void { this.decision.set(action); this.rejectionReason = ''; }
  submitDecision(row: Request): void {
    if (!this.canDecide(row)) return;
    if (this.decision() === 'accept' && !missingRequestFields(row).length) this.store.acceptRequest(row.id);
    else if (this.decision() === 'reject' && this.rejectionReason.trim() && this.rejectionReason.trim().length <= 240) this.store.rejectRequest(row.id, this.rejectionReason.trim());
    else return;
    this.decision.set(null); this.rejectionReason = '';
  }
}
