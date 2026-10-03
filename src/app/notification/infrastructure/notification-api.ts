import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of, switchMap } from 'rxjs';
import { Notification } from '../domain/model/notification.entity';
import { NotificationApiEndpoint } from './notification-api-endpoint';

@Injectable({ providedIn: 'root' })
export class NotificationApi {
  private readonly endpoint: NotificationApiEndpoint;

  constructor(http: HttpClient) { this.endpoint = new NotificationApiEndpoint(http); }

  getNotifications(): Observable<Notification[]> { return this.endpoint.getNotifications(); }
  getUnreadNotifications(): Observable<Notification[]> { return this.endpoint.getUnreadNotifications(); }
  markAsRead(id: number): Observable<Notification> { return this.endpoint.markAsRead(id); }

  markAllAsRead(): Observable<Notification[]> {
    return this.getUnreadNotifications().pipe(
      // ponytail: N calls; add a bulk endpoint only if the volume warrants it.
      switchMap((unread) => unread.length ? forkJoin(unread.map(({ id }) => this.markAsRead(id))) : of([])),
    );
  }
}
