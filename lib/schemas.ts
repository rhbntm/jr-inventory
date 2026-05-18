import { z } from "zod";

export const variantSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  sku: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().trim().min(1, "SKU is required").nullable().optional()
  ),
  size: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  fabric: z.string().trim().nullable().optional(),
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  price: z.coerce.number().min(0, "Selling price must be non-negative"),
  salePrice: z.coerce.number().min(0, "Sale price must be non-negative").nullable().optional(),
  lowStockAt: z.coerce.number().int().min(0, "Low stock threshold must be non-negative").default(5),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().trim().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export const movementSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  priceAtMovement: z.coerce.number().min(0).nullable().optional(),
  note: z.string().trim().nullable().optional(),
});

export type VariantInput = z.infer<typeof variantSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type MovementInput = z.infer<typeof movementSchema>;
