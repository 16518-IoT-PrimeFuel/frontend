import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Dashboard } from './dashboard';
import { AnalyticsApi } from '../../../../analytics/infrastructure/analytics-api';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { IamStore } from '../../../../iam/application/iam.store';
import { ProviderEquipmentApi } from '../../../../equipment/infrastructure/provider-equipment.api';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';

const order = (id: number, status: string) => ({ id, status, totalPrice: 10, scheduledDate: null });

describe('Dashboard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('provider: shows monthly indicators, operational cards and latest orders', () => {
    TestBed.configureTestingModule({ imports: [Dashboard, TranslateModule.forRoot()], providers: [provideRouter([]),
      { provide: AnalyticsApi, useValue: { getProviderAnalytics: (_id: number, from: string, to: string) => {
        expect(from).toMatch(/^\d{4}-\d{2}-01$/);
        expect(to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        return of({ totalOrders: 3, confirmedOrders: 1, cancelledOrders: 1, pendingOrders: 1, totalRevenue: 0, totalFuelSoldLitres: 20, salesTrend: [] });
      } } },
      { provide: ProviderEquipmentApi, useValue: { tanks: () => of([{ id: 1, critical: true, levelPercent: 15 }, { id: 2, critical: false, levelPercent: 70 }]) } },
      { provide: FulfillmentApi, useValue: { deliveries: () => of([]) } },
      { provide: OrderingApi, useValue: { requestInbox: () => of([{ id: 1, status: 'PENDING' }, { id: 2, status: 'ACCEPTED' }]), orders: (path: string, id: number) => { expect([path, id]).toEqual(['provider', 22]); return of([order(1, 'PENDING'), order(3, 'CANCELLED'), order(2, 'CONFIRMED')]); } } },
      { provide: IamStore, useValue: { isBuyer: () => false, companyId: () => 11, providerId: () => 22 } }] });
    const c = TestBed.createComponent(Dashboard);
    expect(c.componentInstance.kpis().map(k => k.value)).toEqual([0, 20, 1, 3, 1, 1]);
    expect(c.componentInstance.pendingRequests().map(r => r.id)).toEqual([1]);
    expect(c.componentInstance.criticalTanks().data.map(t => t.id)).toEqual([1]);
    expect(c.componentInstance.todayDeliveries().data).toEqual([]);
    expect(c.componentInstance.statusCounts().find(s => s.status === 'PENDING')?.count).toBe(1);
    expect(c.componentInstance.recent().map(o => o.id)).toEqual([3, 2, 1]);
  });

  it('keeps operational cards and analytics visible when inbox and order reads fail', () => {
    TestBed.configureTestingModule({ imports: [Dashboard, TranslateModule.forRoot()], providers: [provideRouter([]),
      { provide: AnalyticsApi, useValue: { getProviderAnalytics: () => of({ totalOrders: 3, totalFuelSoldLitres: 20, salesTrend: [] }) } },
      { provide: ProviderEquipmentApi, useValue: { tanks: () => of([{ id: 7, name: 'Planta', critical: true, levelPercent: 10 }]) } },
      { provide: FulfillmentApi, useValue: { deliveries: () => of([{ id: 8, physicalState: 'ASSIGNED', buyerCompanyName: 'ACME' }]) } },
      { provide: OrderingApi, useValue: { requestInbox: () => throwError(() => new Error('offline')), orders: () => throwError(() => new Error('offline')) } },
      { provide: IamStore, useValue: { isBuyer: () => false, companyId: () => null, providerId: () => 22 } },
    ] });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe(false);
    expect(fixture.componentInstance.inboxError()).toBe(true);
    expect(fixture.componentInstance.ordersError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Planta');
    expect(fixture.nativeElement.textContent).toContain('ACME');
    expect(fixture.nativeElement.textContent).toContain('analytics.inbox-error');
    expect(fixture.nativeElement.textContent).not.toContain('analytics.no-pending-requests');
  });

  it('shows operational cards even when analytics itself fails', () => {
    TestBed.configureTestingModule({ imports: [Dashboard, TranslateModule.forRoot()], providers: [provideRouter([]),
      { provide: AnalyticsApi, useValue: { getProviderAnalytics: () => throwError(() => new Error('offline')) } },
      { provide: ProviderEquipmentApi, useValue: { tanks: () => of([{ id: 7, name: 'Planta', critical: true, levelPercent: 10 }]) } },
      { provide: FulfillmentApi, useValue: { deliveries: () => of([]) } },
      { provide: OrderingApi, useValue: { requestInbox: () => of([{ id: 9, quantity: 10, unit: 'LITRE', status: 'PENDING' }]), orders: () => of([]) } },
      { provide: IamStore, useValue: { isBuyer: () => false, companyId: () => null, providerId: () => 22 } },
    ] });
    const fixture = TestBed.createComponent(Dashboard);
    fixture.detectChanges();
    expect(fixture.componentInstance.error()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Planta');
    expect(fixture.nativeElement.textContent).toContain('#9');
  });
});
