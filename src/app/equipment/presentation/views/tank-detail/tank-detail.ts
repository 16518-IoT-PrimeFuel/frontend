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
import { EquipmentApi, apiError } from '../../../infrastructure/equipment.api';
import { RefillEpisode, RefillPolicy, Tank } from '../../../domain/model/equipment.entity';

const emptyPolicy = (): RefillPolicy => ({ lowLevelPercent: 20, hysteresisPercent: 10, targetLevelPercent: 100, providerId: null, fuelProductId: null, autoGenerateEnabled: false });

@Component({
  selector: 'app-tank-detail', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
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
          <mat-form-field><mat-label>{{ 'equipment.low-level' | translate }}</mat-label><input matInput type="number" min="0.01" max="100" name="low" [(ngModel)]="policy.lowLevelPercent" required></mat-form-field>
          <mat-form-field><mat-label>{{ 'equipment.hysteresis' | translate }}</mat-label><input matInput type="number" min="0.01" max="100" name="hysteresis" [(ngModel)]="policy.hysteresisPercent" required></mat-form-field>
          <mat-form-field><mat-label>{{ 'equipment.target-level' | translate }}</mat-label><input matInput type="number" min="0.01" max="100" name="target" [(ngModel)]="policy.targetLevelPercent" required></mat-form-field>
          <mat-form-field><mat-label>{{ 'equipment.provider-id' | translate }}</mat-label><input matInput type="number" min="1" name="provider" [(ngModel)]="policy.providerId"></mat-form-field>
          <mat-form-field><mat-label>{{ 'equipment.product-id' | translate }}</mat-label><input matInput type="number" min="1" name="product" [(ngModel)]="policy.fuelProductId"></mat-form-field>
          <label><input type="checkbox" name="auto" [(ngModel)]="policy.autoGenerateEnabled"> {{ 'equipment.auto-generate' | translate }}</label>
          <button mat-flat-button color="primary" [disabled]="policyForm.invalid || saving()">{{ 'equipment.save-policy' | translate }}</button>
        </form>
      </mat-card-content></mat-card>
      <mat-card><mat-card-header><mat-card-title>{{ 'equipment.episodes' | translate }}</mat-card-title></mat-card-header><mat-card-content>
        @for (episode of episodes(); track episode.id) { <p>{{ episode.status }} · {{ episode.openedAt | date:'medium' }} · {{ episode.openedLevelPercent }}% → {{ episode.targetLevel }} {{ episode.unit }} · {{ episode.requestEmitted ? ('equipment.request-emitted' | translate) : '' }}</p> }
        @if (!episodes().length) { <p>{{ 'equipment.no-episodes' | translate }}</p> }
      </mat-card-content></mat-card>
    </main>`,
  styles: [`.equipment-page{padding:1.5rem;max-width:900px;margin:auto}mat-card{margin:1rem 0}form{display:flex;flex-direction:column;gap:.25rem}mat-form-field{width:100%}`],
})
export class TankDetail implements OnInit {
  private readonly api = inject(EquipmentApi);
  private readonly id = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));
  protected readonly tank = signal<Tank | null>(null);
  protected readonly episodes = signal<RefillEpisode[]>([]);
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected policy = emptyPolicy();
  protected levelPercent(): number { const tank = this.tank(); return tank ? Math.max(0, Math.min(100, tank.currentLevel / tank.capacity * 100)) : 0; }

  ngOnInit(): void {
    this.api.tank(this.id).subscribe({ next: (tank) => this.tank.set(tank), error: (e) => this.error.set(apiError(e)) });
    this.api.policy(this.id).subscribe({ next: (policy) => this.policy = { ...policy }, error: (e: HttpErrorResponse) => {
      if (e.status === 404) this.policy = emptyPolicy(); else this.error.set(apiError(e));
    } });
    this.api.episodes(this.id).subscribe({ next: (rows) => this.episodes.set(rows), error: (e: HttpErrorResponse) => {
      if (e.status !== 404) this.error.set(apiError(e));
    } });
  }
  protected savePolicy(): void {
    this.saving.set(true); this.error.set('');
    this.api.savePolicy(this.id, this.policy).subscribe({ next: (policy) => { this.policy = { ...policy }; this.saving.set(false); }, error: (e) => { this.error.set(apiError(e)); this.saving.set(false); } });
  }
}
