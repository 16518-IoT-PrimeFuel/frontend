import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MonthlyAmount {
  month: string;
  monthIndex: number;
  amount: number;
}

export interface ProviderAnalytics {
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  monthlyRevenue: MonthlyAmount[];
}

export interface BuyerAnalytics {
  totalOrders: number;
  totalSpent: number;
  completedPayments: number;
  pendingPayments: number;
  monthlySpending: MonthlyAmount[];
}

@Injectable({ providedIn: 'root' })
export class ReportingApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.serverBasePath}/analytics`;

  getProviderAnalytics(providerId: number): Observable<ProviderAnalytics> {
    return this.http.get<ProviderAnalytics>(`${this.base}/providers/${providerId}`);
  }

  getBuyerAnalytics(companyId: number): Observable<BuyerAnalytics> {
    return this.http.get<BuyerAnalytics>(`${this.base}/buyers/${companyId}`);
  }
}
