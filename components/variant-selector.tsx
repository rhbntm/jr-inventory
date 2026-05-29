"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Search } from "lucide-react";

export interface VariantSearchItem {
  id: string;
  productName: string;
  sku: string | null;
  size: string | null;
  color: string | null;
  fabric: string | null;
  currentStock: number;
  lowStockAt: number;
  searchText: string;
}

interface VariantSelectorProps {
  variants: VariantSearchItem[];
  selectedVariantId: string;
  onSelectVariant: (id: string) => void;
  isLoading?: boolean;
  error?: string;
}

export function VariantSelector({
  variants,
  selectedVariantId,
  onSelectVariant,
  isLoading,
  error,
}: VariantSelectorProps) {
  const [open, setOpen] = useState(false);

  const selectedVariant = variants.find((v) => v.id === selectedVariantId);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between h-12 text-base",
              error && "border-destructive focus-visible:ring-destructive"
            )}
            disabled={isLoading}
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
                {variants.map((variant) => (
                  <CommandItem
                    key={variant.id}
                    value={variant.searchText}
                    onSelect={() => {
                      onSelectVariant(variant.id);
                      setOpen(false);
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
                          variant={
                            variant.currentStock === 0
                              ? "destructive"
                              : variant.currentStock <= variant.lowStockAt
                              ? "secondary"
                              : "default"
                          }
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
      {error && <p className="text-xs text-destructive font-medium">{error}</p>}
    </div>
  );
}
