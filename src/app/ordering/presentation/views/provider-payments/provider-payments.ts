import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { OrderingApi, ProviderPayment } from '../../../infrastructure/ordering-api';

const STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'];

/** Pagos del distribuidor (cap. 5, pantalla Pagos). Filtros de estado y fechas se envían al backend. */
@Component({
  selector: 'app-provider-payments',
  standalone: true,
  imports: [DatePipe, DecimalPipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatDialogModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-payments.html',
  styleUrl: '../payment-history/payment-history.css',
})
export class ProviderPayments {
  private readonly api = inject(OrderingApi);
  private readonly iam = inject(IamStore);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('completeDialog') private completeDialog!: TemplateRef<unknown>;
  @ViewChild('refundDialog') private refundDialog!: TemplateRef<unknown>;

  protected readonly statuses = STATUSES;
  protected readonly payments = signal<ProviderPayment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly selected = signal<ProviderPayment | null>(null);
  protected readonly status = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly reference = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/)] });
  protected readonly rangeInvalid = () => !!this.from() && !!this.to() && this.from() > this.to();

  constructor() { this.load(); }

  protected load(): void {
    const providerId = this.iam.providerId();
    if (!providerId || this.rangeInvalid()) return;
    this.loading.set(true);
    this.error.set(null);
    // Los límites de fecha se interpretan en la zona del navegador y se envían como instante ISO (inclusivos sobre createdAt).
    const from = this.from() ? new Date(`${this.from()}T00:00:00`).toISOString() : undefined;
    const to = this.to() ? new Date(`${this.to()}T23:59:59.999`).toISOString() : undefined;
    this.api.providerPayments(providerId, { status: this.status() || undefined, from, to }).subscribe({
      next: (rows) => { this.payments.set(rows); this.loading.set(false); },
      error: (e) => { this.error.set(this.errorKey(e)); this.loading.set(false); },
    });
  }

  protected setStatus(value: string): void { this.status.set(value); this.load(); }
  protected setDate(which: 'from' | 'to', value: string): void { (which === 'from' ? this.from : this.to).set(value); this.load(); }
  protected clearDates(): void { this.from.set(''); this.to.set(''); this.load(); }

  protected requestComplete(p: ProviderPayment): void {
    this.selected.set(p);
    this.reference.reset('');
    this.dialog.open(this.completeDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' }).afterClosed().subscribe((ok) => {
      if (ok === true && this.reference.valid) this.run(p, this.api.completePayment(p.id, this.reference.value.trim()), 'provider-payments.complete-success');
    });
  }

  protected requestRefund(p: ProviderPayment): void {
    this.selected.set(p);
    this.dialog.open(this.refundDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' }).afterClosed().subscribe((ok) => {
      if (ok === true) this.run(p, this.api.refundPayment(p.id), 'provider-payments.refund-success');
    });
  }

  private run(p: ProviderPayment, op: ReturnType<OrderingApi['completePayment']>, success: string): void {
    this.busyId.set(p.id);
    this.actionError.set(null);
    this.notice.set(null);
    op.subscribe({
      next: () => { this.busyId.set(null); this.notice.set(success); this.load(); },
      error: (e) => {
        this.busyId.set(null);
        const key = this.errorKey(e);
        // 409 en reembolso: el pago no está COMPLETED.
        this.actionError.set(key === 'errors.http-409' && success.includes('refund') ? 'provider-payments.refund-conflict' : key);
      },
    });
  }

  /** HttpErrorResponse crudo o Error con clave i18n (OrderingApi.refundPayment) -> clave i18n. */
  private errorKey(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      return e.status === 0 ? 'errors.network' : e.status >= 500 ? 'errors.server' : [400, 401, 403, 404, 409, 422].includes(e.status) ? `errors.http-${e.status}` : 'errors.generic';
    }
    return (e as Error)?.message?.startsWith('errors.') ? (e as Error).message : 'provider-payments.action-error';
  }
}
