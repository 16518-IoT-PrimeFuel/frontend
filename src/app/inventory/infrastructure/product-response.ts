import { BaseResource } from '../../shared/infrastructure/base-response';
import { FuelType } from '../domain/model/fuel-product.entity';

export interface ProductResource extends BaseResource {
  id: number;
  name: string;
  fuelType: FuelType;
  pricePerUnit: number;
  unit: string;
  availableStock: number;
  capacity: number;
  providerId: number;
  active: boolean;
}

export type ProductsResponse = ProductResource[];
