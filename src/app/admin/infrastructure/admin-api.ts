import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Payment } from '../../ordering/infrastructure/ordering-api';

export interface AdminUser { id: number; username: string; roles: string[]; companyId: number | null; providerId: number | null; }
export interface ApiMetric { routeKey: string; version: string; handler: string; count: number; lastSeen: string | null; distinctCallers: number; }
export interface TransportEvidence { deliveryId: number; samples: unknown[]; }

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.serverBasePath;

  users(): Observable<AdminUser[]> { return this.http.get<AdminUser[]>(`${this.base}/users`); }
  promote(userId: number): Observable<{ userId: number; username: string; roles: string[] }> { return this.http.post<{ userId: number; username: string; roles: string[] }>(`${this.base}/admin/users/${userId}/promote`, {}); }
  metrics(version: string): Observable<ApiMetric[]> { return this.http.get<ApiMetric[]>(`${this.base}/admin/api-metrics`, { params: new HttpParams().set('version', version) }); }
  payments(): Observable<Payment[]> { return this.http.get<Payment[]>(`${this.base}/payments`); }
  exportEvidence(deliveryId: number): Observable<TransportEvidence> { return this.http.get<TransportEvidence>(`${this.base}/admin/deliveries/${deliveryId}/transport-evidence/export`); }
  deleteEvidence(deliveryId: number): Observable<void> { return this.http.delete<void>(`${this.base}/admin/deliveries/${deliveryId}/transport-evidence`); }
}
