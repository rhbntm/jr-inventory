"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useBatch, useReprocessBatch } from "@/lib/hooks";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, RotateCcw, Package, Calendar, DollarSign, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: batch, isLoading } = useBatch(id);
  const reprocessBatch = useReprocessBatch();
  const { data: session } = useSession();

  const [showReprocessDialog, setShowReprocessDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/batches">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Batch not found</h1>
        </div>
      </div>
    );
  }

  const isOwner = session?.user?.role === "OWNER";
  const isProcessed = batch.actualQty !== null;
  const totalAssigned = batch.movements.reduce((sum, m) => sum + m.quantity, 0);

  const handleReprocess = async () => {
    try {
      // Re-submit the exact same data to reprocess
      await reprocessBatch.mutateAsync({
        id,
        data: {
          assignments: batch.movements.map((m) => ({
            variantId: m.variantId,
            quantity: m.quantity,
            costPerUnit: Number(m.costPerUnit),
          })),
          damagedQty: batch.damagedQty ?? 0,
          actualQty: batch.actualQty ?? totalAssigned,
        }
      });
      toast.success("Batch reprocessed successfully");
      setShowReprocessDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reprocess batch");
      setShowReprocessDialog(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/batches">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight flex-1">
          Batch #{batch.id.slice(-6).toUpperCase()}
        </h1>
        {isOwner && isProcessed && (
          <Button
            variant="outline"
            className="text-amber-600 border-amber-600 hover:bg-amber-50"
            onClick={() => setShowReprocessDialog(true)}
            disabled={reprocessBatch.isPending}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reprocess
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Status</span>
              {isProcessed ? (
                <Badge variant="default">Processed</Badge>
              ) : (
                <Badge variant="outline">Pending</Badge>
              )}
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" /> Supplier
              </span>
              <span className="font-medium">{batch.supplierName ?? "N/A"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Purchase Date
              </span>
              <span className="font-medium">
                {batch.purchaseDate ? formatDate(new Date(batch.purchaseDate)) : "N/A"}
              </span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Total Cost
              </span>
              <span className="font-medium">
                {batch.totalCost ? `₱${Number(batch.totalCost).toLocaleString()}` : "N/A"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quantities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Estimated Qty</span>
              <span className="font-medium">{batch.estimatedQty ?? "N/A"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Actual Qty</span>
              <span className="font-medium">{batch.actualQty ?? "N/A"}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Damaged Qty</span>
              <span className="font-medium text-destructive">{batch.damagedQty ?? 0}</span>
            </div>
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Assigned to Variants</span>
              <span className="font-medium text-primary">{totalAssigned}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Variant Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {batch.movements.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No assignments for this batch.</p>
          ) : (
            <div className="divide-y border rounded-md">
              <div className="grid grid-cols-4 bg-muted/50 p-3 text-sm font-medium">
                <div className="col-span-2">Variant</div>
                <div className="text-right">Quantity</div>
                <div className="text-right">Cost Per Unit</div>
              </div>
              {batch.movements.map((movement) => (
                <div key={movement.id} className="grid grid-cols-4 items-center p-3 text-sm">
                  <div className="col-span-2">
                    <Link href={`/products/${movement.variant.productId}`} className="font-medium hover:underline text-primary">
                      {movement.variant.product.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[movement.variant.sku, movement.variant.size, movement.variant.color]
                        .filter(Boolean)
                        .join(" / ")}
                    </div>
                  </div>
                  <div className="text-right font-medium">{movement.quantity}</div>
                  <div className="text-right text-muted-foreground">
                    ₱{Number(movement.costPerUnit).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReprocessDialog} onOpenChange={setShowReprocessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" /> Reprocess Batch
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-3">
              <p>
                Reprocessing will recalculate and rewrite the stock movements for this batch.
                This is useful if the variant assignment logic changed or was interrupted.
              </p>
              <p className="font-medium text-foreground">
                This will:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Create reversal OUT movements for old assigned quantities.</li>
                <li>Delete old batch tracking records.</li>
                <li>Create new IN movements for current assignments.</li>
                <li>Update current stock based on the net difference.</li>
              </ul>
              <div className="bg-amber-50 text-amber-800 p-3 rounded-md text-sm mt-4">
                <strong>Warning:</strong> Ensure this batch has not been manually adjusted significantly, as reprocessing relies on current available stock to prevent negative inventory balances.
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowReprocessDialog(false)}
              disabled={reprocessBatch.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleReprocess}
              disabled={reprocessBatch.isPending}
            >
              {reprocessBatch.isPending ? "Reprocessing..." : "Confirm Reprocess"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
