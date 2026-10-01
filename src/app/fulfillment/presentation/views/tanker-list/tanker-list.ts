import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterModule } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FulfillmentStore } from '../../../application/fulfillment.store';

/**
 * @summary Vista de lista de vehículos.
 * @remarks Muestra vehículos de la flota del proveedor con filtros por estado.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-tanker-list',
  standalone: true,
  imports: [
    MatDialogModule,
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
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


  protected readonly displayedColumns: string[] = [
    'licensePlate',
    'brand',
    'model',
    'capacity',
    'status',
    'actions',
  ];

  ngOnInit(): void {
    this.store.loadTankers();
  }

  protected onRefresh(): void {
    this.store.loadTankers();
  }

  protected onShowAvailable(): void {
    this.store.loadAvailableTankers();
  }

  protected onShowAll(): void {
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

  protected getStatusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }
}
