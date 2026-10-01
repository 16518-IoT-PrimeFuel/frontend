import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { afterEach, describe, expect, it } from 'vitest';
import { IamStore } from '../../../../iam/application/iam.store';
import { ProductInventory } from './product-inventory';
import { environment } from '../../../../../environments/environment';

const products = [
  { id: 1, name: 'Diesel Norte', fuelType: 'DIESEL', providerId: 10, pricePerUnit: 12.5, unit: 'LITERS', availableStock: 100, capacity: 1000, active: true },
  { id: 2, name: 'Gasolina Sur', fuelType: 'GASOLINE', providerId: 20, pricePerUnit: 15, unit: 'LITERS', availableStock: 200, capacity: 1000, active: true },
];

function setup(role: 'BUYER' | 'PROVIDER', companyId = 1) {
  TestBed.configureTestingModule({
    imports: [ProductInventory],
    providers: [
      provideRouter([]), provideTranslateService(), provideHttpClient(), provideHttpClientTesting(),
      { provide: IamStore, useValue: { isProvider: signal(role === 'PROVIDER'), isBuyer: signal(role === 'BUYER'), providerId: signal(role === 'PROVIDER' ? 10 : null), companyId: signal(companyId) } },
    ],
  });
  const fixture = TestBed.createComponent(ProductInventory);
  const http = TestBed.inject(HttpTestingController);
  fixture.detectChanges();
  return { fixture, http };
}

describe('global products and prices catalog', () => {
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });

  for (const companyId of [101, 202]) {
    it(`shows products from different providers to buyer company ${companyId} without editing controls`, () => {
      const { fixture, http } = setup('BUYER', companyId);
      http.expectOne(`${environment.serverBasePath}/provider-companies`).flush([{ id: 10, name: 'Proveedor Norte' }, { id: 20, name: 'Proveedor Sur' }]);
      const request = http.expectOne(`${environment.serverBasePath}/fuel-products`);
      expect(request.request.method).toBe('GET');
      request.flush(products);
      fixture.detectChanges();
      const element: HTMLElement = fixture.nativeElement;
      for (const text of ['Diesel Norte', 'Gasolina Sur', 'Proveedor Norte', 'Proveedor Sur', '12.50', '15.00']) expect(element.textContent).toContain(text);
      expect(element.querySelector('input')).toBeNull();
      expect(element.querySelector('a[href*="product-form"], button[ng-reflect-router-link*="product-form"]')).toBeNull();
      expect(element.querySelectorAll('.mat-column-actions').length).toBe(0);
      fixture.componentInstance['saveStock'](1);
      fixture.componentInstance['onDelete'](1);
      http.expectNone(request => request.method !== 'GET');
      fixture.componentInstance['onRefresh']();
      http.expectOne(`${environment.serverBasePath}/fuel-products`).flush(products);
    });
  }

  it('keeps products visible with provider IDs when the provider directory fails', () => {
    const { fixture, http } = setup('BUYER');
    http.expectOne(`${environment.serverBasePath}/provider-companies`).flush({}, { status: 500, statusText: 'Unavailable' });
    http.expectOne(`${environment.serverBasePath}/fuel-products`).flush(products);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Diesel Norte');
    expect(fixture.nativeElement.textContent).toContain('#10');
    expect(fixture.nativeElement.textContent).toContain('#20');
  });

  it('loads only the owning provider inventory and retains management controls', () => {
    const { fixture, http } = setup('PROVIDER');
    http.expectNone(`${environment.serverBasePath}/fuel-products`);
    http.expectNone(`${environment.serverBasePath}/provider-companies`);
    http.expectOne(`${environment.serverBasePath}/fuel-products/provider/10`).flush([products[0]]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Diesel Norte');
    expect(fixture.nativeElement.textContent).not.toContain('Gasolina Sur');
    expect(fixture.nativeElement.querySelector('input[type="number"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.mat-column-actions').length).toBeGreaterThan(0);
  });
});
