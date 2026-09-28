import { HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';

/**
 * Abstract base class providing centralized HTTP error handling for FullTank.
 * @remarks All API endpoint classes in the bounded contexts extend this class
 * to avoid duplicating error handling logic. Maps HTTP status codes to
 * meaningful error messages aligned with the FullTank domain.
 * @author FullTank Platform
 */
export abstract class ErrorHandlingEnabledBaseType {
  /**
   * Handles HTTP errors and returns an observable that throws a typed error.
   * @param operation - A human-readable description of the failed operation.
   * @returns A function that takes an HttpErrorResponse and returns an Observable<never>.
   */
  protected handleError(operation: string) {
    return (error: HttpErrorResponse): Observable<never> => {
      const body = typeof error.error === 'object' ? error.error : null;
      const fallback = error.status === 0 ? 'errors.network' : error.status >= 500 ? 'errors.server' : `errors.http-${error.status}`;
      const message = error.status >= 500 ? fallback : (body?.message ?? fallback);
      const details = error.status < 500 && typeof body?.details === 'string' && body.details !== message ? body.details : '';
      const errorMessage = details ? `${message}: ${details}` : message;

      console.error(`[FullTank API Error] ${errorMessage}`, error);
      return throwError(() => new Error(errorMessage));
    };
  }
}
