import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { Order, OrderStatus } from '../../../../ordering/domain/model/order.entity';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { BuyerAnalytics, ProviderAnalytics } from '../../../../analytics/domain/model/analytics.entity';
import { AnalyticsApi } from '../../../../analytics/infrastructure/analytics-api';

interface Kpi { label: string; value: number; money?: boolean; hint?: string }

/** Resumen operativo de comprador y proveedor. El análisis mensual vive en /analytics. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly iam = inject(IamStore);
  private readonly analyticsApi = inject(AnalyticsApi);
  private readonly ordering = inject(OrderingApi);
  readonly isBuyer = this.iam.isBuyer();
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly analytics = signal<BuyerAnalytics | ProviderAnalytics | null>(null);
  readonly orders = signal<Order[]>([]);
  readonly statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'];
  readonly statusCounts = computed(() => this.statuses.map(status => ({ status, count: this.orders().filter(order => order.status === status).length })));
  // ponytail: el pedido no trae fecha de creación; el id (autoincremental) ordena de más reciente a más antiguo.
  readonly recent = computed(() => [...this.orders()].sort((a, b) => b.id - a.id).slice(0, 5));
  readonly kpis = computed<Kpi[]>(() => {
    const data = this.analytics();
    if (!data) return [];
    if (this.isBuyer) {
      const buyer = data as BuyerAnalytics;
      return [
        { label: 'analytics.total-spent', value: buyer.totalSpent, money: true, hint: 'analytics.hint-completed-payments' },
        { label: 'analytics.pending-payments', value: buyer.pendingPayments },
        { label: 'analytics.total-orders', value: buyer.totalOrders },
        { label: 'analytics.completed-payments', value: buyer.completedPayments },
      ];
    }
    const provider = data as ProviderAnalytics;
    return [
      { label: 'analytics.total-revenue', value: provider.totalRevenue, money: true, hint: 'analytics.hint-completed-payments' },
      { label: 'analytics.total-orders', value: provider.totalOrders },
      { label: 'analytics.confirmed-orders', value: provider.confirmedOrders, hint: 'analytics.hint-confirmed' },
      { label: 'analytics.cancelled-orders', value: provider.cancelledOrders },
    ];
  });

  constructor() { this.load(); }

  load(): void {
    const id = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    this.error.set(false);
    if (id === null) { this.loading.set(false); this.error.set(true); return; }
    this.loading.set(true);
    forkJoin({
      analytics: this.isBuyer ? this.analyticsApi.getBuyerAnalytics(id) : this.analyticsApi.getProviderAnalytics(id),
      orders: this.ordering.orders(this.isBuyer ? 'company' : 'provider', id),
    }).subscribe({
      next: data => { this.analytics.set(data.analytics); this.orders.set(data.orders); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }
}
