import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BuyerAnalytics, ProviderAnalytics } from '../domain/model/analytics.entity';

@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.serverBasePath}/analytics`;

  getProviderAnalytics(providerId: number): Observable<ProviderAnalytics> {
    return this.http.get<ProviderAnalytics>(`${this.base}/providers/${providerId}`);
  }

  getBuyerAnalytics(companyId: number): Observable<BuyerAnalytics> {
    return this.http.get<BuyerAnalytics>(`${this.base}/buyers/${companyId}`);
  }
}
