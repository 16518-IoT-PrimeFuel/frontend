import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { Order, OrderStatus } from '../../../../ordering/domain/model/order.entity';
import { Request } from '../../../../ordering/domain/model/request.entity';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { BuyerAnalytics, ProviderAnalytics } from '../../../../analytics/domain/model/analytics.entity';
import { AnalyticsApi } from '../../../../analytics/infrastructure/analytics-api';
import { ProviderEquipmentApi } from '../../../../equipment/infrastructure/provider-equipment.api';
import { ProviderTank } from '../../../../equipment/domain/model/provider-equipment.entity';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';
import { ProviderDelivery } from '../../../../fulfillment/domain/model/provider-delivery.entity';
import { TrendGranularity, groupSalesTrend } from '../../../../analytics/domain/sales-trend';

/** Hoy (yyyy-MM-dd) en America/Lima, no en UTC. */
const todayLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

/** Estado independiente por tarjeta: una falla no oculta el resto del panel. */
interface Card<T> { loading: boolean; error: boolean; data: T }
const CRITICAL_LIMIT = 5;

interface Kpi { label: string; value: number; money?: boolean; hint?: string }

/** Resumen operativo de comprador y proveedor. El análisis mensual vive en /analytics. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BaseChartDirective, CurrencyPipe, DatePipe, DecimalPipe, RouterLink, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly iam = inject(IamStore);
  private readonly analyticsApi = inject(AnalyticsApi);
  private readonly ordering = inject(OrderingApi);
  private readonly equipment = inject(ProviderEquipmentApi);
  private readonly fulfillment = inject(FulfillmentApi);
  readonly isBuyer = this.iam.isBuyer();
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly analytics = signal<BuyerAnalytics | ProviderAnalytics | null>(null);
  readonly orders = signal<Order[]>([]);
  readonly pendingRequests = signal<Request[]>([]);
  readonly criticalTanks = signal<Card<ProviderTank[]>>({ loading: true, error: false, data: [] });
  readonly todayDeliveries = signal<Card<ProviderDelivery[]>>({ loading: true, error: false, data: [] });
  readonly granularity = signal<TrendGranularity>('day');
  readonly granularities: TrendGranularity[] = ['day', 'week', 'month'];
  private readonly today = todayLima();
  private readonly monthStart = `${this.today.slice(0, 8)}01`;
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
      { label: 'analytics.fuel-sold', value: provider.totalFuelSoldLitres, hint: 'analytics.litres-hint' },
      { label: 'analytics.pending-orders', value: provider.pendingOrders },
      { label: 'analytics.total-orders', value: provider.totalOrders },
      { label: 'analytics.confirmed-orders', value: provider.confirmedOrders, hint: 'analytics.hint-confirmed' },
      { label: 'analytics.cancelled-orders', value: provider.cancelledOrders },
    ];
  });

  readonly trend = computed(() => {
    const data = this.analytics() as ProviderAnalytics | null;
    return data && !this.isBuyer ? groupSalesTrend(data.salesTrend ?? [], this.granularity(), this.monthStart, this.today) : [];
  });
  readonly hasSales = computed(() => this.trend().some(point => point.litres > 0));
  readonly chartData = computed<ChartData<'bar', number[], string>>(() => ({
    labels: this.trend().map(point => point.date),
    datasets: [{ data: this.trend().map(point => point.litres), backgroundColor: '#3972c6', borderRadius: 4 }],
  }));
  readonly chartOptions: ChartOptions<'bar'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

  constructor() { this.load(); if (!this.isBuyer) { this.loadCriticalTanks(); this.loadTodayDeliveries(); } }

  loadCriticalTanks(): void {
    this.criticalTanks.set({ loading: true, error: false, data: [] });
    this.equipment.tanks().subscribe({
      next: rows => this.criticalTanks.set({ loading: false, error: false, data: rows.filter(t => t.critical).sort((a, b) => a.levelPercent - b.levelPercent).slice(0, CRITICAL_LIMIT) }),
      error: () => this.criticalTanks.set({ loading: false, error: true, data: [] }),
    });
  }

  loadTodayDeliveries(): void {
    this.todayDeliveries.set({ loading: true, error: false, data: [] });
    this.fulfillment.deliveries(this.today).subscribe({
      next: data => this.todayDeliveries.set({ loading: false, error: false, data }),
      error: () => this.todayDeliveries.set({ loading: false, error: true, data: [] }),
    });
  }

  load(): void {
    const id = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    this.error.set(false);
    if (id === null) { this.loading.set(false); this.error.set(true); return; }
    this.loading.set(true);
    forkJoin({
      analytics: this.isBuyer ? this.analyticsApi.getBuyerAnalytics(id) : this.analyticsApi.getProviderAnalytics(id, this.monthStart, this.today),
      orders: this.ordering.orders(this.isBuyer ? 'company' : 'provider', id),
      requests: this.isBuyer ? of([] as Request[]) : this.ordering.requestInbox(),
    }).subscribe({
      next: data => { this.analytics.set(data.analytics); this.orders.set(data.orders); this.pendingRequests.set(data.requests.filter(r => r.status === 'PENDING')); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }
}
