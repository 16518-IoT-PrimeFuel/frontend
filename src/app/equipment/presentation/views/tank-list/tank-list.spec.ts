import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EquipmentStore } from '../../../application/equipment.store';
import { TankList } from './tank-list';

describe('TankList', () => {
  let fixture: ComponentFixture<TankList>;
  let element: HTMLElement;
  const store = {
    customer: signal({ id: 4, name: 'ACME', legacyCompanyId: 7, active: true }), sites: signal([]), tanks: signal([]), error: signal(''), loading: signal(false),
    creatingSite: signal(false), creatingTank: signal(false), load: vi.fn(), createSite: vi.fn(), createTank: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({ imports: [TankList], providers: [provideRouter([]), provideTranslateService()] });
    TestBed.overrideComponent(TankList, { set: { providers: [{ provide: EquipmentStore, useValue: store }] } });
    fixture = TestBed.createComponent(TankList);
    fixture.componentInstance['formOpen'].set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    element = fixture.nativeElement;
  });

  const errors = (form: string) => Array.from(element.querySelectorAll(`${form} mat-error`)).map(error => error.textContent!.trim());

  it('shows the tank errors, focuses the first invalid field and does not call the service on an invalid submit', () => {
    const submit = element.querySelector<HTMLButtonElement>('.tank-form .actions button:not([type="button"])')!;
    expect(submit.disabled).toBe(false);
    expect(errors('.tank-form')).toEqual([]);
    submit.click();
    fixture.detectChanges();
    expect(errors('.tank-form')).toEqual(['validation.required', 'validation.min-value']);
    expect(document.activeElement).toBe(element.querySelector('input[name="tankName"]'));
    expect(store.createTank).not.toHaveBeenCalled();
  });

  it('shows the site error and does not call the service on an invalid submit', () => {
    const submit = element.querySelector<HTMLButtonElement>('.site-form button')!;
    expect(submit.disabled).toBe(false);
    submit.click();
    fixture.detectChanges();
    expect(errors('.site-form')).toEqual(['validation.required']);
    expect(document.activeElement).toBe(element.querySelector('input[name="siteName"]'));
    expect(store.createSite).not.toHaveBeenCalled();
  });

  it('disables the submit buttons only while a request is in flight', () => {
    store.creatingTank.set(true); store.creatingSite.set(true);
    fixture.detectChanges();
    expect(element.querySelector<HTMLButtonElement>('.tank-form .actions button:not([type="button"])')!.disabled).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('.site-form button')!.disabled).toBe(true);
    store.creatingTank.set(false); store.creatingSite.set(false);
  });
});
