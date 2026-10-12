import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ProviderBuyerForm } from './provider-buyer-form';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';
import { MatDialogRef } from '@angular/material/dialog';

describe('ProviderBuyerForm lookup identity', () => {
  const buyer = { buyerCompanyId: 4, name: 'ACME', ruc: '20123456789' };
  let api: { lookupBuyer: ReturnType<typeof vi.fn>; registerBuyerCompany: ReturnType<typeof vi.fn> };
  const setup = (dialogRef?: object) => {
    api = { lookupBuyer: vi.fn(() => of(buyer)), registerBuyerCompany: vi.fn(() => new Subject()) };
    TestBed.configureTestingModule({ imports: [ProviderBuyerForm, TranslateModule.forRoot()], providers: [
      provideRouter([]), { provide: ProviderEquipmentApi, useValue: api },
      ...(dialogRef ? [{ provide: MatDialogRef, useValue: dialogRef }] : []),
    ] });
    const fixture = TestBed.createComponent(ProviderBuyerForm);
    return { fixture, form: fixture.componentInstance as any };
  };
  beforeEach(() => TestBed.resetTestingModule());

  it('invalidates a found company when the RUC changes and cannot link the old identity', () => {
    const { form } = setup();
    form.lookupForm.controls.ruc.setValue(buyer.ruc);
    form.search();
    expect(form.found()).toEqual(buyer);
    form.lookupForm.controls.ruc.setValue('20987654321');
    form.link();
    expect(form.found()).toBeNull();
    expect(api.registerBuyerCompany).not.toHaveBeenCalled();
  });

  it('ignores an in-flight result after editing the RUC', () => {
    const { form } = setup();
    const pending = new Subject();
    api.lookupBuyer.mockReturnValue(pending as any);
    form.lookupForm.controls.ruc.setValue(buyer.ruc);
    form.search();
    form.lookupForm.controls.ruc.setValue('20987654321');
    pending.next(buyer);
    expect(form.found()).toBeNull();
    expect(form.searching()).toBe(false);
  });

  it('blocks repeated searches during the server cooldown without automatic retries', () => {
    const { fixture, form } = setup();
    api.lookupBuyer.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 429, error: { code: 'LOOKUP_RATE_LIMITED' } })) as any);
    form.lookupForm.controls.ruc.setValue(buyer.ruc);
    form.search();
    form.search();
    expect(form.waitSeconds()).toBe(60);
    expect(api.lookupBuyer).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('blocks duplicate link submissions and explains a legacy company without an organization', () => {
    const { form } = setup();
    const pending = new Subject();
    api.registerBuyerCompany.mockReturnValue(pending);
    form.lookupForm.controls.ruc.setValue(buyer.ruc);
    form.search();
    form.link();
    form.link();
    expect(api.registerBuyerCompany).toHaveBeenCalledTimes(1);
    expect(api.registerBuyerCompany).toHaveBeenCalledWith({ buyerCompanyId: 4 });
    pending.error(new HttpErrorResponse({ status: 404, error: { code: 'BUYERCOMPANY_NOT_FOUND' } }));
    expect(form.error()).toBe('provider-equipment.err-buyer-no-org');
  });

  it('keeps the modal open during saving and closes with success without navigating', async () => {
    const ref = { close: vi.fn(), disableClose: false };
    const { fixture, form } = setup(ref);
    const navigate = vi.spyOn(form.router, 'navigate').mockResolvedValue(true);
    form.form.patchValue({ name: 'Empresa prueba', ruc: '20261012007' });
    const pending = new Subject();
    api.registerBuyerCompany.mockReturnValue(pending);
    form.submit(); await fixture.whenStable();
    form.cancel();
    expect(ref.disableClose).toBe(true);
    expect(ref.close).not.toHaveBeenCalled();
    pending.next({ id: 5 }); pending.complete();
    expect(ref.close).toHaveBeenCalledExactlyOnceWith(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reveals RUC location help with an official lookup link and can hide it again', async () => {
    const { fixture } = setup();
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('.ruc-help-button');
    button.click(); await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const link = fixture.nativeElement.querySelector('#ruc-help a');
    expect(link.getAttribute('href')).toBe('https://e-consultaruc.sunat.gob.pe/');
    expect(link.getAttribute('rel')).toContain('noopener');
    button.click(); await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('#ruc-help')).toBeNull();
  });
});
