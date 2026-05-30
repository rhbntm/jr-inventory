import type { Prisma } from "@prisma/client";

export type ProductWithVariants = Prisma.ProductGetPayload<{
  include: {
    category: true;
    variants: true;
  };
}>;

export type VariantWithProduct = Prisma.ProductVariantGetPayload<{
  include: {
    product: {
      include: { category: true };
    };
  };
}>;

export type MovementWithDetails = Prisma.StockMovementGetPayload<{
  include: {
    variant: {
      include: {
        product: true;
      };
    };
    user: true;
  };
}>;

export type DashboardStats = {
  totalProducts: number;
  totalVariants: number;
  lowStockCount: number;
  todayMovementsIn: number;
  todayMovementsOut: number;
  todayRevenue: number;
  todayProfit: number;
  recentMovements: MovementWithDetails[];
  // Financial KPIs
  totalInventoryCost: number;
  totalInventoryRevenue: number;
  totalProfitPotential: number;
  averageMarginPercent: number;
  movementTrend: {
    name: string;
    in: number;
    out: number;
  }[];
  marginDistribution: {
    name: string;
    value: number;
    count: number;
  }[];
  topPerformers: {
    id: string;
    name: string;
    sku: string | null;
    profit: number;
    salesCount: number;
    currentStock: number;
  }[];
  slowMovingItems: {
    id: string;
    name: string;
    sku: string | null;
    currentStock: number;
    daysSinceLastMovement: number | null;
  }[];
};

export type LowStockItem = {
  variantId: string;
  sku: string | null;
  productName: string;
  size: string | null;
  color: string | null;
  fabric: string | null;
  currentStock: number;
  reservedStock?: number;
  lowStockAt: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiErrorResponse = {
  error: string;
  details?: string;
};

export type BatchWithMovements = Prisma.BatchGetPayload<{
  include: {
    movements: {
      include: { variant: { include: { product: true } } };
    };
  };
}>;

export type BatchAnalytics = {
  topBatchesByProfit: {
    id: string;
    supplierName: string | null;
    purchaseDate: Date | null;
    totalCost: number | null;
    estimatedProfit: number;
    damagedQty: number | null;
    damagePercent: number;
  }[];
  highestDamageBatches: {
    id: string;
    supplierName: string | null;
    purchaseDate: Date | null;
    damagedQty: number | null;
    actualQty: number | null;
    damagePercent: number;
  }[];
};

export type ReservationWithDetails = Prisma.ReservationGetPayload<{
  include: {
    variant: {
      include: {
        product: true;
      };
    };
    user: true;
  };
}>;

export type AvailableStockResponse = {
  currentStock: number;
  reservedStock: number;
  availableStock: number;
};

