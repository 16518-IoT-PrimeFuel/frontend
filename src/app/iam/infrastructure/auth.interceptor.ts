import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';
import { IamStore } from '../application/iam.store';

/** Un 401 no implica sesión caducada (el backend también lo usa en denegaciones de permiso): solo se cierra si el `exp` del JWT ya pasó. */
function isExpired(token: string | undefined): boolean {
  try {
    const { exp } = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

/** Punto único de log de errores HTTP. Nunca registra cabeceras, cuerpo de la petición ni tokens de la URL. */
function logHttpError(method: string, url: string, error: HttpErrorResponse): void {
  const invitationToken = /\/invitations\/[^/]+\/accept/.test(url);
  const safeUrl = url.split(/[?#]/)[0].replace(/\/invitations\/[^/]+\/accept/, '/invitations/:token/accept');
  const body = typeof error.error === 'object' && error.error !== null ? error.error : null;
  console.error(`[FullTank HTTP ${error.status || 'network'}] ${method} ${safeUrl}`, {
    status: error.status,
    statusText: error.statusText,
    // El 404 de una invitación puede repetir el token en el cuerpo: se omite.
    code: invitationToken ? undefined : body?.code,
    message: invitationToken ? undefined : body?.message ?? (typeof error.error === 'string' ? error.error.slice(0, 300) : error.message),
    details: invitationToken ? undefined : body?.details,
  });
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const iam = inject(IamStore);
  const token = iam.session()?.token;
  // Las peticiones de traducciones se saltan: TranslateService las emite al construirse y inyectarlo aquí crearía una dependencia circular.
  const language = request.url.includes('/i18n/') ? '' : inject(TranslateService).getCurrentLang();
  const withLanguage = language ? request.clone({ setHeaders: { 'Accept-Language': language } }) : request;
  let isApiRequest = false;
  try {
    const api = new URL(environment.serverBasePath, location.origin);
    const destination = new URL(request.url, location.origin);
    const basePath = api.pathname.replace(/\/$/, '');
    isApiRequest = destination.origin === api.origin && (destination.pathname === basePath || destination.pathname.startsWith(`${basePath}/`));
  } catch { /* Una URL de API aún sin configurar no debe recibir el Bearer. */ }
  const authenticatedRequest = token && isApiRequest && !request.url.includes('/authentication/')
    ? withLanguage.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : withLanguage;

  return next(authenticatedRequest).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && !request.url.includes('/i18n/')) logHttpError(request.method, request.url, error);
    if (error instanceof HttpErrorResponse && error.status === 401 && iam.session()?.token === token && isExpired(token)) {
      iam.logout();
    }
    return throwError(() => error);
  }));
};
