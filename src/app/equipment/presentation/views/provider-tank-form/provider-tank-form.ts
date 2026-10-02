import { Component, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { IamStore } from '../../../../iam/application/iam.store';
import { InventoryApi } from '../../../../inventory/infrastructure/inventory-api';
import { FuelProduct } from '../../../../inventory/domain/model/fuel-product.entity';
import { ProviderBuyerCompany, ProviderTank, ProviderTankUpdate, ProviderUnit } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi, providerErrorKey, unitKey } from '../../../infrastructure/provider-equipment.api';

/** El nivel inicial no puede superar la capacidad (el backend lo valida igual). */
const levelWithinCapacity = (g: AbstractControl): ValidationErrors | null =>
  Number(g.get('initialLevel')?.value) > Number(g.get('capacity')?.value) ? { levelAboveCapacity: true } : null;

/**
 * Asociar tanque + dispositivo IoT (US-51, N7) y editar umbral/producto/dispositivo (N8).
 * En edición solo se envían los campos modificados; deviceId y channel siempre juntos.
 */
@Component({
  selector: 'app-provider-tank-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './provider-tank-form.html',
  styleUrl: '../provider-views.css',
})
export class ProviderTankForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProviderEquipmentApi);
  private readonly inventory = inject(InventoryApi);
  private readonly iam = inject(IamStore);
  protected readonly unitKey = unitKey;
  protected readonly buyerId = Number(this.route.snapshot.paramMap.get('buyerId'));
  private readonly tankId = Number(this.route.snapshot.paramMap.get('tankId')) || null;
  protected readonly editing = this.tankId !== null;

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly buyer = signal<ProviderBuyerCompany | null>(null);
  protected readonly products = signal<FuelProduct[]>([]);
  private original: ProviderTank | null = null;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    siteId: [0, Validators.min(1)],
    fuelProductId: [0, Validators.min(1)],
    capacity: [0, Validators.min(0.01)],
    unit: ['LITRE' as ProviderUnit],
    initialLevel: [0, Validators.min(0)],
    lowLevelPercent: [20, [Validators.min(1), Validators.max(90)]],
    deviceId: ['', [Validators.required, Validators.maxLength(120), Validators.pattern(/\S/)]],
    channel: ['level', [Validators.required, Validators.maxLength(60), Validators.pattern(/\S/)]],
    autoGenerateEnabled: [true],
  }, { validators: levelWithinCapacity });

  ngOnInit(): void { this.load(); }

  protected load(): void {
    const providerId = this.iam.providerId();
    this.loading.set(true);
    this.loadError.set(false);
    forkJoin({
      buyers: this.api.buyerCompanies(),
      // Solo productos activos del catálogo del distribuidor.
      products: providerId ? this.inventory.getProductsByProvider(providerId) : [[] as FuelProduct[]],
      tanks: this.editing ? this.api.tanks(this.buyerId) : [[] as ProviderTank[]],
    }).subscribe({
      next: ({ buyers, products, tanks }) => {
        this.buyer.set(buyers.find((b) => b.id === this.buyerId) ?? null);
        this.products.set(products.filter((p) => p.active));
        if (this.editing) this.fill(tanks.find((t) => t.id === this.tankId) ?? null);
        else if (this.buyer()?.sites.length === 1) this.form.patchValue({ siteId: this.buyer()!.sites[0].id });
        this.loadError.set(!this.buyer() || (this.editing && !this.original));
        this.loading.set(false);
      },
      error: () => { this.loadError.set(true); this.loading.set(false); },
    });
  }

  private fill(t: ProviderTank | null): void {
    this.original = t;
    if (!t) return;
    const d = t.devices[0];
    this.form.patchValue({
      name: t.name, siteId: t.siteId, fuelProductId: t.fuelProductId ?? 0, capacity: t.capacity, unit: t.unit,
      initialLevel: t.currentLevel, lowLevelPercent: t.lowLevelPercent, deviceId: d?.deviceId ?? '', channel: d?.channel ?? 'level',
    });
    // Solo producto, umbral y dispositivo son editables (autoGenerateEnabled no viene en el recurso, no se reenvía).
    for (const c of ['name', 'siteId', 'capacity', 'unit', 'initialLevel'] as const) this.form.controls[c].disable();
  }

  protected submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    const done = { next: () => this.router.navigate(['/clients', this.buyerId]), error: (e: unknown) => { this.error.set(providerErrorKey(e)); this.saving.set(false); } };
    if (!this.editing) {
      const site = this.buyer()!.sites.find((s) => s.id === Number(v.siteId))!;
      this.api.registerTank({
        buyerCompanyId: this.buyerId, customerAccountId: site.customerAccountId, siteId: site.id, name: v.name.trim(),
        fuelProductId: Number(v.fuelProductId), capacity: Number(v.capacity), unit: v.unit, initialLevel: Number(v.initialLevel),
        lowLevelPercent: Number(v.lowLevelPercent), deviceId: v.deviceId.trim(), channel: v.channel.trim(),
        autoGenerateEnabled: v.autoGenerateEnabled,
      }).subscribe(done);
      return;
    }
    const o = this.original!;
    const body: ProviderTankUpdate = {};
    if (Number(v.fuelProductId) !== o.fuelProductId) body.fuelProductId = Number(v.fuelProductId);
    if (Number(v.lowLevelPercent) !== o.lowLevelPercent) body.lowLevelPercent = Number(v.lowLevelPercent);
    if (v.deviceId.trim() !== (o.devices[0]?.deviceId ?? '') || v.channel.trim() !== (o.devices[0]?.channel ?? '')) {
      body.deviceId = v.deviceId.trim();
      body.channel = v.channel.trim();
    }
    this.api.updateTank(this.tankId!, body).subscribe(done);
  }
}
