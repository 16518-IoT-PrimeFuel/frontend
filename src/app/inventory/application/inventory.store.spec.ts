import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { InventoryStore } from './inventory.store';
import { InventoryApi } from '../infrastructure/inventory-api';
import { FuelProduct } from '../domain/model/fuel-product.entity';

describe('InventoryStore re-entry guards', () => {
  let api: { updateStock: ReturnType<typeof vi.fn>; deleteProduct: ReturnType<typeof vi.fn> };
  let store: InventoryStore;

  beforeEach(() => {
    api = { updateStock: vi.fn(), deleteProduct: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: InventoryApi, useValue: api }] });
    store = TestBed.inject(InventoryStore);
  });

  it('rejects a second delete or stock update while a delete is in flight', () => {
    const pending = new Subject<void>();
    api.deleteProduct.mockReturnValue(pending);
    store.deleteProduct(1);
    store.deleteProduct(1);
    store.deleteProduct(2);
    store.updateStock(1, 50);
    expect(api.deleteProduct).toHaveBeenCalledTimes(1);
    expect(api.updateStock).not.toHaveBeenCalled();
    expect(store.mutatingId()).toBe(1);
    pending.next(); pending.complete();
    expect(store.mutatingId()).toBeNull();
    store.deleteProduct(2);
    expect(api.deleteProduct).toHaveBeenCalledTimes(2);
  });

  it('rejects a second stock update while one is in flight and recovers after an error', () => {
    const pending = new Subject<FuelProduct>();
    api.updateStock.mockReturnValue(pending);
    store.updateStock(1, 50);
    store.updateStock(1, 60);
    expect(api.updateStock).toHaveBeenCalledTimes(1);
    pending.error(new Error('offline'));
    expect(store.mutatingId()).toBeNull();
    expect(store.isLoading()).toBe(false);
    expect(store.error()).toBe('offline');
    store.updateStock(1, 60);
    expect(api.updateStock).toHaveBeenCalledTimes(2);
  });
});
