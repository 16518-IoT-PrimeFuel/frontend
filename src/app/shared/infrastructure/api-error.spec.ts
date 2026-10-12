import { describe, expect, it } from 'vitest';
import { apiErrorKey } from './api-error';

describe('apiErrorKey', () => {
  it('distinguishes payment conflicts and operation validation without exposing backend text', () => {
    for (const [details, key] of [
      ['Operation number ABC123 is already registered', 'operation-duplicate'],
      ['A payment already exists for order 30', 'payment-duplicate'],
      ['Order 30 is not awaiting payment; current status is PAID', 'order-not-payable'],
    ]) expect(apiErrorKey({ status: 409, error: { code: 'PAYMENT_CONFLICT', details } })).toBe(`errors.${key}`);
    expect(apiErrorKey({ status: 400, error: { code: 'VALIDATION_ERROR', details: 'The operation number must be 6 to 20 alphanumeric characters' } })).toBe('errors.operation-format');
    expect(apiErrorKey({ status: 409, error: { code: 'REPLENISHMENTREQUEST_CONFLICT', details: 'The tank already has a pending manual request' } })).toBe('errors.tank-pending-request');
  });

  it('handles rate limits, unknown responses and network errors with safe translation keys', () => {
    expect(apiErrorKey({ status: 429, error: { code: 'RATE_LIMITED' } })).toBe('errors.http-429');
    expect(apiErrorKey({ status: 0 })).toBe('errors.network');
    expect(apiErrorKey({ status: 500, error: { code: 'PAYMENT_CONFLICT' } })).toBe('errors.server');
    expect(apiErrorKey({ status: 418, error: { code: 42, details: {} }, message: 'SQL password=secret' })).toBe('errors.generic');
    expect(apiErrorKey(new Error('errors.network'))).toBe('errors.network');
    expect(apiErrorKey(undefined)).toBe('errors.generic');
    expect(apiErrorKey({ status: 418, error: { code: 'toString' } })).toBe('errors.generic');
  });
});
