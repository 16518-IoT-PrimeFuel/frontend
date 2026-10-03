import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../application/iam.store';
import { displayAuthError } from '../../../infrastructure/auth-error';
import { FUEL_TYPES } from '../../../../inventory/domain/model/fuel-product.entity';

@Component({
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.html',
})
export class Register {
  private readonly iam = inject(IamStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly returnUrl = this.cleanInvitationReturnUrl();
  readonly role = this.route.snapshot.data['role'] as 'BUYER' | 'PROVIDER';
  readonly error = signal('');
  readonly submitting = signal(false);
  readonly showPassword = signal(false);
  username = '';
  password = '';
  name = '';
  ruc = '';
  address = '';
  phone = '';
  sector = '';
  readonly fuelTypeOptions = FUEL_TYPES;
  fuelTypes: string[] = ['DIESEL'];
  description = '';

  toggleFuelType(type: string): void { this.fuelTypes = this.fuelTypes.includes(type) ? this.fuelTypes.filter((value) => value !== type) : [...this.fuelTypes, type]; }

  private cleanInvitationReturnUrl(): string | null {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    const legacyToken = returnUrl?.match(/^\/accept-invitation\/([^?#]+)$/)?.[1];
    const fragment = this.route.snapshot.fragment;
    if (fragment || legacyToken) {
      try { this.iam.pendingInvitationToken.set(decodeURIComponent(fragment || legacyToken!)); }
      catch { this.iam.pendingInvitationToken.set(''); }
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { returnUrl: legacyToken ? '/accept-invitation' : returnUrl },
        fragment: undefined, replaceUrl: true,
      });
    }
    return legacyToken ? '/accept-invitation' : returnUrl;
  }

  submit(form: NgForm): void {
    if (this.submitting()) return;
    form.control.markAllAsTouched();
    if (form.invalid) { this.error.set('auth.validation.form-invalid'); return; }
    if (this.role === 'PROVIDER' && !this.fuelTypes.length) { this.error.set('auth.fuel-types-required'); return; }
    this.error.set('');
    this.submitting.set(true);
    this.iam.signUp({
      role: this.role, username: this.username, password: this.password,
      name: this.name, ruc: this.ruc, address: this.address, phone: this.phone,
      sector: this.sector, fuelTypesOffered: this.fuelTypes,
      description: this.description,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => void this.router.navigateByUrl(this.returnUrl || '/dashboard'),
      error: (error) => { this.error.set(displayAuthError(error, 'sign-up')); this.submitting.set(false); },
    });
  }
}
