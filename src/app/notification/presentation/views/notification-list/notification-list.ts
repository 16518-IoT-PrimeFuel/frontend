import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NotificationStore } from '../../../application/notification.store';
import { Notification } from '../../../domain/model/notification.entity';

@Component({
  selector: 'app-notification-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatCardModule,
    MatDividerModule,
    RouterModule,
    TranslatePipe,
  ],
  templateUrl: './notification-list.html',
  styleUrl: './notification-list.css',
})
export class NotificationList implements OnInit {
  protected readonly store = inject(NotificationStore);

  protected filterMode: 'all' | 'unread' = 'all';

  ngOnInit(): void {
    this.store.loadNotifications();
  }

  protected onShowAll(): void {
    this.filterMode = 'all';
    this.store.loadNotifications();
  }

  protected onShowUnread(): void {
    this.filterMode = 'unread';
    this.store.loadUnreadNotifications();
  }

  protected onRefresh(): void {
    if (this.filterMode === 'unread') {
      this.store.loadUnreadNotifications();
    } else {
      this.store.loadNotifications();
    }
  }

  protected onMarkAsRead(notification: Notification): void {
    if (!notification.read) {
      this.store.markAsRead(notification.id);
    }
  }

  protected onToggleRead(notification: Notification): void {
    if (!notification.read) {
      this.store.markAsRead(notification.id);
    }
  }

  protected onMarkAllAsRead(): void {
    this.store.markAllAsRead();
  }

  /**
   * Determina el ícono Material a mostrar según el tipo de notificación.
   * @remarks Usa los métodos de dominio de la entidad para clasificar.
   */
  protected getIconFor(notification: Notification): string {
    if (notification.isOrderEvent()) return 'receipt_long';
    if (notification.isDeliveryEvent()) return 'local_shipping';
    return 'notifications';
  }

  protected getTypeClass(type: string): string {
    return type.toLowerCase().replace(/_/g, '-');
  }

  protected getCategoryClass(notification: Notification): string {
    if (notification.isOrderEvent()) return 'category-order';
    if (notification.isDeliveryEvent()) return 'category-delivery';
    return 'category-default';
  }

  protected timeAgo(createdAt: string): string {
    return new Date(createdAt).toLocaleString();
  }

  protected trackById(_index: number, notification: Notification): number {
    return notification.id;
  }
}

