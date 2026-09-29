import { Component, computed, effect, inject, Signal, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderingStore } from '../../../application/ordering.store';
import { Order } from '../../../domain/model/order.entity';
import { IamStore } from '../../../../iam/application/iam.store';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatError } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';
import { Driver } from '../../../../fulfillment/domain/model/driver.entity';
import { Tanker } from '../../../../fulfillment/domain/model/tanker.entity';
import { HttpErrorResponse } from '@angular/common/http';
import { OrderingApi, Payment, PaymentMethod } from '../../../infrastructure/ordering-api';

@Component({ selector: 'app-order-detail', imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, TranslatePipe, MatButton, MatIconButton, MatIcon, MatCard, MatCardContent, MatChip, MatChipSet, MatProgressSpinner, MatError, MatTooltip], templateUrl: './order-detail.html', styleUrl: './order-detail.css' })
export class OrderDetail {
  readonly store = inject(OrderingStore);
  private readonly iam = inject(IamStore);
  readonly isBuyer = this.iam.role() === 'BUYER';
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fulfillment = inject(FulfillmentApi);
  private readonly api = inject(OrderingApi);
  readonly assigning = signal(false);
  readonly companyName = signal<string | null>(null);
  readonly drivers = signal<Driver[]>([]);
  readonly tankers = signal<Tanker[]>([]);
  driverId: number | null = null;
  tankerId: number | null = null;
  windowStart = '';
  windowEnd = '';
  assignmentError = '';
  readonly payment = signal<Payment | null>(null);
  readonly paymentLoading = signal(false);
  readonly paying = signal(false);
  paymentMethod: PaymentMethod = 'BANK_TRANSFER';
  transactionReference = '';
  paymentError = '';
  private paymentOrderLoaded: number | null = null;
  order: Signal<Order | undefined> = computed(() => this.store.orders().find(item => item.id === Number(this.route.snapshot.paramMap.get('id'))));
  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id > 0) this.store.loadOrder(id);
    this.store.loadNames();
    effect(() => {
      const order = this.order();
      if (order && this.isBuyer && this.companyName() === null) this.api.buyerCompany(order.companyId).subscribe({ next: company => this.companyName.set(company.name), error: () => undefined });
      if (!order || !['PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED'].includes(order.status) || this.paymentOrderLoaded === order.id) return;
      this.paymentOrderLoaded = order.id;
      this.paymentLoading.set(true);
      this.api.paymentForOrder(order.id).subscribe({
        next: payment => { this.payment.set(payment); this.paymentLoading.set(false); },
        error: (error: HttpErrorResponse) => {
          this.payment.set(null);
          this.paymentLoading.set(false);
          if (error.status !== 404) this.paymentError = error.error?.message ?? 'order-detail.payment-error';
        },
      });
    });
  }
  back(): void { this.router.navigate(['/ordering/order-list']).then(); }
  confirm(id: number): void { this.store.confirmOrder(id); }
  cancelOrder(id: number): void { this.store.cancelOrder(id); }
  pay(order: Order): void {
    const companyId = this.iam.companyId();
    if (!companyId) return;
    this.paying.set(true);
    this.paymentError = '';
    this.api.createPayment(order.id, companyId, order.totalPrice, this.paymentMethod).subscribe({
      next: payment => { this.payment.set(payment); this.paying.set(false); },
      error: (error: HttpErrorResponse) => { this.paymentError = error.error?.message ?? 'order-detail.payment-error'; this.paying.set(false); },
    });
  }
  completePayment(orderId: number): void {
    const payment = this.payment();
    if (!payment || !this.transactionReference.trim()) return;
    this.paying.set(true);
    this.paymentError = '';
    this.api.completePayment(payment.id, this.transactionReference.trim()).subscribe({
      next: completed => { this.payment.set(completed); this.paying.set(false); this.store.loadOrder(orderId); },
      error: (error: HttpErrorResponse) => { this.paymentError = error.error?.message ?? 'order-detail.payment-error'; this.paying.set(false); },
    });
  }
  statusClass(status: string): string { return status.toLowerCase(); }
  openAssignment(): void {
    this.assigning.set(true);
    this.fulfillment.getEligibleDrivers().subscribe(rows => {
      this.drivers.set(rows);
      this.driverId = rows.length === 1 ? rows[0].id : null;
    });
    this.fulfillment.getEligibleTankers().subscribe(rows => {
      this.tankers.set(rows);
      this.tankerId = rows.length === 1 ? rows[0].id : null;
    });
  }
  assign(orderId: number): void {
    if (!this.driverId || !this.tankerId || !this.windowStart || !this.windowEnd) return;
    this.assignmentError = '';
    this.fulfillment.assignDelivery({ commandId: crypto.randomUUID(), orderId, driverId: this.driverId, tankerId: this.tankerId,
      windowStart: new Date(this.windowStart).toISOString(), windowEnd: new Date(this.windowEnd).toISOString(),
      scheduledDate: this.order()?.scheduledDate ?? undefined }).subscribe({
      next: result => { this.assigning.set(false); this.router.navigate(['/fulfillment/delivery-detail', result.deliveryId]); },
      error: error => this.assignmentError = error?.error?.message ?? 'fulfillment.assignment-failed',
    });
  }
}
