import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { ProviderPayments } from './provider-payments';

describe('ProviderPayments', () => {
  const payment = { id: 9, orderId: 30, buyerName: 'ACME', amount: 200, currency: null, status: 'COMPLETED', paymentMethod: 'CASH', createdAt: '2026-10-02T12:00:00Z', paidAt: '2026-10-02T07:00:00' };
  let api: { providerPayments: ReturnType<typeof vi.fn>; refundProviderPayment: ReturnType<typeof vi.fn> };
  const setup = (providerId: number | null = 22) => {
    api = { providerPayments: vi.fn(() => of([])), refundProviderPayment: vi.fn(() => of(payment)) };
    TestBed.configureTestingModule({ imports: [ProviderPayments, TranslateModule.forRoot()], providers: [
      provideRouter([]), { provide: OrderingApi, useValue: api }, { provide: IamStore, useValue: { providerId: () => providerId } },
    ] });
    const fixture = TestBed.createComponent(ProviderPayments);
    return { fixture, view: fixture.componentInstance as any };
  };
  beforeEach(() => TestBed.resetTestingModule());

  it('cancels the older filter request so late results cannot overwrite the latest list', () => {
    const { view } = setup();
    const first = new Subject();
    const second = new Subject();
    api.providerPayments.mockReturnValueOnce(first as any).mockReturnValueOnce(second as any);
    view.setStatus('PENDING');
    view.setStatus('COMPLETED');
    second.next([payment]);
    first.next([{ ...payment, status: 'PENDING' }]);
    expect(view.payments()).toEqual([payment]);
  });

  it('sends inclusive Lima date boundaries and clears invalid ranges', () => {
    const { view } = setup();
    view.from.set('2026-10-01');
    view.to.set('2026-10-02');
    view.load();
    expect(api.providerPayments).toHaveBeenLastCalledWith(22, { status: undefined, from: '2026-10-01T05:00:00.000Z', to: '2026-10-03T04:59:59.999Z' });
    view.from.set('2026-10-04');
    view.load();
    expect(view.loading()).toBe(false);
    expect(view.payments()).toEqual([]);
    expect(api.providerPayments).toHaveBeenCalledTimes(2);
  });

  it('does not leave a permanent spinner when provider context is missing', () => {
    const { view } = setup(null);
    expect(view.loading()).toBe(false);
    expect(view.error()).toBe('errors.http-403');
    expect(api.providerPayments).not.toHaveBeenCalled();
  });

  it('paginates the returned payments without new HTTP reads and resets on a filter change', () => {
    const { view } = setup();
    view.payments.set(Array.from({ length: 45 }, (_, i) => ({ ...payment, id: i + 1 })));
    expect(view.pageRows()).toHaveLength(20);
    view.changePage(1);
    expect(view.pageRows()[0].id).toBe(21);
    view.changePage(20);
    expect(view.pageRows().map((p: any) => p.id)).toEqual([41, 42, 43, 44, 45]);
    expect(view.firstRow()).toBe(41);
    expect(view.lastRow()).toBe(45);
    expect(api.providerPayments).toHaveBeenCalledTimes(1);
    view.setStatus('PENDING');
    expect(view.page()).toBe(0);
  });

  it('clamps the page when a refresh removes rows from the last page', () => {
    const { view } = setup();
    view.payments.set(Array.from({ length: 21 }, (_, i) => ({ ...payment, id: i + 1 })));
    view.changePage(1);
    api.providerPayments.mockReturnValue(of([payment]) as any);
    view.load();
    expect(view.page()).toBe(0);
    expect(view.pageRows()).toEqual([payment]);
  });

  it('renders an unknown currency and the local paid time without adding a currency symbol', () => {
    const { fixture, view } = setup();
    view.payments.set([payment]);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('provider-payments.currency-unknown');
    expect(text).toContain('02/10/2026 07:00');
    expect(text).not.toContain('S/');
  });

  it('maps the refund conflict by backend code and blocks invalid payment actions', () => {
    const { view } = setup();
    const open = vi.spyOn(view.dialog, 'open').mockReturnValue({ afterClosed: () => of(true), close: vi.fn() } as any);
    api.refundProviderPayment.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'PAYMENT_CONFLICT' } })) as any);
    view.requestRefund({ ...payment, status: 'PENDING' });
    expect(open).not.toHaveBeenCalled();
    view.requestRefund(payment);
    expect(view.actionError()).toBe('provider-payments.refund-conflict');
  });
});
