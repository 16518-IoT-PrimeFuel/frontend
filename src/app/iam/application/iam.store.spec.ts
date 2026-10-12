import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IamApi } from '../infrastructure/iam-api';
import { Session } from '../domain/model/session.entity';
import { IamStore } from './iam.store';

describe('IamStore session closure', () => {
  const session: Session = { id: 1, username: 'test@example.com', token: 'test-token', roles: ['ROLE_BUYER'], companyId: 4, providerId: null, memberships: [] };
  let response: Subject<void>;
  let api: { signIn: ReturnType<typeof vi.fn>; signOut: ReturnType<typeof vi.fn> };
  let replace: ReturnType<typeof vi.fn>;
  let store: IamStore;

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear(); sessionStorage.clear();
    response = new Subject<void>();
    api = { signIn: vi.fn(() => of(session)), signOut: vi.fn(() => response) };
    replace = vi.fn();
    vi.stubGlobal('location', { replace });
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: IamApi, useValue: api }] });
    store = TestBed.inject(IamStore);
  });
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); sessionStorage.clear(); });

  it('revokes before clearing, blocks duplicate logout and preserves invitation navigation', () => {
    store.signIn(session.username, 'password', false).subscribe();
    store.logout('/accept-invitation', 'invitation-token');
    store.logout();
    expect(api.signOut).toHaveBeenCalledOnce();
    expect(store.session()).toEqual(session);
    expect(sessionStorage.getItem('fulltank.session')).not.toBeNull();
    expect(replace).not.toHaveBeenCalled();
    response.complete();
    expect(store.session()).toBeNull();
    expect(sessionStorage.getItem('fulltank.session')).toBeNull();
    expect(replace).toHaveBeenCalledExactlyOnceWith('/login?returnUrl=%2Faccept-invitation#invitation-token');
  });

  it('clears the local session even when revocation fails', () => {
    store.signIn(session.username, 'password').subscribe();
    store.logout();
    response.error(new Error('offline'));
    expect(store.session()).toBeNull();
    expect(localStorage.getItem('fulltank.session')).toBeNull();
    expect(replace).toHaveBeenCalledExactlyOnceWith('/login');
  });

  it('expires locally without a recursive revocation request and supplies the login notice', () => {
    store.signIn(session.username, 'password').subscribe();
    store.expireSession();
    expect(api.signOut).not.toHaveBeenCalled();
    expect(store.session()).toBeNull();
    expect(replace).toHaveBeenCalledExactlyOnceWith('/login?reason=session-expired');
  });
});
