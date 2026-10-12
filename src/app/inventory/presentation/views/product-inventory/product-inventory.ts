import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { InventoryStore } from '../../../application/inventory.store';
import { IamStore } from '../../../../iam/application/iam.store';
import { InventoryApi } from '../../../infrastructure/inventory-api';
import { FuelProduct } from '../../../domain/model/fuel-product.entity';
import { MoneyPipe } from '../../../../shared/presentation/pipe/money.pipe';
import { FuelUnitPipe } from '../../../../shared/presentation/pipe/fuel-unit.pipe';
import { ProductForm } from '../product-form/product-form';

type StatusFilter = 'all' | 'active' | 'inactive';

/**
 * @summary Vista de catálogo de productos de combustible.
 * @remarks Tabla con búsqueda y pestañas por estado; alta y edición se hacen en un modal.
 * @author FullTank Platform
 */
@Component({
  selector: 'app-product-inventory',
  standalone: true,
  imports: [
    MoneyPipe, FuelUnitPipe, MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule, TranslatePipe,
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
  private formOpen = false;

  protected readonly search = signal('');
  protected readonly filter = signal<StatusFilter>('all');
  protected readonly filters: StatusFilter[] = ['all', 'active', 'inactive'];
  protected readonly isBuyer = this.iam.isBuyer;

  private matches(p: FuelProduct, filter: StatusFilter): boolean {
    return filter === 'all' || (filter === 'active') === p.active;
  }
  protected count(filter: StatusFilter): number { return this.store.productList().filter(p => this.matches(p, filter)).length; }
  protected readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return this.store.productList().filter(p => this.matches(p, this.filter()) && (!q || p.name.toLowerCase().includes(q)));
  });
  protected clearFilters(): void { this.search.set(''); this.filter.set('all'); }

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

  /** Alta (sin producto) o edición en el mismo modal. */
  protected openForm(product?: FuelProduct): void {
    if (!this.isProvider() || this.formOpen) return;
    this.formOpen = true;
    this.dialog.open(ProductForm, {
      data: { product },
      width: '620px', maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100dvh - 32px)', autoFocus: 'input',
    }).afterClosed().subscribe(() => { this.formOpen = false; });
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
