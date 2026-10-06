import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { beforeEach, expect, it, vi } from 'vitest';
import { FulfillmentStore } from './fulfillment.store';
import { FulfillmentApi } from '../infrastructure/fulfillment-api';
import { ProviderDelivery } from '../domain/model/provider-delivery.entity';
import { Driver } from '../domain/model/driver.entity';

beforeEach(() => TestBed.resetTestingModule());

it('keeps only deliveries for the latest date and cancels reads when the view is destroyed', () => {
  const old = new Subject<ProviderDelivery[]>();
  const current = new Subject<ProviderDelivery[]>();
  const api = { deliveries: vi.fn().mockReturnValueOnce(old).mockReturnValueOnce(current) };
  TestBed.configureTestingModule({ providers: [{ provide: FulfillmentApi, useValue: api }] });
  const store = TestBed.inject(FulfillmentStore);
  const destroyRef = TestBed.inject(DestroyRef);
  store.loadDeliveries('2026-10-02', destroyRef);
  store.loadDeliveries('2026-10-03', destroyRef);
  old.next([{ id: 1 } as ProviderDelivery]);
  expect(store.deliveries()).toEqual([]);
  expect(store.isLoading()).toBe(true);
  current.next([{ id: 2 } as ProviderDelivery]);
  expect(store.deliveries()[0].id).toBe(2);
  TestBed.resetTestingModule();
  current.next([{ id: 3 } as ProviderDelivery]);
  expect(store.deliveries()[0].id).toBe(2);
  expect(store.isLoading()).toBe(false);
});

it('rejects a second mutation while one is pending and recovers after an error', () => {
  const first = new Subject<Driver>();
  const api = {
    updateDriverStatus: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(of({ id: 1, status: 'AVAILABLE' } as Driver)),
    updateTankerStatus: vi.fn(), getDrivers: vi.fn(() => of([{ id: 1, status: 'INACTIVE' } as Driver])),
  };
  TestBed.configureTestingModule({ providers: [{ provide: FulfillmentApi, useValue: api }] });
  const store = TestBed.inject(FulfillmentStore);
  store.updateDriverStatus(1, { status: 'INACTIVE' });
  store.updateDriverStatus(1, { status: 'AVAILABLE' });
  store.updateTankerStatus(2, { status: 'INACTIVE' });
  expect(api.updateDriverStatus).toHaveBeenCalledTimes(1);
  expect(api.updateTankerStatus).not.toHaveBeenCalled();
  store.loadDrivers();
  expect(store.driverList()[0].status).toBe('INACTIVE');
  first.error(new Error('errors.http-500'));
  expect(store.error()).toBe('errors.http-500');
  expect(store.isLoading()).toBe(false);
  store.updateDriverStatus(1, { status: 'AVAILABLE' });
  expect(api.updateDriverStatus).toHaveBeenCalledTimes(2);
  expect(store.driverList()[0].status).toBe('AVAILABLE');
  expect(store.successMsg()).toBe('driver-form.saved');
});
