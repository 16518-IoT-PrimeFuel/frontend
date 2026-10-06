import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { catchError, finalize, forkJoin, Observable, of, Subscription, switchMap, tap } from 'rxjs';
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

@Component({ selector: 'app-request-form', providers: [OrderingStore], imports: [TranslatePipe, ReactiveFormsModule, MatFormField, MatLabel, MatError, MatInput, MatButton, MatSelect, MatOption], templateUrl: './request-form.html', styleUrl: './request-form.css' })
export class RequestForm {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(OrderingApi);
  private readonly equipmentApi = inject(EquipmentApi);
  private readonly equipment = inject(EquipmentStore);
  private readonly router = inject(Router);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly store = inject(OrderingStore);
  /** Cuenta interna de la organización activa, resuelta desde la identidad; el comprador no la elige. */
  readonly customerAccountId = signal<number | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly tanks = signal<Tank[]>([]);
  readonly sites = signal<Site[]>([]);
  readonly providers = signal<{id: number; name: string}[]>([]);
  readonly products = signal<FuelProduct[]>([]);
  readonly productsLoading = signal(false);
  readonly productError = signal('');
  readonly catalogAlert = signal('');
  readonly submitted = signal(false);
  /** Condición ajena a los campos que impide enviar; se explica junto al botón tras intentar enviar. */
  readonly blocker = computed(() => this.customerAccountId() === null ? (this.loading() ? 'request-form.loading' : 'request-form.no-customer')
    : this.productsLoading() ? 'request-form.products-loading' : this.productError());
  private loadRequest?: Subscription;
  private productsRequest?: Subscription;
  readonly minDate = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  readonly form = this.fb.nonNullable.group({ siteId: [0], tankId: [0], providerId: [0, Validators.min(1)], fuelProductId: [0, Validators.min(1)], quantity: [1, [Validators.required, Validators.min(1)]], unit: ['LITERS', Validators.required], deliveryDate: [this.minDate, Validators.required], deliveryAddress: ['', [Validators.required, Validators.maxLength(255)]] });

  constructor() { this.load(); }
  /** Carga inicial; también es el reintento. Cada lista conserva lo que ya tenía si su consulta falla. */
  load(): void {
    this.loadRequest?.unsubscribe();
    this.loading.set(true); this.loadError.set('');
    this.loadRequest = forkJoin([
      this.part(this.api.providers(), values => this.providers.set(values), 'request-form.providers-error'),
      this.equipment.resolveCustomer().pipe(
        switchMap(customer => {
          this.customerAccountId.set(customer.id);
          return forkJoin([
            this.part(this.api.tanks(), values => this.tanks.set(values.filter(t => t.customerAccountId === customer.id)), 'request-form.tanks-error'),
            this.part(this.equipmentApi.sites(customer.id), values => this.sites.set(values), 'request-form.sites-error'),
          ]);
        }),
        catchError(e => { this.loadError.set(apiError(e)); return of(null); }),
      ),
    ]).pipe(finalize(() => this.loading.set(false))).subscribe();
  }
  private part<T>(source: Observable<T>, save: (value: T) => void, errorKey: string): Observable<unknown> {
    return source.pipe(tap(save), catchError(() => { this.loadError.set(errorKey); return of(null); }));
  }
  /** La solicitud no lleva sede: elegirla solo rellena la dirección, que sigue siendo editable. */
  onSiteChange(): void {
    const address = this.sites().find(s => s.id === this.form.controls.siteId.value)?.address;
    if (address) this.form.controls.deliveryAddress.setValue(address.slice(0, 255));
  }
  onProviderChange(): void {
    this.productsRequest?.unsubscribe();
    const id = this.form.controls.providerId.value;
    this.form.controls.fuelProductId.setValue(0); this.products.set([]);
    this.productError.set(''); this.catalogAlert.set(''); this.productsLoading.set(!!id);
    if (id) this.productsRequest = this.api.products(id).subscribe({
      next: values => {
        this.productsLoading.set(false);
        this.products.set(values.filter(product => product.active !== false));
        if (!this.products().length) { this.productError.set('request-form.no-products'); this.alertEmptyCatalog(); }
      },
      error: () => { this.productsLoading.set(false); this.productError.set('request-form.products-error'); },
    });
  }
  /** Avisa al distribuidor elegido de que su catálogo está vacío; el reintento repite solo este POST. */
  alertEmptyCatalog(): void {
    const id = this.form.controls.providerId.value;
    this.catalogAlert.set('');
    this.api.alertEmptyCatalog(id).subscribe({
      next: () => { if (this.form.controls.providerId.value === id) this.catalogAlert.set('request-form.provider-notified'); },
      error: () => { if (this.form.controls.providerId.value === id) this.catalogAlert.set('request-form.notification-error'); },
    });
  }
  ngOnDestroy(): void { this.loadRequest?.unsubscribe(); this.productsRequest?.unsubscribe(); }
  submit(): void {
    if (this.store.creating()) return;
    // Un producto que ya no está en el catálogo cargado cuenta como campo vacío.
    if (!this.products().some(product => product.id === this.form.controls.fuelProductId.value)) this.form.controls.fuelProductId.setValue(0);
    this.form.markAllAsTouched();
    this.submitted.set(true);
    const customerAccountId = this.customerAccountId();
    if (this.form.invalid) { this.host.nativeElement.querySelector<HTMLElement>('[formControlName].ng-invalid')?.focus(); return; }
    if (customerAccountId === null || this.blocker()) return;
    const { siteId, tankId, providerId, fuelProductId, ...details } = this.form.getRawValue();
    this.store.createRequest({ ...details, customerAccountId, tankId: tankId || null, providerId, fuelProductId }, () => this.router.navigate(['/ordering/request-list'], { state: { notice: 'request-list.created' } }).then());
  }
  cancel(): void { this.router.navigate(['/ordering/request-list']).then(); }
}
