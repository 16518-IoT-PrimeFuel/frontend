import { Component, ElementRef, effect, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule, NgForm } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { TranslatePipe } from '@ngx-translate/core';
import { EquipmentStore } from '../../../application/equipment.store';
import { SiteType } from '../../../domain/model/equipment.entity';
import { SiteGeocoding } from '../../../infrastructure/site-geocoding';
import { TankMapCanvas } from './tank-map-canvas';

@Component({
  selector: 'app-site-location-dialog', standalone: true, providers: [SiteGeocoding],
  imports: [DecimalPipe, FormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatIconModule, MatSelectModule, TranslatePipe, TankMapCanvas],
  template: `
    <div class="dialog-header"><h2 mat-dialog-title>{{ 'equipment.map.add-location' | translate }}</h2>
      <button mat-icon-button type="button" [disabled]="store.creatingSite()" (click)="close()" [attr.aria-label]="'equipment.map.close' | translate"><mat-icon aria-hidden="true">close</mat-icon></button></div>
    <mat-dialog-content>
      <p id="site-location-help" class="dialog-help"><mat-icon aria-hidden="true">info</mat-icon>{{ 'equipment.map.create-help' | translate }}</p>
      <form id="site-location-form" #form="ngForm" (ngSubmit)="save(form)" class="site-location-form" aria-describedby="site-location-help">
        <mat-form-field appearance="outline"><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="siteName" [(ngModel)]="name" required maxlength="150" [disabled]="store.creatingSite()"><mat-error>{{ 'validation.required' | translate }}</mat-error></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>{{ 'equipment.map.site-type' | translate }}</mat-label><mat-select name="siteType" [(ngModel)]="siteType" required [disabled]="store.creatingSite()"><mat-option value="TANK_LOCATION">{{ 'equipment.map.tank-location' | translate }}</mat-option><mat-option value="STATION">{{ 'equipment.map.station' | translate }}</mat-option></mat-select></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="address"><mat-label>{{ 'equipment.address' | translate }}</mat-label><input matInput name="siteAddress" [(ngModel)]="address" maxlength="255" [disabled]="store.creatingSite()"><mat-hint>{{ 'equipment.map.address-hint' | translate }}</mat-hint></mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic"><mat-label>{{ 'equipment.map.city' | translate }}</mat-label><mat-select [value]="city" (selectionChange)="exploreCity($event.value)" [disabled]="locations.cityLoading() || store.creatingSite()">@for (name of cities; track name) { <mat-option [value]="name">{{ name }}</mat-option> }</mat-select></mat-form-field>
        <p class="point-help">{{ 'equipment.map.pick-help' | translate }}</p>
      </form>
      @if (locations.cityError()) { <p role="alert">{{ 'equipment.map.city-error' | translate }}</p> }
      <app-tank-map-canvas [points]="[]" [picking]="!store.creatingSite()" [point]="point()" [cityCenter]="locations.cityCenter()" (choosePoint)="pick($event)"></app-tank-map-canvas>
      <p class="point-status" aria-live="polite">@if (point(); as p) { {{ 'equipment.map.chosen-point' | translate }}: {{ p[1] | number:'1.6-6' }}, {{ p[0] | number:'1.6-6' }} } @else { {{ 'equipment.map.no-point' | translate }} }</p>
      @if (attempted() && !point()) { <p role="alert" class="dialog-error">{{ 'equipment.map.point-required' | translate }}</p> }
      @if (attempted() && store.error()) { <p role="alert" class="dialog-error">{{ store.error() | translate }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end"><button mat-button type="button" [disabled]="store.creatingSite()" (click)="close()">{{ 'request-form.cancel' | translate }}</button><button mat-flat-button type="submit" form="site-location-form" [disabled]="store.creatingSite()">{{ 'equipment.add-site' | translate }}</button></mat-dialog-actions>`,
  styles: [`:host{display:block}.dialog-header{display:flex;align-items:center;justify-content:space-between;padding-right:12px}.dialog-header h2{margin:0}.dialog-help{display:flex;gap:10px;line-height:1.6;color:#4b5563;font-size:.875rem}.dialog-help mat-icon{flex:none;color:#1e3a8a}.site-location-form{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}.address{grid-column:1/-1}.point-help{font-size:.8125rem;line-height:1.6;color:#4b5563}.point-status{font-size:.875rem;font-variant-numeric:tabular-nums}.dialog-error{color:#991b1b;font-size:.875rem}app-tank-map-canvas{height:min(44dvh,440px)}mat-dialog-content{max-height:calc(96dvh - 145px)}@media(max-width:600px){.site-location-form{grid-template-columns:minmax(0,1fr)}.address{grid-column:auto}app-tank-map-canvas{height:38dvh}}`],
})
export class SiteLocationDialog {
  protected readonly store = inject<{ store: EquipmentStore }>(MAT_DIALOG_DATA).store;
  protected readonly locations = inject(SiteGeocoding);
  private readonly ref = inject(MatDialogRef<SiteLocationDialog>);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly point = signal<[number, number] | null>(null);
  protected readonly attempted = signal(false);
  protected readonly cities = ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco', 'Huancayo', 'Iquitos', 'Tacna', 'Puno'];
  protected city = 'Lima';
  protected name = '';
  protected address = '';
  protected siteType: SiteType = 'TANK_LOCATION';
  constructor() {
    void this.locations.exploreCity(this.city);
    effect(() => this.ref.disableClose = this.store.creatingSite());
  }
  protected exploreCity(name: string): void { this.city = name; void this.locations.exploreCity(name); }
  protected pick(point: [number, number]): void { if (!this.store.creatingSite()) this.point.set(point); }
  protected close(): void { if (!this.store.creatingSite()) this.ref.close(); }
  protected save(form: NgForm): void {
    this.attempted.set(true); form.control.markAllAsTouched();
    if (form.invalid || !this.name.trim()) { this.host.nativeElement.querySelector<HTMLInputElement>('input[name="siteName"]')?.focus(); return; }
    const point = this.point();
    if (!point || this.store.creatingSite()) return;
    // Protect an in-flight creation from Escape/backdrop dismissal as well as button dismissal.
    this.ref.disableClose = true;
    this.store.createSite({ name: this.name.trim(), address: this.address.trim(), siteType: this.siteType,
      latitude: point[1], longitude: point[0] }, () => this.ref.close(true));
  }
}
