"use client";

import { useState, useEffect } from "react";
import { useCreateVariant, useUpdateVariant } from "@/lib/hooks";
import { variantSchema } from "@/lib/schemas";
import type { CreateVariantInput } from "@/lib/types";
import type { ProductVariant } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Free Size", "Other"];

interface VariantFormProps {
  productId: string;
  variant?: ProductVariant;
  onSuccess?: () => void;
}

export function VariantForm({ productId, variant, onSuccess }: VariantFormProps) {
  const isEditing = !!variant;
  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();
  const [formData, setFormData] = useState<CreateVariantInput>({
    productId,
    sku: "",
    size: undefined,
    color: "",
    fabric: "",
    costPrice: 0,
    price: 0,
    lowStockAt: 5,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const isPending = createVariant.isPending || updateVariant.isPending;

  // Initialize form when editing
  useEffect(() => {
    if (variant) {
      setFormData({
        productId,
        sku: variant.sku ?? "",
        size: variant.size ?? undefined,
        color: variant.color ?? "",
        fabric: variant.fabric ?? "",
        costPrice: Number(variant.costPrice ?? 0),
        price: Number(variant.price),
        salePrice: variant.salePrice ? Number(variant.salePrice) : null,
        lowStockAt: variant.lowStockAt,
      });
    }
  }, [variant, productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = variantSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (path && !fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      });
      setErrors(fieldErrors);
      toast.error("Please check the form for errors");
      return;
    }

    try {
      if (isEditing) {
        await updateVariant.mutateAsync({
          id: variant.id,
          data: result.data,
        });
        toast.success("Variant updated successfully");
      } else {
        await createVariant.mutateAsync(result.data);
        toast.success("Variant created successfully");
      }

      if (!isEditing) {
        setFormData({
          productId,
          sku: "",
          size: undefined,
          color: "",
          fabric: "",
          costPrice: 0,
          price: 0,
          salePrice: null,
          lowStockAt: 5,
        });
      }
      onSuccess?.();
    } catch (err: any) {
      const message = err instanceof Error ? err.message : "Failed to save variant";
      toast.error(message);
      
      // Handle server-side field validation (e.g. unique SKU)
      if (message.toLowerCase().includes("sku")) {
        setErrors({ sku: "This SKU is already in use" });
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku" className={errors.sku ? "text-destructive" : ""}>SKU</Label>
          <Input
            id="sku"
            value={formData.sku ?? ""}
            onChange={(e) => {
              setFormData({ ...formData, sku: e.target.value });
              if (errors.sku) setErrors({ ...errors, sku: "" });
            }}
            placeholder="e.g., SKU-001"
            disabled={isPending}
            className={errors.sku ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.sku && <p className="text-xs text-destructive font-medium">{errors.sku}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Size</Label>
          <Select
            value={formData.size ?? "none"}
            onValueChange={(value) =>
              setFormData({ ...formData, size: value === "none" ? undefined : value as string })
            }
            disabled={isPending}
          >
            <SelectTrigger id="size">
              <SelectValue placeholder="Select size..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Size</SelectItem>
              {SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="color">Color</Label>
          <Input
            id="color"
            value={formData.color ?? ""}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            placeholder="e.g., Black"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fabric">Fabric</Label>
          <Input
            id="fabric"
            value={formData.fabric ?? ""}
            onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
            placeholder="e.g., Cotton"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Pricing Section */}
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label htmlFor="costPrice" className={errors.costPrice ? "text-destructive" : ""}>
            Cost <span className="text-muted-foreground text-xs">(Buy)</span>
          </Label>
          <Input
            id="costPrice"
            type="number"
            min={0}
            step={0.01}
            value={formData.costPrice}
            onChange={(e) => {
              setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 });
              if (errors.costPrice) setErrors({ ...errors, costPrice: "" });
            }}
            placeholder="0.00"
            disabled={isPending}
            className={errors.costPrice ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.costPrice && <p className="text-xs text-destructive font-medium">{errors.costPrice}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="price" className={errors.price ? "text-destructive" : ""}>
            Normal Sell <span className="text-destructive">*</span>
          </Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            value={formData.price}
            onChange={(e) => {
              setFormData({ ...formData, price: parseFloat(e.target.value) || 0 });
              if (errors.price) setErrors({ ...errors, price: "" });
            }}
            placeholder="0.00"
            disabled={isPending}
            className={errors.price ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.price && <p className="text-xs text-destructive font-medium">{errors.price}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="salePrice" className={errors.salePrice ? "text-destructive" : ""}>
            Sale Price
          </Label>
          <Input
            id="salePrice"
            type="number"
            min={0}
            step={0.01}
            value={formData.salePrice ?? ""}
            onChange={(e) => {
              const val = e.target.value === "" ? null : parseFloat(e.target.value);
              setFormData({ ...formData, salePrice: val });
              if (errors.salePrice) setErrors({ ...errors, salePrice: "" });
            }}
            placeholder="Optional"
            disabled={isPending}
            className={errors.salePrice ? "border-destructive focus-visible:ring-destructive" : ""}
          />
          {errors.salePrice && <p className="text-xs text-destructive font-medium">{errors.salePrice}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lowStockAt">Low Stock</Label>
          <Input
            id="lowStockAt"
            type="number"
            min={0}
            value={formData.lowStockAt}
            onChange={(e) => setFormData({ ...formData, lowStockAt: parseInt(e.target.value) || 0 })}
            placeholder="5"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Profit Preview */}
      {(formData.price > 0 || (formData.salePrice ?? 0) > 0) && (
        <div className="p-3 bg-muted rounded-md text-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground font-medium">Standard Profit:</span>
            <span className={formData.price - (formData.costPrice ?? 0) >= 0 ? "text-green-600 font-bold" : "text-destructive font-bold"}>
              ₱{(formData.price - (formData.costPrice ?? 0)).toFixed(2)} 
              <span className="text-xs ml-1 font-normal">
                ({formData.price > 0 ? (((formData.price - (formData.costPrice ?? 0)) / formData.price) * 100).toFixed(1) : 0}%)
              </span>
            </span>
          </div>
          
          {formData.salePrice !== null && formData.salePrice !== undefined && formData.salePrice > 0 && (
            <div className="flex justify-between items-center pt-2 border-t border-muted-foreground/20">
              <span className="text-amber-600 font-medium">Sale Profit:</span>
              <span className={formData.salePrice - (formData.costPrice ?? 0) >= 0 ? "text-amber-600 font-bold" : "text-destructive font-bold"}>
                ₱{(formData.salePrice - (formData.costPrice ?? 0)).toFixed(2)}
                <span className="text-xs ml-1 font-normal">
                  ({formData.salePrice > 0 ? (((formData.salePrice - (formData.costPrice ?? 0)) / formData.salePrice) * 100).toFixed(1) : 0}%)
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      <Button
        type="submit"
        className="w-full"
        disabled={isPending || formData.price < 0}
      >
        {isPending
          ? isEditing
            ? "Updating..."
            : "Creating..."
          : isEditing
            ? "Update Variant"
            : "Create Variant"}
      </Button>
    </form>
  );
}
