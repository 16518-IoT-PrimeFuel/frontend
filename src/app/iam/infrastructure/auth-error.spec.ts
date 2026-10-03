import { describe, expect, it } from 'vitest';
import { displayAuthError } from './auth-error';

describe('displayAuthError', () => {
  it('explains duplicate emails and company or organization RUCs', () => {
    for (const [code, key] of [
      ['USER_CONFLICT', 'user-conflict'],
      ['BUYER COMPANY_CONFLICT', 'buyer-conflict'],
      ['PROVIDER COMPANY_CONFLICT', 'provider-conflict'],
      ['ORGANIZATION_CONFLICT', 'ruc-conflict'],
    ]) {
      expect(displayAuthError({ status: 409, error: { code } }, 'sign-up')).toBe(`auth.error.${key}`);
    }
  });

  it('maps the backend sign-in statuses to a credentials message', () => {
    for (const status of [400, 401, 404]) {
      expect(displayAuthError({ status }, 'sign-in')).toBe('auth.error.credentials');
    }
  });

  it('never shows unknown error or raw server codes in login or registration', () => {
    for (const operation of ['sign-in', 'sign-up'] as const) {
      for (const [status, key] of [[0, 'connection'], [403, 'forbidden'], [409, 'conflict'], [429, 'too-many-attempts'], [500, 'server'], [502, 'server'], [418, 'generic']] as const) {
        expect(displayAuthError({ status, error: { code: 'UNKNOWN', message: 'Unknown Error' } }, operation)).toBe(`auth.error.${key}`);
      }
      expect(displayAuthError(undefined, operation)).toBe('auth.error.generic');
    }
  });

  it('preserves a useful password reset message', () => {
    expect(displayAuthError({ status: 400, error: { message: 'El token ha vencido.' } })).toBe('El token ha vencido.');
  });
});
