import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';
import { CreateRequest, Request } from '../domain/model/request.entity';
import { Order } from '../domain/model/order.entity';
import { Tank } from '../../equipment/domain/model/equipment.entity';
import { FuelProduct } from '../../inventory/domain/model/fuel-product.entity';

export type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';
export interface Payment { id: number; orderId: number; companyId: number; amount: number; status: string; paymentMethod: PaymentMethod; transactionReference: string | null; paidAt: string | null; operationNumber?: string | null; currency?: string; }
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
/** Ítem de GET /payments/provider/{id}; las fechas nuevas llegan en UTC. */
export interface ProviderPayment {
  id: number; orderId: number; buyerCompanyId: number; buyerName: string | null; amount: number; currency: string | null;
  status: PaymentStatus; paymentMethod: PaymentMethod; createdAt: string; updatedAt: string; paidAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrderingApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.serverBasePath;

  requests(): Observable<Request[]> { return this.http.get<Request[]>(`${this.base}/replenishment-requests`); }
  requestInbox(): Observable<Request[]> { return this.http.get<Request[]>(`${this.base}/replenishment-requests/inbox`); }
  request(id: number): Observable<Request> { return this.http.get<Request>(`${this.base}/replenishment-requests/${id}`); }
  createRequest(payload: CreateRequest): Observable<Request> { return this.http.post<Request>(`${this.base}/replenishment-requests`, { ...payload, source: 'MANUAL' }); }
  acceptRequest(id: number): Observable<Request> { return this.http.post<Request>(`${this.base}/replenishment-requests/${id}/accept`, {}); }
  rejectRequest(id: number, reason: string): Observable<Request> { return this.http.post<Request>(`${this.base}/replenishment-requests/${id}/reject`, { reason }); }
  cancelRequest(id: number): Observable<Request> { return this.http.post<Request>(`${this.base}/replenishment-requests/${id}/cancel`, {}); }

  orders(path: string, id: number): Observable<Order[]> { return this.http.get<Order[]>(`${this.base}/fuel-orders/${path}/${id}`); }
  order(id: number): Observable<Order> { return this.http.get<Order>(`${this.base}/fuel-orders/${id}`); }
  confirmOrder(id: number): Observable<Order> { return this.http.post<Order>(`${this.base}/fuel-orders/${id}/confirm`, {}); }
  cancelOrder(id: number): Observable<Order> { return this.http.post<Order>(`${this.base}/fuel-orders/${id}/cancel`, {}); }
  receiveOrder(id: number): Observable<Order> { return this.http.post<Order>(`${this.base}/fuel-orders/${id}/receive`, {}); }

  paymentsForCompany(companyId: number): Observable<Payment[]> { return this.http.get<Payment[]>(`${this.base}/payments/company/${companyId}`); }
  refundPayment(id: number): Observable<Payment> { return this.http.post<Payment>(`${this.base}/payments/${id}/refund`, null); }
  refundProviderPayment(id: number): Observable<Payment> { return this.http.post<Payment>(`${this.base}/payments/${id}/refund`, null); }
  providerPayments(providerId: number, filters: { status?: string; from?: string; to?: string } = {}): Observable<ProviderPayment[]> {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(filters)) if (v) params = params.set(k, v);
    return this.http.get<ProviderPayment[]>(`${this.base}/payments/provider/${providerId}`, { params });
  }
  paymentForOrder(orderId: number): Observable<Payment> { return this.http.get<Payment>(`${this.base}/payments/order/${orderId}`); }
  createPayment(orderId: number, companyId: number, paymentMethod: PaymentMethod, operationNumber?: string): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/payments`, { orderId, companyId, paymentMethod, ...(operationNumber ? { operationNumber } : {}) });
  }
  completePayment(id: number, transactionReference: string): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/payments/${id}/complete`, { transactionReference });
  }

  tanks(): Observable<Tank[]> { return this.http.get<Tank[]>(`${this.base}/tanks`); }
  providers(): Observable<{ id: number; name: string }[]> { return this.http.get<{ id: number; name: string }[]>(`${this.base}/provider-companies`); }
  provider(id: number): Observable<{ id: number; name: string }> { return this.http.get<{ id: number; name: string }>(`${this.base}/provider-companies/${id}`); }
  buyerCompany(id: number): Observable<{ id: number; name: string }> { return this.http.get<{ id: number; name: string }>(`${this.base}/buyer-companies/${id}`); }
  allProducts(): Observable<FuelProduct[]> { return this.http.get<FuelProduct[]>(`${this.base}/fuel-products`); }
  products(providerId: number): Observable<FuelProduct[]> { return this.http.get<FuelProduct[]>(`${this.base}/fuel-products/provider/${providerId}`); }
  alertEmptyCatalog(providerId: number): Observable<void> { return this.http.post<void>(`${this.base}/fuel-products/provider/${providerId}/empty-catalog-alert`, {}); }
}
