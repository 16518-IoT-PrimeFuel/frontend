import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FuelProduct, CreateProductPayload, UpdateProductPayload } from '../domain/model/fuel-product.entity';
import { ProductApiEndpoint } from './product-api-endpoint';

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly endpoint: ProductApiEndpoint;

  constructor(http: HttpClient) {
    this.endpoint = new ProductApiEndpoint(http);
  }

  getAllProducts(): Observable<FuelProduct[]> { return this.endpoint.getAll(); }
  getProductsByProvider(providerId: number): Observable<FuelProduct[]> { return this.endpoint.getByProvider(providerId); }
  getProductById(id: number): Observable<FuelProduct> { return this.endpoint.getById(id); }
  createProduct(payload: CreateProductPayload): Observable<FuelProduct> { return this.endpoint.createProduct(payload); }
  updateProduct(id: number, payload: UpdateProductPayload): Observable<FuelProduct> { return this.endpoint.updateProduct(id, payload); }
  updateStock(id: number, stock: number): Observable<FuelProduct> { return this.endpoint.updateStock(id, stock); }
  deleteProduct(id: number): Observable<void> { return this.endpoint.delete(id); }
}
