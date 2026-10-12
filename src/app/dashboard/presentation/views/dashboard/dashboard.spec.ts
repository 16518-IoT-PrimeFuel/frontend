import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Dashboard } from './dashboard';
import { DashboardApi } from '../../../infrastructure/dashboard-api';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { IamStore } from '../../../../iam/application/iam.store';
import { IamApi } from '../../../../iam/infrastructure/iam-api';
import { ProviderEquipmentApi } from '../../../../equipment/infrastructure/provider-equipment.api';
import { EquipmentStore } from '../../../../equipment/application/equipment.store';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';
import { NotificationStore } from '../../../../notification/application/notification.store';
import { routes } from '../../../../app.routes';

type Role = 'BUYER' | 'PROVIDER' | 'ADMIN';
const order = (id: number, status: string, fuelProductId = 1, totalPrice = 10, requestedQuantity = 5) => ({ id, status, fuelProductId, totalPrice, requestedQuantity, scheduledDate: null, deliveryAddress: 'Av. Lima 1' });
const months = [{ month: '2026-03', monthIndex: 3, amount: 30 }, { month: '2026-01', monthIndex: 1, amount: 10 }];
const buyer = { totalOrders: 4, totalSpent: 40, completedPayments: 2, pendingPayments: 1, monthlySpending: months };
const provider = { totalOrders: 7, confirmedOrders: 3, cancelledOrders: 2, pendingOrders: 1, totalRevenue: 55, totalFuelSoldLitres: 20, monthlyRevenue: [], salesTrend: [] };
const platform = { totalOrders: 9, totalDeliveries: 5, totalPayments: 6, totalRevenue: 123, pendingOrders: 2, completedDeliveries: 1 };

