"use client";

import { useState } from "react";
import { useProducts, useCreateMovement } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Search, Package, ArrowDownLeft, ArrowUpRight, RotateCcw } from "lucide-react";

interface StockMovementFormProps {
  variantId?: string;
  type?: "IN" | "OUT" | "ADJUSTMENT";
  onSuccess?: () => void;
}

export function StockMovementForm({ variantId: preselectedVariantId, type: preselectedType, onSuccess }: StockMovementFormProps) {
  const { data: productsData, isLoading: productsLoading } = useProducts({ pageSize: 1000 });
  const createMovement = useCreateMovement();

  const [selectedVariantId, setSelectedVariantId] = useState<string>(preselectedVariantId ?? "");
  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">(preselectedType ?? "OUT");
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flatten all variants for search
  const allVariants = productsData?.data.flatMap((product) =>
    product.variants.map((variant) => ({
      id: variant.id,
      productName: product.name,
      sku: variant.sku,
      size: variant.size,
      color: variant.color,
      fabric: variant.fabric,
      currentStock: variant.currentStock,
      lowStockAt: variant.lowStockAt,
      price: variant.price,
      searchText: `${product.name} ${variant.sku ?? ""} ${variant.size ?? ""} ${variant.color ?? ""} ${variant.fabric ?? ""}`.toLowerCase(),
    }))
  ) ?? [];

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);

  const resetForm = () => {
    if (!preselectedVariantId) {
      setSelectedVariantId("");
    }
    if (!preselectedType) {
      setType("OUT");
    }
    setQuantity(1);
    setNote("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedVariantId || quantity < 1) {
      setError("Please select a variant and enter a valid quantity");
      return;
    }

    try {
      await createMovement.mutateAsync({
        variantId: selectedVariantId,
        type,
        quantity,
        note: note.trim() || undefined,
      });

      toast.success(`${type === "IN" ? "Stock In" : type === "OUT" ? "Stock Out" : "Adjustment"} recorded: ${quantity} units`);
      resetForm();
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to record movement";
      setError(message);
      toast.error(message);
    }
  };

  const isLowStock = selectedVariant && selectedVariant.currentStock <= selectedVariant.lowStockAt;
  const isOutOfStock = selectedVariant && selectedVariant.currentStock === 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Variant Selector */}
      {!preselectedVariantId && (
        <div className="space-y-2">
          <Label>Product / Variant *</Label>
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={searchOpen}
                className="w-full justify-between h-12 text-base"
                disabled={productsLoading}
              >
                {selectedVariant ? (
                  <span className="truncate text-left">
                    {selectedVariant.productName} —{" "}
                    {[selectedVariant.size, selectedVariant.color, selectedVariant.sku]
                      .filter(Boolean)
                      .join(" / ") || "No details"}
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search by name, SKU, size, or color...
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search products..." />
                <CommandList>
                  <CommandEmpty>No products found.</CommandEmpty>
                  <CommandGroup>
                    {allVariants.map((variant) => (
                      <CommandItem
                        key={variant.id}
                        value={variant.searchText}
                        onSelect={() => {
                          setSelectedVariantId(variant.id);
                          setSearchOpen(false);
                        }}
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="font-medium">{variant.productName}</span>
                          <span className="text-xs text-muted-foreground">
                            {[variant.size, variant.color, variant.fabric, variant.sku]
                              .filter(Boolean)
                              .join(" / ") || "No details"}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge
                              variant={variant.currentStock === 0 ? "destructive" : variant.currentStock <= variant.lowStockAt ? "secondary" : "default"}
                              className="text-xs"
                            >
                              Stock: {variant.currentStock}
                            </Badge>
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Selected Variant Info */}
      {selectedVariant && (
        <Card className={cn("p-4", isOutOfStock ? "border-destructive" : isLowStock ? "border-amber-500" : "")}>
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{selectedVariant.productName}</p>
              <p className="text-sm text-muted-foreground">
                {[selectedVariant.size, selectedVariant.color, selectedVariant.fabric, selectedVariant.sku]
                  .filter(Boolean)
                  .join(" / ") || "No details"}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={isOutOfStock ? "destructive" : isLowStock ? "secondary" : "default"}>
                  Current Stock: {selectedVariant.currentStock}
                </Badge>
                {isOutOfStock && <span className="text-xs text-destructive">Out of stock!</span>}
                {isLowStock && !isOutOfStock && <span className="text-xs text-amber-600">Low stock warning</span>}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Movement Type */}
      {!preselectedType && (
        <div className="space-y-2">
          <Label>Movement Type</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={type === "IN" ? "default" : "outline"}
              onClick={() => setType("IN")}
              className="flex-1"
            >
              <ArrowDownLeft className="mr-2 h-4 w-4" />
              Stock In
            </Button>
            <Button
              type="button"
              variant={type === "OUT" ? "default" : "outline"}
              onClick={() => setType("OUT")}
              className="flex-1"
            >
              <ArrowUpRight className="mr-2 h-4 w-4" />
              Stock Out
            </Button>
            <Button
              type="button"
              variant={type === "ADJUSTMENT" ? "default" : "outline"}
              onClick={() => setType("ADJUSTMENT")}
              className="flex-1"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Adjust
            </Button>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="quantity">Quantity *</Label>
        <Input
          id="quantity"
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
          className="h-12 text-lg"
        />
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Textarea
          id="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this movement..."
          rows={2}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full h-12 text-lg"
        disabled={!selectedVariantId || quantity < 1 || createMovement.isPending}
      >
        {createMovement.isPending ? "Recording..." : type === "IN" ? "Record Stock In" : type === "OUT" ? "Record Stock Out" : "Record Adjustment"}
      </Button>
    </form>
  );
}

import { Card } from "@/components/ui/card";
