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
 * @summary Vista de lista de conductores.
 * @remarks Muestra conductores autorizados del proveedor con filtros por estado.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-driver-list',
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
  templateUrl: './driver-list.html',
  styleUrl: './driver-list.css',
})
export class DriverList implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  @ViewChild('confirmDialog') private confirmDialog!: TemplateRef<unknown>;
  protected readonly store = inject(FulfillmentStore);



  protected readonly displayedColumns: string[] = [
    'fullName',
    'licenseNumber',
    'phoneNumber',
    'email',
    'status',
    'actions',
  ];

  ngOnInit(): void {
    this.store.loadDrivers();
  }

  protected onRefresh(): void {
    this.store.loadDrivers();
  }

  protected onShowAvailable(): void {
    this.store.loadAvailableDrivers();
  }

  protected onShowAll(): void {
    this.store.loadDrivers();
  }

  protected onToggleActive(driverId: number, active: boolean): void {
    const apply = () => this.store.updateDriverStatus(driverId, { status: active ? 'INACTIVE' : 'AVAILABLE' });
    if (active) this.dialog.open(this.confirmDialog).afterClosed().subscribe((ok) => ok && apply());
    else apply();
  }

  protected onEligibility(id: number): void {
    this.store.checkDriverEligibility(id, this.destroyRef);
  }

  protected eligibilityKey(outcome: string): string {
    if (outcome === 'BUSY') return 'eligibility.driver-busy';
    return ['ELIGIBLE', 'INELIGIBLE'].includes(outcome) ? `eligibility.outcomes.${outcome}` : '';
  }

  protected eligibilityClass(outcome: string): string {
    return ['ELIGIBLE', 'BUSY', 'INELIGIBLE'].includes(outcome) ? outcome.toLowerCase() : 'unknown';
  }

  protected getStatusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  protected getFullName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`;
  }
}
