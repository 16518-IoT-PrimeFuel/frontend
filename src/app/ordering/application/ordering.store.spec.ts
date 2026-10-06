import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { OrderingStore } from './ordering.store';
import { OrderingApi } from '../infrastructure/ordering-api';
import { IamStore } from '../../iam/application/iam.store';

beforeEach(() => TestBed.resetTestingModule());

function setup() {
  const role = signal('PROVIDER');
  const pending = new Subject<any>();
  const api = { acceptRequest: vi.fn(() => pending), rejectRequest: vi.fn(() => pending), confirmOrder: vi.fn(() => pending), cancelOrder: vi.fn(() => pending),
    createRequest: vi.fn(() => pending), cancelRequest: vi.fn(() => of({})), requests: vi.fn(() => of([])), requestInbox: vi.fn(() => of([])) };
  TestBed.configureTestingModule({ providers: [
    { provide: OrderingApi, useValue: api },
    { provide: IamStore, useValue: { role, isProvider: () => role() === 'PROVIDER', isBuyer: () => role() === 'BUYER', providerId: () => 2, companyId: () => 4 } },
  ] });
  const store = TestBed.inject(OrderingStore);
  return { store, api, role };
}

it('allows decisions only for the provider pending request and serializes repeated decisions', () => {
  const { store, api } = setup();
  (store as any).requestsState.set([{ id: 1, providerId: 99, status: 'PENDING' }, { id: 2, providerId: 2, status: 'ACCEPTED' }, { id: 3, providerId: 2, status: 'PENDING' }]);
  store.acceptRequest(1);
  store.rejectRequest(2, 'reason');
  store.rejectRequest(3, ' '.repeat(10));
  store.rejectRequest(3, 'x'.repeat(241));
  expect(api.acceptRequest).not.toHaveBeenCalled();
  expect(api.rejectRequest).not.toHaveBeenCalled();
  store.acceptRequest(3);
  store.acceptRequest(3);
  store.rejectRequest(3, 'reason');
  expect(api.acceptRequest).toHaveBeenCalledExactlyOnceWith(3);
  expect(api.rejectRequest).not.toHaveBeenCalled();
});

it('checks current order ownership, role and state before confirmation or cancellation', () => {
  const { store, api, role } = setup();
  (store as any).ordersState.set([{ id: 1, companyId: 99, providerId: 99, status: 'PENDING' }, { id: 2, companyId: 4, providerId: 2, status: 'PAID' }, { id: 3, companyId: 4, providerId: 2, status: 'PENDING' }]);
  store.confirmOrder(3);
  store.cancelOrder(1);
  store.cancelOrder(2);
  expect(api.confirmOrder).not.toHaveBeenCalled();
  expect(api.cancelOrder).not.toHaveBeenCalled();
  role.set('BUYER');
  store.confirmOrder(1);
  store.confirmOrder(2);
  store.confirmOrder(3);
  store.confirmOrder(3);
  store.cancelOrder(3);
  expect(api.confirmOrder).toHaveBeenCalledExactlyOnceWith(3);
  expect(api.cancelOrder).not.toHaveBeenCalled();
});

it('rejects a second createRequest while one is in flight and allows a new one once it settles', () => {
  const { store, api } = setup();
  const first = new Subject<any>();
  api.createRequest.mockReturnValue(first);
  const done = vi.fn();
  store.createRequest({} as any, done);
  store.createRequest({} as any, done);
  expect(api.createRequest).toHaveBeenCalledTimes(1);
  expect(store.creating()).toBe(true);
  first.next({ id: 1 });
  first.complete();
  expect(done).toHaveBeenCalledTimes(1);
  expect(store.creating()).toBe(false);
  api.createRequest.mockReturnValue(throwError(() => ({ status: 500 })) as any);
  store.createRequest({} as any, done);
  expect(api.createRequest).toHaveBeenCalledTimes(2);
  expect(done).toHaveBeenCalledTimes(1);
  expect(store.creating()).toBe(false);
});

it('cancels only a pending request as buyer and reports the result', () => {
  const { store, api, role } = setup();
  (store as any).requestsState.set([{ id: 1, status: 'PENDING' }, { id: 2, status: 'ACCEPTED' }]);
  store.cancelRequest(1);
  role.set('BUYER');
  store.cancelRequest(2);
  expect(api.cancelRequest).not.toHaveBeenCalled();
  store.cancelRequest(1);
  expect(api.cancelRequest).toHaveBeenCalledExactlyOnceWith(1);
  expect(store.notice()).toBe('request-list.cancelled');
});
