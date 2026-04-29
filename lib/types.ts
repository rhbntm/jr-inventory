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
  description?: string;
  categoryId?: string;
};

export type CreateVariantInput = {
  productId: string;
  sku?: string;
  size?: string;
  color?: string;
  fabric?: string;
  costPrice?: number;  // Cost to buy from supplier
  price: number;       // Selling price to customer
  lowStockAt?: number;
};

export type CreateMovementInput = {
  variantId: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  note?: string;
};

export type DashboardStats = {
  totalProducts: number;
  totalVariants: number;
  lowStockCount: number;
  todayMovementsIn: number;
  todayMovementsOut: number;
  recentMovements: MovementWithDetails[];
  // Financial KPIs
  totalInventoryCost: number;
  totalInventoryRevenue: number;
  totalProfitPotential: number;
  averageMarginPercent: number;
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
