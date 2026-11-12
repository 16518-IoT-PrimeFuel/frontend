import { Component, signal } from '@angular/core';
import { Site, Tank } from '../../../domain/model/equipment.entity';
import { TankMap } from './tank-map';

/** Vista temporal de desarrollo: permite validar Mapbox sin iniciar sesión ni llamar al backend FullTank. */
@Component({
  selector: 'app-tank-map-preview',
  standalone: true,
  imports: [TankMap],
  template: `
    <main class="preview">
      <header>
        <h1>Prueba visual del mapa de tanques</h1>
        <p>Datos simulados. Deben aparecer 2 ubicaciones en el mapa: una estación y una sede con 2 tanques.</p>
        <p>La tercera sede no tiene coordenadas: debe figurar en la lista, pero no generar un marcador falso.</p>
      </header>

      <app-tank-map
        [sites]="sites"
        [tanks]="tanks"
        [visibleTanks]="tanks"
        [selectedId]="selectedTankId()"
        (selectTank)="selectedTankId.set($event)"
      />

      <p class="selection" aria-live="polite">
        Tanque seleccionado: {{ selectedTankId() ?? 'ninguno' }}
      </p>
    </main>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: #f4f6f9; color: #1f2d3d; }
    .preview { max-width: 1400px; margin: 0 auto; padding: 24px; }
    header { margin-bottom: 20px; }
    h1 { margin: 0 0 8px; font-size: 1.5rem; }
    p { margin: 6px 0; line-height: 1.5; }
    .selection { margin-top: 18px; font-weight: 600; }
  `],
})
export class TankMapPreview {
  protected readonly selectedTankId = signal<number | null>(101);

  protected readonly sites: Site[] = [
    {
      id: 1, customerAccountId: 1, name: 'Estación de prueba - Lima Centro',
      address: 'Cercado de Lima, Lima, Perú', active: true,
      siteType: 'STATION', latitude: -12.0464, longitude: -77.0428,
    },
    {
      id: 2, customerAccountId: 1, name: 'Sede de tanques - San Isidro',
      address: 'San Isidro, Lima, Perú', active: true,
      siteType: 'TANK_LOCATION', latitude: -12.097, longitude: -77.036,
    },
    {
      id: 3, customerAccountId: 1, name: 'Sede sin coordenadas',
      address: '', active: true, siteType: 'TANK_LOCATION',
    },
  ];

  protected readonly tanks: Tank[] = [
    {
      id: 101, customerAccountId: 1, siteId: 1, name: 'Tanque estación',
      capacity: 10000, currentLevel: 7200, unit: 'LITRE',
      levelSource: 'MANUAL', active: true,
    },
    {
      id: 102, customerAccountId: 1, siteId: 2, name: 'Tanque diésel A',
      capacity: 12000, currentLevel: 5400, unit: 'LITRE',
      levelSource: 'MANUAL', active: true,
    },
    {
      id: 103, customerAccountId: 1, siteId: 2, name: 'Tanque diésel B',
      capacity: 8000, currentLevel: 3500, unit: 'LITRE',
      levelSource: 'MANUAL', active: true,
    },
    {
      id: 104, customerAccountId: 1, siteId: 3, name: 'Tanque sin ubicación',
      capacity: 5000, currentLevel: 2400, unit: 'LITRE',
      levelSource: 'MANUAL', active: true,
    },
  ];
}
