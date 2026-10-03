import { DestroyRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { expect, it, vi } from 'vitest';
import { FulfillmentStore } from './fulfillment.store';
import { FulfillmentApi } from '../infrastructure/fulfillment-api';
import { ProviderDelivery } from '../domain/model/provider-delivery.entity';

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
