import { Component, DestroyRef, ElementRef, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { map } from 'rxjs';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ChartData, ChartOptions } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { EquipmentStore } from '../../../application/equipment.store';
import { Site, Tank } from '../../../domain/model/equipment.entity';
import { unitKey } from '../../../infrastructure/provider-equipment.api';
import { REFILL_POLICY_DIALOG_CONFIG, RefillPolicyDialog } from '../refill-policy-dialog/refill-policy-dialog';
import { FUEL_TYPES } from '../../../../inventory/domain/model/fuel-product.entity';

import { TankMap } from './tank-map';
import { SiteLocationDialog } from './site-location-dialog';
import { lockMapDialogScroll } from './tank-map-canvas';

type Filter = 'all' | 'low' | 'ok';

const emptyTank = () => ({ name: '', siteId: null as number | null, fuelType: '', capacity: 0, unit: 'LITERS', initialLevel: 0 });

@Component({
  selector: 'app-tank-list', standalone: true, providers: [EquipmentStore],
  imports: [TankMap, BaseChartDirective, DatePipe, DecimalPipe, FormsModule, RouterLink, TranslatePipe, MatIconModule, MatButtonModule, MatTabsModule, MatFormFieldModule, MatInputModule, MatProgressBarModule, MatSelectModule],
  template: `
    <main class="tk">
      @if (store.error()) { <p class="dl-error tk-error" role="alert"><span>{{ store.error() | translate }}</span><button mat-button type="button" (click)="store.load()">{{ 'equipment.retry' | translate }}</button></p> }
      @if (store.loading() || store.tanksLoading()) { <mat-progress-bar mode="indeterminate" [attr.aria-label]="'equipment.loading' | translate"></mat-progress-bar> }

          <header class="tk-head">
            <h1 id="tanks-heading">{{ 'equipment.title' | translate }}</h1>
            <button mat-flat-button color="primary" type="button" [disabled]="!store.customer()" [attr.aria-expanded]="formOpen()" aria-controls="tank-form" (click)="formOpen.set(!formOpen())"><mat-icon aria-hidden="true">add</mat-icon>{{ 'equipment.add-tank' | translate }}</button>
          </header>

      <div class="tk-split" [class.picked]="selectedId() !== null" [class.solo]="!store.tanks().length">
        <section class="tk-list" aria-labelledby="tanks-heading">
          @if (formOpen() && store.customer()) {
            <section id="tank-form" class="tk-panel"><h2>{{ 'equipment.add-tank' | translate }}</h2>
              <form #tankForm="ngForm" (ngSubmit)="addTank(tankForm)" class="tank-form">
                <mat-form-field><mat-label>{{ 'equipment.name' | translate }}</mat-label><input matInput name="tankName" [(ngModel)]="tank.name" required maxlength="150"><mat-error>{{ 'validation.required' | translate }}</mat-error></mat-form-field>
                <mat-form-field><mat-label>{{ 'equipment.site' | translate }}</mat-label><mat-select name="siteId" [(ngModel)]="tank.siteId"><mat-option [value]="null">—</mat-option>@for (site of store.sites(); track site.id) { <mat-option [value]="site.id">{{ site.name }}</mat-option> }</mat-select></mat-form-field>
                <mat-form-field><mat-label>{{ 'equipment.fuel-type' | translate }}</mat-label><mat-select name="fuelType" [(ngModel)]="tank.fuelType"><mat-option value="">—</mat-option>@for (type of fuelTypes; track type) { <mat-option [value]="type">{{ 'fuel-type.' + type.toLowerCase() | translate }}</mat-option> }</mat-select></mat-form-field>
                <mat-form-field><mat-label>{{ 'equipment.capacity' | translate }}</mat-label><input matInput type="number" min="0.01" name="capacity" #capacity="ngModel" [(ngModel)]="tank.capacity" required><mat-error>{{ (capacity.hasError('required') ? 'validation.required' : 'validation.min-value') | translate:{ n: 0.01 } }}</mat-error></mat-form-field>
                <mat-form-field><mat-label>{{ 'equipment.unit' | translate }}</mat-label><mat-select name="unit" [(ngModel)]="tank.unit" required><mat-option value="LITERS">{{ 'unit.liters' | translate }}</mat-option><mat-option value="GALLONS">{{ 'unit.gallons' | translate }}</mat-option></mat-select><mat-error>{{ 'validation.required' | translate }}</mat-error></mat-form-field>
                <mat-form-field><mat-label>{{ 'equipment.initial-level' | translate }}</mat-label><input matInput type="number" min="0" [max]="tank.capacity" name="initialLevel" #initialLevel="ngModel" [(ngModel)]="tank.initialLevel"><mat-error>{{ (initialLevel.hasError('min') ? 'validation.min-value' : 'equipment.err-initial-level') | translate:{ n: 0 } }}</mat-error></mat-form-field>
                <div class="actions"><button mat-button type="button" (click)="formOpen.set(false)">{{ 'request-form.cancel' | translate }}</button><button mat-flat-button color="primary" [disabled]="store.creatingTank()">{{ 'equipment.create-tank' | translate }}</button></div>
              </form>
            </section>
          }


          @if (store.tanks().length) {
            <div class="dl-chips" role="group" [attr.aria-label]="'equipment.tanks' | translate">
              @for (option of filters; track option.id) {
                <button type="button" class="dl-chip" [attr.aria-pressed]="filter() === option.id" (click)="filter.set(option.id)">{{ option.label | translate }} <span>{{ count(option.id) }}</span></button>
              }
            </div>
            <ul class="tk-cards">
              @for (item of visible(); track item.id) {
                <li><a class="tk-card" [routerLink]="[]" [queryParams]="{ tank: item.id }" [attr.aria-current]="shown()?.id === item.id ? 'true' : null">
                  <span class="tk-card-top"><span><small>{{ 'equipment.card-label' | translate }}</small><strong>{{ item.name }}</strong></span><img src="/tank-placeholder.webp" alt="" width="1400" height="574"></span>
                  <span class="tk-row"><mat-icon aria-hidden="true">location_on</mat-icon><span><b>{{ siteOf(item)?.name ?? ('equipment.no-site' | translate) }}</b>@if (siteOf(item)?.address; as address) { <small>{{ address }}</small> }</span></span>
                  <span class="tk-row"><mat-icon aria-hidden="true">local_gas_station</mat-icon><span><b>{{ item.fuelType ? ('fuel-type.' + item.fuelType.toLowerCase() | translate) : ('equipment.no-fuel' | translate) }}</b><small>{{ item.capacity | number:'1.0-2' }} {{ unit(item.unit) | translate }}</small></span></span>
                  <span class="tk-card-foot"><small>{{ 'equipment.current-level' | translate }}</small>
                    <span class="tk-card-level"><b>{{ percent(item) }} %</b>@if (store.policies()[item.id]) { <span class="dl-badge" [class]="isLow(item) ? 'st-pending' : 'st-paid'">{{ (isLow(item) ? 'equipment.status-low' : 'equipment.status-ok') | translate }}</span> }</span>
                    <span class="tk-bar" [class.low]="isLow(item)" aria-hidden="true"><span [style.width.%]="percent(item)"></span></span>
                  </span>
                </a></li>
              }
            </ul>
            @if (!visible().length) { <p class="tk-muted">{{ 'equipment.filter-empty' | translate }}</p> }
          } @else if (!store.loading() && !store.tanksLoading() && !store.error()) {
            <div class="dl-empty"><p><strong>{{ 'equipment.no-tanks' | translate }}</strong></p><p>{{ 'equipment.empty-hint' | translate }}</p></div>
          }
        </section>

        @if (store.tanks().length) {
          <section class="tk-detail" aria-live="polite">
            <a class="tk-back" [routerLink]="[]"><mat-icon aria-hidden="true">arrow_back</mat-icon>{{ 'equipment.back-to-list' | translate }}</a>
            @if (shown(); as item) {
              <header class="tk-detail-head">
                <div class="tk-title"><h2>{{ item.name }}</h2>
                  @if (store.policies()[item.id]) { <span class="tk-status" [class.low]="isLow(item)">{{ (isLow(item) ? 'equipment.status-low' : 'equipment.status-ok') | translate }}</span> }
                </div>
                <div class="tk-actions">
                  <button mat-stroked-button type="button" (click)="editPolicy(item)"><mat-icon aria-hidden="true">tune</mat-icon>{{ 'equipment.manage-policy' | translate }}</button>
                  <a mat-flat-button color="primary" routerLink="/ordering/request-form" [queryParams]="{ tankId: item.id }"><mat-icon aria-hidden="true">local_shipping</mat-icon>{{ 'equipment.request-refill' | translate }}</a>
                </div>
              </header>
              <mat-tab-group animationDuration="0ms" mat-stretch-tabs="false">
                <mat-tab [label]="'equipment.tab-level' | translate">
                  <div class="tk-tab" [class.low]="isLow(item)">
                    <h3>{{ 'equipment.fuel-level' | translate }}</h3>
                    <div class="tk-stage"><div class="tk-gauge" role="img" [attr.aria-label]="'equipment.gauge-label' | translate:{ name: item.name, percent: percent(item), level: item.currentLevel, capacity: item.capacity, unit: (unit(item.unit) | translate) }">
                      <img src="/tank-placeholder.webp" alt="" width="1400" height="574">
                      <div class="tk-load">
                        <span class="fuel" [style.width.%]="percent(item)"></span>
                        @if (store.policies()[item.id]; as policy) { <span class="low-mark" [style.left.%]="policy.lowLevelPercent"></span> }
                        <span class="pct" [class.out]="percent(item) < 22" [style.left.%]="percent(item) < 22 ? percent(item) : percent(item) / 2">{{ percent(item) }}%</span>
                      </div>
                    </div></div>
                    <dl class="tk-tiles">
                      <div><dt>{{ 'equipment.tile-fuel' | translate }}</dt><dd>{{ item.fuelType ? ('fuel-type.' + item.fuelType.toLowerCase() | translate) : ('equipment.no-fuel' | translate) }}</dd></div>
                      <div><dt>{{ 'equipment.current-level' | translate }}</dt><dd>{{ item.currentLevel | number:'1.0-2' }} <small>{{ unit(item.unit) | translate }}</small></dd></div>
                      <div><dt>{{ 'equipment.capacity' | translate }}</dt><dd>{{ item.capacity | number:'1.0-2' }} <small>{{ unit(item.unit) | translate }}</small></dd></div>
                      <div><dt>{{ 'equipment.free-space' | translate }}</dt><dd>{{ freeSpace(item) | number:'1.0-2' }} <small>{{ unit(item.unit) | translate }}</small></dd></div>
                      <div><dt>{{ 'equipment.tile-threshold' | translate }}</dt><dd>@if (store.policies()[item.id]; as policy) { {{ policy.lowLevelPercent }} % } @else { — }</dd></div>
                    </dl>
                    <h3>{{ 'equipment.history' | translate }}</h3>
                    @if (store.readings().length) {
                      <div class="tk-chart"><canvas baseChart [data]="chartData()" [options]="chartOptions" type="line" role="img" [attr.aria-label]="'equipment.history-label' | translate:{ name: item.name, n: store.readings().length, level: store.readings().at(-1)!.level, unit: (unit(item.unit) | translate) }"></canvas></div>
                    } @else {
                      <p class="tk-note" [attr.role]="store.readingsState() === 'error' ? 'alert' : null">{{ (store.readingsState() === 'error' ? 'equipment.readings-error' : store.readingsState() === 'loading' ? 'equipment.readings-loading' : 'equipment.no-readings') | translate }}</p>
                    }
                  </div>
                </mat-tab>
                <mat-tab [label]="'equipment.tab-info' | translate">
                  <div class="tk-tab">
                    <dl class="tk-facts">
                      <div><dt>{{ 'equipment.site' | translate }}</dt><dd>@if (siteOf(item); as place) { {{ place.name }} @if (place.address) { <small>{{ place.address }}</small> } } @else { {{ 'equipment.no-site' | translate }} }</dd></div>
                      @if (siteOf(item); as place) { @if (place.latitude != null && place.longitude != null) { <div><dt>{{ 'equipment.map.coordinates' | translate }}</dt><dd>{{ place.latitude | number:'1.6-6' }}, {{ place.longitude | number:'1.6-6' }}</dd></div> } }
                      <div><dt>{{ 'equipment.fuel-type' | translate }}</dt><dd>{{ item.fuelType ? ('fuel-type.' + item.fuelType.toLowerCase() | translate) : ('equipment.no-fuel' | translate) }}</dd></div>
                      <div><dt>{{ 'equipment.unit' | translate }}</dt><dd>{{ unit(item.unit) | translate }}</dd></div>
                      <div><dt>{{ 'equipment.level-source' | translate }}</dt><dd>{{ item.levelSource }}</dd></div>
                    </dl>
                    <p class="tk-muted">{{ 'equipment.device-pending' | translate }}</p>
                  </div>
                </mat-tab>
                <mat-tab [label]="'equipment.tab-refill' | translate">
                  <div class="tk-tab">
                    <h3>{{ 'equipment.policy' | translate }}</h3>
                    <p class="tk-muted">@if (store.policies()[item.id]; as policy) { {{ 'equipment.policy-summary' | translate:{ low: policy.lowLevelPercent, target: policy.targetLevelPercent } }} } @else { {{ 'equipment.no-policy' | translate }} }</p>
                    <h3>{{ 'equipment.episodes' | translate }}</h3>
                    @if (recentEpisodes().length) {
                      <ol class="tk-timeline">
                        @for (episode of recentEpisodes(); track episode.id) {
                          <li [class.open]="episode.status === 'OPEN'">
                            <p><strong>{{ episodeLabel(episode.status) | translate }}</strong> · <time [attr.datetime]="episode.openedAt">{{ episode.openedAt | date:'mediumDate' }}</time></p>
                            <p>{{ 'equipment.episode-volume' | translate:{ volume: (episode.requestedVolume | number:'1.0-2'), unit: (unit(episode.unit) | translate) } }}
                              @if (episode.requestId) { · <a [routerLink]="['/ordering/request-detail', episode.requestId]">{{ 'equipment.view-request' | translate:{ id: episode.requestId } }}</a> }</p>
                          </li>
                        }
                      </ol>
                    } @else { <p class="tk-muted">{{ 'equipment.no-episodes' | translate }}</p> }
                  </div>
                </mat-tab>
              </mat-tab-group>
            } @else {
              <div class="dl-empty"><p><strong>{{ 'equipment.not-found' | translate }}</strong></p><p>{{ 'equipment.pick-other' | translate }}</p></div>
            }
          </section>
        }
      </div>

      <section class="tk-panel tk-sites" [attr.aria-label]="'equipment.map.title' | translate">
      <app-tank-map [sites]="store.sites()" [tanks]="store.tanks()" [visibleTanks]="visible()" [includeEmptySites]="filter() === 'all'" [selectedId]="shown()?.id ?? null" [policies]="store.policies()" [loading]="store.loading() || store.tanksLoading() || store.sitesLoading()" (selectTank)="selectTank($event)"></app-tank-map>
        @if (store.customer() && !store.sites().length) { <p class="tk-muted">{{ 'equipment.no-sites' | translate }}</p> }
        @if (store.customer()) {
          <div class="site-form"><p class="site-help"><mat-icon aria-hidden="true">info</mat-icon>{{ 'equipment.map.create-help' | translate }}</p>
            <button mat-stroked-button type="button" [disabled]="store.creatingSite()" (click)="addSite()"><mat-icon aria-hidden="true">add_location_alt</mat-icon>{{ 'equipment.add-site' | translate }}</button></div>
        }
      </section>
    </main>`,
  styles: [`
    :host{display:block;container-type:inline-size}
    .tk{display:flex;flex-direction:column;gap:20px;max-width:1480px;margin:auto;color:#1f2d3d}
    .tk small{display:block;color:#4b5563;font-size:.8125rem;font-weight:400}
    .tk-head,.tk-detail-head,.tk-error{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
    .tk-head h1{margin:0;font-size:1.5rem;line-height:1.2}
    .tk-actions{display:flex;flex-wrap:wrap;gap:8px}
    .tk-error{margin:0}
    .tk-split{display:grid;grid-template-columns:minmax(300px,.72fr) minmax(0,1fr);gap:24px;align-items:start}
    .tk-split.solo{grid-template-columns:minmax(0,1fr)}
    .tk-list{display:grid;gap:16px;min-width:0}
    .tk-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
    .tk-card{display:grid;gap:12px;height:100%;box-sizing:border-box;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;color:inherit;text-decoration:none;transition:border-color .15s ease-out,background-color .15s ease-out}
    .tk-card:hover{border-color:#9db2e8}
    .tk-card[aria-current]{border-color:#1e3a8a;box-shadow:inset 0 0 0 1px #1e3a8a}
    .tk-card:focus-visible,.tk-back:focus-visible,.tk-tab a:focus-visible{outline:2px solid #1e3a8a;outline-offset:2px}
    .tk-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-bottom:12px;border-bottom:1px solid #eef0f4}
    .tk-card-top strong{display:block;overflow-wrap:anywhere}
    .tk-card-top img{width:64px;height:auto;flex:none}
    .tk-row{display:flex;align-items:center;gap:10px;min-width:0}
    .tk-row>span{min-width:0}.tk-row b,.tk-row small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .tk-row mat-icon,.site-list mat-icon{flex:none;width:28px;height:28px;border-radius:50%;background:#eff6ff;color:#1e3a8a;font-size:16px;line-height:28px;text-align:center}
    .tk-row b,.site-list b{display:block;font-weight:500}
    .tk-card-foot{display:grid;gap:6px;padding-top:12px;border-top:1px solid #eef0f4}
    .tk-card-level{display:flex;align-items:center;justify-content:space-between;gap:8px;font-variant-numeric:tabular-nums}
    .tk-bar{height:6px;border-radius:999px;background:#e2e8f0;overflow:hidden}
    .tk-bar span{display:block;height:100%;background:#1e3a8a}
    .tk-bar.low span{background:#b45309}
    .tk-muted{margin:0;color:#4b5563;font-size:.875rem}
    .tk-detail,.tk-panel{display:grid;gap:16px;min-width:0;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#fff}
    .tk-sites{padding:0;overflow:hidden}.tk-sites>h2,.tk-sites>p,.tk-sites>.site-form,.tk-sites>.site-list{margin-left:24px;margin-right:24px}.tk-sites>h2{margin-top:24px!important}.tk-sites>.site-form{margin-bottom:24px}
    .tk-panel h2,.tk-tab h3{margin:0;font-size:1.0625rem;font-weight:600}
    .tk-title{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
    .tk-title h2{margin:0;font-size:1.5rem;line-height:1.2;overflow-wrap:anywhere}
    .tk-status{display:inline-flex;align-items:center;gap:6px;color:#14532d;font-size:.875rem;font-weight:500}
    .tk-status::before{content:'';width:8px;height:8px;border-radius:50%;background:currentColor}
    .tk-status.low{color:#8a3d05}
    .tk-back{display:none;align-items:center;gap:6px;width:fit-content;color:#1e3a8a;font-weight:500;text-decoration:none}
    .tk-back mat-icon{width:20px;height:20px;font-size:20px}
    .tk-tab{display:grid;gap:16px;padding-top:20px}
    .tk-tab h3:not(:first-child){margin-top:8px}
    .tk-stage{padding:16px;border-radius:12px;background:#f4f6f9}
    .tk-gauge{position:relative;width:100%;max-width:620px;margin:0 auto}
    .tk-gauge img{display:block;width:100%;height:auto;mix-blend-mode:multiply}
    .tk-load{position:absolute;left:27.9%;top:10.7%;width:66.5%;height:57.5%}
    .tk-load .fuel{position:absolute;inset:0 auto 0 0;background:#1e3a8a;mix-blend-mode:multiply;transition:width .6s cubic-bezier(.16,1,.3,1)}
    .tk-tab.low .fuel{background:#b45309}
    .tk-load .low-mark{position:absolute;top:0;bottom:0;border-left:2px dashed #7a4100}
    .tk-load .pct{position:absolute;top:50%;transform:translate(-50%,-50%);color:#fff;font-size:clamp(1.125rem,3.2cqi,1.75rem);font-weight:500;font-variant-numeric:tabular-nums}
    .tk-load .pct.out{transform:translate(10px,-50%);color:#1f2d3d}
    .tk-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin:0}
    .tk-tiles div{padding:10px 12px;border:1px solid #e5e7eb;border-radius:8px}
    .tk-tiles dt,.tk-facts dt{color:#4b5563;font-size:.8125rem}
    .tk-tiles dd{margin:2px 0 0;font-weight:600;font-variant-numeric:tabular-nums}
    .tk-tiles small{display:inline}
    .tk-chart{position:relative;height:240px}
    .tk-note{margin:0;padding:28px 16px;border:1px dashed #b8c0cc;border-radius:12px;color:#4b5563;text-align:center}
    .tk-facts{margin:0}
    .tk-facts div{display:grid;grid-template-columns:minmax(120px,1fr) 2fr;gap:12px;padding:12px 0;border-bottom:1px solid #eef0f4}
    .tk-facts dd{margin:0;font-weight:500;overflow-wrap:anywhere}
    .tk-timeline{list-style:none;margin:0;padding:0}
    .tk-timeline li{position:relative;padding:0 0 16px 24px;border-left:2px solid #dbe2ee;margin-left:5px}
    .tk-timeline li:last-child{border-left-color:transparent;padding-bottom:0}
    .tk-timeline li::before{content:'';position:absolute;left:-7px;top:3px;width:12px;height:12px;border-radius:50%;background:#94a3b8;box-shadow:0 0 0 3px #fff}
    .tk-timeline li.open::before{background:#b45309}
    .tk-timeline p{margin:0}.tk-timeline p+p{color:#4b5563;font-size:.875rem}
    .tk-tab a{color:#1e3a8a;font-weight:500}
    .tank-form,.site-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 16px;align-items:center}
    .site-form{grid-template-columns:minmax(0,1fr) auto}.site-help{display:flex;align-items:flex-start;gap:10px;margin:0;font-size:.875rem;line-height:1.6;color:#4b5563}.site-help mat-icon{flex:none;color:#1e3a8a}
    .actions{grid-column:1/-1;display:flex;justify-content:flex-end;gap:8px}
    .site-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:12px 32px}
    .site-list li{display:flex;align-items:center;gap:10px}
    mat-form-field{width:100%}mat-tab-group{min-width:0}:host ::ng-deep .mat-mdc-tab{min-width:0;padding:0 16px}
    @container (max-width:760px){
      .tk-split{grid-template-columns:minmax(0,1fr)}
      .tk-split:not(.picked) .tk-detail,.tk-split.picked .tk-list{display:none}
      .tk-split:not(.picked) .tk-card[aria-current]{border-color:#e5e7eb;box-shadow:none}
      .tk-back{display:inline-flex}
      .tk-detail,.tk-panel{padding:16px}
      .tk-sites{padding:0}
      .site-form{grid-template-columns:minmax(0,1fr)}
      .tk-detail-head .tk-actions,.tk-detail-head .tk-actions a,.tk-detail-head .tk-actions button{width:100%}
    }
    @media (prefers-reduced-motion:reduce){.tk-card,.tk-load .fuel{transition:none}}
  `],
})
export class TankList implements OnInit {
  protected readonly store = inject(EquipmentStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected selectTank(id: number): void { void this.router.navigate([], { queryParams: { tank: id }, queryParamsHandling: 'merge' }); }
  protected readonly formOpen = signal(false);
  protected tank = emptyTank();
  protected readonly fuelTypes = FUEL_TYPES;
  /** Tanque elegido en la URL (`?tank=`); sin parámetro, el escritorio muestra el primero y el móvil solo el listado. */
  protected readonly selectedId = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map(params => params.has('tank') ? Number(params.get('tank')) : null)), { initialValue: null });
  protected readonly shown = computed(() => { const id = this.selectedId(), tanks = this.store.tanks(); return id === null ? tanks[0] ?? null : tanks.find(tank => tank.id === id) ?? null; });
  private readonly shownId = computed(() => this.shown()?.id ?? null);
  protected readonly recentEpisodes = computed(() => [...this.store.episodes()].sort((a, b) => b.openedAt.localeCompare(a.openedAt)).slice(0, 3));

  protected readonly filters: { id: Filter; label: string }[] = [{ id: 'all', label: 'equipment.filter-all' }, { id: 'low', label: 'equipment.status-low' }, { id: 'ok', label: 'equipment.status-ok' }];
  protected readonly filter = signal<Filter>('all');
  protected readonly visible = computed(() => this.store.tanks().filter(tank => this.matches(tank, this.filter())));
  protected readonly chartData = computed<ChartData<'line', number[], string>>(() => ({
    labels: this.store.readings().map(reading => new Date(reading.capturedAt).toLocaleString()),
    datasets: [{ data: this.store.readings().map(reading => reading.level), borderColor: '#1e3a8a', backgroundColor: 'rgba(30,58,138,.1)', fill: true, pointRadius: 2, tension: 0.2 }],
  }));
  protected readonly chartOptions: ChartOptions<'line'> = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } };

  constructor() { effect(() => { const id = this.shownId(); if (id !== null) untracked(() => { this.store.loadEpisodes(id); this.store.loadReadings(id); }); }); }

  ngOnInit(): void { this.store.load(); }
  protected percent(tank: Tank): number { return tank.capacity > 0 ? Math.min(100, Math.max(0, Math.round(tank.currentLevel / tank.capacity * 100))) : 0; }
  /** Misma regla que RefillThresholds del backend: bajo cuando el porcentaje no supera el umbral de la política. */
  protected isLow(tank: Tank): boolean { const policy = this.store.policies()[tank.id]; return !!policy && tank.capacity > 0 && tank.currentLevel / tank.capacity * 100 <= policy.lowLevelPercent; }
  protected siteOf(tank: Tank): Site | undefined { return this.store.sites().find(site => site.id === tank.siteId); }
  protected episodeLabel(status: string): string { return status === 'OPEN' ? 'equipment.episode-open' : status === 'REARMED' ? 'equipment.episode-rearmed' : status; }
  /** Sin política no hay estado: el tanque solo aparece en «Todos». */
  private matches(tank: Tank, filter: Filter): boolean { return filter === 'all' || (!!this.store.policies()[tank.id] && this.isLow(tank) === (filter === 'low')); }
  protected count(filter: Filter): number { return this.store.tanks().filter(tank => this.matches(tank, filter)).length; }
  protected editPolicy(tank: Tank): void {
    this.dialog.open(RefillPolicyDialog, { ...REFILL_POLICY_DIALOG_CONFIG, data: { tankId: tank.id, tankName: tank.name } }).afterClosed()
      .subscribe(policy => { if (policy) this.store.policies.update(all => ({ ...all, [tank.id]: policy })); });
  }
  protected freeSpace(tank: Tank): number { return Math.max(0, tank.capacity - tank.currentLevel); }
  protected readonly unit = unitKey;
  protected addSite(): void {
    const ref = this.dialog.open(SiteLocationDialog, { data: { store: this.store }, width: '1200px', maxWidth: '96vw', maxHeight: '96dvh', autoFocus: 'first-heading', restoreFocus: true });
    lockMapDialogScroll(this.host.nativeElement, ref);
    const unregister = this.destroyRef.onDestroy(() => ref.close());
    ref.afterClosed().subscribe(unregister);
  }
  protected addTank(form: NgForm): void {
    if (form.invalid) { this.showErrors(form, '.tank-form'); return; }
    this.store.createTank({ ...this.tank }, () => { this.tank = emptyTank(); this.formOpen.set(false); });
  }
  private showErrors(form: NgForm, selector: string): void {
    form.control.markAllAsTouched();
    this.host.nativeElement.querySelector(selector)?.querySelector<HTMLElement>('input.ng-invalid, mat-select.ng-invalid')?.focus();
  }
}
