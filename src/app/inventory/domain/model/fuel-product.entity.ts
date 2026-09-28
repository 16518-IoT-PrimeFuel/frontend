import { BaseEntity } from '../../../shared/domain/model/base-entity';

export type FuelType = 'DIESEL' | 'GASOLINE' | 'GASOLINE_84' | 'GASOLINE_90' | 'GASOLINE_95' | 'GASOLINE_97' | 'GLP' | 'GNV';

export class FuelProduct implements BaseEntity {
  id!: number;
  name!: string;
  fuelType!: FuelType;
  pricePerUnit!: number;
  unit!: string;
  availableStock!: number;
  capacity!: number;
  providerId!: number;
  active!: boolean;

  constructor(params: FuelProduct) { Object.assign(this, params); }
}

export interface CreateProductPayload {
  name: string;
  fuelType: FuelType;
  pricePerUnit: number;
  unit: string;
  availableStock: number;
  capacity: number;
  providerId: number;
  active: boolean;
}

export type UpdateProductPayload = Omit<CreateProductPayload, 'providerId'>;
