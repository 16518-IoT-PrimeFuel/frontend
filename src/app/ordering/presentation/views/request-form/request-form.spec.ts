import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { RequestForm } from './request-form';
import { EquipmentStore } from '../../../../equipment/application/equipment.store';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { FuelProduct } from '../../../../inventory/domain/model/fuel-product.entity';

describe('RequestForm', () => {
  let fixture: ComponentFixture<RequestForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestForm, TranslateModule.forRoot()],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: EquipmentStore, useValue: { resolveCustomer: () => of({ id: 4, name: 'ACME', active: true }) } }],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestForm);
    await fixture.whenStable();
  });

  it('uses the resolved account and has no customer selector', () => {
    expect(fixture.componentInstance.customerAccountId()).toBe(4);
    expect('customerAccountId' in fixture.componentInstance.form.controls).toBe(false);
  });

  it('blocks an empty or inactive catalog and alerts the provider', () => {
    const api = TestBed.inject(OrderingApi);
    const products = vi.spyOn(api, 'products').mockReturnValue(of([{ id: 8, active: false } as FuelProduct]));
    const alert = vi.spyOn(api, 'alertEmptyCatalog').mockReturnValue(of(undefined));
    const create = vi.spyOn(fixture.componentInstance.store, 'createRequest');
    const component = fixture.componentInstance;
    component.form.patchValue({ providerId: 2, fuelProductId: 8, deliveryAddress: 'Av. Lima' });
    component.onProviderChange();
    component.form.controls.fuelProductId.setValue(8);
    component.submit();
    fixture.detectChanges();
    expect(component.productError()).toBe('request-form.no-products');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('request-form.no-products');
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(true);
    expect(component.products()).toEqual([]);
    expect(alert).toHaveBeenCalledWith(2);
    expect(create).not.toHaveBeenCalled();
    products.mockReturnValue(of([]));
    component.onProviderChange();
    expect(component.productError()).toBe('request-form.no-products');
  });

  it('distinguishes a load failure from an empty catalog and allows retry', () => {
    const api = TestBed.inject(OrderingApi);
    const products = vi.spyOn(api, 'products').mockReturnValue(throwError(() => new Error('offline')));
    const alert = vi.spyOn(api, 'alertEmptyCatalog');
    const component = fixture.componentInstance;
    component.form.controls.providerId.setValue(2);
    component.onProviderChange();
    expect(component.productError()).toBe('request-form.products-error');
    expect(alert).not.toHaveBeenCalled();
    products.mockReturnValue(of([{ id: 8, providerId: 2, active: true } as FuelProduct]));
    component.onProviderChange();
    expect(component.productError()).toBe('');
    expect(component.products()).toHaveLength(1);
  });

  it('ignores an old provider response after changing provider', () => {
    const old = new Subject<FuelProduct[]>();
    vi.spyOn(TestBed.inject(OrderingApi), 'products').mockReturnValueOnce(old).mockReturnValueOnce(of([{ id: 9, active: true } as FuelProduct]));
    const component = fixture.componentInstance;
    component.form.controls.providerId.setValue(2);
    component.onProviderChange();
    component.form.controls.providerId.setValue(3);
    component.onProviderChange();
    old.next([]);
    expect(component.products()[0].id).toBe(9);
    expect(component.productError()).toBe('');
  });

  it('does not report success when the provider alert fails', () => {
    vi.spyOn(TestBed.inject(OrderingApi), 'products').mockReturnValue(of([]));
    vi.spyOn(TestBed.inject(OrderingApi), 'alertEmptyCatalog').mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.form.controls.providerId.setValue(2);
    component.onProviderChange();
    expect(component.catalogAlert()).toBe('request-form.notification-error');
  });
});
