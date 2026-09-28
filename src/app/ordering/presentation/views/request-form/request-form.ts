import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { OrderingStore } from '../../../application/ordering.store';
import { Customer, Tank } from '../../../../equipment/domain/model/equipment.entity';
import { FuelProduct } from '../../../../inventory/domain/model/fuel-product.entity';

@Component({ selector: 'app-request-form', imports: [TranslatePipe, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatButton, MatSelect, MatOption], templateUrl: './request-form.html', styleUrl: './request-form.css' })
export class RequestForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(OrderingApi);
  private readonly router = inject(Router);
  readonly store = inject(OrderingStore);
  readonly customers = signal<Customer[]>([]);
  readonly tanks = signal<Tank[]>([]);
  readonly providers = signal<{id: number; name: string}[]>([]);
  readonly products = signal<FuelProduct[]>([]);
  readonly minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  readonly form = this.fb.nonNullable.group({ customerAccountId: [0, Validators.min(1)], tankId: [0, Validators.min(1)], providerId: [0, Validators.min(1)], fuelProductId: [0, Validators.min(1)], quantity: [1, [Validators.required, Validators.min(1)]], unit: ['LITERS', Validators.required], deliveryDate: [this.minDate, Validators.required], deliveryAddress: [''] });

  constructor() {
    this.api.customers().subscribe(values => this.customers.set(values));
    this.api.tanks().subscribe(values => this.tanks.set(values));
    this.api.providers().subscribe(values => this.providers.set(values));
  }
  tanksForCustomer(): Tank[] { return this.tanks().filter(t => t.customerAccountId === this.form.controls.customerAccountId.value); }
  onCustomerChange(): void { this.form.controls.tankId.setValue(0); }
  onProviderChange(): void {
    const id = this.form.controls.providerId.value;
    this.form.controls.fuelProductId.setValue(0); this.products.set([]);
    if (id) this.api.products(id).subscribe(values => this.products.set(values));
  }
  submit(): void {
    if (this.form.invalid) return;
    const { customerAccountId, tankId, providerId, fuelProductId, ...details } = this.form.getRawValue();
    this.store.createRequest({ ...details, customerAccountId, tankId, providerId, fuelProductId }, () => this.router.navigate(['/ordering/request-list']).then());
  }
  cancel(): void { this.router.navigate(['/ordering/request-list']).then(); }
}
