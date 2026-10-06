
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { vi } from 'vitest';

import { RequestList } from './request-list';
import { OrderingStore } from '../../../application/ordering.store';
import { Request } from '../../../domain/model/request.entity';

describe('RequestList', () => {
  let component: RequestList;
  let fixture: ComponentFixture<RequestList>;

  const storeMock = {
    requests: signal<Request[]>([]),
    loading: signal(false),
    error: signal<string | null>(null),
    notice: signal(''),
    isProvider: signal(false),
    providerNames: signal<Record<number, string>>({}),
    productNames: signal<Record<number, string>>({}),

    loadRequests: vi.fn(),
    loadNames: vi.fn(),
    cancelRequest: vi.fn(),
    acceptRequest: vi.fn(),
    rejectRequest: vi.fn(),
  };

  const testRequest: Request = {
    id: 1,
    organizationId: 1,
    customerAccountId: 1,
    tankId: 1,
    providerId: 2,
    fuelProductId: 5,
    quantity: 100,
    unit: 'LITERS',
    unitPrice: 5,
    status: 'PENDING',
    source: 'MANUAL',
    rejectionReason: null,
    orderId: null,
    deliveryAddress: 'Av. Los Olivos 123',
    deliveryDate: '2026-10-10',
    version: 1,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    storeMock.requests.set([]);
    storeMock.loading.set(false);
    storeMock.error.set(null);
    storeMock.notice.set('');
    storeMock.isProvider.set(false);

    await TestBed.configureTestingModule({
      imports: [
        RequestList,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideRouter([]),
        {
          provide: OrderingStore,
          useValue: storeMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestList);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load requests and names', () => {
    expect(storeMock.loadRequests).toHaveBeenCalled();
    expect(storeMock.loadNames).toHaveBeenCalled();
  });

  it('should filter requests by status', () => {
    storeMock.requests.set([
      { ...testRequest, id: 1, status: 'PENDING' },
      { ...testRequest, id: 2, status: 'ACCEPTED' },
    ]);

    fixture.detectChanges();

    expect(component.filtered().length).toBe(2);

    component.status.set('PENDING');

    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].id).toBe(1);
  });

  it('should cancel a request', () => {
    component.cancel(1);

    expect(storeMock.cancelRequest).toHaveBeenCalledWith(1);
  });

  it('should accept a provider request', () => {
    storeMock.isProvider.set(true);
    component.providerRequestId = 1;

    component.acceptById();

    expect(storeMock.acceptRequest).toHaveBeenCalledWith(1);
  });

  it('should reject a provider request with a reason', () => {
    storeMock.isProvider.set(true);
    component.providerRequestId = 1;
    component.providerRejectReason = '  Sin combustible  ';

    component.rejectById();

    expect(storeMock.rejectRequest)
      .toHaveBeenCalledWith(1, 'Sin combustible');

    expect(component.providerRejectReason).toBe('');
  });
});
