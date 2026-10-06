import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { Dashboard } from './dashboard';
import { IamStore } from '../../../../iam/application/iam.store';
import { AnalyticsApi } from '../../../../analytics/infrastructure/analytics-api';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';

describe('Dashboard', () => {
  let component: Dashboard;
  let fixture: ComponentFixture<Dashboard>;

  const iamStoreMock = {
    isBuyer: () => true,
    companyId: () => 1,
    providerId: () => null,
  };

  const analyticsApiMock = {
    getBuyerAnalytics: () =>
      of({
        totalOrders: 0,
        totalSpent: 0,
        completedPayments: 0,
        pendingPayments: 0,
        monthlySpending: [],
      }),

    getProviderAnalytics: () =>
      of({
        totalOrders: 0,
        confirmedOrders: 0,
        cancelledOrders: 0,
        totalRevenue: 0,
        monthlyRevenue: [],
      }),
  };

  const orderingApiMock = {
    orders: () => of([]),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        Dashboard,
        TranslateModule.forRoot(),
      ],
      providers: [
        {
          provide: IamStore,
          useValue: iamStoreMock,
        },
        {
          provide: AnalyticsApi,
          useValue: analyticsApiMock,
        },
        {
          provide: OrderingApi,
          useValue: orderingApiMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});