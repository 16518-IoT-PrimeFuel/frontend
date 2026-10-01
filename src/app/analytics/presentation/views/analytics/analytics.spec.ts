import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { Analytics } from './analytics';
import { AnalyticsApi } from '../../../infrastructure/analytics-api';
import { IamStore } from '../../../../iam/application/iam.store';
import { routes } from '../../../../app.routes';

const months = [{ month: '2026-03', monthIndex: 3, amount: 30 }, { month: '2026-01', monthIndex: 1, amount: 10 }];
const buyer = { totalOrders: 4, totalSpent: 40, completedPayments: 2, pendingPayments: 1, monthlySpending: months };
const provider = { totalOrders: 7, confirmedOrders: 3, cancelledOrders: 2, totalRevenue: 55, monthlyRevenue: [] };
const platform = { totalOrders: 9, totalDeliveries: 5, totalPayments: 6, totalRevenue: 123, pendingOrders: 2, completedDeliveries: 1 };

function setup(role: 'BUYER' | 'PROVIDER' | 'ADMIN', api: Partial<Record<keyof AnalyticsApi, unknown>>) {
  TestBed.configureTestingModule({ imports: [Analytics, TranslateModule.forRoot()], providers: [
    { provide: AnalyticsApi, useValue: api },
    { provide: IamStore, useValue: { role: () => role, isProvider: () => role === 'PROVIDER', companyId: () => 11, providerId: () => 22 } },
  ] });
  const fixture = TestBed.createComponent(Analytics);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
}

describe('Analytics', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('buyer: loads by session companyId, covers every field and orders the series chronologically', () => {
    const getBuyerAnalytics = vi.fn(() => of(buyer));
    const { component } = setup('BUYER', { getBuyerAnalytics });
    expect(getBuyerAnalytics).toHaveBeenCalledWith(11);
    expect(component.kpis().map(k => k.value)).toEqual([4, 40, 2, 1]);
    expect(component.series().map(r => r.month)).toEqual(['2026-01', '2026-03']);
  });

  it('range filter only trims the monthly series, never the totals', () => {
    const { component } = setup('BUYER', { getBuyerAnalytics: () => of(buyer) });
    component.setFrom('2026-03');
    expect(component.visible().map(r => r.month)).toEqual(['2026-03']);
    expect(component.kpis().map(k => k.value)).toEqual([4, 40, 2, 1]);
  });

  it('provider: covers every field; empty series is not an error and zero is kept', () => {
    const getProviderAnalytics = vi.fn(() => of({ ...provider, cancelledOrders: 0 }));
    const { component, text } = setup('PROVIDER', { getProviderAnalytics });
    expect(getProviderAnalytics).toHaveBeenCalledWith(22);
    expect(component.kpis().map(k => k.value)).toEqual([7, 3, 0, 55]);
    expect(component.error()).toBe(false);
    expect(component.series()).toEqual([]);
    expect(text()).toContain('analytics.no-monthly-data');
  });

  it('admin: loads the platform summary with its six indicators and no monthly series', () => {
    const { component, text } = setup('ADMIN', { getPlatformSummary: () => of(platform) });
    expect(component.kpis().map(k => k.value)).toEqual([9, 2, 5, 1, 6, 123]);
    expect(text()).not.toContain('analytics.series-note');
  });

  it('error shows a retry that reloads', () => {
    const getPlatformSummary = vi.fn().mockReturnValueOnce(throwError(() => new Error('x'))).mockReturnValue(of(platform));
    const { fixture, component } = setup('ADMIN', { getPlatformSummary });
    expect(component.error()).toBe(true);
    ((fixture.nativeElement as HTMLElement).querySelector('.state button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.error()).toBe(false);
    expect(component.data()).toEqual(platform);
  });
});

describe('analytics routes', () => {
  it('redirects the legacy reporting paths to /analytics', () => {
    const redirect = (path: string) => routes.find(r => r.path === path)?.redirectTo;
    expect(redirect('reporting')).toBe('analytics');
    expect(redirect('reporting/report-main')).toBe('analytics');
  });
});
