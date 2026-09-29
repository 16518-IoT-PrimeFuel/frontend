import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  readonly role = inject(ActivatedRoute).snapshot.data['role'] as 'BUYER' | 'PROVIDER';
  readonly error = signal('');
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

  submit(): void {
    if (this.role === 'PROVIDER' && !this.fuelTypes.length) return;
    this.error.set('');
    this.iam.signUp({
      role: this.role, username: this.username, password: this.password,
      name: this.name, ruc: this.ruc, address: this.address, phone: this.phone,
      sector: this.sector, fuelTypesOffered: this.fuelTypes,
      description: this.description,
    }).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (error) => this.error.set(displayAuthError(error)),
    });
  }
}
