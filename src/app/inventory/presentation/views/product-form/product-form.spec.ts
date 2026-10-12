import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IamStore } from '../../../../iam/application/iam.store';
import { InventoryStore } from '../../../application/inventory.store';
import { ProductForm } from './product-form';

describe('ProductForm', () => {
  let fixture: ComponentFixture<ProductForm>;
  let element: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [provideRouter([]), provideTranslateService(), provideHttpClient(), provideHttpClientTesting(),
        { provide: IamStore, useValue: { providerId: signal(10) } }],
    });
    fixture = TestBed.createComponent(ProductForm);
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  it('keeps the submit button enabled and shows no errors before interacting', () => {
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(element.querySelectorAll('mat-error').length).toBe(0);
  });

  it('shows the field errors, focuses the first invalid field and does not call the service on an invalid submit', () => {
    const create = vi.spyOn(TestBed.inject(InventoryStore), 'createProduct');
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    fixture.detectChanges();
    const errors = Array.from(element.querySelectorAll('mat-error')).map(error => error.textContent!.trim());
    expect(errors).toEqual(['validation.required', 'validation.required', 'validation.min-value', 'validation.min-value']);
    expect(document.activeElement).toBe(element.querySelector('[formControlName="name"]'));
    expect(create).not.toHaveBeenCalled();
    TestBed.inject(HttpTestingController).verify();
  });

  it('reports the minimum length of the name', () => {
    const name = fixture.componentInstance['productForm'].controls['name'];
    name.setValue('ab'); name.markAsTouched();
    fixture.detectChanges();
    expect(element.querySelector('mat-error')!.textContent).toContain('validation.min-length');
  });
});

describe('ProductForm as an edit modal', () => {
  it('prefills from the dialog data, saves with the product id and closes the dialog', async () => {
    const { MAT_DIALOG_DATA, MatDialogRef } = await import('@angular/material/dialog');
    const close = vi.fn();
    const product = { id: 7, name: 'Diesel Norte', fuelType: 'DIESEL', providerId: 10, pricePerUnit: 12.5, unit: 'LITRE', availableStock: 100, capacity: 1000, active: true };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProductForm],
      providers: [provideRouter([]), provideTranslateService(), provideHttpClient(), provideHttpClientTesting(),
        { provide: IamStore, useValue: { providerId: signal(10) } },
        { provide: MAT_DIALOG_DATA, useValue: { product } }, { provide: MatDialogRef, useValue: { close, disableClose: false } }],
    });
    const fixture = TestBed.createComponent(ProductForm);
    fixture.detectChanges();
    const update = vi.spyOn(TestBed.inject(InventoryStore), 'updateProduct').mockImplementation((_id, _payload, done) => done?.());
    expect(fixture.componentInstance['productForm'].value.name).toBe('Diesel Norte');
    fixture.nativeElement.querySelector('button[type="submit"]').click();
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ name: 'Diesel Norte', active: true }), expect.any(Function));
    expect(close).toHaveBeenCalledWith(true);
  });
});
