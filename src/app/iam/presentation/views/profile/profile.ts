import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { IamApi, BuyerCompanyProfile, ProviderCompanyProfile, UserProfile, OrganizationProfile } from '../../../infrastructure/iam-api';
import { IamStore } from '../../../application/iam.store';

@Component({
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly api = inject(IamApi);
  private readonly iam = inject(IamStore);
  readonly user = signal<UserProfile | null>(null);
  readonly organizations = signal<OrganizationProfile[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly isBuyer = this.iam.isBuyer();
  buyer: BuyerCompanyProfile = { id: 0, name: '', ruc: '', sector: '', address: '', contactEmail: '', phone: '' };
  provider: ProviderCompanyProfile = { id: 0, name: '', ruc: '', rating: null, address: '', phone: '', fuelTypesOffered: [], description: '' };
  fuelTypes = '';

  constructor() {
    const userId = this.iam.userId();
    const companyId = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    if (userId === null || companyId === null) { this.loading.set(false); this.error.set('profile.load-error'); return; }
    forkJoin({
      user: this.api.getUser(userId),
      company: this.isBuyer ? this.api.getBuyerCompany(companyId) : this.api.getProviderCompany(companyId),
      organizations: this.api.getOrganizations(),
    }).subscribe({
      next: ({ user, company, organizations }) => {
        this.user.set(user);
        this.organizations.set(organizations);
        if (this.isBuyer) this.buyer = company as BuyerCompanyProfile;
        else {
          this.provider = company as ProviderCompanyProfile;
          this.fuelTypes = this.provider.fuelTypesOffered.join(', ');
        }
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('profile.load-error'); },
    });
  }

  save(): void {
    const id = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    if (id === null) return;
    this.error.set('');
    this.saved.set(false);
    this.saving.set(true);
    const request: Observable<BuyerCompanyProfile | ProviderCompanyProfile> = this.isBuyer
      ? this.api.updateBuyerCompany(id, this.buyer)
      : this.api.updateProviderCompany(id, { ...this.provider, fuelTypesOffered: this.fuelTypes.split(',').map((x) => x.trim()).filter(Boolean) });
    request.subscribe({
      next: (company) => {
        if (this.isBuyer) this.buyer = company as BuyerCompanyProfile;
        else {
          this.provider = company as ProviderCompanyProfile;
          this.fuelTypes = this.provider.fuelTypesOffered.join(', ');
        }
        this.saved.set(true);
        this.saving.set(false);
      },
      error: () => { this.error.set('profile.save-error'); this.saving.set(false); },
    });
  }
}
