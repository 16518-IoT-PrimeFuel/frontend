import { beforeEach, describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TranslateModule } from '@ngx-translate/core';
import { RequestForm } from './request-form';
import { EquipmentStore } from '../../../../equipment/application/equipment.store';
import { EquipmentApi } from '../../../../equipment/infrastructure/equipment.api';
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
    const statuses: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="status"]'));
    expect(statuses.some(status => status.textContent!.includes('request-form.no-products'))).toBe(true);
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('form > [role="alert"]').textContent).toContain('request-form.no-products');
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
    fixture.detectChanges();
    const failure: HTMLElement = fixture.nativeElement.querySelector('form > [role="alert"]');
    expect(failure.textContent).toContain('request-form.products-error');
    expect(failure.querySelector('button')).not.toBeNull();
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

  it('shows the initial load, keeps what loaded and retries a failed list', () => {
    const api = TestBed.inject(OrderingApi);
    const component = fixture.componentInstance;
    const providers = new Subject<{ id: number; name: string }[]>();
    vi.spyOn(api, 'providers').mockReturnValue(providers);
    const tanks = vi.spyOn(api, 'tanks').mockReturnValue(throwError(() => new Error('offline')));
    const sites = vi.spyOn(TestBed.inject(EquipmentApi), 'sites').mockReturnValue(of([{ id: 1, name: 'Sede', address: 'Av. Lima' }] as any));
    component.load();
    fixture.detectChanges();
    expect(component.loading()).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('request-form.loading');
    providers.next([{ id: 2, name: 'Distribuidor' }]);
    providers.complete();
    fixture.detectChanges();
    expect(component.loading()).toBe(false);
    expect(component.providers()).toHaveLength(1);
    expect(component.sites()).toHaveLength(1);
    const failure: HTMLElement = fixture.nativeElement.querySelector('[role="alert"]');
    expect(failure.textContent).toContain('request-form.tanks-error');
    tanks.mockReturnValue(of([{ id: 3, customerAccountId: 4, name: 'T1' }, { id: 5, customerAccountId: 9, name: 'Ajeno' }] as any));
    sites.mockReturnValue(throwError(() => new Error('offline')));
    vi.spyOn(api, 'providers').mockReturnValue(of([{ id: 2, name: 'Distribuidor' }]));
    failure.querySelector('button')!.click();
    expect(component.tanks().map(tank => tank.id)).toEqual([3]);
    expect(component.sites()).toHaveLength(1);
    expect(component.loadError()).toBe('request-form.sites-error');
    sites.mockReturnValue(of([]));
    component.load();
    expect(component.loadError()).toBe('');
  });

  it('retries only the empty-catalog alert without reloading products', () => {
    const api = TestBed.inject(OrderingApi);
    const products = vi.spyOn(api, 'products').mockReturnValue(of([]));
    const alert = vi.spyOn(api, 'alertEmptyCatalog').mockReturnValue(throwError(() => new Error('offline')));
    const component = fixture.componentInstance;
    component.form.controls.providerId.setValue(2);
    component.onProviderChange();
    fixture.detectChanges();
    alert.mockReturnValue(of(undefined));
    const statuses: HTMLElement[] = Array.from(fixture.nativeElement.querySelectorAll('[role="status"]'));
    statuses.find(status => status.textContent!.includes('request-form.notification-error'))!.querySelector('button')!.click();
    expect(products).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(2);
    expect(alert).toHaveBeenLastCalledWith(2);
    expect(component.catalogAlert()).toBe('request-form.provider-notified');
  });

  it('keeps submit enabled and, with errors, marks every field, focuses the first one and does not create', () => {
    const component = fixture.componentInstance;
    const create = vi.spyOn(component.store, 'createRequest');
    fixture.detectChanges();
    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submit.disabled).toBe(false);
    submit.click();
    fixture.detectChanges();
    expect(create).not.toHaveBeenCalled();
    expect(component.form.controls.providerId.touched && component.form.controls.deliveryAddress.touched).toBe(true);
    expect(document.activeElement?.getAttribute('formControlName')).toBe('providerId');
    expect(fixture.nativeElement.querySelectorAll('mat-error').length).toBeGreaterThanOrEqual(2);
    const addressError = () => fixture.nativeElement.querySelector('textarea').closest('mat-form-field').querySelector('mat-error').textContent;
    expect(addressError()).toContain('validation.required');
    component.form.controls.deliveryAddress.setValue('x'.repeat(256));
    fixture.detectChanges();
    expect(addressError()).toContain('validation.max-length');
  });

  const fillValid = () => {
    vi.spyOn(TestBed.inject(OrderingApi), 'products').mockReturnValue(of([{ id: 8, providerId: 2, active: true } as FuelProduct]));
    const component = fixture.componentInstance;
    component.form.controls.providerId.setValue(2);
    component.onProviderChange();
    component.form.patchValue({ fuelProductId: 8, deliveryAddress: 'Av. Lima' });
    return component;
  };

  it('explains a missing customer account next to the button instead of failing silently', () => {
    const component = fillValid();
    const create = vi.spyOn(component.store, 'createRequest');
    component.customerAccountId.set(null);
    component.submit();
    fixture.detectChanges();
    expect(create).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('form > [role="alert"]').textContent).toContain('request-form.loading');
    component.loading.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('form > [role="alert"]').textContent).toContain('request-form.no-customer');
  });

  it('shows the in-flight text and returns to the list with a created notice', () => {
    const component = fillValid();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const create = vi.spyOn(component.store, 'createRequest').mockImplementation((_value, done) => done());
    component.submit();
    expect(create.mock.calls[0][0]).toMatchObject({ customerAccountId: 4, providerId: 2, fuelProductId: 8, tankId: null });
    expect(navigate).toHaveBeenCalledWith(['/ordering/request-list'], { state: { notice: 'request-list.created' } });
    component.store.creating.set(true);
    fixture.detectChanges();
    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(submit.textContent).toContain('request-form.creating');
    expect(submit.disabled).toBe(true);
    component.submit();
    expect(create).toHaveBeenCalledTimes(1);
  });
});
