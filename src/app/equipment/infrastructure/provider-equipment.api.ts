import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RefillEpisode } from '../domain/model/equipment.entity';
import {
  BuyerLookup, NewBuyerCompany, NewProviderTank, ProviderBuyerCompany, ProviderTank, ProviderTankReading, ProviderTankUpdate,
} from '../domain/model/provider-equipment.entity';

/** Endpoints /provider/* (solo ROLE_PROVIDER). El distribuidor lo deriva el backend del token. */
@Injectable({ providedIn: 'root' })
export class ProviderEquipmentApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.serverBasePath}/provider`;

  buyerCompanies() { return this.http.get<ProviderBuyerCompany[]>(`${this.base}/buyer-companies`); }
  lookupBuyer(ruc: string) { return this.http.get<BuyerLookup>(`${this.base}/buyer-companies/lookup`, { params: { ruc } }); }
  registerBuyerCompany(body: NewBuyerCompany | { buyerCompanyId: number }) { return this.http.post<ProviderBuyerCompany>(`${this.base}/buyer-companies`, body); }
  tanks(buyerCompanyId?: number) {
    const params = buyerCompanyId ? new HttpParams().set('buyerCompanyId', buyerCompanyId) : undefined;
    return this.http.get<ProviderTank[]>(`${this.base}/tanks`, { params });
  }
  tank(id: number) { return this.http.get<ProviderTank>(`${this.base}/tanks/${id}`); }
  registerTank(body: NewProviderTank) { return this.http.post<ProviderTank>(`${this.base}/tanks`, body); }
  updateTank(id: number, body: ProviderTankUpdate) { return this.http.put<ProviderTank>(`${this.base}/tanks/${id}`, body); }
  readings(id: number, from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ProviderTankReading[]>(`${this.base}/tanks/${id}/readings`, { params });
  }
  episodes(id: number) { return this.http.get<RefillEpisode[]>(`${this.base}/tanks/${id}/refill-episodes`); }
}

/** LITRE|LITERS -> unit.liters, GALLON|GALLONS -> unit.gallons (clave i18n existente). */
export const unitKey = (unit: string | null | undefined) => (unit?.startsWith('GALLON') ? 'unit.gallons' : 'unit.liters');

const errorKeys: Record<string, string> = {
  DEVICEBINDING_CONFLICT: 'provider-equipment.err-device-duplicate',
  BUYERCOMPANY_CONFLICT: 'provider-equipment.err-ruc-duplicate',
  PROVIDERBUYERLINK_CONFLICT: 'provider-equipment.err-already-linked',
  BUYERCOMPANY_NOT_FOUND: 'provider-equipment.err-buyer-not-found',
  FUELPRODUCT_NOT_FOUND: 'provider-equipment.err-product-not-found',
  TANK_NOT_FOUND: 'provider-equipment.err-tank-not-found',
  LOOKUP_RATE_LIMITED: 'provider-equipment.err-lookup-rate-limited',
  VALIDATION_ERROR: 'errors.http-400',
};

/** HttpErrorResponse de /provider/* -> clave i18n; nunca expone `details` (viene en inglés fijo). */
export const providerErrorKey = (e: any): string =>
  errorKeys[e?.error?.code] ?? ([400, 401, 403, 404, 409, 422].includes(e?.status) ? `errors.http-${e.status}` : e?.status === 0 ? 'errors.network' : 'equipment.request-failed');
