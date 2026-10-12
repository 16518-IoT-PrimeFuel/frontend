import { Component, DestroyRef, ElementRef, TemplateRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { RefillPolicy, Site, Tank } from '../../../domain/model/equipment.entity';
import { SiteGeocoding, SiteLocation } from '../../../infrastructure/site-geocoding';
import { unitKey } from '../../../infrastructure/provider-equipment.api';
import { LocatedSite, TankMapCanvas, lockMapDialogScroll } from './tank-map-canvas';

@Component({
  selector: 'app-tank-map', standalone: true, providers: [SiteGeocoding],
  imports: [DecimalPipe, NgTemplateOutlet, TranslatePipe, MatButtonModule, MatIconModule, MatDialogModule, MatProgressBarModule, MatFormFieldModule, MatSelectModule, TankMapCanvas],
  template: `
    <section class="tank-map-panel" aria-labelledby="tank-map-title">
      <header class="map-header"><div><h2 id="tank-map-title">{{ 'equipment.map.title' | translate }}</h2>
        <p>{{ 'equipment.map.description' | translate }}</p></div>
        <button mat-stroked-button type="button" (click)="expand()"><mat-icon aria-hidden="true">open_in_full</mat-icon>{{ 'equipment.map.expand' | translate }}</button>
      </header>
      <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ expanded: false }"></ng-container>
    </section>

    <ng-template #modal>
      <div class="map-dialog-header"><h2 mat-dialog-title id="expanded-tank-map-title">{{ 'equipment.map.title' | translate }}</h2>
        <button mat-icon-button mat-dialog-close type="button" [aria-label]="'equipment.map.close' | translate"><mat-icon aria-hidden="true">close</mat-icon></button></div>
      <mat-dialog-content class="map-dialog-content">
        <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ expanded: true }"></ng-container>
      </mat-dialog-content>
    </ng-template>

    <ng-template #body let-expanded="expanded">
      <div class="map-body" [class.expanded]="expanded" [class.summary-hidden]="!showSummary()">
        <div class="map-area">
          <div class="city-tools"><mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'equipment.map.city' | translate }}</mat-label>
            <mat-select [value]="city" (selectionChange)="exploreCity($event.value)" [disabled]="locations.cityLoading()">
              @for (name of cities; track name) { <mat-option [value]="name">{{ name }}</mat-option> }
            </mat-select>
          </mat-form-field><p>{{ 'equipment.map.city-hint' | translate }}</p></div>
          @if (locations.cityLoading()) { <mat-progress-bar mode="indeterminate" [attr.aria-label]="'equipment.map.city-loading' | translate"></mat-progress-bar> }
          @if (locations.cityError()) { <p class="map-warning" role="alert">{{ 'equipment.map.city-error' | translate }} <button mat-button type="button" (click)="exploreCity(city)">{{ 'equipment.retry' | translate }}</button></p> }
          <div class="map-tools"><span>{{ 'equipment.map.located' | translate:{ n: points().length, total: groups().length } }}</span>
            <button mat-button type="button" [disabled]="!points().length" (click)="canvas.fit()"><mat-icon aria-hidden="true">center_focus_strong</mat-icon>{{ 'equipment.map.fit' | translate }}</button>
            <button mat-button type="button" [attr.aria-expanded]="showSummary()" [attr.aria-controls]="expanded ? 'expanded-map-sites' : 'map-sites'" (click)="showSummary.set(!showSummary())"><mat-icon aria-hidden="true">view_sidebar</mat-icon>{{ (showSummary() ? 'equipment.map.hide-sites' : 'equipment.map.show-sites') | translate }}</button></div>
          <app-tank-map-canvas #canvas [points]="points()" [selectedSite]="selectedSite()" [selectedTank]="selectedId()" [cityCenter]="locations.cityCenter()" (selectSite)="chooseSite($event)"></app-tank-map-canvas>
          @if (!points().length) {
            <div class="map-empty" role="status"><mat-icon aria-hidden="true">location_off</mat-icon>
              <strong>{{ (pending() || loading() ? 'equipment.map.locating' : !tanks().length ? 'equipment.map.no-tanks' : !visibleTanks().length ? 'equipment.map.filtered-empty' : 'equipment.map.no-locations') | translate }}</strong>
              <p>{{ 'equipment.map.empty-hint' | translate }}</p>
            </div>
          }
          @if (pending() || loading()) { <mat-progress-bar mode="indeterminate" [attr.aria-label]="'equipment.map.locating' | translate"></mat-progress-bar> }
          @if (errors()) { <p class="map-warning" role="alert">{{ 'equipment.map.geocoding-error' | translate }} <button mat-button type="button" (click)="retry()">{{ 'equipment.retry' | translate }}</button></p> }
          <p class="map-caption">{{ 'equipment.map.legend' | translate }}</p>
        </div>
        <aside class="map-summary" [id]="expanded ? 'expanded-map-sites' : 'map-sites'" [hidden]="!showSummary()" [attr.aria-label]="'equipment.map.sites' | translate">
          @if (groups().length) {
            <div class="map-site-list" role="group" [attr.aria-label]="'equipment.map.select-site' | translate">
              @for (group of groups(); track group.site.id) {
                <button type="button" class="site-choice" [attr.aria-pressed]="selectedSite() === group.site.id" (click)="chooseSite(group.site.id)">
                  <mat-icon aria-hidden="true">location_on</mat-icon><span><b>{{ group.site.name }}</b><small>{{ locationLabel(locations.locations()[group.site.id]) | translate }} · {{ 'equipment.map.tank-count' | translate:{ n: group.tanks.length } }}</small>
                    @if (deliverySites().includes(group.site.id)) { <small class="site-delivery">{{ 'equipment.map.delivery-today' | translate }}</small> }</span>
                </button>
              }
            </div>
          }
          @if (selectedGroup(); as group) {
            <div class="site-summary" aria-live="polite"><h3>{{ group.site.name }}</h3>
              @if (group.site.siteType) { <p>{{ (group.site.siteType === 'STATION' ? 'equipment.map.station' : 'equipment.map.tank-location') | translate }}</p> }
              @if (group.site.address) { <p>{{ group.site.address }}</p> }
              <p>{{ locationLabel(locations.locations()[group.site.id]) | translate }}</p>
              @if (locations.locations()[group.site.id]?.coordinates; as coordinates) {
                <p class="map-coordinates"><b>{{ (locations.locations()[group.site.id].state === 'approximate' ? 'equipment.map.approximate-coordinates' : 'equipment.map.coordinates') | translate }}</b><span>{{ coordinates[1] | number:'1.6-6' }}, {{ coordinates[0] | number:'1.6-6' }}</span></p>
              }
              @if (!group.tanks.length) { <p>{{ 'equipment.map.site-without-tanks' | translate }}</p> }
              <ul class="map-tanks">@for (tank of group.tanks; track tank.id) {
                <li><button type="button" class="tank-choice" [attr.aria-pressed]="selectedId() === tank.id" (click)="selectTank.emit(tank.id)">{{ tank.name }}</button>
                  <p>{{ tank.fuelType ? ('fuel-type.' + tank.fuelType.toLowerCase() | translate) : ('equipment.no-fuel' | translate) }} · {{ tank.capacity | number:'1.0-2' }} {{ unit(tank.unit) | translate }}</p>
                  <p>{{ 'equipment.current-level' | translate }}: {{ tank.currentLevel | number:'1.0-2' }} {{ unit(tank.unit) | translate }}
                    @if (policies()[tank.id]; as policy) { · {{ (tank.capacity > 0 && tank.currentLevel / tank.capacity * 100 <= policy.lowLevelPercent ? 'equipment.status-low' : 'equipment.status-ok') | translate }} }
                  </p>
                </li>
              }</ul>
            </div>
          } @else { <p class="map-hint">{{ 'equipment.map.select-hint' | translate }}</p> }
          @if (missingSiteCount()) { <p class="map-hint">{{ 'equipment.map.unlinked' | translate:{ n: missingSiteCount() } }}</p> }
        </aside>
      </div>
    </ng-template>`,
  styleUrl: './tank-map.css',
})
export class TankMap {
  readonly sites = input.required<Site[]>();
  readonly tanks = input.required<Tank[]>();
  readonly visibleTanks = input.required<Tank[]>();
  readonly selectedId = input<number | null>(null);
  readonly policies = input<Record<number, RefillPolicy | null>>({});
  readonly loading = input(false);
  readonly includeEmptySites = input(true);
  /** Sedes con una entrega en curso hoy: se resaltan en el mapa y en la lista. */
  readonly deliverySites = input<number[]>([]);
  readonly selectTank = output<number>();
  protected readonly locations = inject(SiteGeocoding);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly modal = viewChild.required<TemplateRef<unknown>>('modal');
  private dialogRef?: MatDialogRef<unknown>;
  protected readonly unit = unitKey;
  protected readonly cities = ['Lima', 'Arequipa', 'Trujillo', 'Chiclayo', 'Piura', 'Cusco', 'Huancayo', 'Iquitos', 'Tacna', 'Puno'];
  protected city = 'Lima';
  protected readonly showSummary = signal(true);
  private readonly focusedSite = signal<number | null>(null);
  protected readonly relevantSites = computed(() => this.sites());
  protected readonly groups = computed(() => this.relevantSites().map(site => ({ site,
    tanks: this.visibleTanks().filter(tank => tank.siteId === site.id && tank.customerAccountId === site.customerAccountId),
  })).filter(group => group.tanks.length || (this.includeEmptySites() && !this.tanks().some(tank => tank.siteId === group.site.id && tank.customerAccountId === group.site.customerAccountId))));
  protected readonly points = computed<LocatedSite[]>(() => this.groups().flatMap(group => {
    const location = this.locations.locations()[group.site.id];
    return location?.coordinates ? [{ site: group.site, count: group.tanks.length, delivery: this.deliverySites().includes(group.site.id),
      location: { ...location, coordinates: location.coordinates } }] : [];
  }));
  protected readonly selectedSite = computed(() => this.focusedSite() ?? this.visibleTanks().find(tank => tank.id === this.selectedId())?.siteId ?? null);
  protected readonly selectedGroup = computed(() => this.groups().find(group => group.site.id === this.selectedSite()));
  protected readonly pending = computed(() => Object.values(this.locations.locations()).some(location => location.state === 'loading'));
  protected readonly errors = computed(() => Object.values(this.locations.locations()).some(location => location.state === 'error'));
  protected readonly missingSiteCount = computed(() => this.visibleTanks().filter(tank => !this.groups().some(group => group.tanks.some(item => item.id === tank.id))).length);

  constructor() {
    void this.locations.exploreCity(this.city);
    effect(() => { this.selectedId(); untracked(() => this.focusedSite.set(null)); });
    effect(() => { void this.locations.locate(this.relevantSites()); });
    inject(DestroyRef).onDestroy(() => this.dialogRef?.close());
  }
  protected locationLabel(location?: SiteLocation): string { return location?.source === 'manual' ? 'equipment.map.manual-location' : `equipment.map.${location?.state ?? 'unavailable'}`; }
  protected chooseSite(id: number): void {
    this.showSummary.set(true);
    const tanks = this.groups().find(group => group.site.id === id)?.tanks;
    if (tanks?.length) { this.focusedSite.set(null); this.selectTank.emit(tanks.find(tank => tank.id === this.selectedId())?.id ?? tanks[0].id); }
    else this.focusedSite.set(id);
  }
  protected retry(): void { this.locations.retry(this.relevantSites()); }
  protected exploreCity(name: string): void { this.city = name; void this.locations.exploreCity(name); }
  protected expand(): void {
    if (this.dialogRef) return;
    this.dialogRef = this.dialog.open(this.modal(), { width: '1440px', maxWidth: '96vw', maxHeight: '96dvh',
      ariaLabelledBy: 'expanded-tank-map-title', autoFocus: 'first-heading', restoreFocus: true,
    });
    lockMapDialogScroll(this.host.nativeElement, this.dialogRef);
    this.dialogRef.afterClosed().subscribe(() => this.dialogRef = undefined);
  }
}
