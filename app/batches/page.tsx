"use client";

import { useBatches } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Package, Calendar, DollarSign, ListTodo } from "lucide-react";
import Link from "next/link";

export default function BatchesPage() {
  const { data, isLoading } = useBatches();
  const batches = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Batches</h1>
        <div className="flex items-center gap-3">
          <Link href="/batches/new/manual">
            <Button id="manual-tally-btn" variant="outline">
              <ListTodo className="mr-2 h-4 w-4" />
              Manual Tally
            </Button>
          </Link>
          <Link href="/batches/new">
            <Button id="new-batch-btn">
              <Plus className="mr-2 h-4 w-4" />
              New Batch
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : batches.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No batches yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Use the Bale Counting Wizard to receive and record a new stock batch.
            </p>
            <div className="flex items-center gap-3">
              <Link href="/batches/new/manual">
                <Button id="manual-tally-empty-btn" variant="outline">
                  <ListTodo className="mr-2 h-4 w-4" /> Manual Tally
                </Button>
              </Link>
              <Link href="/batches/new">
                <Button id="new-batch-empty-btn">
                  <Plus className="mr-2 h-4 w-4" /> Create First Batch
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const totalAssigned = batch.movements.reduce((s, m) => s + m.quantity, 0);
            const pct = batch.actualQty && batch.damagedQty
              ? Math.round((batch.damagedQty / batch.actualQty) * 100)
              : 0;
            return (
              <Link href={`/batches/${batch.id}`} key={batch.id} className="block">
                <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">
                        {batch.supplierName ?? "Unknown Supplier"}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {batch.category && (
                          <Badge variant="secondary">{batch.category}</Badge>
                        )}
                        {batch.actualQty !== null ? (
                          <Badge variant="default">Processed</Badge>
                        ) : (
                          <Badge variant="outline">Pending</Badge>
                        )}
                        {pct > 0 && (
                          <Badge variant="destructive">{pct}% damaged</Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">
                      #{batch.id.slice(-6).toUpperCase()}
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
                    {batch.purchaseDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(batch.purchaseDate).toLocaleDateString()}
                      </span>
                    )}
                    {batch.totalCost && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5" />
                        ₱{Number(batch.totalCost).toLocaleString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      {totalAssigned} assigned · {batch.estimatedQty ?? "?"} estimated
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
