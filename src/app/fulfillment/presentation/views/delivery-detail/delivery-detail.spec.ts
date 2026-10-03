import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { of, Subject, throwError } from 'rxjs';
import { FulfillmentApi } from '../../../infrastructure/fulfillment-api';
import { OrderingApi } from '../../../../ordering/infrastructure/ordering-api';
import { ProviderEquipmentApi } from '../../../../equipment/infrastructure/provider-equipment.api';
import { DeliveryDetail } from './delivery-detail';

describe('DeliveryDetail resilient reads and commands', () => {
  const setup = () => {
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
