export type DeliveryPhysicalState = 'ASSIGNED' | 'STARTED' | 'ARRIVED' | 'DELIVERING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

/** Entrega del distribuidor (GET /deliveries). `status` es el estado legado; la UI usa `physicalState`. */
export interface ProviderDelivery {
  id: number;
  orderId: number;
  status: string;
  physicalState: DeliveryPhysicalState;
  driver: { id: number; firstName: string; lastName: string } | null;
  tanker: { id: number; licensePlate: string } | null;
  scheduledDate: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  buyerCompanyId: number | null;
  buyerCompanyName: string | null;
  customerAccountId: number | null;
  siteId: number | null;
  deliveryAddress: string | null;
  requestedVolume: number | null;
  unit: string | null;
  deliveredVolume: number | null;
}

export interface DeliveryRecommendation {
  orderId: number;
  recommended: boolean;
  /** NO_ELIGIBLE_DRIVER | NO_SUFFICIENT_ELIGIBLE_TANKER | RESERVATION_CONFLICT */
  reason: string | null;
  driverId: number | null;
  driverName: string | null;
  tankerId: number | null;
  licensePlate: string | null;
  tankerCapacityLitres: number | null;
  requestedVolumeLitres: number;
  windowStart: string;
  windowEnd: string;
  criterion: string;
}

export interface ValveObservation {
  id: number;
  state: 'OPEN' | 'CLOSED';
  unauthorized: boolean;
  commandId: string | null;
  recordedAt: string;
}
