import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { OrderingStore } from '../../../application/ordering.store';
import { IamStore } from '../../../../iam/application/iam.store';
import { Request } from '../../../domain/model/request.entity';
import { CONFIRM_DIALOG_CONFIG, ConfirmDialog } from '../../../../shared/presentation/component/confirm-dialog/confirm-dialog';

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
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private dialogRef?: MatDialogRef<unknown>;
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
  constructor() {
    this.store.loadRequests(); this.store.loadNames();
    const notice = inject(Router).currentNavigation()?.extras.state?.['notice'];
    if (typeof notice === 'string') this.store.notice.set(notice); // al final: run() limpia el aviso
    this.destroyRef.onDestroy(() => this.dialogRef?.close());
  }
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
  /** La lista del comprador solo trae sus propias solicitudes; el store vuelve a comprobar rol y estado. */
  canCancel(row: Request): boolean { return this.iam.isBuyer() && row.status === 'PENDING' && !this.store.loading(); }
  cancelRequest(row: Request): void {
    if (!this.canCancel(row) || this.dialogRef) return;
    this.dialogRef = this.dialog.open(ConfirmDialog, { ...CONFIRM_DIALOG_CONFIG, data: { titleKey: 'confirm.title', messageKey: 'request-detail.confirm-cancel' } });
    this.dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      this.dialogRef = undefined;
      const current = this.store.requests().find(item => item.id === row.id);
      if (confirmed === true && current && this.canCancel(current)) this.store.cancelRequest(row.id);
    });
  }
}
