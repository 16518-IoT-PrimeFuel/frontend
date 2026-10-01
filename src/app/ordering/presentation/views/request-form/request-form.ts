import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatInput, MatLabel } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';
import { OrderingApi } from '../../../infrastructure/ordering-api';
import { OrderingStore } from '../../../application/ordering.store';
import { EquipmentApi, apiError } from '../../../../equipment/infrastructure/equipment.api';
import { EquipmentStore } from '../../../../equipment/application/equipment.store';
import { Site, Tank } from '../../../../equipment/domain/model/equipment.entity';
import { FuelProduct } from '../../../../inventory/domain/model/fuel-product.entity';

@Component({ selector: 'app-request-form', imports: [TranslatePipe, ReactiveFormsModule, MatFormField, MatLabel, MatError, MatInput, MatButton, MatSelect, MatOption], templateUrl: './request-form.html', styleUrl: './request-form.css' })
export class RequestForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(OrderingApi);
  private readonly equipmentApi = inject(EquipmentApi);
  private readonly equipment = inject(EquipmentStore);
  private readonly router = inject(Router);
  readonly store = inject(OrderingStore);
  /** Cuenta interna de la organización activa, resuelta desde la identidad; el comprador no la elige. */
  readonly customerAccountId = signal<number | null>(null);
  readonly loadError = signal('');
  readonly tanks = signal<Tank[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly providers = signal<{id: number; name: string}[]>([]);
  readonly products = signal<FuelProduct[]>([]);
  readonly minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  readonly form = this.fb.nonNullable.group({ siteId: [0], tankId: [0], providerId: [0, Validators.min(1)], fuelProductId: [0, Validators.min(1)], quantity: [1, [Validators.required, Validators.min(1)]], unit: ['LITERS', Validators.required], deliveryDate: [this.minDate, Validators.required], deliveryAddress: ['', [Validators.required, Validators.maxLength(255)]] });

  constructor() {
    this.equipment.resolveCustomer().subscribe({
      next: customer => {
        this.customerAccountId.set(customer.id);
        this.api.tanks().subscribe(values => this.tanks.set(values.filter(t => t.customerAccountId === customer.id)));
        this.equipmentApi.sites(customer.id).subscribe(values => this.sites.set(values));
      },
      error: e => this.loadError.set(apiError(e)),
    });
    this.api.providers().subscribe(values => this.providers.set(values));
  }
  /** La solicitud no lleva sede: elegirla solo rellena la dirección, que sigue siendo editable. */
  onSiteChange(): void {
    const address = this.sites().find(s => s.id === this.form.controls.siteId.value)?.address;
    if (address) this.form.controls.deliveryAddress.setValue(address.slice(0, 255));
  }
  onProviderChange(): void {
    const id = this.form.controls.providerId.value;
    this.form.controls.fuelProductId.setValue(0); this.products.set([]);
    if (id) this.api.products(id).subscribe(values => this.products.set(values));
  }
  submit(): void {
    const customerAccountId = this.customerAccountId();
    if (this.form.invalid || customerAccountId === null) return;
    const { siteId, tankId, providerId, fuelProductId, ...details } = this.form.getRawValue();
    this.store.createRequest({ ...details, customerAccountId, tankId: tankId || null, providerId, fuelProductId }, () => this.router.navigate(['/ordering/request-list']).then());
  }
  cancel(): void { this.router.navigate(['/ordering/request-list']).then(); }
}
