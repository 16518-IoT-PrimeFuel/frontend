import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
        <form #policyForm="ngForm" (ngSubmit)="savePolicy()">
          <mat-form-field><mat-label>{{ 'equipment.low-level' | translate }}</mat-label><input matInput type="number" step="any" name="low" [(ngModel)]="policy.lowLevelPercent" required></mat-form-field>
          @if (lowError()) { <small class="field-error" role="alert">{{ lowError() | translate }}</small> }
          <mat-form-field><mat-label>{{ 'equipment.hysteresis' | translate }}</mat-label><input matInput type="number" step="any" name="hysteresis" [(ngModel)]="policy.hysteresisPercent" required></mat-form-field>
          @if (hysteresisError()) { <small class="field-error" role="alert">{{ hysteresisError() | translate }}</small> }
          <mat-form-field><mat-label>{{ 'equipment.target-level' | translate }}</mat-label><input matInput type="number" step="any" name="target" [(ngModel)]="policy.targetLevelPercent" required></mat-form-field>
          @if (targetError()) { <small class="field-error" role="alert">{{ targetError() | translate }}</small> }
          <mat-form-field><mat-label>{{ 'equipment.provider' | translate }}</mat-label><mat-select name="provider" [ngModel]="policy.providerId" (ngModelChange)="onProviderChange($event)"><mat-option [value]="null">{{ 'equipment.not-set' | translate }}</mat-option>@for (provider of providers(); track provider.id) { <mat-option [value]="provider.id">{{ provider.name }}</mat-option> }</mat-select></mat-form-field>
          <mat-form-field><mat-label>{{ 'equipment.product' | translate }}</mat-label><mat-select name="product" [(ngModel)]="policy.fuelProductId" [disabled]="policy.providerId === null"><mat-option [value]="null">{{ 'equipment.not-set' | translate }}</mat-option>@for (product of products(); track product.id) { <mat-option [value]="product.id">{{ product.name }} ({{ 'fuel-type.' + product.fuelType.toLowerCase() | translate }})</mat-option> }</mat-select></mat-form-field>
          <label><input type="checkbox" name="auto" [(ngModel)]="policy.autoGenerateEnabled" [disabled]="policy.providerId === null || policy.fuelProductId === null"> {{ 'equipment.auto-generate' | translate }}</label>
          @if (policy.providerId === null || policy.fuelProductId === null) { <small>{{ 'equipment.auto-needs-both' | translate }}</small> }
          <button mat-flat-button color="primary" [disabled]="policyForm.invalid || policyInvalid() || saving()">{{ 'equipment.save-policy' | translate }}</button>
          @if (saved()) { <p role="status">{{ 'equipment.policy-saved' | translate }}</p> }
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
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly tank = signal<Tank | null>(null);
  protected readonly episodes = signal<RefillEpisode[]>([]);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly providers = signal<{ id: number; name: string }[]>([]);
  protected readonly products = signal<{ id: number; name: string; fuelType: string }[]>([]);
  protected policy = emptyPolicy();
  protected levelPercent(): number { const tank = this.tank(); return tank ? Math.max(0, Math.min(100, tank.currentLevel / tank.capacity * 100)) : 0; }

  /** Reglas de RefillThresholds y RefillPolicy del backend: bajo (0,100), histéresis > 0, bajo + histéresis <= 100, objetivo (0,100]. */
  protected lowError(): string { const v = this.policy.lowLevelPercent; return v != null && (v <= 0 || v >= 100) ? 'equipment.err-low-range' : ''; }
  protected hysteresisError(): string {
    const { lowLevelPercent: low, hysteresisPercent: hyst } = this.policy;
    if (hyst != null && hyst <= 0) return 'equipment.err-hysteresis-positive';
    return low != null && hyst != null && low + hyst > 100 ? 'equipment.err-low-plus-hysteresis' : '';
  }
  protected targetError(): string { const v = this.policy.targetLevelPercent; return v != null && (v <= 0 || v > 100) ? 'equipment.err-target-range' : ''; }
  protected policyInvalid(): boolean { return !!(this.lowError() || this.hysteresisError() || this.targetError()); }
  protected onProviderChange(providerId: number | null): void {
    this.policy.providerId = providerId; this.policy.fuelProductId = null; this.policy.autoGenerateEnabled = false; this.products.set([]);
    if (providerId !== null) this.loadProducts(providerId);
  }
  private loadProducts(providerId: number): void { this.api.products(providerId).subscribe({ next: (rows) => this.products.set(rows), error: (e) => this.error.set(apiError(e)) }); }

  ngOnInit(): void {
    this.api.providers().subscribe({ next: (rows) => this.providers.set(rows), error: (e) => this.error.set(apiError(e)) });
    this.api.tank(this.id).subscribe({ next: (tank) => this.tank.set(tank), error: (e) => this.error.set(apiError(e)) });
    this.api.policy(this.id).subscribe({ next: (policy) => { this.policy = { ...policy }; if (policy.providerId !== null) this.loadProducts(policy.providerId); }, error: (e: HttpErrorResponse) => {
      if (e.status === 404) this.policy = emptyPolicy(); else this.error.set(apiError(e));
    } });
    this.api.episodes(this.id).subscribe({ next: (rows) => this.episodes.set(rows), error: (e: HttpErrorResponse) => {
      if (e.status !== 404) this.error.set(apiError(e));
    } });
  }
  protected savePolicy(): void {
    this.saving.set(true); this.saved.set(false); this.error.set('');
    this.api.savePolicy(this.id, this.policy).subscribe({ next: (policy) => { this.policy = { ...policy }; this.saved.set(true); this.saving.set(false); }, error: (e) => { this.error.set(apiError(e)); this.saving.set(false); } });
  }
}
