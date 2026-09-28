import { Injectable, signal, inject } from '@angular/core';
import { InventoryApi } from '../infrastructure/inventory-api';
import { FuelProduct, CreateProductPayload, UpdateProductPayload } from '../domain/model/fuel-product.entity';

@Injectable({ providedIn: 'root' })
export class InventoryStore {
  private readonly api = inject(InventoryApi);
  private readonly _productList = signal<FuelProduct[]>([]);
  private readonly _selectedProduct = signal<FuelProduct | null>(null);
  private readonly _isLoading = signal(false);
  private readonly _error = signal<string | null>(null);
  readonly productList = this._productList.asReadonly();
  readonly selectedProduct = this._selectedProduct.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();

  loadAllProducts(providerId?: number): void {
    this._isLoading.set(true);
    this._error.set(null);
    (providerId === undefined ? this.api.getAllProducts() : this.api.getProductsByProvider(providerId)).subscribe({
      next: (products) => { this._productList.set(products); this._isLoading.set(false); },
      error: (error) => { this._error.set(error.message ?? 'Failed to load products'); this._isLoading.set(false); },
    });
  }

  loadProductById(id: number): void {
    this._isLoading.set(true);
    this.api.getProductById(id).subscribe({
      next: (product) => { this._selectedProduct.set(product); this._isLoading.set(false); },
      error: (error) => { this._error.set(error.message ?? 'Failed to load product'); this._isLoading.set(false); },
    });
  }

  createProduct(payload: CreateProductPayload, done?: () => void): void {
    this._isLoading.set(true);
    this.api.createProduct(payload).subscribe({
      next: (product) => { this._productList.update((list) => [...list, product]); this._isLoading.set(false); done?.(); },
      error: (error) => { this._error.set(error.message ?? 'Failed to create product'); this._isLoading.set(false); },
    });
  }

  updateProduct(id: number, payload: UpdateProductPayload, done?: () => void): void {
    this._isLoading.set(true);
    this.api.updateProduct(id, payload).subscribe({
      next: (product) => { this._productList.update((list) => list.map((item) => item.id === id ? product : item)); this._selectedProduct.set(product); this._isLoading.set(false); done?.(); },
      error: (error) => { this._error.set(error.message ?? 'Failed to update product'); this._isLoading.set(false); },
    });
  }

  updateStock(id: number, stock: number): void {
    this._isLoading.set(true);
    this.api.updateStock(id, stock).subscribe({
      next: (product) => { this._productList.update((list) => list.map((item) => item.id === id ? product : item)); this._isLoading.set(false); },
      error: (error) => { this._error.set(error.message ?? 'Failed to update stock'); this._isLoading.set(false); },
    });
  }

  deleteProduct(id: number): void {
    this._isLoading.set(true);
    this.api.deleteProduct(id).subscribe({
      next: () => { this._productList.update((list) => list.filter((item) => item.id !== id)); this._isLoading.set(false); },
      error: (error) => { this._error.set(error.message ?? 'Failed to delete product'); this._isLoading.set(false); },
    });
  }
}
