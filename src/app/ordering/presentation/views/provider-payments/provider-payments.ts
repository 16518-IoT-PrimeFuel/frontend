import { Component, computed, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
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
  private listRequest?: Subscription;
  private confirming = false;
  @ViewChild('completeDialog') private completeDialog!: TemplateRef<unknown>;
  @ViewChild('refundDialog') private refundDialog!: TemplateRef<unknown>;

  protected readonly statuses = STATUSES;
  protected readonly payments = signal<ProviderPayment[]>([]);
  protected readonly page = signal(0);
  protected readonly pageSize = 20;
  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.payments().length / this.pageSize)));
  protected readonly pageRows = computed(() => this.payments().slice(this.page() * this.pageSize, (this.page() + 1) * this.pageSize));
  protected readonly firstRow = computed(() => this.payments().length ? this.page() * this.pageSize + 1 : 0);
  protected readonly lastRow = computed(() => Math.min((this.page() + 1) * this.pageSize, this.payments().length));
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
    this.listRequest?.unsubscribe();
    const providerId = this.iam.providerId();
    if (!providerId || this.rangeInvalid()) {
      this.payments.set([]);
      this.loading.set(false);
      this.error.set(!providerId ? 'errors.http-403' : null);
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    // Las fechas del negocio corresponden a Lima (UTC-5), independientemente de la zona del navegador.
    const from = this.from() ? new Date(`${this.from()}T00:00:00-05:00`).toISOString() : undefined;
    const to = this.to() ? new Date(`${this.to()}T23:59:59.999-05:00`).toISOString() : undefined;
    this.listRequest = this.api.providerPayments(providerId, { status: this.status() || undefined, from, to }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.payments.set(rows); this.page.set(Math.min(this.page(), this.pageCount() - 1)); this.loading.set(false); },
      error: (e) => { this.error.set(this.errorKey(e)); this.loading.set(false); },
    });
  }

  protected setStatus(value: string): void { this.status.set(value); this.page.set(0); this.load(); }
  protected setDate(which: 'from' | 'to', value: string): void { (which === 'from' ? this.from : this.to).set(value); this.page.set(0); this.load(); }
  protected clearDates(): void { this.from.set(''); this.to.set(''); this.page.set(0); this.load(); }
  protected changePage(delta: number): void { this.page.set(Math.max(0, Math.min(this.pageCount() - 1, this.page() + delta))); }

  protected requestComplete(p: ProviderPayment): void {
    if (p.status !== 'PENDING' || this.busyId() !== null || this.confirming) return;
    this.confirming = true;
    this.selected.set(p);
    this.reference.reset('');
    const dialog = this.dialog.open(this.completeDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' });
    this.destroyRef.onDestroy(() => dialog.close());
    dialog.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
      this.confirming = false;
      if (ok === true && this.reference.valid) this.run(p, this.api.completePayment(p.id, this.reference.value.trim()), 'provider-payments.complete-success');
    });
  }

  /** El botón queda activo: con la referencia vacía se muestra el error bajo el campo en vez de cerrar. */
  protected submitReference(dialog: MatDialogRef<unknown>): void {
    this.reference.markAsTouched();
    if (this.reference.valid) dialog.close(true);
  }

  protected requestRefund(p: ProviderPayment): void {
    if (p.status !== 'COMPLETED' || this.busyId() !== null || this.confirming) return;
    this.confirming = true;
    this.selected.set(p);
    const dialog = this.dialog.open(this.refundDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' });
    this.destroyRef.onDestroy(() => dialog.close());
    dialog.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((ok) => {
      this.confirming = false;
      if (ok === true) this.run(p, this.api.refundProviderPayment(p.id), 'provider-payments.refund-success');
    });
  }

  private run(p: ProviderPayment, op: ReturnType<OrderingApi['completePayment']>, success: string): void {
    this.busyId.set(p.id);
    this.actionError.set(null);
    this.notice.set(null);
    op.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busyId.set(null); this.notice.set(success); this.load(); },
      error: (e) => {
        this.busyId.set(null);
        const key = this.errorKey(e);
        // 409 en reembolso: el pago no está COMPLETED.
        this.actionError.set(e instanceof HttpErrorResponse && e.error?.code === 'PAYMENT_CONFLICT' && success.includes('refund') ? 'provider-payments.refund-conflict' : key);
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
