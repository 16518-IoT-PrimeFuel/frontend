import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

import { NotificationList } from './notification-list';
import { NotificationStore } from '../../../application/notification.store';
import { IamStore } from '../../../../iam/application/iam.store';

describe('NotificationList', () => {
  let component: NotificationList;
  let fixture: ComponentFixture<NotificationList>;

  const notificationStoreMock = {
    notificationList: () => [],
    unreadCount: () => 0,
    isLoading: () => false,
    error: () => '',
    successMsg: () => '',

    loadNotifications: () => {},
    loadUnreadNotifications: () => {},
    markAsRead: (_id: number) => {},
    markAllAsRead: () => {},
  };

  const iamStoreMock = {
    role: () => 'BUYER',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        NotificationList,
        TranslateModule.forRoot(),
      ],
      providers: [
        provideRouter([]),
        {
          provide: NotificationStore,
          useValue: notificationStoreMock,
        },
        {
          provide: IamStore,
          useValue: iamStoreMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationList);
    component = fixture.componentInstance;

    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});