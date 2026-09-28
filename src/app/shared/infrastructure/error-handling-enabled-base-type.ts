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
      const errorMessage = error.error?.message ?? error.error?.code ?? (
        error.error instanceof ErrorEvent ? error.error.message :
          error.status === 400 ? 'Request validation failed.' :
          error.status === 401 ? 'Your session has expired. Sign in again.' :
          error.status === 403 ? 'You do not have permission to do this.' :
          error.status === 404 ? 'The requested resource was not found.' :
          error.status === 409 ? 'This conflicts with an existing record.' :
          error.status === 422 ? 'This request cannot be processed.' :
          error.status === 0 ? 'The server could not be reached.' : error.statusText || 'Unexpected server error'
      );

      console.error(`[FullTank API Error] ${errorMessage}`, error);
      return throwError(() => new Error(errorMessage));
    };
  }
}
