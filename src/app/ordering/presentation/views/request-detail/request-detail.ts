import { Component, DestroyRef, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subject, catchError, combineLatest, finalize, map, of, startWith, switchMap, takeUntil } from 'rxjs';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { Request } from '../../../domain/model/request.entity';
import { IamStore } from '../../../../iam/application/iam.store';

registerLocaleData(localeEs);

type RequestAction = 'cancel' | 'accept' | 'reject';

@Component({
  selector: 'app-request-detail',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, RouterLink, TranslatePipe, MatButton, MatDialogModule],
  templateUrl: './request-detail.html',
  styleUrl: './request-detail.css',
})
export class RequestDetail {
  readonly iam = inject(IamStore);
  private readonly api = inject(OrderingApi);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly refresh = new Subject<void>();
  private readonly routeChanged = new Subject<void>();
  private currentId: number | null = null;
  private dialogRef?: MatDialogRef<unknown>;
  @ViewChild('confirmation') private confirmation!: TemplateRef<unknown>;
  readonly request = signal<Request | null>(null);
  readonly loading = signal(false);
  readonly acting = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly action = signal<RequestAction | null>(null);
  readonly locale = toSignal(this.translate.onLangChange.pipe(map(event => event.lang), startWith(this.translate.getCurrentLang() || 'es')), { requireSync: true });
  rejectionReason = '';

  constructor() {
    this.destroyRef.onDestroy(() => this.dialogRef?.close());
    combineLatest([this.route.paramMap, this.refresh.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        const rawId = params.get('id') ?? '';
        const id = /^[1-9]\d*$/.test(rawId) && Number.isSafeInteger(Number(rawId)) ? Number(rawId) : null;
        if (id !== this.currentId) {
          this.routeChanged.next();
          this.dialogRef?.close();
          this.currentId = id;
          this.notice.set('');
          this.rejectionReason = '';
        }
        this.request.set(null);
        this.error.set('');
        if (id === null) { this.loading.set(false); this.error.set('errors.http-404'); return EMPTY; }
        this.loading.set(true);
        return this.api.request(id).pipe(
          catchError((error: HttpErrorResponse) => { this.error.set(this.errorKey(error)); return of(null); }),
          finalize(() => this.loading.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(request => this.request.set(request));
  }

  reload(): void {
    if (this.loading() || this.acting() || this.action()) return;
    this.notice.set('');
    this.refresh.next();
  }

  canAct(action: RequestAction): boolean {
    const request = this.request();
    return !!request && request.status === 'PENDING' && !this.loading() && !this.acting()
      && (action === 'cancel' ? this.iam.isBuyer() : this.iam.isProvider() && this.iam.providerId() === request.providerId);
  }

  confirmAction(action: RequestAction): void {
    if (!this.canAct(action) || this.action()) return;
    const requestId = this.request()!.id;
    this.action.set(action);
    this.rejectionReason = '';
    this.dialogRef = this.dialog.open(this.confirmation, { width: '480px', maxWidth: 'calc(100vw - 32px)' });
    this.dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      this.dialogRef = undefined;
      this.action.set(null);
      if (confirmed !== true || this.request()?.id !== requestId || !this.canAct(action)) return;
      const reason = this.rejectionReason.trim();
      if (action === 'reject' && !reason) return;
      this.error.set('');
      this.notice.set('');
      this.acting.set(true);
      const mutation = action === 'cancel' ? this.api.cancelRequest(requestId)
        : action === 'accept' ? this.api.acceptRequest(requestId) : this.api.rejectRequest(requestId, reason);
      mutation.pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef), finalize(() => this.acting.set(false))).subscribe({
        next: () => { this.notice.set(`request-detail.${action}-success`); this.rejectionReason = ''; this.refresh.next(); },
        error: (error: HttpErrorResponse) => this.error.set(this.errorKey(error)),
      });
    });
  }

  private errorKey(error: HttpErrorResponse): string {
    if (error.status === 0) return 'errors.network';
    if (error.status >= 500) return 'errors.server';
    return [400, 401, 403, 404, 409, 422].includes(error.status) ? `errors.http-${error.status}` : 'errors.generic';
  }
}
