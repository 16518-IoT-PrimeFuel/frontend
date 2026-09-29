import { Component, ViewChild, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel, MatError, MatHint } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { IamApi, BuyerCompanyProfile, ProviderCompanyProfile, UserProfile, OrganizationProfile } from '../../../infrastructure/iam-api';
import { IamStore } from '../../../application/iam.store';
import { FUEL_TYPES } from '../../../../inventory/domain/model/fuel-product.entity';

/** Página de configuración de cuenta (ruta /profile). */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [FormsModule, TranslatePipe, MatButton, MatFormField, MatInput, MatLabel, MatError, MatHint, MatIcon, MatTabsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly api = inject(IamApi);
  private readonly iam = inject(IamStore);
  @ViewChild('companyForm') companyForm?: NgForm;
  readonly user = signal<UserProfile | null>(null);
  readonly organizations = signal<OrganizationProfile[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly tab = signal(0);
  readonly isBuyer = this.iam.isBuyer();
  buyer: BuyerCompanyProfile = { id: 0, name: '', ruc: '', sector: '', address: '', contactEmail: '', phone: '' };
  provider: ProviderCompanyProfile = { id: 0, name: '', ruc: '', rating: null, address: '', phone: '', fuelTypesOffered: [], description: '' };
  readonly fuelTypeOptions = FUEL_TYPES;
  fuelTypes: string[] = [];

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
        this.applyCompany(company);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('profile.load-error'); },
    });
  }

  role(value: string): string { return value.replace(/^ROLE_/, ''); }
  get canSave(): boolean { return !!this.companyForm?.dirty && !!this.companyForm?.valid && !this.saving(); }

  toggleFuelType(type: string): void {
    this.fuelTypes = this.fuelTypes.includes(type) ? this.fuelTypes.filter((value) => value !== type) : [...this.fuelTypes, type];
    this.companyForm?.form.markAsDirty();
  }

  save(): void {
    const id = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    if (id === null || !this.canSave) return;
    this.error.set('');
    this.saved.set(false);
    this.saving.set(true);
    const request: Observable<BuyerCompanyProfile | ProviderCompanyProfile> = this.isBuyer
      ? this.api.updateBuyerCompany(id, this.buyer)
      : this.api.updateProviderCompany(id, { ...this.provider, fuelTypesOffered: this.fuelTypes });
    request.subscribe({
      next: (company) => {
        this.applyCompany(company);
        this.companyForm?.form.markAsPristine();
        this.saved.set(true);
        this.saving.set(false);
      },
      error: () => { this.error.set('profile.save-error'); this.saving.set(false); },
    });
  }

  private applyCompany(company: BuyerCompanyProfile | ProviderCompanyProfile): void {
    if (this.isBuyer) this.buyer = company as BuyerCompanyProfile;
    else {
      this.provider = company as ProviderCompanyProfile;
      this.fuelTypes = [...this.provider.fuelTypesOffered];
    }
  }
}
