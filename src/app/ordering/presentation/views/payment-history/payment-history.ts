import { Component, DestroyRef, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Payment } from '../../../infrastructure/ordering-api';
import { MatButton } from '@angular/material/button';
import { OrderingStore } from '../../../application/ordering.store';

@Component({ selector: 'app-payment-history', providers: [OrderingStore], imports: [CurrencyPipe, DatePipe, RouterLink, TranslatePipe, MatButton, MatDialogModule, MatProgressSpinnerModule], templateUrl: './payment-history.html', styleUrl: './payment-history.css' })
export class PaymentHistory {
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private confirming = false;
  private confirmationDialog?: MatDialogRef<unknown>;
  @ViewChild('confirmDialog') private confirmDialog!: TemplateRef<unknown>;
  readonly selectedPayment = signal<Payment | null>(null);
  readonly store = inject(OrderingStore);
  readonly status = signal('');
  readonly statuses = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];
  readonly filtered = computed(() => this.store.payments()
    .filter(payment => !this.status() || payment.status === this.status())
    .sort((a, b) => Number(b.status === 'PENDING') - Number(a.status === 'PENDING')
      || (b.paidAt ? Date.parse(b.paidAt) : 0) - (a.paidAt ? Date.parse(a.paidAt) : 0)
      || b.id - a.id));

  requestRefund(payment: Payment): void {
    if (payment.status !== 'COMPLETED' || this.confirming || this.store.refundingId() !== null || this.store.loading()) return;
    this.confirming = true;
    this.selectedPayment.set(payment);
    this.confirmationDialog = this.dialog.open(this.confirmDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' });
    this.confirmationDialog.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(ok => {
        this.confirmationDialog = undefined;
        this.confirming = false;
        this.selectedPayment.set(null);
        if (ok === true) this.store.refundPayment(payment);
      });
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.confirmationDialog?.close());
    this.store.loadPayments();
  }
}
