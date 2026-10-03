import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BuyerAnalytics, PlatformSummary, ProviderAnalytics } from '../domain/model/analytics.entity';

@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.serverBasePath}/analytics`;

  getProviderAnalytics(providerId: number, from?: string, to?: string): Observable<ProviderAnalytics> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ProviderAnalytics>(`${this.base}/providers/${providerId}`, { params });
  }

  getPlatformSummary(): Observable<PlatformSummary> {
    return this.http.get<PlatformSummary>(`${this.base}/platform`);
  }

  getBuyerAnalytics(companyId: number): Observable<BuyerAnalytics> {
    return this.http.get<BuyerAnalytics>(`${this.base}/buyers/${companyId}`);
  }
}
