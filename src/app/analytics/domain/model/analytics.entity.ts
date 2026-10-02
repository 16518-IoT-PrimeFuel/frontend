export interface MonthlyAmount {
  month: string;
  monthIndex: number;
  amount: number;
}

export interface SalesTrendPoint {
  date: string;
  litres: number;
}

export interface ProviderAnalytics {
  providerId: number;
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  totalRevenue: number;
  monthlyRevenue: MonthlyAmount[];
  pendingOrders: number;
  totalFuelSoldLitres: number;
  salesTrend: SalesTrendPoint[];
}

export interface PlatformSummary {
  totalOrders: number;
  totalDeliveries: number;
  totalPayments: number;
  totalRevenue: number;
  pendingOrders: number;
  completedDeliveries: number;
}

export interface BuyerAnalytics {
  totalOrders: number;
  totalSpent: number;
  completedPayments: number;
  pendingPayments: number;
  monthlySpending: MonthlyAmount[];
}
