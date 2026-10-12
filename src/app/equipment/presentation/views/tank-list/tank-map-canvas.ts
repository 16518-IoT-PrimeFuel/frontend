import { AfterViewInit, Component, DestroyRef, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map } from 'mapbox-gl';
import type { MatDialogRef } from '@angular/material/dialog';
import { environment } from '../../../../../environments/environment';
import { Site } from '../../../domain/model/equipment.entity';
import { SiteLocation } from '../../../infrastructure/site-geocoding';

export type LocatedSite = { site: Site; location: SiteLocation & { coordinates: [number, number] }; count: number; delivery?: boolean };

/** CDK blocks document scrolling; FullTank scrolls its fixed layout's content instead. */
export function lockMapDialogScroll(host: HTMLElement, ref: MatDialogRef<unknown>): void {
  const content = host.closest<HTMLElement>('mat-sidenav-content');
  if (!content) return;
  const previous = content.style.overflowY;
  content.style.overflowY = 'hidden';
  ref.beforeClosed().subscribe(() => content.style.overflowY = previous);
}

@Component({
  selector: 'app-tank-map-canvas', standalone: true,
  imports: [TranslatePipe, MatButtonModule],
  template: `
    <div class="map-shell" [attr.aria-busy]="loading()">
      <div #container class="map" [attr.aria-label]="'equipment.map.canvas' | translate"></div>
      @if (loading() || error()) {
        <div class="map-state" [attr.role]="error() ? 'alert' : 'status'">
          <p>{{ (error() ? 'equipment.map.map-error' : 'equipment.map.map-loading') | translate }}</p>
          @if (error()) { <button mat-stroked-button type="button" (click)="start()">{{ 'equipment.retry' | translate }}</button> }
        </div>
      }
      @if (picking() && !loading() && !error()) {
        <button class="pick-center" mat-raised-button type="button" (click)="markCenter()">{{ 'equipment.map.mark-center' | translate }}</button>
      }
    </div>`,
  styles: [`:host{display:block;min-width:0}.map-shell{position:relative;height:100%;min-height:300px;background:#eef2f6}.map{height:100%;min-height:inherit}.map-state{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;background:#f4f6f9;text-align:center;color:#374151}.map-state p{max-width:45ch}.pick-center{position:absolute;bottom:36px;left:12px}`],
})
export class TankMapCanvas implements AfterViewInit {
  readonly points = input.required<LocatedSite[]>();
  readonly selectedSite = input<number | null>(null);
  readonly selectedTank = input<number | null>(null);
  readonly cityCenter = input<[number, number] | null>(null);
  readonly picking = input(false);
  readonly point = input<[number, number] | null>(null);
  readonly choosePoint = output<[number, number]>();
  readonly selectSite = output<number>();
  protected readonly loading = signal(true);
  protected readonly error = signal(false);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('container');
  private readonly translate = inject(TranslateService);
  private map?: Map;
  private observer?: ResizeObserver;
  private destroyed = false;
  private generation = 0;
  private fitted = false;
  private pointSet = '';
  private lastSelected: string | null = null;
  private lastCenter?: [number, number] | null;
  private loadingTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => { this.points(); this.selectedSite(); this.selectedTank(); this.cityCenter(); this.point(); this.update(); });
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true; this.generation++; clearTimeout(this.loadingTimeout); this.observer?.disconnect(); this.map?.remove();
    });
  }
  ngAfterViewInit(): void { void this.start(); }

  protected async start(): Promise<void> {
    const generation = ++this.generation;
    clearTimeout(this.loadingTimeout);
    this.observer?.disconnect(); this.map?.remove(); this.map = undefined;
    this.fitted = false; this.pointSet = ''; this.lastSelected = null; this.lastCenter = undefined;
    this.error.set(false); this.loading.set(true);
    try {
      // Angular transforms the embedded worker; serve the official worker unchanged instead.
      const { default: mapboxgl } = await import('mapbox-gl');
      if (this.destroyed || generation !== this.generation) return;
      mapboxgl.workerUrl = new URL('assets/mapbox/mapbox-gl-csp-worker.js', document.baseURI).href;
      const map = this.map = new mapboxgl.Map({
        container: this.container().nativeElement, accessToken: environment.mapbox.accessToken,
        style: environment.mapbox.style,
        // The city center is navigation context, never a tank's fallback coordinates.
        ...(this.points().length ? { center: this.points()[0].location.coordinates, zoom: 12 }
          : this.cityCenter() ? { center: this.cityCenter()!, zoom: 11 } : {}),
        locale: { 'NavigationControl.ZoomIn': this.translate.instant('equipment.map.zoom-in'),
          'NavigationControl.ZoomOut': this.translate.instant('equipment.map.zoom-out'),
          'NavigationControl.ResetBearing': this.translate.instant('equipment.map.orientation') },
      });
      map.getCanvas().setAttribute('aria-label', this.translate.instant('equipment.map.keyboard'));
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      // Listen without logging Mapbox's errors (they may contain request URLs with the pk token).
      map.on('error', () => { this.error.set(true); this.loading.set(false); });
      this.loadingTimeout = setTimeout(() => { this.error.set(true); this.loading.set(false); }, 20000);
      map.on('load', () => {
        clearTimeout(this.loadingTimeout);
        map.addSource('sites', { type: 'geojson', data: this.data(), cluster: true, clusterRadius: 45, clusterMaxZoom: 13 });
        map.addLayer({ id: 'clusters', type: 'circle', source: 'sites', filter: ['has', 'point_count'],
          paint: { 'circle-color': '#1e3a8a', 'circle-radius': 22, 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 } });
        map.addLayer({ id: 'counts', type: 'symbol', source: 'sites', filter: ['has', 'point_count'],
          layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13 }, paint: { 'text-color': '#fff' } });
        map.addLayer({ id: 'sites', type: 'circle', source: 'sites', filter: ['!', ['has', 'point_count']],
          paint: { 'circle-radius': ['case', ['==', ['get', 'id'], this.selectedSite() ?? -1], 13, 9],
            'circle-color': ['case', ['get', 'approximate'], '#a16207', '#1e3a8a'],
            'circle-stroke-width': 3, 'circle-stroke-color': ['case', ['get', 'delivery'], '#16a34a', '#fff'] } });
        if (this.picking()) {
          map.addSource('chosen-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          map.addLayer({ id: 'chosen-point', type: 'circle', source: 'chosen-point', paint: {
            'circle-radius': 12, 'circle-color': '#1e3a8a', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff',
          } });
          map.on('click', event => this.choosePoint.emit([event.lngLat.lng, event.lngLat.lat]));
          map.getCanvas().style.cursor = 'crosshair';
        }
        map.on('click', 'sites', event => {
          const id = Number(event.features?.[0]?.properties?.['id']);
          if (this.points().some(point => point.site.id === id)) this.selectSite.emit(id);
        });
        map.on('click', 'clusters', event => {
          const feature = event.features?.[0];
          if (!feature || feature.geometry.type !== 'Point') return;
          const coordinates = feature.geometry.coordinates as [number, number];
          (map.getSource('sites') as GeoJSONSource).getClusterExpansionZoom(Number(feature.properties?.['cluster_id']), (error, zoom) => {
            if (!error && zoom != null && this.map === map && !this.destroyed) map.easeTo({ center: coordinates, zoom, duration: this.duration() });
          });
        });
        for (const layer of ['sites', 'clusters']) {
          map.on('mouseenter', layer, () => map.getCanvas().style.cursor = 'pointer');
          map.on('mouseleave', layer, () => map.getCanvas().style.cursor = '');
        }
        for (const [name, path] of [['station', '/estation-placeholder.png'], ['warehouse', '/tank-warehouse.png']]) {
          map.loadImage(path, (error, image) => {
            if (error || !image || this.destroyed || this.map !== map) return;
            map.addImage(name, image, { pixelRatio: image.width / 64 });
            if (!map.hasImage('station') || !map.hasImage('warehouse')) return;
            map.addLayer({ id: 'site-images', type: 'symbol', source: 'sites', filter: ['!', ['has', 'point_count']], layout: {
              'icon-image': ['get', 'image'], 'icon-anchor': 'bottom', 'icon-offset': [0, -12],
              'icon-allow-overlap': true, 'icon-size': 1,
            } });
            map.on('click', 'site-images', event => {
              const id = Number(event.features?.[0]?.properties?.['id']);
              if (this.points().some(point => point.site.id === id)) this.selectSite.emit(id);
            });
            map.on('mouseenter', 'site-images', () => map.getCanvas().style.cursor = 'pointer');
            map.on('mouseleave', 'site-images', () => map.getCanvas().style.cursor = '');
          });
        }
        this.loading.set(false); this.error.set(false); this.update();
      });
      this.observer = new ResizeObserver(() => map.resize());
      this.observer.observe(this.container().nativeElement);
    } catch { if (!this.destroyed) { this.error.set(true); this.loading.set(false); } }
  }

  fit(): void {
    const map = this.map, points = this.points();
    if (!map || !points.length) return;
    const lngs = points.map(p => p.location.coordinates[0]), lats = points.map(p => p.location.coordinates[1]);
    map.fitBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 55, maxZoom: 14, duration: this.duration() });
  }
  protected markCenter(): void { if (this.map) this.choosePoint.emit(this.map.getCenter().toArray()); }
  private duration(): number { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220; }
  private data(): FeatureCollection<Point> {
    return { type: 'FeatureCollection', features: this.points().map(point => ({ type: 'Feature',
      geometry: { type: 'Point', coordinates: point.location.coordinates },
      properties: { id: point.site.id, delivery: !!point.delivery, approximate: point.location.state === 'approximate', image: point.site.siteType === 'STATION' ? 'station' : 'warehouse' },
    })) };
  }
  private update(): void {
    const map = this.map;
    if (!map?.getSource('sites')) return;
    (map.getSource('sites') as GeoJSONSource).setData(this.data());
    const point = this.point(), source = map.getSource('chosen-point') as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: point ? [{ type: 'Feature', properties: {},
      geometry: { type: 'Point', coordinates: point } }] : [] });
    map.setPaintProperty('sites', 'circle-radius', ['case', ['==', ['get', 'id'], this.selectedSite() ?? -1], 13, 9]);
    const center = this.cityCenter();
    if (center && this.lastCenter !== center) map.easeTo({ center, zoom: 11, duration: this.duration() });
    this.lastCenter = center;
    const pointSet = this.points().map(point => `${point.site.id}:${point.location.coordinates}`).join('|');
    if (this.points().length && (!this.fitted || this.pointSet !== pointSet)) { this.fit(); this.fitted = true; }
    this.pointSet = pointSet;
    const selected = this.points().find(p => p.site.id === this.selectedSite());
    const selectedKey = selected ? `${selected.site.id}:${this.selectedTank()}` : null;
    if (selected && this.lastSelected !== selectedKey) {
      map.easeTo({ center: selected.location.coordinates, zoom: selected.location.state === 'approximate' ? 14 : 16, duration: this.duration() });
    }
    this.lastSelected = selectedKey;
  }
}
