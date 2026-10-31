import { z } from "zod";

export const variantSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  sku: z.preprocess(
    (val) => (val === "" ? null : val),
    z.string().trim().min(1).nullable().optional()
  ),
  size: z.string().trim().nullable().optional(),
  color: z.string().trim().nullable().optional(),
  fabric: z.string().trim().nullable().optional(),
  costPrice: z.coerce.number().min(0, "Cost price must be non-negative"),
  price: z.coerce.number().min(0, "Selling price must be non-negative"),
  salePrice: z.coerce.number().min(0, "Sale price must be non-negative").nullable().optional(),
  lowStockAt: z.coerce.number().int().min(0, "Low stock threshold must be non-negative").default(5),
  isArchived: z.boolean().optional(),
});

export const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  description: z.string().trim().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});

export const movementTypeSchema = z.enum(["IN", "OUT", "ADJUSTMENT"]);

export const movementSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  type: movementTypeSchema,
  // For ADJUSTMENT this is the new absolute stock level, so 0 is allowed.
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
  priceAtMovement: z.coerce.number().min(0).nullable().optional(),
  note: z.string().trim().nullable().optional(),
}).refine((d) => d.type === "ADJUSTMENT" || d.quantity >= 1, {
  message: "Quantity must be at least 1",
  path: ["quantity"],
});

export type VariantInput = z.infer<typeof variantSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type MovementInput = z.infer<typeof movementSchema>;

export const batchSchema = z.object({
  supplierName: z.string().trim().nullable().optional(),
  purchaseDate: z.coerce.date().nullable().optional(),
  totalCost: z.coerce.number().min(0).nullable().optional(),
  estimatedQty: z.coerce.number().int().min(0).nullable().optional(),
  category: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export const estimateSchema = z.object({
  sampleWeight: z.coerce.number().positive("Sample weight must be positive"),
  sampleQty: z.coerce.number().int().positive("Sample quantity must be at least 1"),
  totalWeight: z.coerce.number().positive("Total weight must be positive"),
});

export const batchProcessSchema = z.object({
  assignments: z.array(z.object({
    variantId: z.string().min(1),
    quantity: z.coerce.number().int().min(0),
    costPerUnit: z.coerce.number().min(0).nullable().optional(),
  })).min(1, "At least one variant assignment is required"),
  damagedQty: z.coerce.number().int().min(0).default(0),
  actualQty: z.coerce.number().int().min(0).nullable().optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1, "Category name is required").transform(s => s.trim()),
});

export const manualBatchSchema = z.object({
  header: z.object({
    supplierName: z.string().trim().nullable().optional(),
    purchaseDate: z.coerce.date().nullable().optional(),
    totalCost: z.coerce.number().min(0),
    estimatedQty: z.coerce.number().int().min(0),
    category: z.string().trim().nullable().optional(),
    notes: z.string().trim().nullable().optional(),
  }),
  variantMode: z.enum(["EXISTING", "NEW"]),
  variant: z.object({
    existingId: z.string().nullable().optional(), // Used if EXISTING
    productName: z.string().trim().nullable().optional(), // Used if NEW
    sku: z.string().trim().nullable().optional(),
    size: z.string().trim().nullable().optional(),
    color: z.string().trim().nullable().optional(),
    fabric: z.string().trim().nullable().optional(),
    price: z.coerce.number().min(0).nullable().optional(), // Manually set or auto-calculated
  }).optional(),
  tally: z.object({
    good: z.coerce.number().int().min(0).default(0),
    stained: z.coerce.number().int().min(0).default(0),
    damaged: z.coerce.number().int().min(0).default(0),
  }),
});

export const settingsMarkupSchema = z.object({
  markupPercent: z.coerce.number().min(0),
  fixedMarkup: z.coerce.number().min(0),
});

export type BatchInput = z.infer<typeof batchSchema>;
export type EstimateInput = z.infer<typeof estimateSchema>;
export type BatchProcessInput = z.infer<typeof batchProcessSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type ManualBatchInput = z.infer<typeof manualBatchSchema>;
export type SettingsMarkupInput = z.infer<typeof settingsMarkupSchema>;

export const conditionAdjustSchema = z.object({
  // Correction to good stock on hand: positive adds units, negative removes them.
  stockChange: z.coerce.number().int().default(0),
  toStained: z.coerce.number().int().min(0).default(0),
  toDamaged: z.coerce.number().int().min(0).default(0),
  note: z.string().trim().nullable().optional(),
}).refine(d => d.stockChange !== 0 || d.toStained + d.toDamaged > 0, {
  message: "Change the stock or move at least one unit",
});

export type ConditionAdjustInput = z.infer<typeof conditionAdjustSchema>;

export const createReservationSchema = z.object({
  variantId: z.string().min(1, "Variant ID is required"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  customerName: z.string().trim().nullable().optional(),
  priceAtReservation: z.coerce.number().min(0).nullable().optional(),
});

export const updateReservationSchema = z.object({
  action: z.enum(["ship", "deliver", "release", "return", "cancel"]),
  restock: z.boolean().optional(),
});

export const userRoleSchema = z.enum(["OWNER", "PARTNER"]);

export const inviteUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  name: z.string().trim().min(1, "Name is required"),
  role: userRoleSchema.default("PARTNER"),
  // Optional: without a password the user can only sign in with Google.
  password: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(8, "Password must be at least 8 characters").optional()
  ),
});

export const updateUserSchema = z.object({
  role: userRoleSchema,
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;