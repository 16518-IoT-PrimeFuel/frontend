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
import { Router, RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { NotificationStore } from '../../../application/notification.store';
import { Notification } from '../../../domain/model/notification.entity';
import { LimaDatePipe } from '../../../../shared/presentation/pipe/lima-date.pipe';

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
    LimaDatePipe,
  ],
  templateUrl: './notification-list.html',
  styleUrl: './notification-list.css',
})
export class NotificationList implements OnInit {
  protected readonly store = inject(NotificationStore);

  private readonly router = inject(Router);
  private readonly iam = inject(IamStore);

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
    if (notification.isRequestEvent()) return 'assignment';
    if (notification.isPaymentEvent()) return 'payments';
    if (notification.isOrderEvent()) return 'receipt_long';
    if (notification.isDeliveryEvent()) return 'local_shipping';
    return 'notifications';
  }

  protected getTypeClass(type: string): string {
    return type.toLowerCase().replace(/_/g, '-');
  }

  protected getCategoryClass(notification: Notification): string {
    if (notification.isPaymentEvent()) return 'category-payment';
    if (notification.isRequestEvent() || notification.isOrderEvent()) return 'category-order';
    if (notification.isDeliveryEvent()) return 'category-delivery';
    return 'category-default';
  }

  /** Rótulo i18n de la referencia; null si el tipo no tiene un destino conocido. */
  protected referenceLabel(n: Notification): string | null {
    if (n.type === 'ORDER_ACCEPTED' || n.type === 'ORDER_REJECTED' || n.isRequestEvent()) return 'notification-list.view-request';
    if (n.isDeliveryEvent() || n.type === 'ORDER_DISPATCHED') return this.iam.role() === 'PROVIDER' ? 'notification-list.view-delivery' : 'notification-list.view-orders';
    return null;
  }

  // Delivery events, including ORDER_DISPATCHED, reference a delivery; buyers cannot resolve its order yet.
  protected linkFor(n: Notification): string[] | null {
    if (n.type === 'ORDER_ACCEPTED' || n.type === 'ORDER_REJECTED' || n.isRequestEvent()) return n.referenceId && Number.isSafeInteger(n.referenceId) && n.referenceId > 0 ? ['/ordering/request-detail', String(n.referenceId)] : ['/ordering/request-list'];
    if (n.isDeliveryEvent() || n.type === 'ORDER_DISPATCHED') {
      if (this.iam.role() === 'BUYER') return ['/ordering/order-list'];
      if (this.iam.role() === 'PROVIDER' && Number.isSafeInteger(n.referenceId) && n.referenceId! > 0) return ['/fulfillment/delivery-detail', String(n.referenceId)];
    }
    return null;
  }

  protected open(n: Notification): void {
    const link = this.linkFor(n);
    if (!link) return;
    this.onMarkAsRead(n);
    this.router.navigate(link);
  }

  protected trackById(_index: number, notification: Notification): number {
    return notification.id;
  }
}

