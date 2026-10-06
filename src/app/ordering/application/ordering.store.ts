import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { finalize, Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Request, CreateRequest } from '../domain/model/request.entity';
import { Order } from '../domain/model/order.entity';
import { OrderingApi, Payment } from '../infrastructure/ordering-api';
import { IamStore } from '../../iam/application/iam.store';

@Injectable({ providedIn: 'root' })
export class OrderingStore {
  private readonly api = inject(OrderingApi);
  private readonly destroyRef = inject(DestroyRef);
  private activeRequests = 0;
  private orderRequest?: Subscription;
  private readonly iam = inject(IamStore);
  private readonly requestsState = signal<Request[]>([]);
  private readonly paymentsState = signal<Payment[]>([]);
  private readonly ordersState = signal<Order[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  readonly requests = this.requestsState.asReadonly();
  readonly payments = this.paymentsState.asReadonly();
  readonly orders = this.ordersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly providerNames = signal<Record<number, string | undefined>>({});
  readonly productNames = signal<Record<number, string | undefined>>({});
  readonly notice = signal('');
  readonly refundingId = signal<number | null>(null);
  readonly refundError = signal('');
  readonly creating = signal(false);
  readonly isProvider = computed(() => this.iam.role() === 'PROVIDER');

  /** Nombres para mostrar en vez de ids; si una consulta falla se muestra el id (sin error visible). */
  loadNames(): void {
    if (this.isProvider()) { // el distribuidor solo puede leer su propia empresa y sus productos
      const id = this.iam.providerId();
      if (id === null) return;
      this.api.provider(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: row => this.providerNames.set({ [row.id]: row.name }), error: () => undefined });
      this.api.products(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: rows => this.productNames.set(Object.fromEntries(rows.map(row => [row.id, row.name]))), error: () => undefined });
      return;
    }
    this.api.providers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: rows => this.providerNames.set(Object.fromEntries(rows.map(row => [row.id, row.name]))), error: () => undefined });
    this.api.allProducts().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: rows => this.productNames.set(Object.fromEntries(rows.map(row => [row.id, row.name]))), error: () => undefined });
  }
  loadRequests(): void {
    this.run(this.isProvider() ? this.api.requestInbox() : this.api.requests(), value => this.requestsState.set(value));
  }
  loadOrders(): void {
    const id = this.isProvider() ? this.iam.providerId() : this.iam.companyId();
    if (id == null) { this.errorState.set('ordering.missing-organization'); return; }
    this.run(this.api.orders(this.isProvider() ? 'provider' : 'company', id), value => this.ordersState.set(value));
  }
  loadPayments(): void {
    if (this.loadingState() || this.refundingId() !== null) return;
    this.refundError.set('');
    const companyId = this.iam.companyId();
    if (!this.iam.isBuyer() || companyId == null) {
      this.paymentsState.set([]);
      this.errorState.set('ordering.missing-organization');
      return;
    }
    this.run(this.api.paymentsForCompany(companyId), payments => this.paymentsState.set(payments));
  }
  refundPayment(payment: Payment): void {
    const currentPayment = this.paymentsState().find(row => row.id === payment.id);
    if (!this.iam.isBuyer() || !currentPayment || currentPayment.status !== 'COMPLETED' || currentPayment.companyId !== this.iam.companyId() || this.refundingId() !== null || this.loadingState()) return;
    this.refundingId.set(payment.id);
    this.refundError.set('');
    this.notice.set('');
    this.api.refundPayment(payment.id).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.refundingId.set(null))).subscribe({
      next: updated => {
        this.paymentsState.update(payments => payments.map(row => row.id === updated.id ? updated : row));
        this.notice.set('payment-history.refund-success');
      },
      error: error => this.refundError.set(error?.message ?? 'errors.generic'),
    });
  }
  loadOrder(id: number): void {
    this.orderRequest?.unsubscribe();
    this.ordersState.set([]);
    if (!Number.isSafeInteger(id) || id < 1) { this.errorState.set('errors.http-404'); return; }
    this.orderRequest = this.run(this.api.order(id), order => this.ordersState.set([order]));
  }
  createRequest(value: CreateRequest, done: () => void): void {
    if (this.creating()) return;
    this.creating.set(true);
    this.mutate(this.api.createRequest(value).pipe(finalize(() => this.creating.set(false))), () => { this.loadRequests(); done(); });
  }
  acceptRequest(id: number): void {
    if (!this.canDecideRequest(id)) return;
    this.mutate(this.api.acceptRequest(id), request => {
      this.loadRequests();
      if (request.orderId != null) this.loadOrder(request.orderId);
      else this.loadOrders();
      this.notice.set('request-list.accepted'); // al final: run() limpia el aviso
    });
  }
  rejectRequest(id: number, reason: string): void {
    if (!this.canDecideRequest(id) || !reason.trim() || reason.trim().length > 240) return;
    this.mutate(this.api.rejectRequest(id, reason.trim()), () => { this.loadRequests(); this.notice.set('request-list.rejected'); });
  }
  cancelRequest(id: number): void {
    if (!this.iam.isBuyer() || this.loading() || !this.requests().some(row => row.id === id && row.status === 'PENDING')) return;
    this.mutate(this.api.cancelRequest(id), () => { this.loadRequests(); this.notice.set('request-list.cancelled'); });
  }
  confirmOrder(id: number): void {
    const order = this.orders().find(row => row.id === id);
    if (this.loading() || !this.iam.isBuyer() || order?.companyId !== this.iam.companyId() || order?.status !== 'PENDING') return;
    this.mutate(this.api.confirmOrder(id), order => { this.replaceOrder(order); this.notice.set('order-detail.confirm-success'); });
  }
  cancelOrder(id: number): void {
    const order = this.orders().find(row => row.id === id);
    const owns = this.iam.isBuyer() ? order?.companyId === this.iam.companyId() : this.iam.isProvider() && order?.providerId === this.iam.providerId();
    if (this.loading() || !order || !owns || !['PENDING', 'CONFIRMED'].includes(order.status)) return;
    this.mutate(this.api.cancelOrder(id), order => { this.replaceOrder(order); this.notice.set('order-detail.cancel-success'); });
  }

  private canDecideRequest(id: number): boolean {
    return this.isProvider() && !this.loading() && this.requests().some(row => row.id === id && row.status === 'PENDING' && row.providerId === this.iam.providerId());
  }

  private replaceOrder(order: Order): void { this.ordersState.update(items => [order, ...items.filter(x => x.id !== order.id)]); }
  private run<T>(request: import('rxjs').Observable<T>, save: (value: T) => void): Subscription {
    this.activeRequests++;
    this.loadingState.set(true); this.errorState.set(null); this.notice.set('');
    return request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
      this.activeRequests--;
      this.loadingState.set(this.activeRequests > 0);
    })).subscribe({ next: save, error: error => this.errorState.set(error?.error?.message ?? error?.error?.code ?? (error?.status == null ? error?.message : null) ?? 'ordering.request-failed') });
  }
  private mutate<T>(request: import('rxjs').Observable<T>, done: (value: T) => void): void { this.run(request, done); }
}
