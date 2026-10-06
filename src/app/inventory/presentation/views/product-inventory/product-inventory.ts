import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { InventoryStore } from '../../../application/inventory.store';
import { IamStore } from '../../../../iam/application/iam.store';
import { InventoryApi } from '../../../infrastructure/inventory-api';

/**
 * @summary Vista de catálogo de productos de combustible.
 * @remarks Muestra tabla de productos con filtros por tipo y estado activo.
 * Permite navegar a formulario de creación y detalle de productos.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-product-inventory',
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
  templateUrl: './product-inventory.html',
  styleUrl: './product-inventory.css',
})
export class ProductInventory implements OnInit {
  private readonly dialog = inject(MatDialog);
  @ViewChild('confirmDialog') private confirmDialog!: TemplateRef<unknown>;
  protected readonly store = inject(InventoryStore);
  protected readonly iam = inject(IamStore);
  protected readonly stockValues: Record<number, number> = {};
  protected readonly isProvider = this.iam.isProvider;
  private readonly api = inject(InventoryApi);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly providerNames = signal<Record<number, string>>({});
  private confirming = false;

  protected readonly displayedColumns: string[] = [
    'name',
    ...(this.iam.isBuyer() ? ['provider'] : []),
    'fuelType',
    'pricePerUnit',
    'availableStock',
    'unit',
    'active',
    ...(this.isProvider() ? ['actions'] : []),
  ];

  ngOnInit(): void {
    if (this.iam.isBuyer()) {
      this.api.getProviders().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: providers => this.providerNames.set(Object.fromEntries(providers.map(p => [p.id, p.name]))),
        // Products remain visible with the provider ID if the directory is unavailable.
        error: () => this.providerNames.set({}),
      });
    }
    this.loadProducts();
  }

  protected onRefresh(): void {
    this.loadProducts();
  }

  private loadProducts(): void {
    this.store.loadAllProducts(this.iam.isProvider() ? this.iam.providerId() ?? undefined : undefined);
  }

  protected saveStock(productId: number): void {
    if (!this.isProvider()) return;
    const stock = this.stockValues[productId];
    if (Number.isFinite(stock) && stock >= 0) this.store.updateStock(productId, stock);
  }

  protected onDelete(productId: number): void {
    if (!this.isProvider() || this.confirming || this.store.isLoading() || this.store.mutatingId() !== null) return;
    this.confirming = true;
    this.dialog.open(this.confirmDialog).afterClosed().subscribe((ok) => { this.confirming = false; if (ok) this.store.deleteProduct(productId); });
  }
}
