import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { IamStore } from '../../../../iam/application/iam.store';
import { BuyerAnalytics, MonthlyAmount, PlatformSummary, ProviderAnalytics } from '../../../domain/model/analytics.entity';
import { AnalyticsApi } from '../../../infrastructure/analytics-api';

interface Kpi { label: string; hint: string; value: number; money?: boolean }
type Kind = 'buyer' | 'provider' | 'admin';

/** Análisis por rol: comprador (gasto), proveedor (ingresos) y administrador (resumen de plataforma). */
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [BaseChartDirective, CurrencyPipe, DecimalPipe, TranslatePipe],
  templateUrl: './analytics.html',
  styleUrl: './analytics.css',
})
export class Analytics {
  private readonly iam = inject(IamStore);
  private readonly api = inject(AnalyticsApi);
  private readonly translate = inject(TranslateService);
  readonly kind: Kind = this.iam.role() === 'ADMIN' ? 'admin' : this.iam.isProvider() ? 'provider' : 'buyer';
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly data = signal<BuyerAnalytics | ProviderAnalytics | PlatformSummary | null>(null);
  readonly from = signal('');
  readonly to = signal('');

  /** Serie mensual completa, en orden cronológico (el backend ya la ordena; se reordena por seguridad). */
  readonly series = computed<MonthlyAmount[]>(() => {
    const value = this.data();
    const rows = this.kind === 'buyer' ? (value as BuyerAnalytics | null)?.monthlySpending
      : this.kind === 'provider' ? (value as ProviderAnalytics | null)?.monthlyRevenue : [];
    return [...(rows ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  });
  /** El filtro solo recorta esta serie; los indicadores usan siempre los totales del backend. */
  readonly visible = computed(() => this.series().filter(row => (!this.from() || row.month >= this.from()) && (!this.to() || row.month <= this.to())));
  readonly kpis = computed<Kpi[]>(() => {
    const value = this.data();
    if (!value) return [];
    if (this.kind === 'buyer') {
      const d = value as BuyerAnalytics;
      return [
        { label: 'analytics.total-orders', hint: 'analytics.def-buyer-orders', value: d.totalOrders },
        { label: 'analytics.total-spent', hint: 'analytics.hint-completed-payments', value: d.totalSpent, money: true },
        { label: 'analytics.completed-payments', hint: 'analytics.def-completed-payments', value: d.completedPayments },
        { label: 'analytics.pending-payments', hint: 'analytics.def-pending-payments', value: d.pendingPayments },
      ];
    }
    if (this.kind === 'provider') {
      const d = value as ProviderAnalytics;
      return [
        { label: 'analytics.total-orders', hint: 'analytics.def-provider-orders', value: d.totalOrders },
        { label: 'analytics.confirmed-orders', hint: 'analytics.hint-confirmed', value: d.confirmedOrders },
        { label: 'analytics.cancelled-orders', hint: 'analytics.def-cancelled', value: d.cancelledOrders },
        { label: 'analytics.total-revenue', hint: 'analytics.hint-completed-payments', value: d.totalRevenue, money: true },
      ];
    }
    const d = value as PlatformSummary;
    return [
      { label: 'analytics.total-orders', hint: 'analytics.def-platform-orders', value: d.totalOrders },
      { label: 'analytics.pending-orders', hint: 'analytics.def-pending-orders', value: d.pendingOrders },
      { label: 'analytics.total-deliveries', hint: 'analytics.def-total-deliveries', value: d.totalDeliveries },
      { label: 'analytics.completed-deliveries', hint: 'analytics.def-completed-deliveries', value: d.completedDeliveries },
      { label: 'analytics.total-payments', hint: 'analytics.def-total-payments', value: d.totalPayments },
      { label: 'analytics.total-revenue', hint: 'analytics.hint-completed-payments', value: d.totalRevenue, money: true },
    ];
  });
  readonly chartData = computed<ChartData<'bar', number[], string>>(() => ({
    labels: this.visible().map(row => this.monthLabel(row)),
    datasets: [{ data: this.visible().map(row => row.amount), backgroundColor: '#3972c6', borderRadius: 5 }],
  }));
  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };

  constructor() { this.load(); }

  load(): void {
    this.error.set(false);
    const id = this.kind === 'buyer' ? this.iam.companyId() : this.iam.providerId();
    if (this.kind !== 'admin' && id === null) { this.loading.set(false); this.error.set(true); return; }
    this.loading.set(true);
    const request: Observable<BuyerAnalytics | ProviderAnalytics | PlatformSummary> = this.kind === 'admin' ? this.api.getPlatformSummary()
      : this.kind === 'buyer' ? this.api.getBuyerAnalytics(id!) : this.api.getProviderAnalytics(id!);
    request.subscribe({
      next: value => { this.data.set(value); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  monthLabel(row: MonthlyAmount): string {
    const [year, month] = row.month.split('-').map(Number);
    return new Intl.DateTimeFormat(this.translate.currentLang || undefined, { month: 'short', year: 'numeric' }).format(new Date(year, month - 1, 1));
  }
  setFrom(value: string): void { this.from.set(value); }
  setTo(value: string): void { this.to.set(value); }
}
