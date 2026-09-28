import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EquipmentStore } from '../../../application/equipment.store';

@Component({
  selector: 'app-tank-list', standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <main class="equipment-page">
      <h1>{{ 'equipment.title' | translate }}</h1>
      @if (store.error()) { <p role="alert">{{ store.error() | translate }}</p> }
      <section class="equipment-grid">
        <mat-card><mat-card-header><mat-card-title>{{ 'equipment.customers' | translate }}</mat-card-title></mat-card-header><mat-card-content>
          <form #customerForm="ngForm" (ngSubmit)="addCustomer()">
            <mat-form-field><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="customerName" [(ngModel)]="customer.name" required maxlength="150"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.ruc' | translate }}</mat-label><input matInput name="ruc" [(ngModel)]="customer.ruc" maxlength="11" pattern="[0-9]{11}"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.address' | translate }}</mat-label><input matInput name="customerAddress" [(ngModel)]="customer.address"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.email' | translate }}</mat-label><input matInput type="email" name="email" [(ngModel)]="customer.contactEmail"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.phone' | translate }}</mat-label><input matInput name="phone" [(ngModel)]="customer.phone"></mat-form-field>
            <button mat-flat-button color="primary" [disabled]="customerForm.invalid">{{ 'equipment.add-customer' | translate }}</button>
          </form>
          @for (customer of store.customers(); track customer.id) {
            <button mat-button (click)="selectCustomer(customer.id)" [attr.aria-pressed]="selectedCustomerId === customer.id">{{ customer.name }}</button>
          } @empty { <p>{{ 'equipment.no-customers' | translate }}</p> }
        </mat-card-content></mat-card>
        <mat-card><mat-card-header><mat-card-title>{{ 'equipment.sites' | translate }}</mat-card-title></mat-card-header><mat-card-content>
          @if (selectedCustomerId !== null) {
            <form #siteForm="ngForm" (ngSubmit)="addSite()">
              <mat-form-field><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="siteName" [(ngModel)]="site.name" required maxlength="150"></mat-form-field>
              <mat-form-field><mat-label>{{ 'equipment.address' | translate }}</mat-label><input matInput name="siteAddress" [(ngModel)]="site.address"></mat-form-field>
              <button mat-flat-button color="primary" [disabled]="siteForm.invalid">{{ 'equipment.add-site' | translate }}</button>
            </form>
            @for (site of store.sites(); track site.id) { <p>{{ site.name }} <small>{{ site.address }}</small></p> }
            @if (!store.sites().length) { <p>{{ 'equipment.no-sites' | translate }}</p> }
          } @else { <p>{{ 'equipment.select-customer' | translate }}</p> }
        </mat-card-content></mat-card>
      </section>
      <mat-card><mat-card-header><mat-card-title>{{ 'equipment.add-tank' | translate }}</mat-card-title></mat-card-header><mat-card-content>
        @if (selectedCustomerId !== null) {
          <form #tankForm="ngForm" (ngSubmit)="addTank()">
            <mat-form-field><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="tankName" [(ngModel)]="tank.name" required maxlength="150"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.site' | translate }}</mat-label><mat-select name="siteId" [(ngModel)]="tank.siteId"><mat-option [value]="null">—</mat-option>@for (site of store.sites(); track site.id) { <mat-option [value]="site.id">{{ site.name }}</mat-option> }</mat-select></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.fuel-type' | translate }}</mat-label><input matInput name="fuelType" [(ngModel)]="tank.fuelType"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.capacity' | translate }}</mat-label><input matInput type="number" min="0.01" name="capacity" [(ngModel)]="tank.capacity" required></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.unit' | translate }}</mat-label><input matInput name="unit" [(ngModel)]="tank.unit"></mat-form-field>
            <mat-form-field><mat-label>{{ 'equipment.initial-level' | translate }}</mat-label><input matInput type="number" min="0" [max]="tank.capacity" name="initialLevel" [(ngModel)]="tank.initialLevel"></mat-form-field>
            <button mat-flat-button color="primary" [disabled]="tankForm.invalid">{{ 'equipment.create-tank' | translate }}</button>
          </form>
        } @else { <p>{{ 'equipment.select-customer' | translate }}</p> }
        <h2>{{ 'equipment.tanks' | translate }}</h2>
        @for (item of customerTanks; track item.id) { <p><a [routerLink]="[item.id]">{{ item.name }}</a> · {{ item.currentLevel }} / {{ item.capacity }} {{ item.unit }}</p> }
        @if (!customerTanks.length) { <p>{{ 'equipment.no-tanks' | translate }}</p> }
      </mat-card-content></mat-card>
      <p>{{ 'equipment.device-pending' | translate }}</p>
    </main>`,
  styles: [`.equipment-page{padding:1.5rem;max-width:1100px;margin:auto}.equipment-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem}mat-card{margin-bottom:1rem}form{display:flex;flex-direction:column;gap:.25rem}mat-form-field{width:100%}a{color:inherit}`],
})
export class TankList implements OnInit {
  protected readonly store = inject(EquipmentStore);
  protected selectedCustomerId: number | null = null;
  protected customer = { name: '', ruc: '', address: '', contactEmail: '', phone: '' };
  protected site = { name: '', address: '' };
  protected tank = { name: '', siteId: null as number | null, fuelType: '', capacity: 0, unit: 'L', initialLevel: 0 };
  protected get customerTanks() { return this.store.tanks().filter((tank) => tank.customerAccountId === this.selectedCustomerId); }

  ngOnInit(): void { this.store.load(); }
  protected selectCustomer(id: number): void { this.selectedCustomerId = id; this.store.loadSites(id); }
  protected addCustomer(): void { this.store.createCustomer({ ...this.customer }); this.customer = { name: '', ruc: '', address: '', contactEmail: '', phone: '' }; }
  protected addSite(): void { if (this.selectedCustomerId === null) return; this.store.createSite(this.selectedCustomerId, this.site); this.site = { name: '', address: '' }; }
  protected addTank(): void {
    if (this.selectedCustomerId === null) return;
    this.store.createTank({ customerAccountId: this.selectedCustomerId, ...this.tank });
    this.tank = { name: '', siteId: null, fuelType: '', capacity: 0, unit: 'L', initialLevel: 0 };
  }
}
