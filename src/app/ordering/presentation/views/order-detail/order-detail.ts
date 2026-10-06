import { Component, computed, DestroyRef, effect, inject, Signal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { distinctUntilChanged, forkJoin, map, of, Subject, Subscription, takeUntil } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { OrderingStore } from '../../../application/ordering.store';
import { Order } from '../../../domain/model/order.entity';
import { IamStore } from '../../../../iam/application/iam.store';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatCard, MatCardContent } from '@angular/material/card';
import { MatChip, MatChipSet } from '@angular/material/chips';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatError } from '@angular/material/input';
import { MatTooltip } from '@angular/material/tooltip';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FulfillmentApi } from '../../../../fulfillment/infrastructure/fulfillment-api';
import { Driver } from '../../../../fulfillment/domain/model/driver.entity';
import { Tanker } from '../../../../fulfillment/domain/model/tanker.entity';
import { DeliveryRecommendation } from '../../../../fulfillment/domain/model/provider-delivery.entity';
import { HttpErrorResponse } from '@angular/common/http';
import { OrderingApi, Payment, PaymentMethod } from '../../../infrastructure/ordering-api';
import { CONFIRM_DIALOG_CONFIG, ConfirmDialog } from '../../../../shared/presentation/component/confirm-dialog/confirm-dialog';

