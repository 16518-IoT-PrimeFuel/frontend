import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { Request, CreateRequest } from '../domain/model/request.entity';
import { Order } from '../domain/model/order.entity';
import { OrderingApi } from '../infrastructure/ordering-api';
import { IamStore } from '../../iam/application/iam.store';

@Injectable({ providedIn: 'root' })
export class OrderingStore {
  private readonly api = inject(OrderingApi);
  private readonly iam = inject(IamStore);
  private readonly requestsState = signal<Request[]>([]);
  private readonly ordersState = signal<Order[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  readonly requests = this.requestsState.asReadonly();
  readonly orders = this.ordersState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly providerNames = signal<Record<number, string | undefined>>({});
  readonly productNames = signal<Record<number, string | undefined>>({});
  readonly notice = signal('');
  readonly isProvider = computed(() => this.iam.role() === 'PROVIDER');

  /** Nombres para mostrar en vez de ids; si una consulta falla se muestra el id (sin error visible). */
  loadNames(): void {
    if (this.isProvider()) { // el distribuidor solo puede leer su propia empresa y sus productos
      const id = this.iam.providerId();
      if (id === null) return;
      this.api.provider(id).subscribe({ next: row => this.providerNames.set({ [row.id]: row.name }), error: () => undefined });
      this.api.products(id).subscribe({ next: rows => this.productNames.set(Object.fromEntries(rows.map(row => [row.id, row.name]))), error: () => undefined });
      return;
    }
    this.api.providers().subscribe({ next: rows => this.providerNames.set(Object.fromEntries(rows.map(row => [row.id, row.name]))), error: () => undefined });
    this.api.allProducts().subscribe({ next: rows => this.productNames.set(Object.fromEntries(rows.map(row => [row.id, row.name]))), error: () => undefined });
  }
  loadRequests(): void {
    if (this.isProvider()) { this.requestsState.set([]); return; } // ponytail: backend has no provider inbox; show the gap instead of fabricating one.
    this.run(this.api.requests(), value => this.requestsState.set(value));
  }
  loadOrders(): void {
    const id = this.isProvider() ? this.iam.providerId() : this.iam.companyId();
    if (id == null) { this.errorState.set('ordering.missing-organization'); return; }
    this.run(this.api.orders(this.isProvider() ? 'provider' : 'company', id), value => this.ordersState.set(value));
  }
  loadOrder(id: number): void { this.run(this.api.order(id), order => this.ordersState.update(items => [order, ...items.filter(x => x.id !== id)])); }
  createRequest(value: CreateRequest, done: () => void): void { this.mutate(this.api.createRequest(value), () => { this.loadRequests(); done(); }); }
  acceptRequest(id: number): void {
    this.mutate(this.api.acceptRequest(id), request => {
      this.loadRequests();
      if (request.orderId != null) this.loadOrder(request.orderId);
      else this.loadOrders();
      this.notice.set('request-list.accepted'); // al final: run() limpia el aviso
    });
  }
  rejectRequest(id: number, reason: string): void { this.mutate(this.api.rejectRequest(id, reason), () => { this.loadRequests(); this.notice.set('request-list.rejected'); }); }
  cancelRequest(id: number): void { this.mutate(this.api.cancelRequest(id), () => this.loadRequests()); }
  confirmOrder(id: number): void { this.mutate(this.api.confirmOrder(id), order => this.replaceOrder(order)); }
  cancelOrder(id: number): void { this.mutate(this.api.cancelOrder(id), order => this.replaceOrder(order)); }

  private replaceOrder(order: Order): void { this.ordersState.update(items => [order, ...items.filter(x => x.id !== order.id)]); }
  private run<T>(request: import('rxjs').Observable<T>, save: (value: T) => void): void {
    this.loadingState.set(true); this.errorState.set(null); this.notice.set('');
    request.pipe(finalize(() => this.loadingState.set(false))).subscribe({ next: save, error: error => this.errorState.set(error?.error?.message ?? error?.error?.code ?? 'ordering.request-failed') });
  }
  private mutate<T>(request: import('rxjs').Observable<T>, done: (value: T) => void): void { this.run(request, done); }
}
