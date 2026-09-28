import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { IamStore } from '../application/iam.store';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const iam = inject(IamStore);
  const token = iam.session()?.token;
  const authenticatedRequest = token && !request.url.includes('/authentication/')
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(catchError((error: unknown) => {
    if (error instanceof HttpErrorResponse && error.status === 401 && iam.isAuthenticated()) {
      iam.logout();
    }
    return throwError(() => error);
  }));
};
