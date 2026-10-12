import { MoneyPipe } from '../../../../shared/presentation/pipe/money.pipe';
import { FuelUnitPipe } from '../../../../shared/presentation/pipe/fuel-unit.pipe';
import { Component, computed, DestroyRef, inject, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { IamApi, OrganizationMember, OrganizationProfile } from '../../../../iam/infrastructure/iam-api';
import { Order, OrderStatus } from '../../../../ordering/domain/model/order.entity';
import { Request } from '../../../../ordering/domain/model/request.entity';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { BuyerSummary, MonthlyAmount, PlatformSummary, ProviderSummary } from '../../../domain/model/dashboard.entity';
import { DashboardApi } from '../../../infrastructure/dashboard-api';
import { TrendGranularity, groupSalesTrend } from '../../../domain/sales-trend';
import { ProviderEquipmentApi } from '../../../../equipment/infrastructure/provider-equipment.api';
import { ProviderBuyerCompany, ProviderTank } from '../../../../equipment/domain/model/provider-equipment.entity';
import { RefillPolicy, Site, Tank } from '../../../../equipment/domain/model/equipment.entity';
import { EquipmentStore } from '../../../../equipment/application/equipment.store';
import { TankMap } from '../../../../equipment/presentation/views/tank-list/tank-map';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';
import { ProviderDelivery } from '../../../../fulfillment/domain/model/provider-delivery.entity';
import { Tanker } from '../../../../fulfillment/domain/model/tanker.entity';
import { Driver } from '../../../../fulfillment/domain/model/driver.entity';
import { NotificationStore } from '../../../../notification/application/notification.store';

/** Hoy (yyyy-MM-dd) en America/Lima, no en UTC. */
const todayLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

type Kind = 'buyer' | 'provider' | 'admin';
type Range = TrendGranularity | 'history';
type Summary = BuyerSummary | ProviderSummary | PlatformSummary;

/** Estado independiente por tarjeta: una falla no oculta el resto del panel. */
interface CardState<T> { loading: boolean; error: boolean; data: T }
type Card<T> = WritableSignal<CardState<T>> & { load(): void };

interface Kpi { label: string; value: number; link: string; money?: boolean; hint?: string }
interface Shortcut { label: string; icon: string; link: string; value?: number }
interface Slice { label: string; value: number; color: string; money?: boolean; plain?: boolean }
interface Donut { id: string; title: string; link: string; linkLabel: string; card: Card<any>; center: number; caption: string; slices: Slice[]; chart: ChartData<'doughnut', number[], string> }

const LIST_LIMIT = 5;
const IN_TRANSIT: OrderStatus[] = ['DISPATCHED', 'IN_PROGRESS'];
const ACTIVE_DELIVERY = ['ASSIGNED', 'STARTED', 'ARRIVED', 'DELIVERING'];
const TANK_LIMIT = 8;
const PRODUCT_COLORS = ['#1e3a8a', '#3b82f6', '#93c5fd', '#f59e0b', '#94a3b8'];

/** Inicio de la aplicación: resumen por rol (comprador, distribuidor, administrador) con acceso a cada sección. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MoneyPipe, FuelUnitPipe, BaseChartDirective, DatePipe, DecimalPipe, NgTemplateOutlet, RouterLink, TranslatePipe, MatIconModule, TankMap],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {
  private readonly iam = inject(IamStore);
  private readonly iamApi = inject(IamApi);
  private readonly api = inject(DashboardApi);
  private readonly ordering = inject(OrderingApi);
  private readonly providerEquipment = inject(ProviderEquipmentApi);
  private readonly fulfillment = inject(FulfillmentApi);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly equipment = inject(EquipmentStore);
  protected readonly notifications = inject(NotificationStore);

  readonly kind: Kind = this.iam.role() === 'ADMIN' ? 'admin' : this.iam.role() === 'PROVIDER' ? 'provider' : 'buyer';
  readonly isBuyer = this.kind === 'buyer';
  readonly isProvider = this.kind === 'provider';
  readonly accountCreated = history.state?.accountCreated === true;
  private readonly ownerId = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
  private readonly today = todayLima();
  private readonly monthStart = `${this.today.slice(0, 8)}01`;

  readonly summary = this.card<Summary | null>(null, () => this.kind === 'admin' ? this.api.getPlatformSummary()
    : this.ownerId === null ? null : this.isBuyer ? this.api.getBuyerSummary(this.ownerId) : this.api.getProviderSummary(this.ownerId));
  /** Ventas diarias del mes en curso (solo distribuidor); los totales salen de `summary`. */
  readonly sales = this.card<ProviderSummary | null>(null, () => this.ownerId === null ? null : this.api.getProviderSummary(this.ownerId, this.monthStart, this.today));
  readonly orders = this.card<Order[]>([], () => this.ownerId === null ? null : this.ordering.orders(this.isBuyer ? 'company' : 'provider', this.ownerId));
  readonly products = this.card<{ id: number; name: string; unit: string }[]>([], () => this.isBuyer ? this.ordering.allProducts() : this.ownerId === null ? null : this.ordering.products(this.ownerId));
  readonly company = this.card<{ name: string; ruc: string } | null>(null, () => this.ownerId === null ? null : this.isBuyer ? this.iamApi.getBuyerCompany(this.ownerId) : this.iamApi.getProviderCompany(this.ownerId));
  readonly organizations = this.card<OrganizationProfile[]>([], () => this.iamApi.getOrganizations());
  private readonly organizationId = this.iam.organizationId() ?? this.iam.session()?.memberships?.[0]?.organizationId ?? null;
  readonly members = this.card<OrganizationMember[]>([], () => this.organizationId === null ? null : this.iamApi.getMembers(this.organizationId));
  readonly requests = this.card<Request[]>([], () => this.isBuyer ? this.ordering.requests() : this.ordering.requestInbox());
  readonly tanks = this.card<ProviderTank[]>([], () => this.providerEquipment.tanks());
  readonly clients = this.card<ProviderBuyerCompany[]>([], () => this.providerEquipment.buyerCompanies());
  readonly tankers = this.card<Tanker[]>([], () => this.fulfillment.getTankers());
  readonly drivers = this.card<Driver[]>([], () => this.fulfillment.getDrivers());
  readonly deliveries = this.card<ProviderDelivery[]>([], () => this.fulfillment.deliveries(this.today));

  readonly range = signal<Range>(this.isProvider ? 'day' : 'history');
  readonly ranges: Range[] = ['day', 'week', 'month', 'history'];
  readonly mapTank = signal<number | null>(null);

  // ── Cabecera ────────────────────────────────────────────────────────────────
  readonly organization = computed(() => this.organizations().data.find(o => o.id === this.organizationId) ?? this.organizations().data[0] ?? null);
  readonly title = computed(() => this.organization()?.name ?? this.company().data?.name ?? '');
  /** Solo cuando la lista se leyó y está vacía: un fallo de red no debe invitar a registrar una organización. */
  readonly noOrganization = computed(() => this.isBuyer && this.ready(this.organizations) && !this.organizations().data.length);

  // ── Indicadores ─────────────────────────────────────────────────────────────
  readonly kpis = computed<Kpi[]>(() => {
    const data = this.summary().data;
    if (!data) return [];
    if (this.kind === 'buyer') {
      const d = data as BuyerSummary;
      return [
        { label: 'dashboard.total-spent', value: d.totalSpent, money: true, hint: 'dashboard.hint-completed-payments', link: '/ordering/payment-history' },
        { label: 'dashboard.pending-payments', value: d.pendingPayments, hint: 'dashboard.def-pending-payments', link: '/ordering/payment-history' },
        { label: 'dashboard.completed-payments', value: d.completedPayments, hint: 'dashboard.def-completed-payments', link: '/ordering/payment-history' },
        { label: 'dashboard.total-orders', value: d.totalOrders, hint: 'dashboard.def-buyer-orders', link: '/ordering/order-list' },
      ];
    }
    if (this.kind === 'provider') {
      const d = data as ProviderSummary;
      return [
        { label: 'dashboard.total-revenue', value: d.totalRevenue, money: true, hint: 'dashboard.hint-completed-payments', link: '/payments' },
        { label: 'dashboard.fuel-sold', value: d.totalFuelSoldLitres, hint: 'dashboard.litres-hint', link: '/ordering/order-list' },
        { label: 'dashboard.total-orders', value: d.totalOrders, hint: 'dashboard.def-provider-orders', link: '/ordering/order-list' },
        { label: 'dashboard.pending-orders', value: d.pendingOrders, hint: 'dashboard.def-pending-orders', link: '/ordering/order-list' },
      ];
    }
    const d = data as PlatformSummary;
    return [
      { label: 'dashboard.total-revenue', value: d.totalRevenue, money: true, hint: 'dashboard.hint-completed-payments', link: '/admin' },
      { label: 'dashboard.total-orders', value: d.totalOrders, hint: 'dashboard.def-platform-orders', link: '/admin' },
      { label: 'dashboard.pending-orders', value: d.pendingOrders, hint: 'dashboard.def-pending-orders', link: '/admin' },
      { label: 'dashboard.total-deliveries', value: d.totalDeliveries, hint: 'dashboard.def-total-deliveries', link: '/admin' },
      { label: 'dashboard.completed-deliveries', value: d.completedDeliveries, hint: 'dashboard.def-completed-deliveries', link: '/admin' },
      { label: 'dashboard.total-payments', value: d.totalPayments, hint: 'dashboard.def-total-payments', link: '/admin' },
    ];
  });

  /** Reparto de pedidos: entregados, en curso (el resto) y cancelados. Porcentajes sobre el total de pedidos. */
  readonly rings = computed(() => {
    const rows = this.orders().data, total = rows.length;
    const delivered = rows.filter(order => order.status === 'DELIVERED').length;
    const cancelled = rows.filter(order => order.status === 'CANCELLED').length;
    return [
      { label: 'dashboard.ring-delivered', color: '#15803d', count: delivered },
      { label: 'dashboard.ring-active', color: '#1e3a8a', count: total - delivered - cancelled },
      { label: 'dashboard.ring-cancelled', color: '#b91c1c', count: cancelled },
    ].map(ring => ({ ...ring, percent: total ? Math.round(ring.count / total * 100) : 0 }));
  });

  // ── Gráfico ─────────────────────────────────────────────────────────────────
  /** Serie mensual completa (gasto del comprador o ingresos del distribuidor), en orden cronológico. */
  readonly series = computed<MonthlyAmount[]>(() => {
    const data = this.summary().data;
    const rows = this.isBuyer ? (data as BuyerSummary | null)?.monthlySpending : this.isProvider ? (data as ProviderSummary | null)?.monthlyRevenue : [];
    return [...(rows ?? [])].sort((a, b) => a.month.localeCompare(b.month));
  });
  readonly trend = computed(() => {
    const range = this.range();
    if (range === 'history') return [];
    // El gasto diario del comprador reutiliza la agrupación de ventas: el valor viaja en `litres`.
    const points = this.isBuyer ? ((this.summary().data as BuyerSummary | null)?.spendingTrend ?? []).map(point => ({ date: point.date, litres: point.amount }))
      : this.sales().data?.salesTrend ?? [];
    return groupSalesTrend(points, range, this.monthStart, this.today);
  });
  readonly chartCard = computed(() => this.isBuyer || this.range() === 'history' ? this.summary : this.sales);
  readonly hasChart = computed(() => this.range() === 'history' ? this.series().length > 0 : this.trend().some(point => point.litres > 0));
  readonly chartData = computed<ChartData<'bar', number[], string>>(() => {
    const history = this.range() === 'history';
    return {
      labels: history ? this.series().map(row => this.monthLabel(row.month)) : this.trend().map(point => point.date),
      datasets: [{ data: history ? this.series().map(row => row.amount) : this.trend().map(point => point.litres), backgroundColor: '#1e3a8a', hoverBackgroundColor: '#3b5fc4', borderRadius: 4, maxBarThickness: 40 }],
    };
  });
  readonly chartOptions: ChartOptions<'bar'> = {
    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { color: '#4b5563' } }, y: { beginAtZero: true, border: { display: false }, grid: { color: '#eef0f4' }, ticks: { color: '#4b5563' } } },
  };

  // ── Productos y pedidos ─────────────────────────────────────────────────────
  private readonly productById = computed(() => new Map(this.products().data.map(product => [product.id, product])));
  /** Combustible comprado (o vendido) por producto; los pedidos cancelados no cuentan. */
  readonly productRows = computed(() => {
    const groups = new Map<number, { id: number; quantity: number; amount: number }>();
    for (const order of this.orders().data) {
      if (order.status === 'CANCELLED') continue;
      const row = groups.get(order.fuelProductId) ?? { id: order.fuelProductId, quantity: 0, amount: 0 };
      row.quantity += order.requestedQuantity; row.amount += order.totalPrice;
      groups.set(order.fuelProductId, row);
    }
    const rows = [...groups.values()].sort((a, b) => b.amount - a.amount);
    const top = rows[0]?.amount || 1;
    return rows.slice(0, LIST_LIMIT).map(row => ({ ...row, ...this.productLabel(row.id), share: Math.round(row.amount / top * 100) }));
  });
  // ponytail: el pedido no trae fecha de creación; el id (autoincremental) ordena de más reciente a más antiguo.
  readonly recent = computed(() => [...this.orders().data].sort((a, b) => b.id - a.id).slice(0, 6).map(order => ({ order, ...this.productLabel(order.fuelProductId) })));
  readonly inTransit = computed(() => this.orders().data.filter(order => IN_TRANSIT.includes(order.status)).sort((a, b) => b.id - a.id).slice(0, LIST_LIMIT)
    .map(order => ({ order, ...this.productLabel(order.fuelProductId) })));
  readonly pendingRequests = computed(() => this.requests().data.filter(request => request.status === 'PENDING'));

  // ── Gráficos circulares ─────────────────────────────────────────────────────
  readonly donuts = computed<Donut[]>(() => {
    const donut = (id: string, title: string, link: string, linkLabel: string, card: Card<any>, caption: string, slices: Slice[], center = slices.reduce((sum, slice) => sum + slice.value, 0)): Donut => ({
      id, title, link, linkLabel, card, caption, slices, center,
      chart: { labels: slices.map(slice => slice.plain ? slice.label : this.translate.instant(slice.label)), datasets: [{ data: slices.map(slice => slice.value), backgroundColor: slices.map(slice => slice.color), borderWidth: 2, borderColor: '#fff', hoverOffset: 4 }] },
    });
    const orders = donut('orders', 'dashboard.orders-by-status', '/ordering/order-list', 'dashboard.all-orders', this.orders, 'dashboard.total-orders',
      this.rings().map(ring => ({ label: ring.label, value: ring.count, color: ring.color })));
    const products = donut('products', this.isBuyer ? 'dashboard.products-bought' : 'dashboard.products-sold', '/fuel-products', this.isBuyer ? 'inventory.catalog' : 'nav.inventory', this.orders, 'dashboard.products-count',
      this.productRows().map((row, index) => ({ label: row.name, value: row.amount, color: PRODUCT_COLORS[index % PRODUCT_COLORS.length], money: true, plain: true })), this.productRows().length);
    if (this.isBuyer) {
      const summary = this.summary().data as BuyerSummary | null;
      return [donut('payments', 'dashboard.payments', '/ordering/payment-history', 'payment-history.title', this.summary, 'dashboard.total-payments', [
        { label: 'dashboard.completed-payments', value: summary?.completedPayments ?? 0, color: '#15803d' },
        { label: 'dashboard.pending-payments', value: summary?.pendingPayments ?? 0, color: '#f59e0b' },
      ]), orders, products];
    }
    const low = this.tanks().data.filter(tank => tank.critical).length;
    return [orders, products, donut('tanks', 'dashboard.client-tanks', '/clients', 'nav.clients', this.tanks, 'dashboard.tanks', [
      { label: 'equipment.status-ok', value: this.tanks().data.length - low, color: '#1e3a8a' },
      { label: 'equipment.status-low', value: low, color: '#b45309' },
    ])];
  });
  readonly donutOptions: ChartOptions<'doughnut'> = { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } };

  // ── Mapa y tanques ──────────────────────────────────────────────────────────
  readonly mapSites = computed<Site[]>(() => this.isBuyer ? this.equipment.sites()
    : this.clients().data.flatMap(client => client.sites).map(site => ({ id: site.id, customerAccountId: site.customerAccountId, name: site.name, address: site.address ?? undefined, active: true })));
  readonly mapTanks = computed<Tank[]>(() => this.isBuyer ? this.equipment.tanks()
    : this.tanks().data.map(tank => ({ id: tank.id, customerAccountId: tank.customerAccountId, siteId: tank.siteId, name: tank.name, fuelType: tank.fuelType, unit: tank.unit, capacity: tank.capacity, currentLevel: tank.currentLevel, levelSource: tank.levelSource, active: true })));
  /** El mapa solo lee `lowLevelPercent` de la política para marcar el nivel bajo. */
  readonly mapPolicies = computed<Record<number, RefillPolicy | null>>(() => this.isBuyer ? this.equipment.policies()
    : Object.fromEntries(this.tanks().data.map(tank => [tank.id, { lowLevelPercent: tank.lowLevelPercent } as RefillPolicy])));
  readonly mapLoading = computed(() => this.isBuyer ? this.equipment.loading() || this.equipment.tanksLoading() || this.equipment.sitesLoading() : this.tanks().loading || this.clients().loading);
  /** Tanques del comprador o de los clientes del distribuidor, del más vacío al más lleno. `low` es null si no hay política. */
  readonly allTanks = computed(() => {
    const percent = (level: number, capacity: number) => capacity > 0 ? Math.min(100, Math.max(0, level / capacity * 100)) : 0;
    const rows = this.isBuyer
      ? this.equipment.tanks().map(tank => {
        const value = percent(tank.currentLevel, tank.capacity), threshold = this.equipment.policies()[tank.id]?.lowLevelPercent;
        return { id: tank.id, name: tank.name, place: this.equipment.sites().find(site => site.id === tank.siteId)?.name ?? null, fuelType: tank.fuelType ?? '', capacity: tank.capacity, unit: tank.unit as string | undefined,
          percent: value, low: threshold == null ? null : value <= threshold, link: ['/tanks'], query: { tank: String(tank.id) } as Record<string, string> };
      })
      : this.tanks().data.map(tank => ({ id: tank.id, name: tank.name, place: tank.siteName, fuelType: tank.fuelType ?? '', capacity: tank.capacity, unit: tank.unit as string | undefined,
        percent: tank.levelPercent, low: tank.critical as boolean | null, link: ['/clients', 'tank', String(tank.id)], query: {} as Record<string, string> }));
    return rows.sort((a, b) => a.percent - b.percent);
  });
  readonly tankCards = computed(() => this.allTanks().slice(0, TANK_LIMIT));
  /** Tanques que piden reposición. */
  readonly lowTanks = computed(() => this.allTanks().filter(tank => tank.low).slice(0, LIST_LIMIT));
  readonly tanksLoading = computed(() => this.isBuyer ? this.equipment.tanksLoading() : this.tanks().loading);
  readonly tanksError = computed(() => this.isBuyer ? !!this.equipment.error() : this.tanks().error);
  readonly tanksLink = this.isBuyer ? '/tanks' : '/clients';
  readonly deliverySites = computed(() => this.deliveries().data.filter(delivery => delivery.siteId !== null && ACTIVE_DELIVERY.includes(delivery.physicalState)).map(delivery => delivery.siteId!));

  // ── Flota y personas ────────────────────────────────────────────────────────
  readonly fleet = computed(() => this.tankers().data.filter(tanker => tanker.active !== false).map(tanker => ({ tanker,
    delivery: this.deliveries().data.find(delivery => delivery.tanker?.id === tanker.id && ACTIVE_DELIVERY.includes(delivery.physicalState)) ?? null }))
    .sort((a, b) => Number(!!b.delivery) - Number(!!a.delivery)).slice(0, 4));
  readonly topClients = computed(() => [...this.clients().data].sort((a, b) => b.criticalTankCount - a.criticalTankCount || b.activeOrderCount - a.activeOrderCount).slice(0, LIST_LIMIT));
  readonly availableDrivers = computed(() => this.drivers().data.filter(driver => driver.status === 'AVAILABLE').length);

  // ── Atajos a secciones sin tarjeta propia ───────────────────────────────────
  readonly shortcuts = computed<Shortcut[]>(() => {
    if (this.kind === 'admin') return [{ label: 'nav.admin', icon: 'admin_panel_settings', link: '/admin' }];
    const count = <T>(card: Card<T[]>, rows = card().data) => this.ready(card) ? rows.length : undefined;
    const common: Shortcut[] = [
      { label: 'nav.notifications', icon: 'notifications', link: '/notification/notification-list', value: this.notifications.unreadCount() },
      { label: 'profile.title', icon: 'manage_accounts', link: '/profile' },
    ];
    if (this.isBuyer) return [
      { label: 'dashboard.new-request', icon: 'add_circle', link: '/ordering/request-form' },
      { label: 'dashboard.pending-requests', icon: 'pending_actions', link: '/ordering/request-list', value: count(this.requests, this.pendingRequests()) },
      { label: 'inventory.catalog', icon: 'local_gas_station', link: '/fuel-products', value: count(this.products) },
      ...common,
    ];
    return [
      { label: 'dashboard.pending-requests', icon: 'pending_actions', link: '/ordering/request-list', value: count(this.requests, this.pendingRequests()) },
      { label: 'nav.inventory', icon: 'inventory_2', link: '/fuel-products', value: count(this.products) },
      { label: 'dashboard.today-deliveries', icon: 'local_shipping', link: '/fulfillment/delivery-list', value: count(this.deliveries) },
      ...common,
    ];
  });

  constructor() {
    // La marca se consume una vez: no debe reaparecer al recargar ni al volver al panel.
    if (this.accountCreated) history.replaceState({ ...history.state, accountCreated: undefined }, '');
    this.summary.load();
    if (this.kind === 'admin') return;
    for (const card of [this.orders, this.products, this.company, this.organizations, this.requests]) card.load();
    if (this.isBuyer) { this.equipment.load(); this.members.load(); }
    else for (const card of [this.sales, this.tanks, this.clients, this.tankers, this.drivers, this.deliveries]) card.load();
  }

  protected ready(card: () => CardState<unknown>): boolean { return !card().loading && !card().error; }
  protected monthLabel(month: string): string {
    const [year, index] = month.split('-').map(Number);
    return new Intl.DateTimeFormat(this.translate.currentLang || undefined, { month: 'short', year: 'numeric' }).format(new Date(year, index - 1, 1));
  }
  private productLabel(id: number): { name: string; unit: string | null } {
    const product = this.productById().get(id);
    return { name: product?.name ?? `#${id}`, unit: product?.unit ?? null };
  }

  /** Tarjeta con su propia carga: `source` devuelve `null` cuando falta el identificador de la sesión. */
  private card<T>(empty: T, source: () => Observable<T> | null): Card<T> {
    const state = signal<CardState<T>>({ loading: true, error: false, data: empty });
    let request: Subscription | undefined;
    const load = () => {
      request?.unsubscribe();
      const stream = source();
      if (!stream) { state.set({ loading: false, error: true, data: empty }); return; }
      state.set({ loading: true, error: false, data: empty });
      request = stream.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: data => state.set({ loading: false, error: false, data }),
        error: () => state.set({ loading: false, error: true, data: empty }),
      });
    };
    return Object.assign(state, { load });
  }
}
