"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useProducts, useCreateReservation } from "@/lib/hooks";
import { createReservationSchema } from "@/lib/schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { ProductVariant } from "@prisma/client";
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
  CalendarPlus,
  Search,
  History,
  RotateCcw,
  ChevronDown,
  Minus,
  Plus,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionReservation {
  id: string;
  productName: string;
  variantDetails: string;
  customerName: string;
  quantity: number;
  timestamp: Date;
}

export default function QuickReservePage() {
  const { data: productsData, isLoading: productsLoading } = useProducts({ pageSize: 1000 });
  const createReservation = useCreateReservation();

  // Form state
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sessionReservations, setSessionReservations] = useState<SessionReservation[]>([]);

  // Refs
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  // Flatten variants
  const allVariants = productsData?.data.flatMap((product) =>
    product.variants.map((variant) => {
      const reserved = (variant as ProductVariant & { reservedStock?: number }).reservedStock || 0;
      const available = variant.currentStock - reserved;
      return {
        id: variant.id,
        productName: product.name,
        sku: variant.sku,
        size: variant.size,
        color: variant.color,
        fabric: variant.fabric,
        currentStock: variant.currentStock,
        reservedStock: reserved,
        availableStock: available,
        lowStockAt: variant.lowStockAt,
        searchText: `${product.name} ${variant.sku ?? ""} ${variant.size ?? ""} ${variant.color ?? ""} ${variant.fabric ?? ""}`.toLowerCase(),
      };
    })
  ) ?? [];

  const selectedVariant = allVariants.find((v) => v.id === selectedVariantId);

  const resetForm = useCallback(() => {
    setSelectedVariantId("");
    setQuantity(1);
    setCustomerName("");
    setTimeout(() => setSearchOpen(true), 100);
  }, []);

  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetForm();
      }
    };
    window.addEventListener("keydown", handleEscKey);
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [resetForm]);

  const adjustQuantity = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  const handleSubmit = async () => {
    const input = {
      variantId: selectedVariantId,
      quantity,
      customerName: customerName.trim() || null,
    };

    const result = createReservationSchema.safeParse(input);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }

    try {
      await createReservation.mutateAsync(result.data);

      const newReservation: SessionReservation = {
        // eslint-disable-next-line react-hooks/purity
        id: Date.now().toString(),
        productName: selectedVariant?.productName ?? "Unknown",
        variantDetails: [selectedVariant?.size, selectedVariant?.color, selectedVariant?.sku]
          .filter(Boolean)
          .join(" / ") || "No details",
        customerName: customerName.trim() || "Walk-in Customer",
        quantity,
        timestamp: new Date(),
      };

      setSessionReservations((prev) => [newReservation, ...prev].slice(0, 5));
      toast.success(`Reservation created for ${newReservation.customerName}: ${quantity} units`);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create reservation");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: "quantity" | "customer") => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (field === "quantity") {
        customerInputRef.current?.focus();
      } else if (field === "customer") {
        submitButtonRef.current?.focus();
      }
    }
  };

  const isOutOfStock = selectedVariant && selectedVariant.availableStock <= 0;
  const isLowStock = selectedVariant && selectedVariant.availableStock <= selectedVariant.lowStockAt;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Quick Reserve</h1>
        <Badge variant="outline" className="text-sm">
          <RotateCcw className="mr-1 h-3 w-3" />
          Reserve Mode
        </Badge>
      </div>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <CalendarPlus className="h-5 w-5" />
            Create Reservation
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
                            setSearchOpen(false);
                            setTimeout(() => quantityInputRef.current?.focus(), 100);
                          }}
                        >
                          <div className="flex flex-col items-start w-full">
                            <span className="font-medium">{variant.productName}</span>
                            <span className="text-sm text-muted-foreground">
                              {[variant.size, variant.color, variant.sku]
                                .filter(Boolean)
                                .join(" / ") || "No details"} — Available: {variant.availableStock} ({variant.reservedStock} reserved)
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

          {/* Stock Display Info */}
          {selectedVariant && (
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Available Stock</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      isOutOfStock && "text-destructive",
                      isLowStock && !isOutOfStock && "text-amber-600"
                    )}
                  >
                    {selectedVariant.availableStock}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Reserved Stock</p>
                  <p className="text-2xl font-bold text-blue-600">{selectedVariant.reservedStock}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Stock</p>
                  <p className="text-2xl font-bold">{selectedVariant.currentStock}</p>
                </div>
              </div>
              {isOutOfStock && (
                <div className="text-center">
                  <Badge variant="destructive" className="mt-2">
                    OUT OF AVAILABLE STOCK
                  </Badge>
                </div>
              )}
              {isLowStock && !isOutOfStock && (
                <div className="text-center">
                  <Badge variant="secondary" className="mt-2 bg-amber-100 text-amber-800 hover:bg-amber-100">
                    LOW AVAILABLE STOCK
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name (optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <User className="h-4 w-4" />
              </span>
              <Input
                id="customerName"
                ref={customerInputRef}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, "customer")}
                placeholder="e.g. Alice Smith, Order #1004"
                className="pl-9 h-12"
              />
            </div>
          </div>

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

          {/* Submit Button */}
          <Button
            ref={submitButtonRef}
            type="button"
            size="lg"
            className="w-full h-16 text-lg bg-primary hover:bg-primary/95 text-primary-foreground font-bold shadow-md"
            disabled={!selectedVariantId || createReservation.isPending}
            onClick={handleSubmit}
          >
            {createReservation.isPending ? "RESERVING..." : "RESERVE"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Tab to navigate • Enter to advance • Esc to reset
          </p>
        </CardContent>
      </Card>

      {/* Session Reservations History */}
      {sessionReservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              This Session (Last {sessionReservations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sessionReservations.map((res) => (
                <div
                  key={res.id}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      RES
                    </Badge>
                    <div>
                      <p className="font-medium">{res.productName}</p>
                      <p className="text-xs text-muted-foreground">{res.variantDetails}</p>
                      <p className="text-xs text-primary font-medium">Customer: {res.customerName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-blue-600">{res.quantity} units</p>
                    <p className="text-xs text-muted-foreground">
                      {res.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
