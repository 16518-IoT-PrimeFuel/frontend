import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { IamStore } from '../application/iam.store';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  const session = { token: 'active-token' };
  const iam = { session: vi.fn(() => session), expireSession: vi.fn() };
  let http: HttpClient;
  let requests: HttpTestingController;

  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.clearAllMocks();
    iam.session.mockReturnValue(session);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: IamStore, useValue: iam },
      { provide: TranslateService, useValue: { getCurrentLang: () => 'es' } },
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { requests.verify(); vi.restoreAllMocks(); });

  it('attaches Bearer to sign-out but never to public authentication or other origins', () => {
    for (const [url, bearer] of [
      [`${environment.serverBasePath}/authentication/sign-out`, true],
      [`${environment.serverBasePath}/authentication/sign-in`, false],
      ['https://example.com/api/orders', false],
    ] as const) {
      http.post(url, null).subscribe();
      const request = requests.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe(bearer ? 'Bearer active-token' : null);
      request.flush(null);
    }
  });

  it('expires revoked tokens on protected 401, including tokens whose expiry is still in the future', () => {
    const url = `${environment.serverBasePath}/me/organizations`;
    http.get(url).subscribe({ error: () => undefined });
    requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(iam.expireSession).toHaveBeenCalledOnce();
  });

  it('preserves sessions on forbidden responses, public auth failures and external failures', () => {
    for (const [url, status] of [
      [`${environment.serverBasePath}/me/organizations`, 403],
      [`${environment.serverBasePath}/authentication/sign-out`, 401],
      [`${environment.serverBasePath}/authentication/sign-in`, 401],
      ['https://example.com/api/orders', 401],
    ] as const) {
      http.get(url).subscribe({ error: () => undefined });
      requests.expectOne(url).flush({}, { status, statusText: 'Rejected' });
    }
    expect(iam.expireSession).not.toHaveBeenCalled();
  });

  it('does not expire a replacement session because an earlier request failed', () => {
    const url = `${environment.serverBasePath}/me/organizations`;
    http.get(url).subscribe({ error: () => undefined });
    iam.session.mockReturnValue({ token: 'new-token' });
    requests.expectOne(url).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(iam.expireSession).not.toHaveBeenCalled();
  });
});
