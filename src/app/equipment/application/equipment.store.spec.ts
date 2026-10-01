import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EquipmentStore } from './equipment.store';
import { EquipmentApi } from '../infrastructure/equipment.api';
import { IamApi } from '../../iam/infrastructure/iam-api';
import { IamStore } from '../../iam/application/iam.store';
import { Customer } from '../domain/model/equipment.entity';

const account = (id: number, legacyCompanyId: number | null): Customer => ({ id, name: `c${id}`, legacyCompanyId, active: true });

describe('EquipmentStore.resolveCustomer', () => {
  let api: { customers: ReturnType<typeof vi.fn>; createCustomer: ReturnType<typeof vi.fn> };
  const setup = (companyId: number | null) => {
    api = { customers: vi.fn(), createCustomer: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: EquipmentApi, useValue: api },
      { provide: IamApi, useValue: { getBuyerCompany: () => of({ id: companyId, name: 'ACME', ruc: '20123456789', address: 'x', contactEmail: 'a@b.pe', phone: '1', sector: '' }) } },
      { provide: IamStore, useValue: { companyId: () => companyId } },
    ] });
    return TestBed.inject(EquipmentStore);
  };
  const run = (store: EquipmentStore) => new Promise<{ ok?: Customer; err?: any }>(resolve => store.resolveCustomer().subscribe({ next: ok => resolve({ ok }), error: err => resolve({ err }) }));

  it('reuses the account linked to the user company and never creates one', async () => {
    const store = setup(7);
    api.customers.mockReturnValue(of([account(1, 3), account(2, 7)]));
    expect((await run(store)).ok?.id).toBe(2);
    expect(api.createCustomer).not.toHaveBeenCalled();
  });

  it('reuses the single unlinked account of the organization', async () => {
    const store = setup(7);
    api.customers.mockReturnValue(of([account(1, null)]));
    expect((await run(store)).ok?.id).toBe(1);
  });

  it('does not guess among several unrelated accounts or link another company', async () => {
    const store = setup(7);
    api.customers.mockReturnValue(of([account(1, 3), account(2, 4)]));
    expect((await run(store)).err.error.code).toBe('equipment.customer-unresolved');
    expect(api.createCustomer).not.toHaveBeenCalled();
  });

  it('creates from the buyer company only when the organization has none', async () => {
    const store = setup(7);
    api.customers.mockReturnValue(of([]));
    api.createCustomer.mockReturnValue(of(account(9, 7)));
    expect((await run(store)).ok?.id).toBe(9);
    expect(api.createCustomer.mock.lastCall![0].legacyCompanyId).toBe(7);
  });

  it('on a concurrent create (409) rereads the winner instead of duplicating', async () => {
    const store = setup(7);
    api.customers.mockReturnValueOnce(of([])).mockReturnValueOnce(of([account(5, 7)]));
    api.createCustomer.mockReturnValue(throwError(() => ({ status: 409 })));
    expect((await run(store)).ok?.id).toBe(5);
    expect(api.createCustomer).toHaveBeenCalledTimes(1);
  });
});
