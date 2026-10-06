import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AdminStore } from './admin.store';
import { AdminApi, AdminUser } from '../infrastructure/admin-api';

const user = (id: number): AdminUser => ({ id, username: `u${id}`, roles: ['ROLE_USER'], companyId: null, providerId: null });

describe('AdminStore re-entry guards', () => {
  let api: Record<'users' | 'metrics' | 'payments' | 'promote' | 'exportEvidence' | 'deleteEvidence', ReturnType<typeof vi.fn>>;
  let store: AdminStore;

  beforeEach(() => {
    api = { users: vi.fn(), metrics: vi.fn(), payments: vi.fn(), promote: vi.fn(), exportEvidence: vi.fn(), deleteEvidence: vi.fn() };
    TestBed.configureTestingModule({ providers: [{ provide: AdminApi, useValue: api }] });
    store = TestBed.inject(AdminStore);
  });

  it('rejects a second action while one is in flight', () => {
    const pending = new Subject<{ userId: number; username: string; roles: string[] }>();
    api.promote.mockReturnValue(pending);
    store.promote(user(1));
    store.promote(user(1));
    store.promote(user(2));
    store.deleteEvidence(9);
    store.exportEvidence(9, () => {});
    expect(api.promote).toHaveBeenCalledTimes(1);
    expect(api.deleteEvidence).not.toHaveBeenCalled();
    expect(api.exportEvidence).not.toHaveBeenCalled();
    expect(store.acting()).toBe(true);
    pending.next({ userId: 1, username: 'u1', roles: ['ROLE_ADMIN'] }); pending.complete();
    expect(store.acting()).toBe(false);
    expect(store.notice()).toBe('admin.users.promoted');
  });

  it('accepts a new action after the previous one fails', () => {
    const pending = new Subject<void>();
    api.deleteEvidence.mockReturnValueOnce(pending).mockReturnValue(of(undefined));
    store.deleteEvidence(9);
    pending.error({ error: { code: 'admin.evidence.missing' } });
    expect(store.acting()).toBe(false);
    expect(store.error()).toBe('admin.evidence.missing');
    store.deleteEvidence(9);
    expect(api.deleteEvidence).toHaveBeenCalledTimes(2);
    expect(store.notice()).toBe('admin.evidence.deleted');
  });

  it('keeps the initial loads concurrent', () => {
    api.users.mockReturnValue(new Subject());
    api.metrics.mockReturnValue(new Subject());
    api.payments.mockReturnValue(new Subject());
    store.loadUsers(); store.loadMetrics('v1'); store.loadPayments();
    expect(api.users).toHaveBeenCalledTimes(1);
    expect(api.metrics).toHaveBeenCalledWith('v1');
    expect(api.payments).toHaveBeenCalledTimes(1);
  });
});
