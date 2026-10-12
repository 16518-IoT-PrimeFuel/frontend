import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { FuelUnitPipe } from '../../../../shared/presentation/pipe/fuel-unit.pipe';
import { TranslatePipe } from '@ngx-translate/core';
import { FulfillmentStore } from '../../../application/fulfillment.store';
import { PageGuide } from '../../../../shared/presentation/component/page-guide/page-guide';

/**
 * @summary Vista de lista de vehículos.
 * @remarks Muestra vehículos de la flota del proveedor con filtros por estado.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-tanker-list',
  standalone: true,
  imports: [
    PageGuide,
    FuelUnitPipe,
    MatDialogModule,
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    RouterModule,
    TranslatePipe,
  ],
  templateUrl: './tanker-list.html',
  styleUrl: './tanker-list.css',
})
export class TankerList implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  @ViewChild('confirmDialog') private confirmDialog!: TemplateRef<unknown>;
  protected readonly store = inject(FulfillmentStore);


  protected readonly search = signal('');
  /** 'available' = solo elegibles (consulta al backend); 'all' = toda la flota. */
  protected readonly view = signal<'all' | 'available'>('all');
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store.tankerList().filter((t) => !q || `${t.licensePlate} ${t.brand} ${t.model}`.toLowerCase().includes(q));
  });
  protected clearSearch(): void { this.search.set(''); }

  ngOnInit(): void {
    this.store.loadTankers();
  }

  protected onRefresh(): void {
    if (this.view() === 'available') this.onShowAvailable(); else this.store.loadTankers();
  }

  protected onShowAvailable(): void {
    this.view.set('available');
    this.store.loadAvailableTankers();
  }

  protected onShowAll(): void {
    this.view.set('all');
    this.store.loadTankers();
  }

  protected onToggleActive(tankerId: number, active: boolean): void {
    const apply = () => this.store.updateTankerStatus(tankerId, { status: active ? 'INACTIVE' : 'AVAILABLE' });
    if (active) this.dialog.open(this.confirmDialog).afterClosed().subscribe((ok) => ok && apply());
    else apply();
  }

  protected onEligibility(id: number): void {
    this.store.checkTankerEligibility(id, this.destroyRef);
  }

  protected eligibilityKey(outcome: string): string {
    return ['ELIGIBLE', 'BUSY', 'INELIGIBLE'].includes(outcome) ? `eligibility.outcomes.${outcome}` : '';
  }

  protected eligibilityClass(outcome: string): string {
    return ['ELIGIBLE', 'BUSY', 'INELIGIBLE'].includes(outcome) ? outcome.toLowerCase() : 'unknown';
  }

  /** Clase de color del estado (reutiliza las del listado global). */
  protected badge(status: string): string {
    return ({ AVAILABLE: 'st-paid', IN_ROUTE: 'st-confirmed', ASSIGNED: 'st-confirmed', MAINTENANCE: 'st-pending', SUSPENDED: 'st-cancelled' } as Record<string, string>)[status] ?? '';
  }
}
