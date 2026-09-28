import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Notification } from '../domain/model/notification.entity';
import { NotificationResource } from './notification-response';
import { NotificationAssembler } from './notification-assembler';

const endpointUrl = `${environment.serverBasePath}/me/notifications`;

export class NotificationApiEndpoint {
  private readonly endpointUrl = endpointUrl;
  private readonly assembler = new NotificationAssembler();
  constructor(http: HttpClient) {
    this.http = http;
  }
  private readonly http: HttpClient;

  getNotifications(): Observable<Notification[]> {
    return this.http.get<NotificationResource[]>(this.endpointUrl).pipe(
      map((items) => items.map((item) => this.assembler.toEntity(item))),
    );
  }

  getUnreadNotifications(): Observable<Notification[]> {
    return this.http.get<NotificationResource[]>(`${this.endpointUrl}/unread`).pipe(
      map((items) => items.map((item) => this.assembler.toEntity(item))),
    );
  }

  markAsRead(id: number): Observable<Notification> {
    return this.http.post<NotificationResource>(`${this.endpointUrl}/${id}/read`, {}).pipe(
      map((item) => this.assembler.toEntity(item)),
    );
  }
}
