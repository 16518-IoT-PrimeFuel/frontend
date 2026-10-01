import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { EquipmentStore } from '../../../application/equipment.store';
import { Tank } from '../../../domain/model/equipment.entity';
import { FUEL_TYPES } from '../../../../inventory/domain/model/fuel-product.entity';

const emptyTank = () => ({ name: '', siteId: null as number | null, fuelType: '', capacity: 0, unit: 'LITERS', initialLevel: 0 });

@Component({
  selector: 'app-tank-list', standalone: true, providers: [EquipmentStore],
  imports: [FormsModule, RouterLink, TranslatePipe, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  template: `
    <main class="equipment-page">
      <header class="page-head">
        <h1>{{ 'equipment.title' | translate }}</h1>
        <button mat-flat-button color="primary" type="button" [disabled]="!store.customer()" [attr.aria-expanded]="formOpen()" aria-controls="tank-form" (click)="formOpen.set(!formOpen())">{{ 'equipment.add-tank' | translate }}</button>
      </header>
      @if (store.error()) { <p class="error" role="alert">{{ store.error() | translate }}</p> }
      @if (store.loading()) { <mat-progress-bar mode="indeterminate" [attr.aria-label]="'equipment.loading' | translate"></mat-progress-bar> }

      @if (formOpen() && store.customer()) {
        <mat-card id="tank-form"><mat-card-header><mat-card-title>{{ 'equipment.add-tank' | translate }}</mat-card-title></mat-card-header><mat-card-content>
          <form #tankForm="ngForm" (ngSubmit)="addTank(tankForm)" class="tank-form">
            <mat-form-field><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="tankName" [(ngModel)]="tank.name" required maxlength="150"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.site' | translate }}</mat-label><mat-select name="siteId" [(ngModel)]="tank.siteId"><mat-option [value]="null">—</mat-option>@for (site of store.sites(); track site.id) { <mat-option [value]="site.id">{{ site.name }}</mat-option> }</mat-select></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.fuel-type' | translate }}</mat-label><mat-select name="fuelType" [(ngModel)]="tank.fuelType"><mat-option value="">—</mat-option>@for (type of fuelTypes; track type) { <mat-option [value]="type">{{ 'fuel-type.' + type.toLowerCase() | translate }}</mat-option> }</mat-select></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.capacity' | translate }}</mat-label><input matInput type="number" min="0.01" name="capacity" [(ngModel)]="tank.capacity" required></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.unit' | translate }}</mat-label><mat-select name="unit" [(ngModel)]="tank.unit" required><mat-option value="LITERS">{{ 'unit.liters' | translate }}</mat-option><mat-option value="GALLONS">{{ 'unit.gallons' | translate }}</mat-option></mat-select></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.initial-level' | translate }}</mat-label><input matInput type="number" min="0" [max]="tank.capacity" name="initialLevel" [(ngModel)]="tank.initialLevel"></mat-form-field>
            <div class="actions"><button mat-button type="button" (click)="formOpen.set(false)">{{ 'request-form.cancel' | translate }}</button><button mat-flat-button color="primary" [disabled]="tankForm.invalid || store.creatingTank()">{{ 'equipment.create-tank' | translate }}</button></div>
          </form>
        </mat-card-content></mat-card>
      }

      <section aria-labelledby="tanks-heading">
        <h2 id="tanks-heading" class="sr-only">{{ 'equipment.tanks' | translate }}</h2>
        <ul class="tank-grid">
          @for (item of store.tanks(); track item.id) {
            <li><mat-card><mat-card-header><mat-card-title><a [routerLink]="[item.id]">{{ item.name }}</a></mat-card-title>
              <mat-card-subtitle>{{ item.fuelType ? ('fuel-type.' + item.fuelType.toLowerCase() | translate) : '—' }}</mat-card-subtitle></mat-card-header>
              <mat-card-content>
                <dl class="facts">
                  <div><dt>{{ 'equipment.capacity' | translate }}</dt><dd>{{ item.capacity }} {{ unitKey(item) | translate }}</dd></div>
                  <div><dt>{{ 'equipment.current-level' | translate }}</dt><dd>{{ item.currentLevel }} {{ unitKey(item) | translate }} · {{ percent(item) }}%</dd></div>
                </dl>
                <mat-progress-bar mode="determinate" [value]="percent(item)" [attr.aria-label]="('equipment.current-level' | translate) + ' ' + percent(item) + '%'"></mat-progress-bar>
              </mat-card-content>
              <mat-card-actions><a mat-button [routerLink]="[item.id]">{{ 'equipment.details' | translate }}</a></mat-card-actions>
            </mat-card></li>
          }
        </ul>
        @if (!store.loading() && !store.tanks().length && !store.error()) { <p>{{ 'equipment.no-tanks' | translate }}</p> }
      </section>

      <mat-card><mat-card-header><mat-card-title>{{ 'equipment.sites' | translate }}</mat-card-title><mat-card-subtitle>{{ 'equipment.sites-hint' | translate }}</mat-card-subtitle></mat-card-header><mat-card-content>
        <ul class="site-list">@for (site of store.sites(); track site.id) { <li>{{ site.name }} @if (site.address) { <small>· {{ site.address }}</small> }</li> }</ul>
        @if (store.customer() && !store.sites().length) { <p>{{ 'equipment.no-sites' | translate }}</p> }
        @if (store.customer()) {
          <form #siteForm="ngForm" (ngSubmit)="addSite(siteForm)" class="site-form">
            <mat-form-field><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="siteName" [(ngModel)]="site.name" required maxlength="150"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.address' | translate }}</mat-label><input matInput name="siteAddress" [(ngModel)]="site.address"></mat-form-field>
            <button mat-stroked-button [disabled]="siteForm.invalid || store.creatingSite()">{{ 'equipment.add-site' | translate }}</button>
          </form>
        }
      </mat-card-content></mat-card>
      <p>{{ 'equipment.device-pending' | translate }}</p>
    </main>`,
  styles: [`
    .equipment-page{padding:1.5rem;max-width:1100px;margin:auto;display:flex;flex-direction:column;gap:1rem}
    .page-head{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between}
    .page-head h1{margin:0}
    .tank-grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1rem}
    .facts{margin:.5rem 0;display:grid;gap:.25rem}.facts div{display:flex;justify-content:space-between;gap:.5rem}.facts dt{opacity:.75}.facts dd{margin:0;font-weight:500}
    .tank-form,.site-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.25rem 1rem;align-items:start}
    .actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:.5rem}
    .site-list{margin:0 0 .5rem;padding-left:1.25rem}
    .error{color:#b3261e}
    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    mat-form-field{width:100%}a{color:inherit}
  `],
})
export class TankList implements OnInit {
  protected readonly store = inject(EquipmentStore);
  protected readonly formOpen = signal(false);
  protected site = { name: '', address: '' };
  protected tank = emptyTank();
  protected readonly fuelTypes = FUEL_TYPES;

  ngOnInit(): void { this.store.load(); }
  protected percent(tank: Tank): number { return tank.capacity > 0 ? Math.min(100, Math.max(0, Math.round(tank.currentLevel / tank.capacity * 100))) : 0; }
  protected unitKey(tank: Tank): string { return `unit.${(tank.unit ?? 'liters').toLowerCase()}`; }
  protected addSite(form: NgForm): void { if (form.invalid) return; this.store.createSite({ ...this.site }, () => { this.site = { name: '', address: '' }; form.resetForm(this.site); }); }
  protected addTank(form: NgForm): void {
    if (form.invalid) return;
    this.store.createTank({ ...this.tank }, () => { this.tank = emptyTank(); this.formOpen.set(false); });
  }
}
