export type ProviderUnit = 'LITRE' | 'GALLON';

export interface ProviderSite { id: number; customerAccountId: number; name: string; address: string | null; }

export interface ProviderBuyerCompany {
  id: number;
  name: string;
  ruc: string | null;
  sector: string | null;
  organizationId: number | null;
  tankCount: number;
  criticalTankCount: number;
  activeOrderCount: number;
  historicalOrderCount: number;
  sites: ProviderSite[];
}

export interface ProviderTankDevice { deviceId: string; channel: string; validFrom: string; }

export interface ProviderTank {
  id: number;
  buyerCompanyId: number;
  organizationId: number;
  customerAccountId: number;
  siteId: number;
  name: string;
  siteName: string | null;
  deliveryAddress: string | null;
  fuelType: string;
  fuelProductId: number | null;
  capacity: number;
  currentLevel: number;
  unit: ProviderUnit;
  levelPercent: number;
  lowLevelPercent: number;
  critical: boolean;
  levelObservedAt: string | null;
  levelSource: string;
  devices: ProviderTankDevice[];
}

export interface ProviderTankReading {
  id: number;
  tankId: number;
  deviceId: string;
  channel: string;
  sequence: number;
  level: number;
  unit: string;
  capturedAt: string;
  receivedAt: string;
  quality: string;
}

export interface BuyerLookup { buyerCompanyId: number; name: string; ruc: string; }

export interface NewBuyerCompany { name: string; ruc: string; sector?: string; address?: string; contactEmail?: string; phone?: string; siteName?: string; }

export interface NewProviderTank {
  buyerCompanyId: number; customerAccountId: number; siteId: number; name: string; fuelProductId: number;
  capacity: number; unit: ProviderUnit; initialLevel?: number; lowLevelPercent: number;
  deviceId: string; channel: string; autoGenerateEnabled?: boolean;
}

export type ProviderTankUpdate = Partial<Pick<NewProviderTank, 'fuelProductId' | 'lowLevelPercent' | 'deviceId' | 'channel' | 'autoGenerateEnabled'>>;
