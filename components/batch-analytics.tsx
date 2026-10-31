"use client";

import { AlertTriangle, Layers } from "lucide-react";
import { useBatchAnalytics } from "@/lib/hooks";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingRows() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export function BatchAnalytics() {
  const { data: analytics, isLoading } = useBatchAnalytics();
  const topBatches = analytics?.topBatchesByProfit ?? [];
  const damagedBatches = analytics?.highestDamageBatches ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Top Batches by Profit
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingRows />
          ) : topBatches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No processed batches yet.</p>
          ) : (
            <div className="space-y-2">
              {topBatches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">{b.supplierName ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.purchaseDate ? new Date(b.purchaseDate).toLocaleDateString() : "—"}
                      {b.damagedQty ? ` · ${b.damagePercent}% damaged` : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-green-600">
                      +₱{b.estimatedProfit.toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      cost ₱{(b.totalCost ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Highest Damage Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingRows />
          ) : damagedBatches.length === 0 ? (
            <p className="text-muted-foreground text-sm">No damage data yet.</p>
          ) : (
            <div className="space-y-2">
              {damagedBatches.map((b) => (
                <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <div className="font-medium text-sm">{b.supplierName ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.purchaseDate ? new Date(b.purchaseDate).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={b.damagePercent > 20 ? "destructive" : "secondary"}>
                      {b.damagePercent}% damaged
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      {b.damagedQty ?? 0} / {b.actualQty ?? "?"} pcs
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
