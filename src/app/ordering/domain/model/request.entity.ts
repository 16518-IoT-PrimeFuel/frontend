export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type RequestSource = 'MANUAL' | 'AUTOMATIC';

export interface Request {
  id: number;
  organizationId: number;
  customerAccountId: number;
  tankId: number | null;
  providerId: number;
  fuelProductId: number;
  quantity: number;
  unit: string;
  unitPrice: number;
  status: RequestStatus;
  source: RequestSource;
  rejectionReason: string | null;
  orderId: number | null;
  deliveryAddress: string;
  deliveryDate: string;
  version: number;
}

export type CreateRequest = Pick<Request, 'customerAccountId' | 'tankId' | 'providerId' | 'fuelProductId' | 'quantity' | 'unit' | 'deliveryAddress' | 'deliveryDate'>;
