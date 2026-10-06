import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { FulfillmentApi } from '../../../infrastructure/fulfillment-api';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { ProviderEquipmentApi } from '../../../../equipment/infrastructure/provider-equipment.api';
import { DeliveryDetail } from './delivery-detail';

describe('DeliveryDetail resilient reads and commands', () => {
  const setup = (state?: Record<string, unknown>) => {
    const api = {
      delivery: vi.fn(() => of({ id: 1, orderId: 30, driverId: 2, vehicleId: 3, physicalState: 'ASSIGNED' })),
      tracking: vi.fn(() => of(null)), trackingSamples: vi.fn(() => of([])), deliveryTransitions: vi.fn(() => of([])),
      deliveryTimeline: vi.fn(() => of([])), valveObservations: vi.fn(() => of([])),
      getDriverById: vi.fn(() => of({ firstName: 'Ana', lastName: 'Diaz' })),
      getTankerById: vi.fn(() => of({ brand: 'Truck', model: 'X', licensePlate: 'AAA' })),
      deliveryCommand: vi.fn(() => new Subject()),
      createGeofence: vi.fn(() => new Subject()),
    };
    const ordering = { order: vi.fn(() => of({ requestId: 4 })), request: vi.fn(() => of({ tankId: 5 })) };
    const equipment = { readings: vi.fn(() => of([{ capturedAt: '2026-10-02T12:00:00Z', level: 100 }])) };
    TestBed.configureTestingModule({ imports: [DeliveryDetail, TranslateModule.forRoot()], providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      { provide: FulfillmentApi, useValue: api }, { provide: OrderingApi, useValue: ordering }, { provide: ProviderEquipmentApi, useValue: equipment },
      { provide: Router, useValue: { currentNavigation: () => (state ? { extras: { state } } : null) } },
    ] });
    const fixture = TestBed.createComponent(DeliveryDetail);
    return { fixture, view: fixture.componentInstance, api, ordering, equipment };
  };
  beforeEach(() => TestBed.resetTestingModule());

  it('distinguishes failed sections from empty data while retaining the main delivery', () => {
    const { fixture, view, api } = setup();
    api.trackingSamples.mockReturnValue(throwError(() => new Error('offline')));
    api.deliveryTimeline.mockReturnValue(throwError(() => new Error('offline')));
    view.reload();
    fixture.detectChanges();
    expect(view.delivery()?.id).toBe(1);
    expect(view.samplesError()).toBe(true);
    expect(view.timelineError()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('fulfillment.section-error');
  });

  it('discards an old tank read when the refreshed delivery has no associated request', () => {
    const { view, ordering, equipment } = setup();
    const pending = new Subject();
    equipment.readings.mockReturnValue(pending as any);
    view.reload();
    ordering.order.mockReturnValue(of({ requestId: null }) as any);
    view.reload();
    pending.next([{ level: 999 }]);
    expect(view.tankReading()).toBeNull();
    expect(view.tankLevelError()).toBe(false);
  });

  it('guards commands by state and blocks duplicate submissions until the response arrives', () => {
    const { view, api } = setup();
    view.command('complete');
    expect(api.deliveryCommand).not.toHaveBeenCalled();
    view.command('start');
    view.command('start');
    expect(api.deliveryCommand).toHaveBeenCalledTimes(1);
    expect(view.commandBusy()).toBe(true);
  });

  it('asks for a required reason before failing or cancelling and sends nothing when the dialog is dismissed', () => {
    const { view, api } = setup();
    let closed = new Subject<unknown>();
    const open = vi.spyOn((view as any).dialog, 'open').mockImplementation(() => { closed = new Subject(); return { afterClosed: () => closed, close: vi.fn() } as any; });
    view.command('cancel');
    view.command('fail');
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0][1]).toMatchObject({ width: '480px', data: { messageKey: 'fulfillment.confirm-cancel', reason: { labelKey: 'fulfillment.reason', required: true } } });
    expect((open.mock.calls[0][1] as any).data.reason.maxLength).toBeUndefined();
    closed.next(false);
    view.command('cancel');
    closed.next(undefined);
    expect(api.deliveryCommand).not.toHaveBeenCalled();
    view.command('fail');
    expect(open.mock.calls[2][1]).toMatchObject({ data: { messageKey: 'fulfillment.confirm-fail' } });
    view.delivery.set({ ...view.delivery(), physicalState: 'DELIVERED' });
    closed.next({ reason: 'Road closed' });
    expect(api.deliveryCommand).not.toHaveBeenCalled();
    view.delivery.set({ ...view.delivery(), physicalState: 'STARTED' });
    view.command('fail');
    closed.next({ reason: 'Road closed' });
    expect(api.deliveryCommand).toHaveBeenCalledExactlyOnceWith(1, 'fail', { reason: 'Road closed' });
    expect(view.busyAction()).toBe('fail');
  });

  it('shows the loading text only on the pressed button and an inline success notice per action', () => {
    const { fixture, view, api } = setup();
    view.delivery.set({ ...view.delivery(), physicalState: 'STARTED' });
    fixture.detectChanges();
    const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('section:first-of-type button'));
    view.command('arrive');
    fixture.detectChanges();
    expect(buttons().map(b => b.textContent?.trim())).toEqual(['fulfillment.command-busy.arrive', 'fulfillment.fail', 'fulfillment.cancel-delivery']);
    expect(buttons().map(b => b.getAttribute('aria-busy'))).toEqual(['true', 'false', 'false']);
    expect(buttons().every(b => b.disabled)).toBe(true);
    api.deliveryCommand.mock.results[0].value.next({});
    fixture.detectChanges();
    expect(view.commandBusy()).toBe(false);
    expect(api.delivery).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('fulfillment.command-success.arrive');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('tells a 409 state conflict apart from a generic command failure and reloads only on the conflict', () => {
    const { fixture, view, api } = setup();
    view.command('start');
    api.deliveryCommand.mock.results[0].value.error({ status: 500 });
    fixture.detectChanges();
    expect(view.commandBusy()).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('fulfillment.command-failed');
    expect(api.delivery).toHaveBeenCalledTimes(1);
    view.command('start');
    expect(view.commandError()).toBe('');
    api.deliveryCommand.mock.results[1].value.error({ status: 409 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('fulfillment.command-conflict');
    expect(api.delivery).toHaveBeenCalledTimes(2);
  });

  it('shows the assignment notice passed through the navigation state', () => {
    const { fixture, view } = setup({ notice: 'fulfillment.assignment.success' });
    fixture.detectChanges();
    expect(view.message()).toBe('fulfillment.assignment.success');
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain('fulfillment.assignment.success');
  });

  it('clears stale delivery and operations when the refreshed main detail is denied', () => {
    const { view, api } = setup();
    api.delivery.mockReturnValue(throwError(() => ({ status: 404 })));
    view.reload();
    expect(view.loadError()).toBe(true);
    expect(view.delivery()).toBeNull();
    expect(view.can('start')).toBe(false);
  });

  it('rejects non-finite geofence values and blocks duplicate saves while pending', () => {
    const { view, api } = setup();
    view.centerLatitude = -12;
    view.centerLongitude = -77;
    view.radiusMeters = Infinity;
    view.saveGeofence();
    expect(api.createGeofence).not.toHaveBeenCalled();
    view.radiusMeters = 100;
    view.centerLatitude = NaN;
    expect(view.geofenceValid).toBe(false);
    view.centerLatitude = -12;
    view.saveGeofence();
    view.saveGeofence();
    expect(api.createGeofence).toHaveBeenCalledTimes(1);
    api.createGeofence.mock.results[0].value.error({ status: 409 });
    expect(view.geofenceBusy()).toBe(false);
    expect(view.message()).toBe('fulfillment.geofence-exists');
  });

  it('updates tank reading age while the delivery view remains open and cleans the clock on exit', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-02T12:00:00Z'));
    const { fixture, view } = setup();
    try {
      expect(view.tankAgeMinutes(view.tankReading()!)).toBe(0);
      vi.advanceTimersByTime(60_000);
      expect(view.tankAgeMinutes(view.tankReading()!)).toBe(1);
      fixture.destroy();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      fixture.destroy();
      vi.useRealTimers();
    }
  });
});
