import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { ProviderBuyerForm } from './provider-buyer-form';
import { ProviderEquipmentApi } from '../../../infrastructure/provider-equipment.api';

describe('ProviderBuyerForm lookup identity', () => {
  const buyer = { buyerCompanyId: 4, name: 'ACME', ruc: '20123456789' };
  let api: { lookupBuyer: ReturnType<typeof vi.fn>; registerBuyerCompany: ReturnType<typeof vi.fn> };
  const setup = () => {
    api = { lookupBuyer: vi.fn(() => of(buyer)), registerBuyerCompany: vi.fn(() => new Subject()) };
    TestBed.configureTestingModule({ imports: [ProviderBuyerForm, TranslateModule.forRoot()], providers: [
      provideRouter([]), { provide: ProviderEquipmentApi, useValue: api },
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
});
