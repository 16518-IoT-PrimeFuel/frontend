import { Injectable, computed, inject, signal } from '@angular/core';
import { NotificationApi } from '../infrastructure/notification-api';
import { Notification } from '../domain/model/notification.entity';

@Injectable({ providedIn: 'root' })
export class NotificationStore {
  private readonly api = inject(NotificationApi);
  private readonly list = signal<Notification[]>([]);
  private readonly unread = signal(0);
  private readonly loading = signal(false);
  private readonly errorMessage = signal('');
  private readonly successMessage = signal('');

  readonly notificationList = this.list.asReadonly();
  readonly unreadCount = this.unread.asReadonly();
  readonly isLoading = this.loading.asReadonly();
  readonly error = this.errorMessage.asReadonly();
  readonly successMsg = this.successMessage.asReadonly();
  readonly orderNotifications = computed(() => this.list().filter((n) => n.isOrderEvent()));
  readonly deliveryNotifications = computed(() => this.list().filter((n) => n.isDeliveryEvent()));

  loadNotifications(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.getNotifications().subscribe({
      next: (items) => {
        this.list.set(items);
        this.unread.set(items.filter((item) => !item.read).length);
        this.loading.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  loadUnreadNotifications(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.getUnreadNotifications().subscribe({
      next: (items) => {
        this.unread.set(items.length);
        this.list.set(items);
        this.loading.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  refreshUnreadCount(): void {
    this.api.getUnreadNotifications().subscribe({
      next: (items) => this.unread.set(items.length),
      error: (error) => this.errorMessage.set(error.message || 'Failed to load unread notifications'),
    });
  }

  markAsRead(id: number): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.markAsRead(id).subscribe({
      next: (updated) => {
        this.list.update((items) => items.map((item) => item.id === id ? updated : item));
        this.unread.update((count) => Math.max(0, count - 1));
        this.loading.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  markAllAsRead(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.api.markAllAsRead().subscribe({
      next: () => {
        this.list.update((items) => items.map((item) => { item.read = true; return item; }));
        this.unread.set(0);
        this.successMessage.set('All notifications marked as read');
        this.loading.set(false);
      },
      error: (error) => this.fail(error),
    });
  }

  clearMessages(): void { this.errorMessage.set(''); this.successMessage.set(''); }

  private fail(error: { message?: string }): void {
    this.errorMessage.set(error.message || 'Failed to load notifications');
    this.loading.set(false);
  }
}
