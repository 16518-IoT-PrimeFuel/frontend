export function displayAuthError(error: any): string {
  const code = String(error?.error?.code ?? '').toUpperCase();
  if (code.includes('USER') && code.includes('CONFLICT')) return 'auth.error.user-conflict';
  if (code.includes('BUYER') && code.includes('COMPANY') && code.includes('CONFLICT')) return 'auth.error.buyer-conflict';
  if (code.includes('PROVIDER') && code.includes('COMPANY') && code.includes('CONFLICT')) return 'auth.error.provider-conflict';
  return error?.error?.message ?? error?.error?.code ?? (
    error?.status === 0 ? 'auth.error.connection' :
      error?.status === 400 ? 'auth.error.bad-request' :
        error?.status === 401 ? 'auth.error.unauthorized' :
          error?.status === 409 ? 'auth.error.conflict' : 'auth.error.generic'
  );
}
