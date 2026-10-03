import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { OrderingStore } from './ordering.store';
import { OrderingApi } from '../infrastructure/ordering-api';
import { IamStore } from '../../iam/application/iam.store';

beforeEach(() => TestBed.resetTestingModule());

function setup() {
  const role = signal('PROVIDER');
  const pending = new Subject<any>();
  const api = { acceptRequest: vi.fn(() => pending), rejectRequest: vi.fn(() => pending), confirmOrder: vi.fn(() => pending), cancelOrder: vi.fn(() => pending) };
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
