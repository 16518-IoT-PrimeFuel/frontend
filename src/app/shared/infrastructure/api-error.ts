interface ApiFailure { status?: number; error?: { code?: string; details?: unknown }; message?: string; }

const errorKeys: Record<string, string> = {
  DEVICEBINDING_CONFLICT: 'provider-equipment.err-device-duplicate',
  BUYERCOMPANY_CONFLICT: 'provider-equipment.err-ruc-duplicate',
  PROVIDERBUYERLINK_CONFLICT: 'provider-equipment.err-already-linked',
  BUYERCOMPANY_NOT_FOUND: 'provider-equipment.err-buyer-not-found',
  FUELPRODUCT_NOT_FOUND: 'provider-equipment.err-product-not-found',
  TANK_NOT_FOUND: 'provider-equipment.err-tank-not-found',
  LOOKUP_RATE_LIMITED: 'provider-equipment.err-lookup-rate-limited',
  DEVICECREDENTIAL_CONFLICT: 'device.already-issued',
  DEVICECREDENTIAL_NOT_FOUND: 'device.no-credential',
};

/** Traduce errores sin exponer mensajes técnicos ni identificadores del servidor. */
export function apiErrorKey(error: unknown): string {
  const failure = error as ApiFailure | null;
  const status = failure?.status;
  if (status === 0) return 'errors.network';
  if (status !== undefined && status >= 500) return 'errors.server';
  const code = typeof failure?.error?.code === 'string' ? failure.error.code : '';
  const details = typeof failure?.error?.details === 'string' ? failure.error.details : '';
  // shortcut: PAYMENT_CONFLICT agrupa tres motivos, usar códigos distintos cuando el backend los publique.
  if (code === 'PAYMENT_CONFLICT') {
    if (details.startsWith('Operation number ')) return 'errors.operation-duplicate';
    if (details.startsWith('A payment already exists')) return 'errors.payment-duplicate';
    if (details.includes('is not awaiting payment')) return 'errors.order-not-payable';
  }
  if (code === 'VALIDATION_ERROR' && details.includes('operation number')) return 'errors.operation-format';
  if (code === 'VALIDATION_ERROR' && details === 'Quantity exceeds the free capacity of the tank') return 'request-form.quantity-exceeds-capacity';
  if (code === 'VALIDATION_ERROR' && details === 'A tank is required') return 'request-form.tank-required';
  if (code === 'REPLENISHMENTREQUEST_CONFLICT' && details === 'The tank already has a pending manual request') return 'errors.tank-pending-request';
  if (Object.hasOwn(errorKeys, code)) return errorKeys[code];
  if (code === 'RATE_LIMITED' || code === 'LOOKUP_RATE_LIMITED' || status === 429) return 'errors.http-429';
  if (code === 'RESOURCE_NOT_FOUND' || code?.endsWith('_NOT_FOUND')) return 'errors.http-404';
  if (code === 'VALIDATION_ERROR') return 'errors.http-400';
  if (code?.endsWith('_CONFLICT')) return 'errors.http-409';
  if (status !== undefined && [400, 401, 403, 404, 405, 409, 415, 422].includes(status)) return `errors.http-${status}`;
  return typeof failure?.message === 'string' && failure.message.startsWith('errors.') ? failure.message : 'errors.generic';
}
