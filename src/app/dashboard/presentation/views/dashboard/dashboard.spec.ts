import { beforeEach, describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Dashboard } from './dashboard';
import { AnalyticsApi } from '../../../../analytics/infrastructure/analytics-api';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { IamStore } from '../../../../iam/application/iam.store';

const order = (id: number, status: string) => ({ id, status, totalPrice: 10, scheduledDate: null });

describe('Dashboard', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('provider: shows the four indicators, counts orders by real status and lists the latest first', () => {
    TestBed.configureTestingModule({ imports: [Dashboard, TranslateModule.forRoot()], providers: [provideRouter([]),
      { provide: AnalyticsApi, useValue: { getProviderAnalytics: () => of({ totalOrders: 3, confirmedOrders: 1, cancelledOrders: 1, totalRevenue: 0, monthlyRevenue: [] }) } },
      { provide: OrderingApi, useValue: { orders: (path: string, id: number) => { expect([path, id]).toEqual(['provider', 22]); return of([order(1, 'PENDING'), order(3, 'CANCELLED'), order(2, 'CONFIRMED')]); } } },
      { provide: IamStore, useValue: { isBuyer: () => false, companyId: () => 11, providerId: () => 22 } }] });
    const c = TestBed.createComponent(Dashboard);
    c.detectChanges();
    expect(c.componentInstance.kpis().map(k => k.value)).toEqual([0, 3, 1, 1]);
    expect(c.componentInstance.statusCounts().find(s => s.status === 'PENDING')?.count).toBe(1);
    expect(c.componentInstance.recent().map(o => o.id)).toEqual([3, 2, 1]);
  });
});
