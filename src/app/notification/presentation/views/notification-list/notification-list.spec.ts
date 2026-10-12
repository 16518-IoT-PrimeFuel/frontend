import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NotificationList } from './notification-list';
import { TranslateModule } from '@ngx-translate/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { Notification } from '../../../domain/model/notification.entity';
import { of, throwError } from 'rxjs';

describe('NotificationList', () => {
  let component: NotificationList;
  let fixture: ComponentFixture<NotificationList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationList, TranslateModule.forRoot()],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not confuse delivery references with order ids and gives providers their own delivery destination', () => {
    const view = component as any;
    const role = vi.spyOn(view.iam, 'role').mockReturnValue('BUYER');
    const notification = new Notification(1, 4, 'ORDER_DISPATCHED', 'En camino', '', true, 78, '2026-10-12T15:00:00Z');
    expect(view.linkFor(notification)).toEqual(['/ordering/order-list']);
    notification.type = 'DELIVERY_FAILED';
    expect(view.linkFor(notification)).toEqual(['/ordering/order-list']);
    role.mockReturnValue('PROVIDER');
    expect(view.linkFor(notification)).toEqual(['/fulfillment/delivery-detail', '78']);
    notification.referenceId = -1;
    expect(view.linkFor(notification)).toBeNull();
    notification.type = 'NEW_REQUEST';
    notification.referenceId = 5;
    expect(view.linkFor(notification)).toEqual(['/ordering/request-detail', '5']);
  });

  it('shows recovery for a failed read instead of an empty state and keeps backend text out of the view', async () => {
    const view = component as any;
    const read = vi.spyOn(view.store.api, 'getNotifications').mockReturnValue(throwError(() => ({ status: 500, message: 'database secret' })));
    view.onRefresh();
    fixture.detectChanges();
    expect(view.store.error()).toBe('errors.server');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.empty-state')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('database secret');
    read.mockReturnValue(of([]));
    view.onRefresh();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.empty-state a').getAttribute('href')).toBe('/ordering/order-list');
    vi.spyOn(view.store.api, 'getUnreadNotifications').mockReturnValue(of([]));
    fixture.nativeElement.querySelectorAll('.header-actions button')[1].click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.empty-state').textContent).toContain('notification-list.empty-unread');
  });
});
