"use client";

import { useState, useEffect } from "react";
import { useCreateVariant, useUpdateVariant } from "@/lib/hooks";
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
  const updateVariant = useUpdateVariant(variant?.id ?? "");

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

  // Initialize form when editing
  useEffect(() => {
    if (variant) {
      setFormData({
        productId,
        sku: variant.sku ?? "",
        size: variant.size ?? undefined,
        color: variant.color ?? "",
        fabric: variant.fabric ?? "",
        costPrice: Number((variant as any).costPrice ?? 0),
        price: Number(variant.price),
        lowStockAt: variant.lowStockAt,
      });
    }
  }, [variant, productId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.price < 0) {
      toast.error("Selling price cannot be negative");
      return;
    }

    if (formData.costPrice !== undefined && formData.costPrice < 0) {
      toast.error("Cost price cannot be negative");
      return;
    }

    if (formData.lowStockAt! < 0) {
      toast.error("Low stock threshold cannot be negative");
      return;
    }

    try {
      if (isEditing) {
        await updateVariant.mutateAsync({
          sku: formData.sku || undefined,
          size: formData.size,
          color: formData.color || undefined,
          fabric: formData.fabric || undefined,
          costPrice: formData.costPrice,
          price: formData.price,
          lowStockAt: formData.lowStockAt,
        });
        toast.success("Variant updated successfully");
      } else {
        await createVariant.mutateAsync({
          productId,
          sku: formData.sku || undefined,
          size: formData.size,
          color: formData.color || undefined,
          fabric: formData.fabric || undefined,
          costPrice: formData.costPrice,
          price: formData.price,
          lowStockAt: formData.lowStockAt,
        });
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
          lowStockAt: 5,
        });
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save variant");
    }
  };

  const isPending = createVariant.isPending || updateVariant.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="sku">SKU</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder="e.g., SKU-001"
            disabled={isPending}
          />
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
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
            placeholder="e.g., Black"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fabric">Fabric</Label>
          <Input
            id="fabric"
            value={formData.fabric}
            onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
            placeholder="e.g., Cotton"
            disabled={isPending}
          />
        </div>
      </div>

      {/* Pricing Section */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="costPrice">
            Cost Price <span className="text-muted-foreground text-xs">(Buy)</span>
          </Label>
          <Input
            id="costPrice"
            type="number"
            min={0}
            step={0.01}
            value={formData.costPrice}
            onChange={(e) => setFormData({ ...formData, costPrice: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="price">
            Selling Price <span className="text-destructive">*</span> <span className="text-muted-foreground text-xs">(Sell)</span>
          </Label>
          <Input
            id="price"
            type="number"
            min={0}
            step={0.01}
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
            placeholder="0.00"
            disabled={isPending}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="lowStockAt">Low Stock Threshold</Label>
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
      {formData.price > 0 && (
        <div className="p-3 bg-muted rounded-md text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Profit per unit:</span>
            <span className={formData.price - (formData.costPrice ?? 0) >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
              {(formData.price - (formData.costPrice ?? 0)).toFixed(2)}
            </span>
          </div>
          {formData.price > 0 && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-muted-foreground">Margin:</span>
              <span className="text-muted-foreground">
                {((formData.price - (formData.costPrice ?? 0)) / formData.price * 100).toFixed(1)}%
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
