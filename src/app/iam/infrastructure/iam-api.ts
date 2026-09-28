import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Session, SignUpForm } from '../domain/model/session.entity';

@Injectable({ providedIn: 'root' })
export class IamApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.serverBasePath}/authentication`;

  getUser(userId: number): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${environment.serverBasePath}/users/${userId}`);
  }

  getBuyerCompany(companyId: number): Observable<BuyerCompanyProfile> {
    return this.http.get<BuyerCompanyProfile>(`${environment.serverBasePath}/buyer-companies/${companyId}`);
  }

  updateBuyerCompany(companyId: number, profile: BuyerCompanyProfile): Observable<BuyerCompanyProfile> {
    const { name, ruc, sector, address, contactEmail, phone } = profile;
    return this.http.put<BuyerCompanyProfile>(`${environment.serverBasePath}/buyer-companies/${companyId}`, { name, ruc, sector, address, contactEmail, phone });
  }

  getProviderCompany(providerId: number): Observable<ProviderCompanyProfile> {
    return this.http.get<ProviderCompanyProfile>(`${environment.serverBasePath}/provider-companies/${providerId}`);
  }

  updateProviderCompany(providerId: number, profile: ProviderCompanyProfile): Observable<ProviderCompanyProfile> {
    const { name, ruc, rating, address, phone, fuelTypesOffered, description } = profile;
    return this.http.put<ProviderCompanyProfile>(`${environment.serverBasePath}/provider-companies/${providerId}`, { name, ruc, rating, address, phone, fuelTypesOffered, description });
  }

  getOrganizations(): Observable<OrganizationProfile[]> {
    return this.http.get<OrganizationProfile[]>(`${environment.serverBasePath}/me/organizations`);
  }

  signIn(username: string, password: string): Observable<Session> {
    return this.http.post<Session>(`${this.base}/sign-in`, { username, password });
  }

  signUp(form: SignUpForm): Observable<unknown> {
    const payload = form.role === 'BUYER'
      ? {
          username: form.username,
          password: form.password,
          roles: ['ROLE_BUYER'],
          buyerCompany: {
            name: form.name,
            ruc: form.ruc,
            sector: form.sector,
            address: form.address,
            contactEmail: form.username,
            phone: form.phone,
          },
        }
      : {
          username: form.username,
          password: form.password,
          roles: ['ROLE_PROVIDER'],
          providerCompany: {
            name: form.name,
            ruc: form.ruc,
            address: form.address,
            phone: form.phone,
            fuelTypesOffered: form.fuelTypesOffered,
            description: form.description ?? '',
          },
        };
    return this.http.post(`${this.base}/sign-up`, payload);
  }

  requestPasswordReset(email: string): Observable<unknown> {
    return this.http.post(`${this.base}/password-reset/request`, { email });
  }

  confirmPasswordReset(token: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${this.base}/password-reset/confirm`, { token, newPassword });
  }
}

export interface UserProfile { id: number; username: string; roles: string[]; companyId: number | null; providerId: number | null; }
export interface BuyerCompanyProfile { id: number; name: string; ruc: string; sector: string; address: string; contactEmail: string; phone: string; }
export interface ProviderCompanyProfile { id: number; name: string; ruc: string; rating: number | null; address: string; phone: string; fuelTypesOffered: string[]; description: string; }
export interface OrganizationProfile { id: number; name: string; type: string; role: string; }
