import { Component, DestroyRef, inject, signal } from '@angular/core';
import { ReactiveFormsModule, Validators, NonNullableFormBuilder } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { TranslatePipe } from '@ngx-translate/core';
import { BuyerLookup, NewBuyerCompany } from '../../../domain/model/provider-equipment.entity';
import { ProviderEquipmentApi, providerErrorKey } from '../../../infrastructure/provider-equipment.api';

const DEFAULT_RETRY_AFTER_SECONDS = 60;

/**
 * Alta de comprador antes del primer pedido. Paso 1: buscar por RUC; si existe se vincula (POST {buyerCompanyId}),
 * si no existe se crea (POST con datos). No crea usuario IAM.
 */
@Component({
  selector: 'app-provider-buyer-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, TranslatePipe],
  templateUrl: './provider-buyer-form.html',
  styleUrl: '../provider-views.css',
})
export class ProviderBuyerForm {
  private readonly api = inject(ProviderEquipmentApi);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private lookupRequest?: Subscription;
  private timer?: ReturnType<typeof setInterval>;

  protected readonly step = signal<'lookup' | 'create'>('lookup');
  protected readonly found = signal<BuyerLookup | null>(null);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Segundos restantes de espera tras 429 LOOKUP_RATE_LIMITED; mientras sea > 0 no se permite buscar. */
  protected readonly waitSeconds = signal(0);

  protected readonly lookupForm = this.fb.group({ ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]] });
  protected readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150), Validators.pattern(/\S/)]],
    ruc: ['', [Validators.required, Validators.pattern(/^\d{11}$/)]],
    sector: [''],
    address: [''],
    contactEmail: ['', Validators.email],
    phone: [''],
    siteName: [''],
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearInterval(this.timer));
    this.lookupForm.controls.ruc.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.lookupRequest?.unsubscribe();
      this.found.set(null);
      this.searching.set(false);
      this.error.set(null);
    });
  }

  protected search(): void {
    if (this.waitSeconds() > 0 || this.searching() || this.saving()) return;
    if (this.lookupForm.invalid) { this.lookupForm.markAllAsTouched(); return; }
    const ruc = this.lookupForm.controls.ruc.value;
    this.searching.set(true);
    this.error.set(null);
    this.found.set(null);
    this.lookupRequest = this.api.lookupBuyer(ruc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (buyer) => { this.found.set(buyer); this.searching.set(false); },
      error: (e) => {
        this.searching.set(false);
        if (e?.error?.code === 'BUYERCOMPANY_NOT_FOUND') {
          this.form.controls.ruc.setValue(ruc);
          this.step.set('create');
          return;
        }
        if (e?.error?.code === 'LOOKUP_RATE_LIMITED') this.startWait(Number(e.headers?.get('Retry-After')) || DEFAULT_RETRY_AFTER_SECONDS);
        this.error.set(providerErrorKey(e));
      },
    });
  }

  protected link(): void {
    const buyer = this.found();
    if (!buyer || this.saving() || buyer.ruc !== this.lookupForm.controls.ruc.value) return;
    this.saving.set(true);
    this.error.set(null);
    this.api.registerBuyerCompany({ buyerCompanyId: buyer.buyerCompanyId }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (linked) => this.router.navigate(['/clients', linked.id]),
      error: (e) => {
        // Caso legacy: lookup 200 pero la empresa no tiene organización activa => POST 404.
        this.error.set(e?.error?.code === 'BUYERCOMPANY_NOT_FOUND' ? 'provider-equipment.err-buyer-no-org' : providerErrorKey(e));
        this.saving.set(false);
      },
    });
  }

  protected backToLookup(): void { this.step.set('lookup'); this.error.set(null); }

  protected submit(): void {
    if (this.saving()) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const body: Record<string, string> = {};
    // Solo se envían los campos con valor; el backend aplica los por defecto (siteName = name).
    for (const [k, v] of Object.entries(this.form.getRawValue())) if (v.trim()) body[k] = v.trim();
    this.saving.set(true);
    this.error.set(null);
    this.api.registerBuyerCompany(body as unknown as NewBuyerCompany).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (buyer) => this.router.navigate(['/clients', buyer.id]),
      error: (e) => { this.error.set(providerErrorKey(e)); this.saving.set(false); },
    });
  }

  private startWait(seconds: number): void {
    clearInterval(this.timer);
    this.waitSeconds.set(seconds);
    this.timer = setInterval(() => {
      this.waitSeconds.update((s) => s - 1);
      if (this.waitSeconds() <= 0) clearInterval(this.timer);
    }, 1000);
  }
}
