import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { OrderingApi } from './ordering-api';

it('preserves payment errors and sends operation number without a client-controlled amount', () => {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const api = TestBed.inject(OrderingApi);
  const http = TestBed.inject(HttpTestingController);
  const error = vi.fn();
  api.paymentsForCompany(4).subscribe({ error });
  http.expectOne(`${environment.serverBasePath}/payments/company/4`).flush({ code: 'RATE_LIMITED' }, { status: 429, statusText: 'Too Many Requests' });
  expect(error.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
  expect(error.mock.calls[0][0].error.code).toBe('RATE_LIMITED');
  api.refundPayment(8).subscribe({ error });
  http.expectOne(`${environment.serverBasePath}/payments/8/refund`).flush({ code: 'PAYMENT_CONFLICT' }, { status: 409, statusText: 'Conflict' });
  expect(error.mock.calls[1][0].error.code).toBe('PAYMENT_CONFLICT');
  api.createPayment(30, 4, 'BANK_TRANSFER', 'ABC123').subscribe();
  const payment = http.expectOne(`${environment.serverBasePath}/payments`);
  expect(payment.request.body).toEqual({ orderId: 30, companyId: 4, paymentMethod: 'BANK_TRANSFER', operationNumber: 'ABC123' });
  payment.flush({});
  http.verify();
  TestBed.resetTestingModule();
});
