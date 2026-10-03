import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderDetail } from './order-detail';
import { TranslateModule } from '@ngx-translate/core';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { IamStore } from '../../../../iam/application/iam.store';
import { vi } from 'vitest';

describe('OrderDetail', () => {
  let component: OrderDetail;
  let fixture: ComponentFixture<OrderDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderDetail, TranslateModule.forRoot()],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a fresh store per view and cancels its pending order read on exit', () => {
    const view = component as any;
    view.store.ordersState.set([{ id: 30 }]);
    const other = TestBed.createComponent(OrderDetail);
    expect(other.componentInstance.store).not.toBe(component.store);
    expect(other.componentInstance.store.orders()).toEqual([]);
    const pending = new Subject();
    vi.spyOn(view.api, 'order').mockReturnValue(pending);
    component.store.loadOrder(31);
    expect(pending.observed).toBe(true);
    fixture.destroy();
    expect(pending.observed).toBe(false);
    other.destroy();
  });

  it('discards recommendations for a previous or incomplete delivery window', () => {
    const view = component as any;
    view.order = () => ({ id: 30 });
    const old = new Subject();
    const current = new Subject();
    vi.spyOn(view.fulfillment, 'recommendation').mockReturnValueOnce(old).mockReturnValueOnce(current);
    view.windowStart = '2026-10-02T10:00';
    view.windowEnd = '2026-10-02T12:00';
    view.loadRecommendation();
    view.windowStart = '2026-10-02T14:00';
    view.windowEnd = '2026-10-02T16:00';
    view.onWindowChange();
    current.next({ recommended: true, driverId: 2 });
    old.next({ recommended: true, driverId: 1 });
    expect(view.recommendation()?.driverId).toBe(2);
    view.windowEnd = '';
    view.onWindowChange();
    expect(view.recommendation()).toBeNull();
    expect(view.recommendationLoading()).toBe(false);
  });

  const prepareAssignment = (view: any) => {
    view.order = () => ({ id: 30, requestId: 4, scheduledDate: '2026-10-02' });
    vi.spyOn(view.fulfillment, 'getEligibleDrivers').mockReturnValue(of([{ id: 2, firstName: 'Ana', lastName: 'Diaz' }]));
    const tankers = [{ id: 1, licensePlate: 'SMALL', capacity: 100, unit: 'GALLONS' }, { id: 2, licensePlate: 'BIG', capacity: 500, unit: 'LITERS' }, { id: 3, licensePlate: 'INACTIVE', capacity: 1000, unit: 'LITERS' }];
    vi.spyOn(view.fulfillment, 'getTankers').mockReturnValue(of(tankers));
    vi.spyOn(view.fulfillment, 'getEligibleTankers').mockReturnValue(of(tankers.slice(0, 2)));
    vi.spyOn(view.api, 'request').mockReturnValue(of({ quantity: 400, unit: 'LITRE' }));
    view.loadAssignmentResources();
    view.windowStart = '2026-10-02T10:00';
    view.windowEnd = '2026-10-02T12:00';
    return tankers;
  };

  it('retains disabled tankers, compares converted capacity and requires a review before creating', () => {
    const view = component as any;
    const tankers = prepareAssignment(view);
    expect(view.tankers()).toHaveLength(3);
    expect(view.tankerBlockReason(tankers[0])).toBe('fulfillment.assignment.insufficient-capacity');
    expect(view.tankerBlockReason(tankers[2])).toBe('fulfillment.assignment.ineligible');
    expect(view.tankerId).toBe(2);
    expect(view.toLitres(100, ' gallons ')).toBeCloseTo(378.5411784);
    expect(view.toLitres(100, null)).toBeNull();
    const pending = new Subject();
    const assign = vi.spyOn(view.fulfillment, 'assignDelivery').mockReturnValue(pending);
    view.assign(30);
    expect(assign).not.toHaveBeenCalled();
    view.reviewAssignment();
    view.assign(30);
    view.assign(30);
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign.mock.calls[0][0]).toMatchObject({ orderId: 30, driverId: 2, tankerId: 2 });
    expect(view.assignmentSubmitting()).toBe(true);
    const cancel = vi.spyOn(view.store, 'cancelOrder');
    const confirm = vi.spyOn(view.store, 'confirmOrder');
    view.cancelOrder(30);
    view.confirm(30);
    expect(cancel).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('rejects reversed windows and retains the command id when retrying an ambiguous network failure', () => {
    const view = component as any;
    prepareAssignment(view);
    view.windowEnd = '2026-10-02T09:00';
    view.reviewAssignment();
    expect(view.assignmentReview()).toBe(false);
    view.windowEnd = '2026-10-02T12:00';
    const assign = vi.spyOn(view.fulfillment, 'assignDelivery').mockReturnValue(throwError(() => ({ status: 0 })));
    view.reviewAssignment();
    view.assign(30);
    view.assign(30);
    expect(assign).toHaveBeenCalledTimes(2);
    expect((assign.mock.calls[0][0] as { commandId: string }).commandId).toBe((assign.mock.calls[1][0] as { commandId: string }).commandId);
    expect(view.assignmentSubmitting()).toBe(false);
  });

  it('does not claim resources are empty when resource loading fails', () => {
    const view = component as any;
    prepareAssignment(view);
    view.reviewAssignment();
    expect(view.assignmentReview()).toBe(true);
    vi.spyOn(view.fulfillment, 'getEligibleDrivers').mockReturnValue(throwError(() => new Error('offline')));
    view.loadAssignmentResources();
    expect(view.assignmentReview()).toBe(false);
    expect(view.resourcesError()).toBe(true);
    expect(view.assignmentValid).toBe(false);
  });

  it('creates payment only for the current owned pending order and blocks duplicates or uncertain reads', () => {
    const view = component as any;
    const order = { id: 30, companyId: 4, status: 'PENDING_PAYMENT', totalPrice: 200 };
    view.order = () => order;
    view.isBuyer = true;
    vi.spyOn(view.iam, 'companyId').mockReturnValue(4);
    const pending = new Subject();
    const create = vi.spyOn(view.api, 'createPayment').mockReturnValue(pending);
    view.paymentReadError.set(true);
    view.pay(order);
    view.paymentReadError.set(false);
    view.pay({ ...order, companyId: 99 });
    view.pay({ ...order, totalPrice: NaN });
    expect(create).not.toHaveBeenCalled();
    view.pay(order);
    view.pay(order);
    expect(create).toHaveBeenCalledTimes(1);
    pending.error({ status: 0 });
    view.pay(order);
    expect(create).toHaveBeenCalledTimes(1);
    expect(view.paymentError).toBe('errors.network');
    expect(view.paymentReadError()).toBe(true);
    const reload = vi.spyOn(view.store, 'loadOrder').mockImplementation(() => {});
    view.retryPayment();
    expect(reload).toHaveBeenCalledWith(30);
  });

  it('completes only the payment belonging to the current owned order and cancels pending work on exit', () => {
    const view = component as any;
    view.order = () => ({ id: 30, companyId: 4, status: 'PENDING_PAYMENT' });
    view.isBuyer = true;
    vi.spyOn(view.iam, 'companyId').mockReturnValue(4);
    view.transactionReference = ' TX-1 ';
    const pending = new Subject();
    const complete = vi.spyOn(view.api, 'completePayment').mockReturnValue(pending);
    view.payment.set({ id: 8, orderId: 99, companyId: 4, status: 'PENDING' });
    view.completePayment(30);
    expect(complete).not.toHaveBeenCalled();
    view.payment.set({ id: 8, orderId: 30, companyId: 4, status: 'PENDING' });
    view.completePayment(30);
    view.completePayment(30);
    expect(complete).toHaveBeenCalledExactlyOnceWith(8, 'TX-1');
    fixture.destroy();
    expect(pending.observed).toBe(false);
  });

  it('reloads reused route ids and discards the previous payment, assignment and pending completion', () => {
    TestBed.resetTestingModule();
    const params = new BehaviorSubject(convertToParamMap({ id: '30' }));
    const oldPayment = new Subject<any>();
    const nextPayment = new Subject<any>();
    const completion = new Subject<any>();
    const api = {
      order: vi.fn((id: number) => of({ id, companyId: 4, status: 'PENDING_PAYMENT', totalPrice: 100 })),
      providers: () => of([]), allProducts: () => of([]), buyerCompany: () => of({ name: 'ACME' }),
      paymentForOrder: vi.fn().mockReturnValueOnce(oldPayment).mockReturnValueOnce(nextPayment),
      completePayment: vi.fn(() => completion),
    };
    TestBed.configureTestingModule({ imports: [OrderDetail, TranslateModule.forRoot()], providers: [
      provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
      { provide: ActivatedRoute, useValue: { paramMap: params } }, { provide: OrderingApi, useValue: api },
      { provide: IamStore, useValue: { role: () => 'BUYER', isBuyer: () => true, companyId: () => 4 } },
    ] });
    fixture = TestBed.createComponent(OrderDetail);
    const view = fixture.componentInstance;
    fixture.detectChanges();
    oldPayment.next({ id: 8, orderId: 30, companyId: 4, status: 'PENDING', paymentMethod: 'CASH', amount: 100 });
    view.transactionReference = 'OLD';
    view.completePayment(30);
    expect(completion.observed).toBe(true);
    view.assigning.set(true);
    view.assignmentReview.set(true);
    view.windowStart = '2026-10-02T10:00';
    params.next(convertToParamMap({ id: '31' }));
    fixture.detectChanges();
    expect(view.order()?.id).toBe(31);
    expect(view.payment()).toBeNull();
    expect(view.transactionReference).toBe('');
    expect(view.assignmentReview()).toBe(false);
    expect(view.assigning()).toBe(false);
    expect(view.windowStart).toBe('');
    expect(oldPayment.observed).toBe(false);
    expect(completion.observed).toBe(false);
    completion.next({ id: 8, orderId: 30 });
    oldPayment.next({ id: 8, orderId: 30 });
    nextPayment.next({ id: 9, orderId: 31 });
    expect(view.payment()?.id).toBe(9);
    expect(api.order).toHaveBeenCalledTimes(2);
    params.next(convertToParamMap({ id: '1e2' }));
    expect(view.order()).toBeUndefined();
    expect(view.payment()).toBeNull();
    expect(api.order).toHaveBeenCalledTimes(2);
  });
});
