import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { OrderList } from './order-list';
import { OrderingStore } from '../../../application/ordering.store';

describe('OrderList', () => {
  let component: OrderList;
  let fixture: ComponentFixture<OrderList>;

  const orderingStoreMock = {
    orders: () => [],
    loading: () => false,
    error: () => null,
    providerNames: () => ({}),
    productNames: () => ({}),

    loadOrders: () => {},
    loadNames: () => {},
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        OrderList,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideRouter([]),
        {
          provide: OrderingStore,
          useValue: orderingStoreMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OrderList);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});