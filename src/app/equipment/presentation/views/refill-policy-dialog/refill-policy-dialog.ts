import { Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { FormsModule, NgForm } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { EquipmentApi, apiError } from '../../../infrastructure/equipment.api';
import { RefillPolicy } from '../../../domain/model/equipment.entity';

export interface RefillPolicyDialogData { tankId: number; tankName: string; }

/** Tamaño común: `dialog.open(RefillPolicyDialog, { ...REFILL_POLICY_DIALOG_CONFIG, data })`. */
export const REFILL_POLICY_DIALOG_CONFIG = { width: '560px', maxWidth: 'calc(100vw - 32px)' };

const emptyPolicy = (): RefillPolicy => ({ lowLevelPercent: 20, hysteresisPercent: 10, targetLevelPercent: 100, providerId: null, fuelProductId: null, autoGenerateEnabled: false });

/**
 * @summary Diálogo para consultar y guardar la política de reposición de un tanque.
 * @remarks Recibe {@link RefillPolicyDialogData} y se cierra con la política guardada; `undefined` al cancelar.
 */
@Component({
  selector: 'app-refill-policy-dialog', standalone: true,
  imports: [FormsModule, TranslatePipe, MatButtonModule, MatDialogModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>{{ 'equipment.policy' | translate }} · {{ data.tankName }}</h2>
    <mat-dialog-content>
      <div class="rp-lead">
        <p>{{ 'equipment.policy-lead' | translate }}</p>
        <button mat-icon-button type="button" [attr.aria-expanded]="help()" aria-controls="rp-help" [attr.aria-label]="'equipment.policy-help-toggle' | translate" (click)="help.set(!help())"><mat-icon aria-hidden="true">info</mat-icon></button>
      </div>
      <div id="rp-help" class="rp-help" [hidden]="!help()">
        <ul>
          <li>{{ 'equipment.policy-help-low' | translate }}</li>
          <li>{{ 'equipment.policy-help-target' | translate }}</li>
          <li>{{ 'equipment.policy-help-hysteresis' | translate }}</li>
          <li>{{ 'equipment.policy-help-auto' | translate }}</li>
        </ul>
        @if (!policyInvalid()) { <p>{{ 'equipment.policy-example' | translate:{ low: policy.lowLevelPercent, target: policy.targetLevelPercent, rearm: policy.lowLevelPercent + policy.hysteresisPercent } }}</p> }
      </div>
      @if (!policyReady() && !error()) { <mat-progress-bar mode="indeterminate" [attr.aria-label]="'equipment.loading' | translate"></mat-progress-bar> }
      @if (error()) { <p class="dl-error" role="alert">{{ error() | translate }}</p> }
      <form id="rp-form" #policyForm="ngForm" (ngSubmit)="savePolicy(policyForm)">
        <fieldset [disabled]="!policyReady() || saving()">
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>{{ 'equipment.low-level' | translate }}</mat-label><input matInput type="number" step="any" name="low" [(ngModel)]="policy.lowLevelPercent" required><mat-hint>{{ 'equipment.hint-low' | translate }}</mat-hint></mat-form-field>
          @if (lowError()) { <small class="field-error" role="alert">{{ lowError() | translate }}</small> }
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>{{ 'equipment.target-level' | translate }}</mat-label><input matInput type="number" step="any" name="target" [(ngModel)]="policy.targetLevelPercent" required><mat-hint>{{ 'equipment.hint-target' | translate }}</mat-hint></mat-form-field>
          @if (targetError()) { <small class="field-error" role="alert">{{ targetError() | translate }}</small> }
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>{{ 'equipment.hysteresis' | translate }}</mat-label><input matInput type="number" step="any" name="hysteresis" [(ngModel)]="policy.hysteresisPercent" required><mat-hint>{{ 'equipment.hint-hysteresis' | translate }}</mat-hint></mat-form-field>
          @if (hysteresisError()) { <small class="field-error" role="alert">{{ hysteresisError() | translate }}</small> }
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>{{ 'equipment.provider' | translate }}</mat-label><mat-select [disabled]="!policyReady() || saving()" name="provider" [ngModel]="policy.providerId" (ngModelChange)="onProviderChange($event)"><mat-option [value]="null">{{ 'equipment.not-set' | translate }}</mat-option>@for (provider of providers(); track provider.id) { <mat-option [value]="provider.id">{{ provider.name }}</mat-option> }</mat-select><mat-hint>{{ 'equipment.hint-provider' | translate }}</mat-hint></mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>{{ 'equipment.product' | translate }}</mat-label><mat-select name="product" [ngModel]="policy.fuelProductId" (ngModelChange)="onProductChange($event)" [disabled]="!policyReady() || saving() || policy.providerId === null"><mat-option [value]="null">{{ 'equipment.not-set' | translate }}</mat-option>@for (product of products(); track product.id) { <mat-option [value]="product.id">{{ product.name }} ({{ 'fuel-type.' + product.fuelType.toLowerCase() | translate }})</mat-option> }</mat-select></mat-form-field>
          <label class="rp-check"><input type="checkbox" name="auto" [(ngModel)]="policy.autoGenerateEnabled" [disabled]="policy.providerId === null || policy.fuelProductId === null"> {{ 'equipment.auto-generate' | translate }}</label>
          @if (policy.providerId === null || policy.fuelProductId === null) { <small>{{ 'equipment.auto-needs-both' | translate }}</small> }
        </fieldset>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'confirm.cancel' | translate }}</button>
      <button mat-flat-button color="primary" form="rp-form" [disabled]="!policyReady() || saving()">{{ 'equipment.save-policy' | translate }}</button>
    </mat-dialog-actions>`,
  styles: [`
    .rp-lead{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#1f2d3d}
    .rp-lead p{margin:0}
    .rp-lead button{flex:none;--mat-icon-button-icon-color:#1e3a8a}
    .rp-help{margin:8px 0 0;padding:12px 16px;border-radius:8px;background:#eff6ff;color:#1f2d3d;font-size:.875rem;line-height:1.5}
    .rp-help ul{margin:0;padding-left:1.1rem;display:grid;gap:6px}
    .rp-help p{margin:10px 0 0;font-weight:500}
    fieldset{display:flex;flex-direction:column;gap:14px;min-width:0;margin:16px 0 0;padding:0;border:0}
    mat-form-field{width:100%}
    small{color:#4b5563}
    .field-error{margin-top:-8px;color:#a32121}
    .rp-check{display:flex;align-items:center;gap:8px}
    .dl-error{margin:12px 0 0}
  `],
})
export class RefillPolicyDialog implements OnInit {
  private readonly api = inject(EquipmentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ref = inject<MatDialogRef<RefillPolicyDialog, RefillPolicy>>(MatDialogRef);
  protected readonly data = inject<RefillPolicyDialogData>(MAT_DIALOG_DATA);
  private productsRequest?: Subscription;
  private productsSequence = 0;
  protected readonly help = signal(false);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly policyReady = signal(false);
  protected readonly providers = signal<{ id: number; name: string }[]>([]);
  protected readonly products = signal<{ id: number; name: string; fuelType: string }[]>([]);
  protected policy = emptyPolicy();

  /** Reglas de RefillThresholds y RefillPolicy del backend: bajo (0,100), histéresis > 0, bajo + histéresis <= 100, objetivo (0,100]. */
  protected lowError(): string { const v = this.policy.lowLevelPercent; if (v == null) return 'validation.required'; return v <= 0 || v >= 100 ? 'equipment.err-low-range' : ''; }
  protected hysteresisError(): string {
    const { lowLevelPercent: low, hysteresisPercent: hyst } = this.policy;
    if (hyst == null) return 'validation.required';
    if (hyst <= 0) return 'equipment.err-hysteresis-positive';
    return low != null && low + hyst > 100 ? 'equipment.err-low-plus-hysteresis' : '';
  }
  protected targetError(): string { const v = this.policy.targetLevelPercent; if (v == null) return 'validation.required'; return v <= 0 || v > 100 ? 'equipment.err-target-range' : ''; }
  protected policyInvalid(): boolean { return [this.policy.lowLevelPercent, this.policy.hysteresisPercent, this.policy.targetLevelPercent].some((value) => value == null || !Number.isFinite(value)) || !!(this.lowError() || this.hysteresisError() || this.targetError()); }
  protected onProviderChange(providerId: number | null): void {
    if (!this.policyReady() || this.saving()) return;
    ++this.productsSequence; this.productsRequest?.unsubscribe();
    this.policy.providerId = providerId; this.policy.fuelProductId = null; this.policy.autoGenerateEnabled = false; this.products.set([]);
    if (providerId !== null) this.loadProducts(providerId);
  }
  protected onProductChange(productId: number | null): void { if (!this.policyReady() || this.saving()) return; this.policy.fuelProductId = productId; if (productId === null) this.policy.autoGenerateEnabled = false; }
  private loadProducts(providerId: number): void {
    const sequence = ++this.productsSequence; this.productsRequest?.unsubscribe();
    this.productsRequest = this.api.products(providerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { if (sequence === this.productsSequence && this.policy.providerId === providerId) this.products.set(rows); },
      error: e => { if (sequence === this.productsSequence && this.policy.providerId === providerId) this.error.set(apiError(e)); },
    });
  }

  ngOnInit(): void {
    this.api.providers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.providers.set(rows), error: (e) => this.error.set(apiError(e)) });
    this.api.policy(this.data.tankId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (policy) => { this.policy = { ...policy }; this.policyReady.set(true); if (policy.providerId !== null) this.loadProducts(policy.providerId); }, error: (e: HttpErrorResponse) => {
      if (e.status === 404) { this.policy = emptyPolicy(); this.policyReady.set(true); } else this.error.set(apiError(e));
    } });
  }
  protected savePolicy(form: NgForm): void {
    if (!this.policyReady() || this.saving()) return;
    if (this.policyInvalid()) {
      form.control.markAllAsTouched();
      const name = this.lowError() ? 'low' : this.targetError() ? 'target' : 'hysteresis';
      this.host.nativeElement.querySelector<HTMLElement>(`input[name="${name}"]`)?.focus();
      return;
    }
    this.saving.set(true); this.error.set('');
    this.api.savePolicy(this.data.tankId, { ...this.policy }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({ next: (policy) => this.ref.close(policy), error: (e) => this.error.set(apiError(e)) });
  }
}
