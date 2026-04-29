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

export type CreateProductInput = {
  name: string;
  description?: string | null;
  categoryId?: string | null;
};

export type CreateVariantInput = {
  productId: string;
  sku?: string | null;
  size?: string | null;
  color?: string | null;
  fabric?: string | null;
  costPrice?: number;  // Cost to buy from supplier
  price: number;       // Normal selling price
  salePrice?: number | null; // Optional promotional price
  lowStockAt?: number;
};

export type CreateMovementInput = {
  variantId: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  priceAtMovement?: number | null;
  note?: string | null;
};

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
  lowStockAt: number;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ApiError = {
  error: string;
  details?: string;
};
