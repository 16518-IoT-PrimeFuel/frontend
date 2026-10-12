import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { RefillEpisode } from '../domain/model/equipment.entity';
import {
  BuyerLookup, DeviceCredential, NewBuyerCompany, NewProviderTank, ProviderBuyerCompany, ProviderTank, ProviderTankReading, ProviderTankUpdate,
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
  issueDeviceCredential(id: number, channel: string) { return this.http.post<DeviceCredential>(`${this.base}/tanks/${id}/device-credential`, null, { params: { channel } }); }
  rotateDeviceCredential(id: number, channel: string) { return this.http.post<DeviceCredential>(`${this.base}/tanks/${id}/device-credential/rotate`, null, { params: { channel } }); }
  revokeDeviceCredential(id: number, channel: string) { return this.http.post<DeviceCredential>(`${this.base}/tanks/${id}/device-credential/revoke`, null, { params: { channel } }); }
  readings(id: number, from?: string, to?: string) {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get<ProviderTankReading[]>(`${this.base}/tanks/${id}/readings`, { params });
  }
  episodes(id: number) { return this.http.get<RefillEpisode[]>(`${this.base}/tanks/${id}/refill-episodes`); }
}

export { unitKey } from '../../shared/domain/model/fuel-unit';

export { apiErrorKey as providerErrorKey } from '../../shared/infrastructure/api-error';
