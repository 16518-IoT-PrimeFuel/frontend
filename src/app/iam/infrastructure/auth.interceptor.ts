import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
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
  const authenticatedRequest = token && !request.url.includes('/authentication/')
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 && iam.isAuthenticated() && isExpired(token)) {
      iam.logout();
    }
    return throwError(() => error);
  }));
};
