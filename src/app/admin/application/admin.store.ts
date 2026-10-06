import { inject, Injectable, signal } from '@angular/core';
import { finalize, Observable } from 'rxjs';
import { Payment } from '../../ordering/infrastructure/ordering-api';
import { AdminApi, AdminUser, ApiMetric, TransportEvidence } from '../infrastructure/admin-api';

@Injectable({ providedIn: 'root' })
export class AdminStore {
  private readonly api = inject(AdminApi);
  private readonly usersState = signal<AdminUser[]>([]);
  private readonly metricsState = signal<ApiMetric[]>([]);
  private readonly paymentsState = signal<Payment[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly noticeState = signal<string | null>(null);
  private readonly actingState = signal(false);
  readonly users = this.usersState.asReadonly();
  readonly metrics = this.metricsState.asReadonly();
  readonly payments = this.paymentsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  /** Clave i18n del último resultado exitoso de una acción. */
  readonly notice = this.noticeState.asReadonly();
  /** Hay una acción (promover, exportar o borrar evidencia) en curso. */
  readonly acting = this.actingState.asReadonly();

  loadUsers(): void { this.run(this.api.users(), value => this.usersState.set(value)); }
  loadMetrics(version: string): void { this.run(this.api.metrics(version), value => this.metricsState.set(value)); }
  loadPayments(): void { this.run(this.api.payments(), value => this.paymentsState.set(value)); }
  promote(user: AdminUser): void {
    this.act(() => this.api.promote(user.id), result => {
      this.usersState.update(items => items.map(item => item.id === result.userId ? { ...item, roles: result.roles } : item));
      this.noticeState.set('admin.users.promoted');
    });
  }
  exportEvidence(deliveryId: number, done: (evidence: TransportEvidence) => void): void { this.act(() => this.api.exportEvidence(deliveryId), done); }
  deleteEvidence(deliveryId: number): void { this.act(() => this.api.deleteEvidence(deliveryId), () => this.noticeState.set('admin.evidence.deleted')); }

  /** Las cargas pueden coincidir entre sí; las acciones no: se rechaza la segunda mientras hay una en curso. */
  private act<T>(request: () => Observable<T>, save: (value: T) => void): void {
    if (this.actingState()) return;
    this.actingState.set(true);
    this.run(request().pipe(finalize(() => this.actingState.set(false))), save);
  }

  private run<T>(request: Observable<T>, save: (value: T) => void): void {
    this.loadingState.set(true); this.errorState.set(null); this.noticeState.set(null);
    request.pipe(finalize(() => this.loadingState.set(false))).subscribe({
      next: save,
      error: error => this.errorState.set(error?.error?.message ?? error?.error?.code ?? 'admin.error'),
    });
  }
}
