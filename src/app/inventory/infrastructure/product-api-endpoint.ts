import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map } from 'rxjs';
import { BaseApiEndpoint } from '../../shared/infrastructure/base-api-endpoint';
import { environment } from '../../../environments/environment';
import { FuelProduct, CreateProductPayload, UpdateProductPayload } from '../domain/model/fuel-product.entity';
import { ProductResource, ProductsResponse } from './product-response';
import { ProductAssembler } from './product-assembler';

export class ProductApiEndpoint extends BaseApiEndpoint<FuelProduct, ProductResource, ProductsResponse, ProductAssembler> {
  constructor(http: HttpClient) {
    super(http, `${environment.serverBasePath}/fuel-products`, new ProductAssembler());
  }

  override getAll(): Observable<FuelProduct[]> {
    return this.http.get<ProductsResponse>(this.endpointUrl).pipe(map((r) => this.assembler.toEntitiesFromResponse(r)), catchError(this.handleError('Failed to fetch products')));
  }

  getByProvider(providerId: number): Observable<FuelProduct[]> {
    return this.http.get<ProductsResponse>(`${this.endpointUrl}/provider/${providerId}`).pipe(map((r) => this.assembler.toEntitiesFromResponse(r)), catchError(this.handleError('Failed to fetch provider products')));
  }

  override getById(id: number): Observable<FuelProduct> {
    return this.http.get<ProductResource>(`${this.endpointUrl}/${id}`).pipe(map((r) => this.assembler.toEntityFromResource(r)), catchError(this.handleError('Failed to fetch product')));
  }

  createProduct(request: CreateProductPayload): Observable<FuelProduct> {
    return this.http.post<ProductResource>(this.endpointUrl, request).pipe(map((r) => this.assembler.toEntityFromResource(r)), catchError(this.handleError('Failed to create product')));
  }

  updateProduct(id: number, request: UpdateProductPayload): Observable<FuelProduct> {
    return this.http.put<ProductResource>(`${this.endpointUrl}/${id}`, request).pipe(map((r) => this.assembler.toEntityFromResource(r)), catchError(this.handleError('Failed to update product')));
  }

  updateStock(id: number, newStock: number): Observable<FuelProduct> {
    return this.http.post<ProductResource>(`${this.endpointUrl}/${id}/update-stock`, { newStock }).pipe(map((r) => this.assembler.toEntityFromResource(r)), catchError(this.handleError('Failed to update stock')));
  }

  override delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.endpointUrl}/${id}`).pipe(catchError(this.handleError('Failed to delete product')));
  }
}
