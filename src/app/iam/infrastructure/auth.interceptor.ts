import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
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

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const iam = inject(IamStore);
  const token = iam.session()?.token;
  // Las peticiones de traducciones se saltan: TranslateService las emite al construirse y inyectarlo aquí crearía una dependencia circular.
  const language = request.url.includes('/i18n/') ? '' : inject(TranslateService).getCurrentLang();
  const withLanguage = language ? request.clone({ setHeaders: { 'Accept-Language': language } }) : request;
  const authenticatedRequest = token && !request.url.includes('/authentication/')
    ? withLanguage.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : withLanguage;

  return next(authenticatedRequest).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 && iam.isAuthenticated() && isExpired(token)) {
      iam.logout();
    }
    return throwError(() => error);
  }));
};