@Component({ selector: 'app-order-detail', providers: [OrderingStore], imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule, TranslatePipe, MatButton, MatIconButton, MatIcon, MatCard, MatCardContent, MatChip, MatChipSet, MatProgressSpinner, MatError, MatTooltip], templateUrl: './order-detail.html', styleUrl: './order-detail.css' })
export class OrderDetail {
  readonly store = inject(OrderingStore);
  private readonly iam = inject(IamStore);
  readonly isBuyer = this.iam.role() === 'BUYER';
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fulfillment = inject(FulfillmentApi);
  private readonly api = inject(OrderingApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private dialogRef?: MatDialogRef<unknown>;
  private recommendationRequest?: Subscription;
  private resourcesRequest?: Subscription;
  private readonly routeChanged = new Subject<void>();
  private readonly orderId = signal(0);
  readonly assigning = signal(false);
  readonly companyName = signal<string | null>(null);
  readonly drivers = signal<Driver[]>([]);
  readonly tankers = signal<Tanker[]>([]);
  readonly resourcesLoading = signal(false);
  readonly resourcesError = signal(false);
  readonly assignmentSubmitting = signal(false);
  readonly assignmentReview = signal(false);
  readonly requiredLitres = signal<number | null>(null);
  private eligibleTankerIds = new Set<number>();
  private assignmentCommandId: string | null = null;
  driverId: number | null = null;
  tankerId: number | null = null;
  windowStart = '';
  windowEnd = '';
  assignmentError = '';
  readonly recommendation = signal<DeliveryRecommendation | null>(null);
  readonly recommendationLoading = signal(false);
  /** Clave i18n del aviso cuando no hay recomendación utilizable (409 u otro error). */
  readonly recommendationError = signal<string | null>(null);
  readonly payment = signal<Payment | null>(null);
  readonly paymentLoading = signal(false);
  readonly paymentReadError = signal(false);
  readonly paying = signal(false);
  paymentMethod: PaymentMethod = 'BANK_TRANSFER';
  transactionReference = '';
  paymentError = '';
  private paymentOrderLoaded: number | null = null;
  order: Signal<Order | undefined> = computed(() => this.store.orders().find(item => item.id === this.orderId()));
  constructor() {
    this.route.paramMap.pipe(
      map(params => { const raw = params.get('id') ?? ''; return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : 0; }),
      distinctUntilChanged(), takeUntilDestroyed(this.destroyRef),
    ).subscribe(id => {
      this.routeChanged.next();
      this.resetOrderContext();
      this.orderId.set(id);
      this.store.loadOrder(id);
    });
    this.store.loadNames();
    this.destroyRef.onDestroy(() => this.dialogRef?.close());
    effect(() => {
      const order = this.order();
      if (order && this.isBuyer && this.companyName() === null) this.api.buyerCompany(order.companyId).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({ next: company => this.companyName.set(company.name), error: () => undefined });
      if (!order || !['PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'DELIVERED'].includes(order.status) || this.paymentOrderLoaded === order.id) return;
      this.paymentOrderLoaded = order.id;
      this.paymentLoading.set(true);
      this.paymentReadError.set(false);
      this.paymentError = '';
      this.api.paymentForOrder(order.id).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: payment => { this.payment.set(payment); this.paymentLoading.set(false); },
        error: (error: HttpErrorResponse) => {
          this.payment.set(null);
          this.paymentLoading.set(false);
          if (error.status !== 404) { this.paymentReadError.set(true); this.paymentError = this.paymentErrorKey(error); }
        },
      });
    });
  }
  back(): void { this.router.navigate(['/ordering/order-list']).then(); }
  private resetOrderContext(): void {
    this.dialogRef?.close();
    this.companyName.set(null);
    this.payment.set(null);
    this.paymentOrderLoaded = null;
    this.paymentLoading.set(false);
    this.paymentReadError.set(false);
    this.paying.set(false);
    this.paymentError = '';
    this.transactionReference = '';
    this.paymentMethod = 'BANK_TRANSFER';
    this.assigning.set(false);
    this.assignmentSubmitting.set(false);
    this.editAssignment();
    this.driverId = this.tankerId = null;
    this.drivers.set([]);
    this.tankers.set([]);
    this.requiredLitres.set(null);
    this.windowStart = this.windowEnd = '';
    this.assignmentError = '';
    this.resourcesLoading.set(false);
    this.resourcesError.set(false);
    this.recommendation.set(null);
    this.recommendationLoading.set(false);
    this.recommendationError.set(null);
  }
  confirm(id: number): void { this.confirmAction(id, 'confirm'); }
  cancelOrder(id: number): void { this.confirmAction(id, 'cancel'); }
  private canAct(id: number, action: 'confirm' | 'cancel'): boolean {
    const order = this.order();
    return order?.id === id && !this.store.loading() && !this.assignmentSubmitting() && !this.paying()
      && (action === 'confirm' ? this.isBuyer && order.status === 'PENDING' : ['PENDING', 'CONFIRMED'].includes(order.status));
  }
  private confirmAction(id: number, action: 'confirm' | 'cancel'): void {
    if (!this.canAct(id, action) || this.dialogRef) return;
    this.dialogRef = this.dialog.open(ConfirmDialog, { ...CONFIRM_DIALOG_CONFIG, data: { titleKey: 'confirm.title', messageKey: `order-detail.confirm-${action}` } });
    this.dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
      this.dialogRef = undefined;
      if (confirmed !== true || !this.canAct(id, action)) return;
      if (action === 'confirm') this.store.confirmOrder(id);
      else this.store.cancelOrder(id);
    });
  }
  pay(order: Order): void {
    const companyId = this.iam.companyId();
    if (!this.isBuyer || !companyId || order.companyId !== companyId || this.order()?.id !== order.id || order.status !== 'PENDING_PAYMENT'
      || this.store.loading() || this.paying() || this.paymentLoading() || this.payment() || this.paymentReadError()
      || !Number.isFinite(order.totalPrice) || order.totalPrice <= 0 || !['BANK_TRANSFER', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH'].includes(this.paymentMethod)) return;
    this.paying.set(true);
    this.paymentError = '';
    this.api.createPayment(order.id, companyId, order.totalPrice, this.paymentMethod).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: payment => { this.payment.set(payment); this.paying.set(false); },
      error: (error: HttpErrorResponse) => { this.paymentReadError.set(true); this.paymentError = this.paymentErrorKey(error); this.paying.set(false); },
    });
  }
  completePayment(orderId: number): void {
    const payment = this.payment();
    const order = this.order();
    if (!this.isBuyer || !payment || !order || order.id !== orderId || payment.orderId !== orderId || payment.companyId !== this.iam.companyId()
      || order.companyId !== this.iam.companyId() || order.status !== 'PENDING_PAYMENT' || payment.status !== 'PENDING'
      || this.store.loading() || this.paymentLoading() || this.paying() || !this.transactionReference.trim()) return;
    this.paying.set(true);
    this.paymentError = '';
    this.api.completePayment(payment.id, this.transactionReference.trim()).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: completed => { this.payment.set(completed); this.paying.set(false); this.store.loadOrder(orderId); },
      error: (error: HttpErrorResponse) => { this.paymentError = this.paymentErrorKey(error); this.paying.set(false); },
    });
  }
  private paymentErrorKey(error: HttpErrorResponse): string {
    return error.status === 0 ? 'errors.network' : error.status >= 500 ? 'errors.server'
      : [400, 401, 403, 404, 409, 422].includes(error.status) ? `errors.http-${error.status}` : 'order-detail.payment-error';
  }
  retryPayment(): void {
    const order = this.order();
    if (!order || this.store.loading() || this.paying() || this.paymentLoading()) return;
    this.paymentOrderLoaded = null;
    this.store.loadOrder(order.id);
  }
  statusClass(status: string): string { return status.toLowerCase(); }
  openAssignment(): void {
    this.assigning.set(true);
    this.assignmentReview.set(false);
    this.assignmentCommandId = null;
    this.loadRecommendation();
    this.loadAssignmentResources();
  }
  loadAssignmentResources(): void {
    this.editAssignment();
    this.resourcesRequest?.unsubscribe();
    this.resourcesLoading.set(true);
    this.resourcesError.set(false);
    this.drivers.set([]);
    this.tankers.set([]);
    this.driverId = null;
    this.tankerId = null;
    this.requiredLitres.set(null);
    const requestId = this.order()?.requestId;
    this.resourcesRequest = forkJoin({
      drivers: this.fulfillment.getEligibleDrivers(),
      tankers: this.fulfillment.getTankers(),
      eligible: this.fulfillment.getEligibleTankers(),
      request: requestId ? this.api.request(requestId) : of(null),
    }).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ drivers, tankers, eligible, request }) => {
        this.drivers.set(drivers);
        this.tankers.set(tankers);
        this.eligibleTankerIds = new Set(eligible.map(t => t.id));
        this.requiredLitres.set(request ? this.toLitres(request.quantity, request.unit) : null);
        this.driverId = drivers.length === 1 ? drivers[0].id : null;
        const sufficient = tankers.filter(t => !this.tankerBlockReason(t));
        this.tankerId = sufficient.length === 1 ? sufficient[0].id : null;
        this.resourcesLoading.set(false);
      },
      error: () => { this.resourcesLoading.set(false); this.resourcesError.set(true); },
    });
  }
  private toLitres(amount: number, unit: string): number | null {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const code = (unit ?? '').trim().toUpperCase();
    return ['L', 'LITRE', 'LITRES', 'LITER', 'LITERS', 'LITRO', 'LITROS'].includes(code) ? amount
      : ['GAL', 'GALLON', 'GALLONS', 'GALON', 'GALONES'].includes(code) ? amount * 3.785411784 : null;
  }
  tankerBlockReason(t: Tanker): string | null {
    if (!this.eligibleTankerIds.has(t.id)) return 'fulfillment.assignment.ineligible';
    const capacity = this.toLitres(t.capacity, t.unit);
    if (capacity === null || this.requiredLitres() === null) return 'fulfillment.assignment.unknown-capacity';
    return capacity < this.requiredLitres()! ? 'fulfillment.assignment.insufficient-capacity' : null;
  }
  get selectedDriver(): Driver | undefined { return this.drivers().find(d => d.id === this.driverId); }
  get selectedTanker(): Tanker | undefined { return this.tankers().find(t => t.id === this.tankerId); }
  get assignmentValid(): boolean {
    const start = Date.parse(this.windowStart);
    const end = Date.parse(this.windowEnd);
    return !this.resourcesLoading() && !this.resourcesError() && !!this.selectedDriver && !!this.selectedTanker
      && !this.tankerBlockReason(this.selectedTanker) && Number.isFinite(start) && Number.isFinite(end) && start < end;
  }
  reviewAssignment(): void {
    if (!this.assignmentValid || this.assignmentSubmitting()) return;
    this.assignmentCommandId = crypto.randomUUID();
    this.assignmentReview.set(true);
    this.assignmentError = '';
  }
  editAssignment(): void {
    this.assignmentReview.set(false);
    this.assignmentCommandId = null;
  }
  /** Pide la sugerencia al backend; con ventana completa la usa, si no el backend toma el día programado. */
  loadRecommendation(): void {
    this.recommendationRequest?.unsubscribe();
    const orderId = this.order()?.id;
    if (!orderId) return;
    const withWindow = this.windowStart && this.windowEnd;
    this.recommendation.set(null);
    this.recommendationError.set(null);
    this.recommendationLoading.set(true);
    this.recommendationRequest = this.fulfillment.recommendation(orderId, withWindow ? new Date(this.windowStart).toISOString() : undefined, withWindow ? new Date(this.windowEnd).toISOString() : undefined).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rec => { this.recommendation.set(rec); this.recommendationLoading.set(false); },
      error: (error: Error) => { this.recommendationError.set(error.message === 'errors.http-409' ? 'fulfillment.recommendation.conflict' : error.message); this.recommendationLoading.set(false); },
    });
  }
  onWindowChange(): void {
    this.editAssignment();
    this.recommendationRequest?.unsubscribe();
    this.recommendation.set(null);
    this.recommendationError.set(null);
    this.recommendationLoading.set(false);
    if (this.windowStart && this.windowEnd && Date.parse(this.windowStart) < Date.parse(this.windowEnd)) this.loadRecommendation();
  }
  useRecommendation(): void {
    const rec = this.recommendation();
    if (!rec?.recommended) return;
    if (!this.drivers().some(d => d.id === rec.driverId) || !this.tankers().some(t => t.id === rec.tankerId && !this.tankerBlockReason(t))) return;
    this.editAssignment();
    this.driverId = rec.driverId;
    this.tankerId = rec.tankerId;
    this.windowStart = this.toLocalInput(rec.windowStart);
    this.windowEnd = this.toLocalInput(rec.windowEnd);
  }
  private toLocalInput(iso: string): string {
    const d = new Date(iso);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
  assign(orderId: number): void {
    if (!this.assignmentReview() || !this.assignmentValid || this.assignmentSubmitting() || orderId !== this.order()?.id) return;
    this.assignmentError = '';
    this.assignmentSubmitting.set(true);
    this.fulfillment.assignDelivery({ commandId: this.assignmentCommandId!, orderId, driverId: this.driverId, tankerId: this.tankerId,
      windowStart: new Date(this.windowStart).toISOString(), windowEnd: new Date(this.windowEnd).toISOString(),
      scheduledDate: this.order()?.scheduledDate ?? undefined }).pipe(takeUntil(this.routeChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => { this.assignmentSubmitting.set(false); this.assigning.set(false); this.router.navigate(['/fulfillment/delivery-detail', result.deliveryId], { state: { notice: 'fulfillment.assignment.success' } }); },
      error: error => {
        this.assignmentSubmitting.set(false);
        this.assignmentError = error?.status === 409 ? 'fulfillment.assignment.conflict' : 'fulfillment.assignment-failed';
        if (error?.status === 409) { this.editAssignment(); this.loadAssignmentResources(); }
      },
    });
  }
}