/** Cada prueba sobrescribe solo las lecturas que le importan; el resto responde vacío. */
async function setup(role: Role, over: { api?: object; ordering?: object; equipment?: object; fulfillment?: object; iamApi?: object; ids?: { companyId?: number | null; providerId?: number | null } } = {}) {
  const store = { sites: signal([]), tanks: signal([]), policies: signal({}), error: signal(''), loading: signal(false), tanksLoading: signal(false), sitesLoading: signal(false), load: vi.fn() };
  TestBed.configureTestingModule({ imports: [Dashboard, TranslateModule.forRoot()], deferBlockBehavior: DeferBlockBehavior.Manual, providers: [provideRouter([]),
    { provide: DashboardApi, useValue: { getBuyerSummary: () => of(buyer), getProviderSummary: () => of(provider), getPlatformSummary: () => of(platform), ...over.api } },
    { provide: OrderingApi, useValue: { orders: () => of([]), allProducts: () => of([]), products: () => of([]), requests: () => of([]), requestInbox: () => of([]), ...over.ordering } },
    { provide: ProviderEquipmentApi, useValue: { tanks: () => of([]), buyerCompanies: () => of([]), ...over.equipment } },
    { provide: FulfillmentApi, useValue: { getTankers: () => of([]), getDrivers: () => of([]), deliveries: () => of([]), ...over.fulfillment } },
    { provide: IamApi, useValue: { getOrganizations: () => of([{ id: 1, name: 'ACME Org', type: 'CUSTOMER', role: 'OWNER' }]), getMembers: () => of([]), getBuyerCompany: () => of({ name: 'ACME', ruc: '20123456789' }), getProviderCompany: () => of({ name: 'Grifos', ruc: '20999999999' }), ...over.iamApi } },
    { provide: IamStore, useValue: { role: () => role, companyId: () => 11, providerId: () => 22, organizationId: () => 1, session: () => null, ...Object.fromEntries(Object.entries(over.ids ?? {}).map(([key, value]) => [key, () => value])) } },
    { provide: EquipmentStore, useValue: store },
    { provide: NotificationStore, useValue: { unreadCount: () => 3 } },
  ] });
  await TestBed.compileComponents();
  const fixture = TestBed.createComponent(Dashboard);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, store, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('Dashboard', () => {
  beforeEach(() => TestBed.resetTestingModule());
  afterEach(() => history.replaceState(null, ''));

  it('buyer: loads by session companyId, shows the organization and orders the monthly series', async () => {
    const getBuyerSummary = vi.fn(() => of(buyer));
    const { component, store, text } = await setup('BUYER', { api: { getBuyerSummary } });
    expect(getBuyerSummary).toHaveBeenCalledWith(11);
    expect(component.kpis().map(k => k.value)).toEqual([40, 1, 2, 4]);
    expect(component.series().map(r => r.month)).toEqual(['2026-01', '2026-03']);
    expect(component.range()).toBe('history');
    component.range.set('month');
    expect(component.trend()).toHaveLength(1);
    expect(store.load).toHaveBeenCalled();
    expect(text()).toContain('ACME Org');
    expect(text()).toContain('20123456789');
  });

  it('buyer without organizations is invited to register one; a failed read is not an invitation', async () => {
    expect((await setup('BUYER', { iamApi: { getOrganizations: () => of([]) } })).text()).toContain('dashboard.no-org-title');
    TestBed.resetTestingModule();
    expect((await setup('BUYER', { iamApi: { getOrganizations: () => throwError(() => new Error('offline')) } })).text()).not.toContain('dashboard.no-org-title');
  });

  it('groups purchased fuel by product without cancelled orders and lists orders on the way', async () => {
    const { component } = await setup('BUYER', { ordering: {
      orders: (path: string, id: number) => { expect([path, id]).toEqual(['company', 11]); return of([order(1, 'DELIVERED', 1, 10, 5), order(2, 'DISPATCHED', 2, 30, 8), order(3, 'CANCELLED', 1, 99, 9), order(4, 'PENDING', 1, 5, 1)]); },
      allProducts: () => of([{ id: 1, name: 'Diesel B5', unit: 'GALLON' }, { id: 2, name: 'GLP', unit: 'LITRE' }]),
    } });
    expect(component.productRows().map(r => [r.name, r.amount, r.quantity, r.share])).toEqual([['GLP', 30, 8, 100], ['Diesel B5', 15, 6, 50]]);
    expect(component.inTransit().map(r => r.order.id)).toEqual([2]);
    expect(component.recent().map(r => r.order.id)).toEqual([4, 3, 2, 1]);
    expect(component.rings().map(r => [r.count, r.percent])).toEqual([[1, 25], [2, 50], [1, 25]]);
    expect(component.donuts().map(d => [d.id, d.center])).toEqual([['payments', 3], ['orders', 4], ['products', 2]]);
  });

  it('provider: totals come from the full summary, the trend from the current month, and operations are integrated', async () => {
    const getProviderSummary = vi.fn((_id: number, _from?: string, _to?: string) => of(provider));
    const { component, text } = await setup('PROVIDER', { api: { getProviderSummary },
      ordering: { requestInbox: () => of([{ id: 1, status: 'PENDING' }, { id: 2, status: 'ACCEPTED' }]) },
      equipment: { tanks: () => of([{ id: 1, name: 'Planta', critical: true, levelPercent: 15, lowLevelPercent: 20, siteId: 9, customerAccountId: 4 }, { id: 2, name: 'Sur', critical: false, levelPercent: 70 }]),
        buyerCompanies: () => of([{ id: 5, name: 'Minera', tankCount: 2, criticalTankCount: 1, activeOrderCount: 3, sites: [{ id: 9, customerAccountId: 4, name: 'Base', address: null }] }]) },
      fulfillment: { getTankers: () => of([{ id: 3, licensePlate: 'ABC-123', brand: 'Volvo', model: 'FH', capacity: 9000, unit: 'GALLON', status: 'IN_ROUTE', active: true }]),
        getDrivers: () => of([{ id: 1, status: 'AVAILABLE' }, { id: 2, status: 'ASSIGNED' }]),
        deliveries: () => of([{ id: 8, orderId: 1, physicalState: 'STARTED', siteId: 9, buyerCompanyName: 'Minera', tanker: { id: 3, licensePlate: 'ABC-123' } }]) } });
    expect(getProviderSummary.mock.calls[0]).toEqual([22]);
    expect(getProviderSummary.mock.calls[1][1]).toMatch(/^\d{4}-\d{2}-01$/);
    expect(getProviderSummary.mock.calls[1][2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(component.kpis().map(k => k.value)).toEqual([55, 20, 7, 1]);
    expect(component.pendingRequests().map(r => r.id)).toEqual([1]);
    expect(component.lowTanks().map(t => t.id)).toEqual([1]);
    expect(component.tankCards().map(t => [t.id, t.low])).toEqual([[1, true], [2, false]]);
    expect(component.donuts().map(d => d.id)).toEqual(['orders', 'products', 'tanks']);
    expect(component.mapSites().map(s => s.id)).toEqual([9]);
    expect(component.fleet()[0].delivery?.id).toBe(8);
    expect(component.deliverySites()).toEqual([9]);
    expect(component.availableDrivers()).toBe(1);
    expect(text()).toContain('ABC-123');
    expect(text()).toContain('Planta');
    expect(text()).toContain('Minera');
  });

  it('a failing card shows its own retry and never hides the others', async () => {
    const { component, text } = await setup('PROVIDER', { api: { getProviderSummary: () => throwError(() => new Error('offline')) },
      ordering: { orders: () => throwError(() => new Error('offline')) },
      equipment: { tanks: () => of([{ id: 7, name: 'Planta', critical: true, levelPercent: 10 }]) } });
    expect(component.summary().error).toBe(true);
    expect(component.orders().error).toBe(true);
    expect(text()).toContain('dashboard.card-error');
    expect(text()).toContain('Planta');
  });

  it('retry reloads the failed card', async () => {
    const getPlatformSummary = vi.fn().mockReturnValueOnce(throwError(() => new Error('x'))).mockReturnValue(of(platform));
    const { fixture, component } = await setup('ADMIN', { api: { getPlatformSummary } });
    expect(component.summary().error).toBe(true);
    ((fixture.nativeElement as HTMLElement).querySelector('.db-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.summary().data).toEqual(platform);
  });

  it('buyer: daily spending feeds the period selector and organization members are listed', async () => {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const getMembers = vi.fn(() => of([{ userId: 5, username: 'ana', role: 'ADMIN' }]));
    const { component, text } = await setup('BUYER', { api: { getBuyerSummary: () => of({ ...buyer, spendingTrend: [{ date: today, amount: 70 }] }) }, iamApi: { getMembers } });
    expect(getMembers).toHaveBeenCalledWith(1);
    component.range.set('day');
    expect(component.trend().at(-1)).toEqual({ date: today, litres: 70 });
    expect(component.hasChart()).toBe(true);
    expect(text()).toContain('ana');
  });

  it('admin: only the platform summary, with its six indicators', async () => {
    const orders = vi.fn(() => of([]));
    const { component, text } = await setup('ADMIN', { ordering: { orders } });
    expect(component.kpis().map(k => k.value)).toEqual([123, 9, 2, 5, 1, 6]);
    expect(orders).not.toHaveBeenCalled();
    expect(text()).not.toContain('dashboard.recent-orders');
  });

  it('a session without company id reports the error instead of calling the API', async () => {
    const getBuyerSummary = vi.fn(() => of(buyer));
    const { component } = await setup('BUYER', { api: { getBuyerSummary }, ids: { companyId: null } });
    expect(getBuyerSummary).not.toHaveBeenCalled();
    expect(component.summary().error).toBe(true);
  });

  it('shows the welcome notice only once, when arriving with the account-created mark', async () => {
    const create = async () => { TestBed.resetTestingModule(); return (await setup('BUYER')).fixture.nativeElement as HTMLElement; };
    expect((await create()).textContent).not.toContain('auth.register.created');

    history.replaceState({ navigationId: 2, accountCreated: true }, '');
    expect((await create()).querySelector('.db-welcome[role="status"]')?.textContent).toContain('auth.register.created');
    expect(history.state).toEqual({ navigationId: 2 });
    // Recarga o nueva visita al panel: la marca ya se consumió.
    expect((await create()).textContent).not.toContain('auth.register.created');
  });
});

describe('dashboard routes', () => {
  it('redirects the legacy analytics and reporting paths to /dashboard', async () => {
    const redirect = (path: string) => routes.find(r => r.path === path)?.redirectTo;
    expect(redirect('analytics')).toBe('dashboard');
    expect(redirect('reporting')).toBe('dashboard');
    expect(redirect('reporting/report-main')).toBe('dashboard');
  });
});
