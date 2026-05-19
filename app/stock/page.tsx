"use client";

import { useState, useRef, useCallback } from "react";
import { useProducts, useCreateMovement } from "@/lib/hooks";
import { movementSchema } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  Search,
  History,
  RotateCcw,
  ChevronDown,
  Minus,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Session movement tracking
interface SessionMovement {
  id: string;
  productName: string;
  variantDetails: string;
  type: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  timestamp: Date;
}

export default function QuickStockPage() {
  const { data: productsData, isLoading: productsLoading } = useProducts({ pageSize: 1000 });
  const createMovement = useCreateMovement();

  // Form state
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [note, setNote] = useState<string>("");
  const [priceOverride, setPriceOverride] = useState<number | "">("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sessionMovements, setSessionMovements] = useState<SessionMovement[]>([]);

  // Refs for keyboard navigation
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const noteInputRef = useRef<HTMLInputElement>(null);
  const inButtonRef = useRef<HTMLButtonElement>(null);
  const outButtonRef = useRef<HTMLButtonElement>(null);

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
      costPrice: Number(variant.costPrice ?? 0),
      price: Number(variant.price),
      salePrice: variant.salePrice ? Number(variant.salePrice) : null,
      searchText: `${product.name} ${variant.sku ?? ""} ${variant.size ?? ""} ${variant.color ?? ""} ${variant.fabric ?? ""}`.toLowerCase(),
    }))
  ) ?? [];

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);

  const resetForm = useCallback(() => {
    setSelectedVariantId("");
    setQuantity(1);
    setNote("");
    setPriceOverride("");
    // Focus back to search
    setTimeout(() => setSearchOpen(true), 100);
  }, []);

  const adjustQuantity = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleSubmit = async (type: "IN" | "OUT") => {
    const input = {
      variantId: selectedVariantId,
      type,
      quantity,
      priceAtMovement: priceOverride !== "" ? priceOverride : undefined,
      note: note.trim() || undefined,
    };

    const result = movementSchema.safeParse(input);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    try {
      await createMovement.mutateAsync(result.data);

      // Add to session history
      const newMovement: SessionMovement = {
        id: Date.now().toString(),
        productName: selectedVariant?.productName ?? "Unknown",
        variantDetails: [selectedVariant?.size, selectedVariant?.color, selectedVariant?.sku]
          .filter(Boolean)
          .join(" / ") || "No details",
        type,
        quantity,
        timestamp: new Date(),
      };
      setSessionMovements((prev) => [newMovement, ...prev].slice(0, 5));

      toast.success(`${type === "IN" ? "Stock In" : "Stock Out"} recorded: ${quantity} units`);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record movement");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: "quantity" | "note") => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "quantity") {
        noteInputRef.current?.focus();
      } else if (field === "note") {
        // Default to STOCK OUT on Enter (most common during live selling)
        outButtonRef.current?.focus();
      }
    }
  };

  const isLowStock = selectedVariant && selectedVariant.currentStock <= selectedVariant.lowStockAt;
  const isOutOfStock = selectedVariant && selectedVariant.currentStock === 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Quick Stock Entry</h1>
        <Badge variant="outline" className="text-sm">
          <RotateCcw className="mr-1 h-3 w-3" />
          Fast Mode
        </Badge>
      </div>

      {/* Main Entry Card */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Record Movement
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Variant Search */}
          <div className="space-y-2">
            <Label>Product / Variant *</Label>
            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
              <PopoverTrigger
                className="w-full justify-between h-12 text-base flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                disabled={productsLoading}
              >
                {selectedVariant ? (
                  <span className="truncate text-left flex-1">
                    {selectedVariant.productName} —{" "}
                    {[selectedVariant.size, selectedVariant.color, selectedVariant.sku]
                      .filter(Boolean)
                      .join(" / ") || "No details"}
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-2 flex-1">
                    <Search className="h-4 w-4" />
                    Search by name, SKU, size, or color...
                  </span>
                )}
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Type to search..." className="h-10" />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No variants found.</CommandEmpty>
                    <CommandGroup>
                      {allVariants.map((variant) => (
                        <CommandItem
                          key={variant.id}
                          value={variant.searchText}
                          onSelect={() => {
                            setSelectedVariantId(variant.id);
                            setPriceOverride(variant.salePrice ?? variant.price);
                            setSearchOpen(false);
                            // Focus quantity after selection
                            setTimeout(() => quantityInputRef.current?.focus(), 100);
                          }}
                        >
                          <div className="flex flex-col items-start w-full">
                            <div className="flex items-center justify-between w-full">
                              <span className="font-medium">{variant.productName}</span>
                              {variant.salePrice && (
                                <Badge variant="secondary" className="h-5 text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                  SALE
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {[variant.size, variant.color, variant.sku]
                                .filter(Boolean)
                                .join(" / ") || "No details"} — Stock: {variant.currentStock}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Current Stock Display */}
          {selectedVariant && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Current Stock</p>
                  <p
                    className={cn(
                      "text-3xl font-bold",
                      isOutOfStock && "text-destructive",
                      isLowStock && !isOutOfStock && "text-amber-600"
                    )}
                  >
                    {selectedVariant.currentStock}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Low Stock Alert</p>
                  <p className="text-lg font-medium">{selectedVariant.lowStockAt}</p>
                </div>
              </div>
              {isOutOfStock && (
                <Badge variant="destructive" className="mt-2">
                  OUT OF STOCK
                </Badge>
              )}
              {isLowStock && !isOutOfStock && (
                <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100">
                  LOW STOCK
                </Badge>
              )}
              {/* Pricing Info */}
              <div className="mt-3 pt-3 border-t border-border/50">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Cost</p>
                    <p className="font-medium">₱{selectedVariant.costPrice.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Normal Sell</p>
                    <p className={cn("font-medium", selectedVariant.salePrice && "line-through text-muted-foreground")}>
                      ₱{selectedVariant.price.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">{selectedVariant.salePrice ? "Sale Price" : "Profit"}</p>
                    <p className={cn(
                      "font-medium",
                      selectedVariant.salePrice 
                        ? "text-amber-600 font-bold" 
                        : (selectedVariant.price - selectedVariant.costPrice >= 0 ? "text-green-600" : "text-destructive")
                    )}>
                      {selectedVariant.salePrice 
                        ? `₱${selectedVariant.salePrice.toFixed(2)}` 
                        : `₱${(selectedVariant.price - selectedVariant.costPrice).toFixed(2)}`}
                    </p>
                  </div>
                </div>
                {selectedVariant.salePrice && (
                  <p className="text-[10px] text-amber-600 mt-1 font-medium bg-amber-50 px-2 py-0.5 rounded inline-block">
                    Active Sale: Save ₱{(selectedVariant.price - selectedVariant.salePrice).toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Pricing Override (NEW) */}
          {selectedVariant && (
            <div className="space-y-2 p-3 border rounded-lg bg-accent/30">
              <div className="flex items-center justify-between">
                <Label htmlFor="priceAtMovement" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Unit Price for this Transaction
                </Label>
                {priceOverride !== (selectedVariant.salePrice ?? selectedVariant.price) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-[10px]"
                    onClick={() => setPriceOverride(selectedVariant.salePrice ?? selectedVariant.price)}
                  >
                    Reset to Default
                  </Button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">₱</span>
                <Input
                  id="priceAtMovement"
                  type="number"
                  step="0.01"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  className="pl-7 h-10 text-lg font-bold border-2 focus-visible:ring-primary"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                This will be recorded in history as the actual selling price.
              </p>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity *</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => adjustQuantity(-1)}
                disabled={quantity <= 1}
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Input
                id="quantity"
                ref={quantityInputRef}
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                onKeyDown={(e) => handleKeyDown(e, "quantity")}
                className="h-12 text-center text-xl font-bold flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => adjustQuantity(1)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              ref={noteInputRef}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, "note")}
              placeholder="e.g., Live session sale, Restock from supplier..."
              className="h-12"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button
              ref={inButtonRef}
              type="button"
              size="lg"
              variant="default"
              className="h-16 text-lg bg-green-600 hover:bg-green-700"
              disabled={!selectedVariantId || createMovement.isPending}
              onClick={() => handleSubmit("IN")}
            >
              <ArrowDownLeft className="mr-2 h-6 w-6" />
              STOCK IN
            </Button>
            <Button
              ref={outButtonRef}
              type="button"
              size="lg"
              variant="destructive"
              className="h-16 text-lg"
              disabled={!selectedVariantId || createMovement.isPending}
              onClick={() => handleSubmit("OUT")}
            >
              <ArrowUpRight className="mr-2 h-6 w-6" />
              STOCK OUT
            </Button>
          </div>

          {/* Keyboard shortcuts hint */}
          <p className="text-xs text-muted-foreground text-center">
            Tab to navigate • Enter to submit • Esc to reset
          </p>
        </CardContent>
      </Card>

      {/* Session History */}
      {sessionMovements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              This Session (Last {sessionMovements.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionMovements.map((movement) => (
                <div
                  key={movement.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={movement.type === "IN" ? "default" : "destructive"}
                      className={cn(
                        "h-6 w-6 p-0 flex items-center justify-center rounded-full",
                        movement.type === "IN" && "bg-green-600"
                      )}
                    >
                      {movement.type === "IN" ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                    </Badge>
                    <div>
                      <p className="font-medium">{movement.productName}</p>
                      <p className="text-xs text-muted-foreground">{movement.variantDetails}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {movement.type === "OUT" ? "-" : "+"}
                      {movement.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {movement.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
