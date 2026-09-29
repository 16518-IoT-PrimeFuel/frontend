import { Component, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { Location } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormField, MatInput, MatLabel, MatError } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { IamApi, BuyerCompanyProfile, ProviderCompanyProfile, UserProfile, OrganizationProfile } from '../../../infrastructure/iam-api';
import { IamStore } from '../../../application/iam.store';

/** Contenido del modal de perfil. */
@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe, MatButton, MatIconButton, MatDialogModule, MatFormField, MatInput, MatLabel, MatError, MatIcon, MatTabsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfileDialog {
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
        this.applyCompany(company);
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.error.set('profile.load-error'); },
    });
  }

  role(value: string): string { return value.replace(/^ROLE_/, ''); }
  get canSave(): boolean { return !!this.companyForm?.dirty && !!this.companyForm?.valid && !this.saving(); }

  save(): void {
    const id = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    if (id === null || !this.canSave) return;
    this.error.set('');
    this.saved.set(false);
    this.saving.set(true);
    const request: Observable<BuyerCompanyProfile | ProviderCompanyProfile> = this.isBuyer
      ? this.api.updateBuyerCompany(id, this.buyer)
      : this.api.updateProviderCompany(id, { ...this.provider, fuelTypesOffered: this.fuelTypes.split(',').map((x) => x.trim()).filter(Boolean) });
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
      this.fuelTypes = this.provider.fuelTypesOffered.join(', ');
    }
  }
}

export const PROFILE_DIALOG_CONFIG = { width: '640px', maxWidth: '96vw', maxHeight: '92vh', autoFocus: 'dialog', restoreFocus: false, closeOnNavigation: false } as const;

/** Ruta /profile: abre el modal encima de la vista anterior y, al cerrarlo, vuelve a ella. */
@Component({ standalone: true, template: '' })
export class Profile implements OnDestroy {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly ref: MatDialogRef<ProfileDialog> = inject(MatDialog).open(ProfileDialog, PROFILE_DIALOG_CONFIG);
  private destroyed = false;

  constructor() {
    this.ref.afterClosed().subscribe(() => {
      if (this.destroyed) return; // cierre provocado por navegar (Atrás, menú): la navegación ya ocurrió
      if (history.state?.navigationId > 1) this.location.back();
      else void this.router.navigate(['/dashboard'], { replaceUrl: true });
    });
  }

  ngOnDestroy(): void { this.destroyed = true; this.ref.close(); }
}
