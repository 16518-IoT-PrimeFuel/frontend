export interface TankerResource {
  id: number; providerId: number; licensePlate: string; brand: string; model: string;
  capacity: number; unit: string; status: 'AVAILABLE' | 'IN_ROUTE' | 'MAINTENANCE' | 'SUSPENDED' | 'INACTIVE'; active: boolean;
}
