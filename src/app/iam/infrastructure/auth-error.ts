export function displayAuthError(error: any, operation?: 'sign-in' | 'sign-up'): string {
  const code = String(error?.error?.code ?? '').toUpperCase();
  if (error?.status === 0) return 'auth.error.connection';
  if (error?.status >= 500) return 'auth.error.server';
  if (error?.status === 429) return 'auth.error.too-many-attempts';
  if (operation === 'sign-in' && [400, 401, 404].includes(error?.status)) return 'auth.error.credentials';
  if (code.includes('USER') && code.includes('CONFLICT')) return 'auth.error.user-conflict';
  if (code.includes('BUYER') && code.includes('COMPANY') && code.includes('CONFLICT')) return 'auth.error.buyer-conflict';
  if (code.includes('PROVIDER') && code.includes('COMPANY') && code.includes('CONFLICT')) return 'auth.error.provider-conflict';
  if (code === 'ORGANIZATION_CONFLICT') return 'auth.error.ruc-conflict';
  if (operation === 'sign-up' && error?.status === 404) return 'auth.error.registration-unavailable';
  if (error?.status === 403) return 'auth.error.forbidden';
  // Los flujos de autenticación usan mensajes propios, no códigos o textos genéricos del servidor.
  if (!operation && typeof error?.error?.message === 'string' && error.error.message.trim()
      && !/unknown error|http failure|internal server error/i.test(error.error.message)) return error.error.message;
  return (
      [400, 422].includes(error?.status) ? 'auth.error.bad-request' :
        error?.status === 401 ? 'auth.error.unauthorized' :
          error?.status === 409 ? 'auth.error.conflict' : 'auth.error.generic'
  );
}
