import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { forkJoin } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { IamStore } from '../../../../iam/application/iam.store';
import { Order, OrderStatus } from '../../../../ordering/domain/model/order.entity';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { BuyerAnalytics, MonthlyAmount, ProviderAnalytics, ReportingApi } from '../../../../reporting/infrastructure/reporting-api';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [BaseChartDirective, CurrencyPipe, DecimalPipe, NgTemplateOutlet, TranslatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly iam = inject(IamStore);
  private readonly reporting = inject(ReportingApi);
  private readonly ordering = inject(OrderingApi);
  readonly isBuyer = this.iam.isBuyer();
  readonly isReport = location.pathname.startsWith('/reporting');
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly analytics = signal<BuyerAnalytics | ProviderAnalytics | null>(null);
  readonly buyerData = computed(() => this.analytics() as BuyerAnalytics | null);
  readonly providerData = computed(() => this.analytics() as ProviderAnalytics | null);
  readonly orders = signal<Order[]>([]);
  readonly statuses: OrderStatus[] = ['PENDING', 'CONFIRMED', 'DISPATCHED', 'PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED', 'CANCELLED'];
  readonly statusCounts = computed(() => this.statuses.map(status => ({ status, count: this.orders().filter(order => order.status === status).length })));
  readonly months = computed(() => {
    const data = this.isBuyer
      ? (this.analytics() as BuyerAnalytics | null)?.monthlySpending
      : (this.analytics() as ProviderAnalytics | null)?.monthlyRevenue;
    return data ?? [];
  });
  readonly chartData = computed<ChartData<'bar', number[], string>>(() => ({
    labels: this.months().map(month => this.monthLabel(month)),
    datasets: [{ data: this.months().map(month => month.amount), backgroundColor: '#3972c6', borderRadius: 5 }],
  }));
  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  constructor() {
    const id = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    if (id === null) { this.loading.set(false); this.error.set(true); return; }

    if (this.isBuyer) {
      forkJoin({ analytics: this.reporting.getBuyerAnalytics(id), orders: this.ordering.orders('company', id) })
        .subscribe({ next: data => { this.analytics.set(data.analytics); this.orders.set(data.orders); this.loading.set(false); }, error: () => this.fail() });
    } else {
      this.reporting.getProviderAnalytics(id)
        .subscribe({ next: data => { this.analytics.set(data); this.loading.set(false); }, error: () => this.fail() });
    }
  }

  monthLabel(value: MonthlyAmount): string {
    const [year, month] = value.month.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(year, month - 1, 1));
  }
  print(): void { window.print(); }

  private fail(): void { this.error.set(true); this.loading.set(false); }
}
