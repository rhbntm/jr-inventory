"use client";

import { useState } from "react";
import { useDashboard } from "@/lib/hooks";
import { AlertTriangle, X, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function LowStockBanner() {
  const { data } = useDashboard();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const lowStockItems = data?.lowStockItems ?? [];
  const lowStockCount = data?.stats.lowStockCount ?? 0;

  if (lowStockCount === 0) return null;

  // Separate out of stock from low stock
  const outOfStock = lowStockItems.filter((item) => item.currentStock === 0);
  const lowStock = lowStockItems.filter((item) => item.currentStock > 0 && item.currentStock <= item.lowStockAt);

  return (
    <div className={cn(
      "rounded-lg border p-4 mb-6",
      outOfStock.length > 0
        ? "border-destructive bg-destructive/10"
        : "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn(
          "h-5 w-5 mt-0.5 shrink-0",
          outOfStock.length > 0 ? "text-destructive" : "text-amber-600"
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className={cn(
              "font-semibold",
              outOfStock.length > 0 ? "text-destructive" : "text-amber-800 dark:text-amber-200"
            )}>
              {outOfStock.length > 0
                ? `${outOfStock.length} item(s) out of stock`
                : `${lowStockCount} item(s) with low stock`}
            </h3>
            <Badge variant={outOfStock.length > 0 ? "destructive" : "secondary"}>
              Attention Needed
            </Badge>
          </div>

          {/* Out of Stock Items */}
          {outOfStock.length > 0 && (
            <div className="mb-3">
              <p className="text-sm font-medium text-destructive mb-1">Out of Stock:</p>
              <div className="flex flex-wrap gap-2">
                {outOfStock.slice(0, 5).map((item) => (
                  <Badge key={item.variantId} variant="destructive" className="text-xs">
                    <Package className="mr-1 h-3 w-3" />
                    {item.productName}
                    {[item.size, item.color].filter(Boolean).join(" / ") && (
                      <span className="ml-1 opacity-90">
                        ({[item.size, item.color].filter(Boolean).join(" / ")})
                      </span>
                    )}
                  </Badge>
                ))}
                {outOfStock.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{outOfStock.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Low Stock Items */}
          {lowStock.length > 0 && (
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300 mb-1">
                Low Stock (at or below threshold):
              </p>
              <div className="flex flex-wrap gap-2">
                {lowStock.slice(0, 5).map((item) => (
                  <Badge key={item.variantId} variant="secondary" className="text-xs">
                    <Package className="mr-1 h-3 w-3" />
                    {item.productName}
                    {[item.size, item.color].filter(Boolean).join(" / ") && (
                      <span className="ml-1 opacity-90">
                        ({[item.size, item.color].filter(Boolean).join(" / ")})
                      </span>
                    )}
                    <span className="ml-1 font-mono">{item.currentStock} left</span>
                  </Badge>
                ))}
                {lowStock.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{lowStock.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 p-0"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
