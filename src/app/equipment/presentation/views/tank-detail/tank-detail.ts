import { Component, DestroyRef, ElementRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Subscription } from 'rxjs';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { EquipmentApi, apiError } from '../../../infrastructure/equipment.api';
import { RefillEpisode, RefillPolicy, Tank } from '../../../domain/model/equipment.entity';

const emptyPolicy = (): RefillPolicy => ({ lowLevelPercent: 20, hysteresisPercent: 10, targetLevelPercent: 100, providerId: null, fuelProductId: null, autoGenerateEnabled: false });

@Component({
  selector: 'app-tank-detail', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  template: `
    <main class="equipment-page"><a routerLink="/tanks">{{ 'equipment.back' | translate }}</a>
      @if (error()) { <p role="alert">{{ error() | translate }}</p> }
      @if (tank(); as item) {
        <h1>{{ item.name }}</h1><mat-card><mat-card-content>
          <p>{{ item.currentLevel }} / {{ item.capacity }} {{ item.unit }}</p>
          <mat-progress-bar mode="determinate" [value]="levelPercent()"></mat-progress-bar>
          <p>{{ 'equipment.level-source' | translate }}: {{ item.levelSource }}</p>
          <p>{{ 'equipment.device-pending' | translate }}</p>
        </mat-card-content></mat-card>
      }
      <mat-card><mat-card-header><mat-card-title>{{ 'equipment.policy' | translate }}</mat-card-title></mat-card-header><mat-card-content>
        <form #policyForm="ngForm" (ngSubmit)="savePolicy(policyForm)">
          <fieldset [disabled]="!policyReady() || saving()" style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:.25rem">
          <mat-form-field><mat-label>{{ 'equipment.low-level' | translate }}</mat-label><input matInput type="number" step="any" name="low" [(ngModel)]="policy.lowLevelPercent" required></mat-form-field>
          @if (lowError()) { <small class="field-error" role="alert">{{ lowError() | translate }}</small> }
          <mat-form-field><mat-label>{{ 'equipment.hysteresis' | translate }}</mat-label><input matInput type="number" step="any" name="hysteresis" [(ngModel)]="policy.hysteresisPercent" required></mat-form-field>
          @if (hysteresisError()) { <small class="field-error" role="alert">{{ hysteresisError() | translate }}</small> }
          <mat-form-field><mat-label>{{ 'equipment.target-level' | translate }}</mat-label><input matInput type="number" step="any" name="target" [(ngModel)]="policy.targetLevelPercent" required></mat-form-field>
          @if (targetError()) { <small class="field-error" role="alert">{{ targetError() | translate }}</small> }
          <mat-form-field><mat-label>{{ 'equipment.provider' | translate }}</mat-label><mat-select [disabled]="!policyReady() || saving()" name="provider" [ngModel]="policy.providerId" (ngModelChange)="onProviderChange($event)"><mat-option [value]="null">{{ 'equipment.not-set' | translate }}</mat-option>@for (provider of providers(); track provider.id) { <mat-option [value]="provider.id">{{ provider.name }}</mat-option> }</mat-select></mat-form-field>
          <mat-form-field><mat-label>{{ 'equipment.product' | translate }}</mat-label><mat-select name="product" [ngModel]="policy.fuelProductId" (ngModelChange)="onProductChange($event)" [disabled]="!policyReady() || saving() || policy.providerId === null"><mat-option [value]="null">{{ 'equipment.not-set' | translate }}</mat-option>@for (product of products(); track product.id) { <mat-option [value]="product.id">{{ product.name }} ({{ 'fuel-type.' + product.fuelType.toLowerCase() | translate }})</mat-option> }</mat-select></mat-form-field>
          <label><input type="checkbox" name="auto" [(ngModel)]="policy.autoGenerateEnabled" [disabled]="policy.providerId === null || policy.fuelProductId === null"> {{ 'equipment.auto-generate' | translate }}</label>
          @if (policy.providerId === null || policy.fuelProductId === null) { <small>{{ 'equipment.auto-needs-both' | translate }}</small> }
          <button mat-flat-button color="primary" [disabled]="!policyReady() || !tank() || saving()">{{ 'equipment.save-policy' | translate }}</button>
          @if (saved()) { <p role="status">{{ 'equipment.policy-saved' | translate }}</p> }
          </fieldset>
        </form>
      </mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>{{ 'equipment.episodes' | translate }}</mat-card-title></mat-card-header><mat-card-content>
        @for (episode of episodes(); track episode.id) { <p>{{ episode.status }} · {{ episode.openedAt | date:'medium' }} · {{ episode.openedLevelPercent }}% → {{ episode.targetLevel }} {{ episode.unit }} · {{ episode.requestEmitted ? ('equipment.request-emitted' | translate) : '' }}</p> }
        @if (!episodes().length) { <p>{{ 'equipment.no-episodes' | translate }}</p> }
      </mat-card-content></mat-card>
    </main>`,
  styles: [`.equipment-page{padding:1.5rem;max-width:900px;margin:auto}mat-card{margin:1rem 0}form{display:flex;flex-direction:column;gap:.25rem}.field-error{color:#a32121;margin:-.5rem 0 .5rem}mat-form-field{width:100%}`],
})
export class TankDetail implements OnInit {
  private readonly api = inject(EquipmentApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private productsRequest?: Subscription;
  private productsSequence = 0;
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly tank = signal<Tank | null>(null);
  protected readonly episodes = signal<RefillEpisode[]>([]);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly policyReady = signal(false);
  protected readonly saved = signal(false);
  protected readonly providers = signal<{ id: number; name: string }[]>([]);
  protected readonly products = signal<{ id: number; name: string; fuelType: string }[]>([]);
  protected policy = emptyPolicy();
  protected levelPercent(): number { const tank = this.tank(); return tank ? Math.max(0, Math.min(100, tank.currentLevel / tank.capacity * 100)) : 0; }

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
    this.saved.set(false);
    this.policy.providerId = providerId; this.policy.fuelProductId = null; this.policy.autoGenerateEnabled = false; this.products.set([]);
    if (providerId !== null) this.loadProducts(providerId);
  }
  protected onProductChange(productId: number | null): void { if (!this.policyReady() || this.saving()) return; this.policy.fuelProductId = productId; if (productId === null) this.policy.autoGenerateEnabled = false; this.saved.set(false); }
  private loadProducts(providerId: number): void {
    const sequence = ++this.productsSequence; this.productsRequest?.unsubscribe();
    this.productsRequest = this.api.products(providerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { if (sequence === this.productsSequence && this.policy.providerId === providerId) this.products.set(rows); },
      error: e => { if (sequence === this.productsSequence && this.policy.providerId === providerId) this.error.set(apiError(e)); },
    });
  }

  ngOnInit(): void {
    this.api.providers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.providers.set(rows), error: (e) => this.error.set(apiError(e)) });
    this.api.tank(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (tank) => this.tank.set(tank), error: (e) => this.error.set(apiError(e)) });
    this.api.policy(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (policy) => { this.policy = { ...policy }; this.policyReady.set(true); if (policy.providerId !== null) this.loadProducts(policy.providerId); }, error: (e: HttpErrorResponse) => {
      if (e.status === 404) { this.policy = emptyPolicy(); this.policyReady.set(true); } else this.error.set(apiError(e));
    } });
    this.api.episodes(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ next: (rows) => this.episodes.set(rows), error: (e: HttpErrorResponse) => {
      if (e.status !== 404) this.error.set(apiError(e));
    } });
  }
  protected savePolicy(form: NgForm): void {
    if (!this.policyReady() || !this.tank() || this.saving()) return;
    if (this.policyInvalid()) {
      form.control.markAllAsTouched();
      const name = this.lowError() ? 'low' : this.hysteresisError() ? 'hysteresis' : 'target';
      this.host.nativeElement.querySelector<HTMLElement>(`input[name="${name}"]`)?.focus();
      return;
    }
    this.saving.set(true); this.saved.set(false); this.error.set('');
    this.api.savePolicy(this.id, { ...this.policy }).pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.saving.set(false))).subscribe({ next: (policy) => { this.policy = { ...policy }; this.saved.set(true); this.saving.set(false); }, error: (e) => { this.error.set(apiError(e)); this.saving.set(false); } });
  }
}
