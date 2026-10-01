import { Component, DestroyRef, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { FormsModule, NgForm } from '@angular/forms';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel, MatError, MatHint } from '@angular/material/input';
import { MatIcon } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { IamApi, BuyerCompanyProfile, ProviderCompanyProfile, UserProfile, OrganizationProfile, OrganizationInvitation, MembershipRole } from '../../../infrastructure/iam-api';
import { IamStore } from '../../../application/iam.store';
import { FUEL_TYPES } from '../../../../inventory/domain/model/fuel-product.entity';

/** Página de configuración de cuenta (ruta /profile). */
@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [DatePipe, MatDialogModule, MatSelectModule, FormsModule, TranslatePipe, MatButton, MatFormField, MatInput, MatLabel, MatError, MatHint, MatIcon, MatTabsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  private readonly api = inject(IamApi);
  private readonly iam = inject(IamStore);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  @ViewChild('revokeDialog') private revokeDialog!: TemplateRef<unknown>;
  readonly invitationOrganizationId = signal<number | null>(null);
  readonly invitations = signal<OrganizationInvitation[]>([]);
  readonly visibleInvitations = computed(() => this.invitations().filter(value => value.organizationId === this.invitationOrganizationId()));
  readonly invitationOrganization = computed(() => this.organizations().find(value => value.id === this.invitationOrganizationId()));
  readonly inviting = signal(false);
  readonly revokingId = signal<number | null>(null);
  readonly selectedInvitation = signal<OrganizationInvitation | null>(null);
  readonly invitationError = signal('');
  readonly invitationNotice = signal('');
  readonly revealedInvitationId = signal<number | null>(null);
  readonly copyingInvitationId = signal<number | null>(null);
  readonly onboarding = signal(false);
  readonly onboardingRefreshing = signal(false);
  readonly onboardingRefreshError = signal(false);
  readonly onboardingError = signal('');
  readonly createdOrganization = signal<OrganizationProfile | null>(null);
  onboardingName = '';
  onboardingRuc = '';
  onboardingType: 'CUSTOMER' | 'DISTRIBUTOR' = 'CUSTOMER';
  readonly membershipRoles: MembershipRole[] = ['ADMIN', 'MEMBER']; // el backend rechaza invitar OWNER
  invitationEmail = '';
  invitationRole: MembershipRole = 'MEMBER';
  @ViewChild('companyForm') companyForm?: NgForm;
  readonly user = signal<UserProfile | null>(null);
  readonly organizations = signal<OrganizationProfile[]>([]);
  readonly loading = signal(true);
  readonly companyLoading = signal(true);
  readonly companyError = signal('');
  readonly organizationsError = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly tab = signal(inject(ActivatedRoute).snapshot.queryParamMap.get('tab') === 'organizations' ? 2 : 0);
  readonly isBuyer = this.iam.isBuyer();
  buyer: BuyerCompanyProfile = { id: 0, name: '', ruc: '', sector: '', address: '', contactEmail: '', phone: '' };
  provider: ProviderCompanyProfile = { id: 0, name: '', ruc: '', rating: null, address: '', phone: '', fuelTypesOffered: [], description: '' };
  readonly fuelTypeOptions = FUEL_TYPES;
  fuelTypes: string[] = [];

  constructor() {
    const userId = this.iam.userId();
    const companyId = this.isBuyer ? this.iam.companyId() : this.iam.providerId();
    forkJoin({
      user: userId === null ? of(null) : this.api.getUser(userId).pipe(catchError(() => of(null))),
      organizations: this.iam.refreshMemberships().pipe(catchError(() => {
        this.organizationsError.set('profile.load-error');
        return of([] as OrganizationProfile[]);
      })),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ user, organizations }) => {
      this.user.set(user);
      if (!user) this.error.set('profile.load-error');
      this.organizations.set(organizations);
      this.invitationOrganizationId.set(this.iam.organizationId());
      this.loading.set(false);
    });
    if (companyId === null) {
      this.companyLoading.set(false);
      this.companyError.set('profile.load-error');
      return;
    }
    const companyRequest: Observable<BuyerCompanyProfile | ProviderCompanyProfile> = this.isBuyer ? this.api.getBuyerCompany(companyId) : this.api.getProviderCompany(companyId);
    companyRequest.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: company => { this.applyCompany(company); this.companyLoading.set(false); },
      error: () => { this.companyError.set('profile.load-error'); this.companyLoading.set(false); },
    });
  }

  selectInvitationOrganization(id: number): void {
    if (this.inviting() || this.revokingId() !== null || this.selectedInvitation()) return;
    if (!this.iam.selectOrganization(id)) return;
    this.invitationOrganizationId.set(id);
    this.clearInvitationMessages();
  }

  createOrganization(form: NgForm): void {
    const name = this.onboardingName.trim();
    const ruc = this.onboardingRuc.trim();
    if (!form.valid || !name || name.length > 150 || !ruc || ruc.length > 11 || !['CUSTOMER', 'DISTRIBUTOR'].includes(this.onboardingType)
      || this.onboarding() || this.onboardingRefreshing() || this.onboardingRefreshError()) return;
    this.onboardingError.set('');
    this.createdOrganization.set(null);
    this.onboarding.set(true);
    this.api.onboardOrganization(name, ruc, this.onboardingType).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: organization => {
        this.createdOrganization.set(organization);
        this.onboarding.set(false);
        form.resetForm({ name: '', ruc: '', type: 'CUSTOMER' });
        this.refreshCreatedOrganizations();
      },
      error: error => {
        const key = error?.message ?? 'errors.generic';
        this.onboardingError.set(['400', '401', '403', '409'].some(status => key === `errors.http-${status}`)
          ? key.replace('errors.', 'onboarding.') : key);
        this.onboarding.set(false);
      },
    });
  }

  refreshCreatedOrganizations(): void {
    if (!this.createdOrganization() || this.onboardingRefreshing()) return;
    this.onboardingRefreshing.set(true);
    this.onboardingRefreshError.set(false);
    this.iam.refreshMemberships().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: organizations => {
        this.organizations.set(organizations);
        this.organizationsError.set('');
        this.invitationOrganizationId.set(this.iam.organizationId());
        this.onboardingRefreshing.set(false);
      },
      error: () => {
        this.onboardingRefreshError.set(true);
        this.onboardingRefreshing.set(false);
      },
    });
  }

  clearInvitationMessages(): void {
    this.invitationError.set('');
    this.invitationNotice.set('');
  }

  inviteMember(form: NgForm): void {
    const organizationId = this.invitationOrganizationId();
    if (!form.valid || !organizationId || !this.invitationOrganization() || this.inviting() || this.revokingId() !== null) return;
    this.clearInvitationMessages();
    this.inviting.set(true);
    this.api.inviteMember(organizationId, this.invitationEmail.trim(), this.invitationRole)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: invitation => {
          this.invitations.update(values => [...values, invitation]);
          form.resetForm({ email: '', role: 'MEMBER' });
          this.invitationNotice.set('invitations.created');
          this.inviting.set(false);
        },
        error: error => { this.invitationError.set(error?.message ?? 'errors.generic'); this.inviting.set(false); },
      });
  }

  async copyInvitationLink(invitation: OrganizationInvitation): Promise<void> {
    if (this.copyingInvitationId() !== null || invitation.status !== 'PENDING' || !invitation.token) return;
    this.clearInvitationMessages();
    this.copyingInvitationId.set(invitation.id);
    try {
      await navigator.clipboard.writeText(`${location.origin}/accept-invitation#${encodeURIComponent(invitation.token)}`);
      if (!this.destroyRef.destroyed) this.invitationNotice.set('invitations.link-copied');
    } catch {
      if (!this.destroyRef.destroyed) this.invitationError.set('invitations.copy-failed');
    } finally {
      if (!this.destroyRef.destroyed) this.copyingInvitationId.set(null);
    }
  }

  requestRevoke(invitation: OrganizationInvitation): void {
    if (invitation.status !== 'PENDING' || this.inviting() || this.revokingId() !== null || this.selectedInvitation()) return;
    this.clearInvitationMessages();
    this.selectedInvitation.set(invitation);
    const dialogRef = this.dialog.open(this.revokeDialog, { width: '480px', maxWidth: 'calc(100vw - 32px)' });
    const unregisterDestroy = this.destroyRef.onDestroy(() => dialogRef.close());
    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(confirmed => {
        unregisterDestroy();
        this.selectedInvitation.set(null);
        if (confirmed !== true) return;
        this.revokingId.set(invitation.id);
        this.api.revokeInvitation(invitation.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: revoked => {
            this.invitations.update(values => values.map(value => value.id === revoked.id ? revoked : value));
            this.revealedInvitationId.set(null);
            this.invitationNotice.set('invitations.revoked');
            this.revokingId.set(null);
          },
          error: error => { this.invitationError.set(error?.message ?? 'errors.generic'); this.revokingId.set(null); },
        });
      });
  }

  role(value: string): string { return value.replace(/^ROLE_/, ''); }
  get canSave(): boolean { return !this.companyLoading() && !this.companyError() && !!this.companyForm?.dirty && !!this.companyForm?.valid && (this.isBuyer || this.fuelTypes.length > 0) && !this.saving(); }

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
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
