import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError } from 'rxjs';
import { ErrorHandlingEnabledBaseType } from '../../shared/infrastructure/error-handling-enabled-base-type';
import { environment } from '../../../environments/environment';
import { Session, SignUpForm } from '../domain/model/session.entity';

@Injectable({ providedIn: 'root' })
export class IamApi extends ErrorHandlingEnabledBaseType {
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
    // El PUT reemplaza rating incluso si se omite: conservar el valor leído, sin permitir editarlo.
    const { name, ruc, rating, address, phone, fuelTypesOffered, description } = profile;
    return this.http.put<ProviderCompanyProfile>(`${environment.serverBasePath}/provider-companies/${providerId}`, { name, ruc, rating, address, phone, fuelTypesOffered, description });
  }

  getOrganizations(): Observable<OrganizationProfile[]> {
    return this.http.get<OrganizationProfile[]>(`${environment.serverBasePath}/me/organizations`);
  }

  onboardOrganization(name: string, ruc: string, type: 'CUSTOMER' | 'DISTRIBUTOR'): Observable<OrganizationProfile> {
    return this.http.post<OrganizationProfile>(`${environment.serverBasePath}/onboarding`, { name, ruc, type })
      .pipe(catchError(this.handleError('onboardOrganization', true)));
  }

  inviteMember(organizationId: number, email: string, role: MembershipRole): Observable<OrganizationInvitation> {
    return this.http.post<OrganizationInvitation>(`${environment.serverBasePath}/organizations/${organizationId}/invitations`, { email, role })
      .pipe(catchError(this.handleError('inviteMember', true)));
  }

  revokeInvitation(invitationId: number): Observable<OrganizationInvitation> {
    return this.http.delete<OrganizationInvitation>(`${environment.serverBasePath}/invitations/${invitationId}`)
      .pipe(catchError(this.handleError('revokeInvitation', true)));
  }

  acceptInvitation(token: string): Observable<OrganizationInvitation> {
    return this.http.post<OrganizationInvitation>(`${environment.serverBasePath}/invitations/${encodeURIComponent(token)}/accept`, null)
      // El token forma parte de la URL y también puede aparecer en el cuerpo de un 404.
      .pipe(catchError((error: HttpErrorResponse) => this.handleError('acceptInvitation', true)(
        new HttpErrorResponse({ status: error.status, url: `${environment.serverBasePath}/invitations/:token/accept` }),
      )));
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

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export interface OrganizationInvitation { id: number; organizationId: number; email: string; token: string; role: MembershipRole; status: 'PENDING' | 'ACCEPTED' | 'REVOKED'; expiresAt: string | null; }
