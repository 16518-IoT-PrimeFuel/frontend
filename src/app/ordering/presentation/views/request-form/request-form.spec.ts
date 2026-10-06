
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { RequestForm } from './request-form';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { OrderingStore } from '../../../application/ordering.store';

describe('RequestForm', () => {
  let component: RequestForm;
  let fixture: ComponentFixture<RequestForm>;
  let createdRequest: unknown;

  const orderingApiMock = {
    customers: () => of([
      { id: 1, name: 'Cliente de prueba', active: true }
    ]),

    tanks: () => of([
      {
        id: 10,
        customerAccountId: 1,
        siteId: null,
        name: 'Tanque de prueba',
        capacity: 1000,
        currentLevel: 500,
        levelSource: 'MANUAL',
        active: true
      }
    ]),

    providers: () => of([
      { id: 2, name: 'Proveedor de prueba' }
    ]),

    products: (_providerId: number) => of([
      {
        id: 5,
        name: 'Diesel',
        fuelType: 'DIESEL',
        pricePerUnit: 5,
        unit: 'LITERS',
        availableStock: 1000,
        capacity: 2000,
        providerId: 2,
        active: true
      }
    ])
  };

  const orderingStoreMock = {
    error: () => null,
    loading: () => false,

    createRequest: (value: unknown, _done: () => void) => {
      createdRequest = value;
    }
  };

  beforeEach(async () => {
    createdRequest = null;

    await TestBed.configureTestingModule({
      imports: [
        RequestForm,
        TranslateModule.forRoot()
      ],
      providers: [
        provideRouter([]),
        {
          provide: OrderingApi,
          useValue: orderingApiMock
        },
        {
          provide: OrderingStore,
          useValue: orderingStoreMock
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(RequestForm);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load customers, tanks and providers', () => {
    expect(component.customers().length).toBe(1);
    expect(component.tanks().length).toBe(1);
    expect(component.providers().length).toBe(1);
  });

  it('should reset tank when customer changes', () => {
    component.form.controls.tankId.setValue(10);

    component.onCustomerChange();

    expect(component.form.controls.tankId.value).toBe(0);
  });

  it('should load products when provider changes', () => {
    component.form.controls.providerId.setValue(2);

    component.onProviderChange();

    expect(component.products().length).toBe(1);
    expect(component.products()[0].name).toBe('Diesel');
  });

  it('should not submit an invalid form', () => {
    component.submit();

    expect(component.form.invalid).toBe(true);
    expect(createdRequest).toBeNull();
  });

  it('should submit a valid request', () => {
    component.form.patchValue({
      customerAccountId: 1,
      tankId: 10,
      providerId: 2,
      fuelProductId: 5,
      quantity: 50,
      deliveryAddress: 'Av. Los Olivos 123'
    });

    expect(component.form.valid).toBe(true);

    component.submit();

    expect(createdRequest).toEqual(
      expect.objectContaining({
        customerAccountId: 1,
        tankId: 10,
        providerId: 2,
        fuelProductId: 5,
        quantity: 50,
        deliveryAddress: 'Av. Los Olivos 123'
      })
    );
  });
});
