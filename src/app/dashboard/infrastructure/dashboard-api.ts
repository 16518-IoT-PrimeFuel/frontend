import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BuyerSummary, PlatformSummary, ProviderSummary } from '../domain/model/dashboard.entity';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.serverBasePath}/analytics`; // el backend conserva el recurso /analytics

  getProviderSummary(providerId: number, from?: string, to?: string): Observable<ProviderSummary> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ProviderSummary>(`${this.base}/providers/${providerId}`, { params });
  }

  getPlatformSummary(): Observable<PlatformSummary> {
    return this.http.get<PlatformSummary>(`${this.base}/platform`);
  }

  getBuyerSummary(companyId: number): Observable<BuyerSummary> {
    return this.http.get<BuyerSummary>(`${this.base}/buyers/${companyId}`);
  }
}
