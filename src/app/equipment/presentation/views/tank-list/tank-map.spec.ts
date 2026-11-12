import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Site, Tank } from '../../../domain/model/equipment.entity';
import { SiteGeocoding, SiteLocation } from '../../../infrastructure/site-geocoding';
import { TankMap } from './tank-map';
import { LocatedSite, TankMapCanvas } from './tank-map-canvas';

/** Sustituto de Mapbox: inspecciona los puntos recibidos sin usar red ni WebGL. */
@Component({
  selector: 'app-tank-map-canvas',
  standalone: true,
  template: `
    <div class="map-mock">
      @for (point of points(); track point.site.id) {
        <span class="mock-pin"
          [attr.data-site-id]="point.site.id"
          [attr.data-type]="point.site.siteType"
          [attr.data-count]="point.count"
          [attr.data-lng]="point.location.coordinates[0]"
          [attr.data-lat]="point.location.coordinates[1]">
          {{ point.site.name }}
        </span>
      }
    </div>
  `,
})
class FakeMapCanvas {
  readonly points = input.required<LocatedSite[]>();
  readonly selectedSite = input<number | null>(null);
  readonly selectedTank = input<number | null>(null);
  readonly cityCenter = input<[number, number] | null>(null);
  readonly selectSite = output<number>();
  fit(): void { /* sin mapa real */ }
}

/** Datos 100 % simulados; nunca se envian a un servidor. */
const sites: Site[] = [
  { id: 1, customerAccountId: 7, name: 'Estacion Lima', siteType: 'STATION',
    address: 'Direccion de prueba A', latitude: -12.06, longitude: -77.04, active: true },
  { id: 2, customerAccountId: 7, name: 'Ubicacion tanque', siteType: 'TANK_LOCATION',
    address: 'Direccion de prueba B', latitude: -12.08, longitude: -77.03, active: true },
  { id: 3, customerAccountId: 7, name: 'Sede sin coordenadas', siteType: 'TANK_LOCATION',
    address: '', active: true },
];
const tanks: Tank[] = [
  { id: 101, customerAccountId: 7, siteId: 1, name: 'Tanque A',
    capacity: 5000, currentLevel: 2500, levelSource: 'MANUAL', active: true },
  { id: 202, customerAccountId: 7, siteId: 2, name: 'Tanque B',
    capacity: 3000, currentLevel: 1500, levelSource: 'MANUAL', active: true },
];

function createGeocoder() {
  const locations = signal<Record<number, SiteLocation>>({});
  return {
    locations,
    locate: vi.fn(async (rows: Site[]) => {
      const byId: Record<number, SiteLocation> = {};
      for (const site of rows) {
        byId[site.id] = site.latitude == null || site.longitude == null
          ? { state: 'unavailable' }
          : { state: 'available', source: 'manual', coordinates: [site.longitude, site.latitude] };
      }
      locations.set(byId);
    }),
    exploreCity: vi.fn(async () => {}),
  };
}

describe('TankMap: ubicaciones simuladas sin backend', () => {
  let fixture: ComponentFixture<TankMap>;
  let element: HTMLElement;
  let geo: ReturnType<typeof createGeocoder>;

  beforeEach(async () => {
    geo = createGeocoder();

    TestBed.configureTestingModule({
      imports: [TankMap],
      providers: [provideTranslateService()],
    });
    // Angular no permite combinar `set` con `add` / `remove` en el mismo override.
    // Sustituimos el componente y el proveedor usando solo `remove` y `add`.
    TestBed.overrideComponent(TankMap, {
      remove: {
        imports: [TankMapCanvas],
        providers: [SiteGeocoding],
      },
      add: {
        imports: [FakeMapCanvas],
        providers: [
          {
            provide: SiteGeocoding,
            useValue: {
              ...geo,
              cityCenter: signal<[number, number] | null>(null),
              cityLoading: signal(false),
              cityError: signal(false),
              retry: vi.fn(),
            },
          },
        ],
      },
    });
    fixture = TestBed.createComponent(TankMap);
    fixture.componentRef.setInput('sites', sites);
    fixture.componentRef.setInput('tanks', tanks);
    fixture.componentRef.setInput('visibleTanks', tanks);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => TestBed.resetTestingModule());

  it('crea puntos para la estacion y la ubicacion con coordenadas correctas', () => {
    const pins = Array.from(element.querySelectorAll<HTMLElement>('.mock-pin'));
    expect(pins).toHaveLength(2);
    expect(pins.map(pin => [pin.dataset['siteId'], pin.dataset['type']])).toEqual([
      ['1', 'STATION'], ['2', 'TANK_LOCATION'],
    ]);
    expect(pins[0].dataset['lng']).toBe('-77.04');
    expect(pins[0].dataset['lat']).toBe('-12.06');
    expect(geo.locate).toHaveBeenCalledWith(sites);
  });

  it('mantiene en la lista una sede sin coordenadas, pero no inventa un marcador', () => {
    expect(element.querySelectorAll('.site-choice')).toHaveLength(3);
    expect(element.querySelectorAll('.mock-pin')).toHaveLength(2);
    expect(element.textContent).toContain('Sede sin coordenadas');
    (element.querySelectorAll<HTMLButtonElement>('.site-choice')[2]).click();
    fixture.detectChanges();
    expect(element.querySelector('.site-summary')?.textContent).toContain('Sede sin coordenadas');
    expect(element.querySelector('.site-summary')?.textContent).toContain('equipment.map.site-without-tanks');
  });

  it('seleccionar una estacion comunica el tanque asociado', () => {
    const emitted: number[] = [];
    fixture.componentInstance.selectTank.subscribe(id => emitted.push(id));
    element.querySelectorAll<HTMLButtonElement>('.site-choice')[0].click();
    expect(emitted).toEqual([101]);
  });

  it('agrupa dos tanques de una sede en un solo marcador', () => {
    const extra: Tank = { ...tanks[0], id: 303, name: 'Tanque C' };
    fixture.componentRef.setInput('tanks', [...tanks, extra]);
    fixture.componentRef.setInput('visibleTanks', [...tanks, extra]);
    fixture.detectChanges();
    const stationPin = element.querySelector<HTMLElement>('.mock-pin[data-site-id="1"]');
    expect(stationPin?.dataset['count']).toBe('2');
    expect(element.querySelectorAll('.mock-pin')).toHaveLength(2);
  });
});
