import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { RequestList, missingRequestFields } from './request-list';
import { IamStore } from '../../../../iam/application/iam.store';
import { Request } from '../../../domain/model/request.entity';
import { environment } from '../../../../../environments/environment';

const base = environment.serverBasePath;
const valid: Request = { id: 1, organizationId: 100, customerAccountId: 101, tankId: null, providerId: 10, fuelProductId: 5, quantity: 20, unit: 'LITRE', unitPrice: 4.25, status: 'PENDING', source: 'MANUAL', rejectionReason: null, orderId: null, deliveryAddress: 'Lima Sur', deliveryDate: '2026-10-02', version: 0 };
function setup(provider = true, rows: Request[] = [valid], notice?: string) {
  TestBed.configureTestingModule({ imports: [RequestList], providers: [provideRouter([]), provideTranslateService(), provideHttpClient(), provideHttpClientTesting(), { provide: IamStore, useValue: { role: signal(provider ? 'PROVIDER' : 'BUYER'), providerId: signal(provider ? 10 : null), companyId: signal(provider ? null : 100), isBuyer: signal(!provider) } }] });
  if (notice) vi.spyOn(TestBed.inject(Router), 'currentNavigation').mockReturnValue({ extras: { state: { notice } } } as any);
  const fixture = TestBed.createComponent(RequestList);
  const http = TestBed.inject(HttpTestingController);
  http.expectOne(`${base}/replenishment-requests${provider ? '/inbox' : ''}`).flush(rows);
  http.expectOne(`${base}/provider-companies${provider ? '/10' : ''}`).flush(provider ? { id: 10, name: 'Distribuidor Sur' } : [{ id: 10, name: 'Distribuidor Sur' }]);
  http.expectOne(`${base}/fuel-products${provider ? '/provider/10' : ''}`).flush([{ id: 5, name: 'Diesel Sur' }]);
  fixture.detectChanges();
  return { fixture, http, component: fixture.componentInstance };
}

describe('request inbox and inline tracking', () => {
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule(); });
  it('loads every incoming customer, sorts recent first and supports search and status filters', () => {
    const { component, fixture } = setup(true, [valid, { ...valid, id: 2, customerAccountId: 202, status: 'REJECTED', rejectionReason: 'Sin disponibilidad', deliveryAddress: 'Lima Norte' }]);
    expect(component.filtered().map(row => row.id)).toEqual([2, 1]);
    expect(fixture.nativeElement.textContent).toContain('#101');
    expect(fixture.nativeElement.textContent).toContain('#202');
    expect(fixture.nativeElement.querySelector('input[type="number"]')).toBeNull();
    component.search.set('norte'); expect(component.filtered().map(row => row.id)).toEqual([2]);
    component.clearFilters(); component.status.set('PENDING'); expect(component.filtered().map(row => row.id)).toEqual([1]);
  });
  it('shows inline status, rejection reason and linked order tracking', () => {
    const { component, fixture } = setup(true, [{ ...valid, status: 'ACCEPTED', orderId: 30 }]);
    component.toggleTracking(1); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#tracking-1')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/ordering/order-detail/30"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button[aria-expanded="true"]')).not.toBeNull();
    component.toggleTracking(1); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#tracking-1')).toBeNull();
  });
  it('flags missing data and blocks acceptance without treating optional tank as missing', () => {
    const row = { ...valid, deliveryAddress: ' ', deliveryDate: '2026-02-30', quantity: 0 };
    const { component, fixture, http } = setup(true, [row]);
    expect(missingRequestFields(valid)).toEqual([]);
    expect(missingRequestFields(row)).toEqual(['quantity', 'address', 'date']);
    component.incompleteOnly.set(true); component.toggleTracking(1); component.prepareDecision('accept');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('request-list.missing.address');
    component.submitDecision(row);
    http.expectNone(`${base}/replenishment-requests/1/accept`);
  });
  it('requires a rejection reason and sends the selected request rather than a manually entered ID', () => {
    const { component, http } = setup();
    component.toggleTracking(1); component.prepareDecision('reject'); component.submitDecision(valid);
    http.expectNone(`${base}/replenishment-requests/1/reject`);
    component.rejectionReason = ' Sin stock '; component.submitDecision(valid);
    const request = http.expectOne(`${base}/replenishment-requests/1/reject`);
    expect(request.request.body).toEqual({ reason: 'Sin stock' });
    request.flush({ ...valid, status: 'REJECTED', rejectionReason: 'Sin stock' });
    http.expectOne(`${base}/replenishment-requests/inbox`).flush([{ ...valid, status: 'REJECTED', rejectionReason: 'Sin stock' }]);
    expect(component.store.requests()[0].status).toBe('REJECTED');
  });
  it('keeps buyer requests scoped and prevents provider decisions from buyer UI', () => {
    const { component, http } = setup(false);
    expect(component.canDecide(valid)).toBe(false);
    component.prepareDecision('accept'); component.submitDecision(valid);
    http.expectNone(`${base}/replenishment-requests/1/accept`);
  });
  const cancelButton = (fixture: { nativeElement: HTMLElement }) => Array.from(fixture.nativeElement.querySelectorAll('button')).find(button => button.textContent!.includes('request-list.cancel-request'));
  it('offers cancellation only to the buyer on a pending request', () => {
    const provider = setup();
    provider.component.toggleTracking(1); provider.fixture.detectChanges();
    expect(cancelButton(provider.fixture)).toBeUndefined();
    expect(provider.component.canCancel(valid)).toBe(false);
    TestBed.inject(HttpTestingController).verify(); TestBed.resetTestingModule();
    const buyer = setup(false, [valid, { ...valid, id: 2, status: 'ACCEPTED' }]);
    buyer.component.toggleTracking(2); buyer.fixture.detectChanges();
    expect(cancelButton(buyer.fixture)).toBeUndefined();
    buyer.component.toggleTracking(1); buyer.fixture.detectChanges();
    expect(cancelButton(buyer.fixture)).toBeDefined();
  });
  it('cancels a pending request only after confirmation and reports it inline', () => {
    const { component, fixture, http } = setup(false);
    const open = vi.spyOn((component as any).dialog, 'open').mockReturnValue({ afterClosed: () => of(false), close: vi.fn() } as any);
    component.toggleTracking(1); fixture.detectChanges();
    cancelButton(fixture)!.click();
    expect(open.mock.calls[0][1]).toMatchObject({ width: '480px', data: { messageKey: 'request-detail.confirm-cancel' } });
    http.expectNone(`${base}/replenishment-requests/1/cancel`);
    open.mockReturnValue({ afterClosed: () => of(true), close: vi.fn() } as any);
    cancelButton(fixture)!.click();
    http.expectOne(`${base}/replenishment-requests/1/cancel`).flush({ ...valid, status: 'CANCELLED' });
    http.expectOne(`${base}/replenishment-requests`).flush([{ ...valid, status: 'CANCELLED' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.inbox-alert[role="status"]').textContent).toContain('request-list.cancelled');
    expect(cancelButton(fixture)).toBeUndefined();
  });
  it('shows the notice passed through the navigation state', () => {
    const { fixture } = setup(false, [valid], 'request-list.created');
    expect(fixture.nativeElement.querySelector('.inbox-alert[role="status"]').textContent).toContain('request-list.created');
  });
});
