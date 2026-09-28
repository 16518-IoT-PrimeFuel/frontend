import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Customer, RefillEpisode, RefillPolicy, Site, Tank } from '../domain/model/equipment.entity';

@Injectable({ providedIn: 'root' })
export class EquipmentApi {
  private readonly http = inject(HttpClient);
  private readonly base = environment.serverBasePath;

  customers() { return this.http.get<Customer[]>(`${this.base}/customers`); }
  createCustomer(value: Partial<Customer>) { return this.http.post<Customer>(`${this.base}/customers`, value); }
  sites(customerId: number) { return this.http.get<Site[]>(`${this.base}/customers/${customerId}/sites`); }
  createSite(customerId: number, value: Pick<Site, 'name' | 'address'>) { return this.http.post<Site>(`${this.base}/customers/${customerId}/sites`, value); }
  tanks() { return this.http.get<Tank[]>(`${this.base}/tanks`); }
  createTank(value: { customerAccountId: number; siteId: number | null; name: string; fuelType: string; capacity: number; unit: string; initialLevel: number }) { return this.http.post<Tank>(`${this.base}/tanks`, value); }
  tank(id: number) { return this.http.get<Tank>(`${this.base}/tanks/${id}`); }
  policy(id: number) { return this.http.get<RefillPolicy>(`${this.base}/tanks/${id}/refill-policy`); }
  savePolicy(id: number, value: RefillPolicy) { return this.http.put<RefillPolicy>(`${this.base}/tanks/${id}/refill-policy`, value); }
  episodes(id: number) { return this.http.get<RefillEpisode[]>(`${this.base}/tanks/${id}/refill-episodes`); }
}

/** Mensaje del backend (`{code, message}`) o clave i18n si el cuerpo viene vacío (403/404/401 manuales). */
export const apiError = (e: any): string => e?.error?.message ?? e?.error?.code ?? 'equipment.request-failed';
