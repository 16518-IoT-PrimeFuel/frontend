import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { OrderDetail } from './order-detail';
import { OrderingStore } from '../../../application/ordering.store';
import { IamStore } from '../../../../iam/application/iam.store';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';
import { OrderingApi } from '../../../infrastructure/ordering-api';

describe('OrderDetail', () => {
  let component: OrderDetail;
  let fixture: ComponentFixture<OrderDetail>;

  const orderingStoreMock = {
    orders: () => [],
    loading: () => false,
    error: () => null,
    providerNames: () => ({}),
    productNames: () => ({}),

    loadOrder: (_id: number) => {},
    loadNames: () => {},
    confirmOrder: (_id: number) => {},
    cancelOrder: (_id: number) => {},
  };

  const iamStoreMock = {
    role: () => 'BUYER',
    companyId: () => 1,
  };

  const fulfillmentApiMock = {
    getEligibleDrivers: () => of([]),
    getEligibleTankers: () => of([]),
    assignDelivery: () =>
      of({
        deliveryId: 1,
      }),
  };

  const orderingApiMock = {
    buyerCompany: () =>
      of({
        id: 1,
        name: 'Test Company',
      }),

    paymentForOrder: () =>
      of({
        id: 1,
        orderId: 1,
        companyId: 1,
        amount: 100,
        status: 'PENDING',
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: null,
        paidAt: null,
      }),

    createPayment: () =>
      of({
        id: 1,
        orderId: 1,
        companyId: 1,
        amount: 100,
        status: 'PENDING',
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: null,
        paidAt: null,
      }),

    completePayment: () =>
      of({
        id: 1,
        orderId: 1,
        companyId: 1,
        amount: 100,
        status: 'COMPLETED',
        paymentMethod: 'BANK_TRANSFER',
        transactionReference: 'TEST-001',
        paidAt: new Date().toISOString(),
      }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        OrderDetail,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideRouter([]),

        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                id: '1',
              }),
            },
          },
        },

        {
          provide: OrderingStore,
          useValue: orderingStoreMock,
        },

        {
          provide: IamStore,
          useValue: iamStoreMock,
        },

        {
          provide: FulfillmentApi,
          useValue: fulfillmentApiMock,
        },

        {
          provide: OrderingApi,
          useValue: orderingApiMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderDetail);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});