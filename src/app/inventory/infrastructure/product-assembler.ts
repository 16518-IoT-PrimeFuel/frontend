import { BaseAssembler } from '../../shared/infrastructure/base-assembler';
import { FuelProduct } from '../domain/model/fuel-product.entity';
import { ProductResource, ProductsResponse } from './product-response';

export class ProductAssembler implements BaseAssembler<FuelProduct, ProductResource, ProductsResponse> {
  toEntitiesFromResponse(response: ProductsResponse): FuelProduct[] {
    return response.map((resource) => this.toEntityFromResource(resource));
  }

  toEntityFromResource(resource: ProductResource): FuelProduct {
    return new FuelProduct(resource);
  }

  toResourceFromEntity(entity: FuelProduct): ProductResource {
    return { ...entity };
  }
}
