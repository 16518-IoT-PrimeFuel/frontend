import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { catchError, Observable } from 'rxjs';
import { ErrorHandlingEnabledBaseType } from '../../shared/infrastructure/error-handling-enabled-base-type';
import { CreateRequest, Request } from '../domain/model/request.entity';
import { Order } from '../domain/model/order.entity';
import { Tank } from '../../equipment/domain/model/equipment.entity';
import { FuelProduct } from '../../inventory/domain/model/fuel-product.entity';

export type PaymentMethod = 'BANK_TRANSFER' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH';
export interface Payment { id: number; orderId: number; companyId: number; amount: number; status: string; paymentMethod: PaymentMethod; transactionReference: string | null; paidAt: string | null; }

@Injectable({ providedIn: 'root' })
export class OrderingApi extends ErrorHandlingEnabledBaseType {
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

  paymentsForCompany(companyId: number): Observable<Payment[]> { return this.http.get<Payment[]>(`${this.base}/payments/company/${companyId}`).pipe(catchError(this.handleError('paymentsForCompany', true))); }
  refundPayment(id: number): Observable<Payment> { return this.http.post<Payment>(`${this.base}/payments/${id}/refund`, null).pipe(catchError(this.handleError('refundPayment', true))); }
  paymentForOrder(orderId: number): Observable<Payment> { return this.http.get<Payment>(`${this.base}/payments/order/${orderId}`); }
  createPayment(orderId: number, companyId: number, amount: number, paymentMethod: PaymentMethod): Observable<Payment> {
    return this.http.post<Payment>(`${this.base}/payments`, { orderId, companyId, amount, paymentMethod });
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
}
