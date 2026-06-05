"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useProduct,
  useDeleteProduct,
  useDeleteVariant,
  useAdjustConditionStock,
} from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Package,
  Pencil,
  X,
  Trash2,
  Droplets,
  ShieldAlert,
  ArrowRightLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { VariantForm } from "@/components/variant-form";
import { ProductVariant } from "@prisma/client";
import { cn, formatDate } from "@/lib/utils";

// ─── Condition Adjust Dialog ─────────────────────────────────────────────────

type VariantForDialog = ProductVariant & { reservedStock?: number };

function ConditionAdjustDialog({
  variant,
  open,
  onClose,
}: {
  variant: VariantForDialog | null;
  open: boolean;
  onClose: () => void;
}) {
  const adjustCondition = useAdjustConditionStock();
  const [toStained, setToStained] = useState("");
  const [toDamaged, setToDamaged] = useState("");
  const [note, setNote] = useState("");

  if (!variant) return null;

  const available = variant.currentStock - (variant.reservedStock ?? 0);
  const stainedVal = Math.max(0, parseInt(toStained) || 0);
  const damagedVal = Math.max(0, parseInt(toDamaged) || 0);
  const total = stainedVal + damagedVal;
  const isOverLimit = total > available;
  const canSubmit = total > 0 && !isOverLimit && !adjustCondition.isPending;

  function handleClose() {
    setToStained("");
    setToDamaged("");
    setNote("");
    onClose();
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      await adjustCondition.mutateAsync({
        id: variant!.id,
        data: { toStained: stainedVal, toDamaged: damagedVal, note: note || null },
      });
      toast.success("Condition stock updated");
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to adjust stock");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Adjust Condition
          </DialogTitle>
          <DialogDescription>
            Transfer good-condition units into the Stained or Damaged buckets.
            This creates an audit entry in stock history.
          </DialogDescription>
        </DialogHeader>

        {/* Current stock summary */}
        <div className="grid grid-cols-3 gap-2 my-2">
          <div className="rounded-lg border bg-muted/30 p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Good</p>
            <p className="text-2xl font-bold text-green-600">{available}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">available</p>
          </div>
          <div className="rounded-lg border bg-amber-500/5 border-amber-500/30 p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Stained</p>
            <p className="text-2xl font-bold text-amber-500">
              {(variant as ProductVariant & { stainedStock?: number }).stainedStock ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">current</p>
          </div>
          <div className="rounded-lg border bg-destructive/5 border-destructive/30 p-3 text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Damaged</p>
            <p className="text-2xl font-bold text-destructive">
              {(variant as ProductVariant & { damagedStock?: number }).damagedStock ?? 0}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">current</p>
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="cond-stained"
                className="flex items-center gap-1.5 text-amber-600"
              >
                <Droplets className="h-4 w-4" />
                Move to Stained
              </Label>
              <Input
                id="cond-stained"
                type="number"
                min="0"
                max={available}
                placeholder="0"
                value={toStained}
                onChange={(e) => setToStained(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="cond-damaged"
                className="flex items-center gap-1.5 text-destructive"
              >
                <ShieldAlert className="h-4 w-4" />
                Move to Damaged
              </Label>
              <Input
                id="cond-damaged"
                type="number"
                min="0"
                max={available}
                placeholder="0"
                value={toDamaged}
                onChange={(e) => setToDamaged(e.target.value)}
              />
            </div>
          </div>

          {/* Running total / validation */}
          {total > 0 && (
            <div
              className={cn(
                "text-sm px-3 py-2 rounded-md border font-medium",
                isOverLimit
                  ? "bg-destructive/10 border-destructive/40 text-destructive"
                  : "bg-muted/50 border-border text-foreground",
              )}
            >
              {isOverLimit
                ? `⚠ Total (${total}) exceeds available stock (${available})`
                : `Transferring ${total} of ${available} available units`}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="cond-note">Reason / Note (optional)</Label>
            <Input
              id="cond-note"
              placeholder="e.g. Dropped in transit, washing accident..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={handleClose} disabled={adjustCondition.isPending}>
            Cancel
          </Button>
          <Button
            id="cond-submit"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {adjustCondition.isPending ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : (
              <><ArrowRightLeft className="mr-2 h-4 w-4" /> Confirm Transfer</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const deleteProduct = useDeleteProduct();
  const deleteVariant = useDeleteVariant();

  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<string | null>(null);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantToEdit, setVariantToEdit] = useState<ProductVariant | null>(null);
  const [variantForCondition, setVariantForCondition] = useState<VariantForDialog | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="space-y-6">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <p>Product not found</p>
      </div>
    );
  }

  async function handleDeleteProduct() {
    try {
      await deleteProduct.mutateAsync(id);
      toast.success("Product deleted");
      router.push("/products");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete product");
      setShowDeleteProductDialog(false);
    }
  }

  async function handleDeleteVariant(variantId: string) {
    try {
      await deleteVariant.mutateAsync(variantId);
      toast.success("Variant deleted");
      setVariantToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete variant");
      setVariantToDelete(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/products">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight flex-1">{product.name}</h1>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
          onClick={() => setShowDeleteProductDialog(true)}
          disabled={deleteProduct.isPending}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      {/* Product Info */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground">{product.description ?? "No description"}</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Category:</span>
            <span>{product.category?.name ?? "None"}</span>
          </div>
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <div>Created: {formatDate(product.createdAt)}</div>
            <div>Last updated: {formatDate(product.updatedAt)}</div>
          </div>
        </CardContent>
      </Card>

      {/* Variants */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Variants</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowVariantForm(!showVariantForm)}
          >
            {showVariantForm ? (
              <X className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {showVariantForm ? "Cancel" : "Add Variant"}
          </Button>
        </div>

        {showVariantForm && (
          <Card>
            <CardContent className="pt-6">
              <VariantForm
                productId={id}
                onSuccess={() => setShowVariantForm(false)}
              />
            </CardContent>
          </Card>
        )}

        {product.variants.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No variants yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {product.variants.map((variant) => {
              const v = variant as ProductVariant & {
                reservedStock?: number;
                stainedStock?: number;
                damagedStock?: number;
              };
              const available = v.currentStock - (v.reservedStock ?? 0);
              const stained = v.stainedStock ?? 0;
              const damaged = v.damagedStock ?? 0;
              const hasConditionStock = stained > 0 || damaged > 0;

              return (
                <Card key={variant.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        {variant.sku ?? "No SKU"}
                        {variant.isArchived && (
                          <Badge variant="secondary" className="text-[10px] h-5 uppercase tracking-wider bg-muted text-muted-foreground">
                            Archived
                          </Badge>
                        )}
                      </CardTitle>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title="Adjust condition"
                          onClick={() => setVariantForCondition(v)}
                        >
                          <ArrowRightLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setVariantToEdit(variant)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setVariantToDelete(variant.id)}
                          disabled={deleteVariant.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {variant.size && <Badge variant="outline">Size: {variant.size}</Badge>}
                      {variant.color && <Badge variant="outline">Color: {variant.color}</Badge>}
                      {variant.fabric && <Badge variant="outline">Fabric: {variant.fabric}</Badge>}
                    </div>

                    {/* Pricing */}
                    <div className="pt-2 border-t">
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Cost: </span>
                          <span className="font-medium">₱{(Number(variant.costPrice) || 0).toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Sell: </span>
                          <span className={cn("font-medium", variant.salePrice && "line-through text-muted-foreground text-xs")}>
                            ₱{Number(variant.price).toFixed(2)}
                          </span>
                          {variant.salePrice && (
                            <div className="text-amber-600 font-bold">
                              ₱{Number(variant.salePrice).toFixed(2)}
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Profit: </span>
                          {(() => {
                            const currentPrice = variant.salePrice ? Number(variant.salePrice) : Number(variant.price);
                            const profit = currentPrice - (Number(variant.costPrice) || 0);
                            return (
                              <span className={profit >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                                ₱{profit.toFixed(2)}
                                {variant.salePrice && <span className="text-[10px] block text-amber-600">(on sale)</span>}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Stock — good + condition buckets */}
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-muted-foreground">Good stock: </span>
                          <span className="font-semibold text-green-600">{available} available</span>
                          {(v.reservedStock ?? 0) > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({v.reservedStock} reserved)
                            </span>
                          )}
                        </div>
                        <div className="text-sm">
                          <span className="text-muted-foreground">Low at: </span>
                          <span className="font-medium">{variant.lowStockAt}</span>
                        </div>
                      </div>

                      {/* Condition buckets — always visible */}
                      <div className="grid grid-cols-2 gap-2">
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
                            stained > 0
                              ? "bg-amber-500/10 border-amber-500/40"
                              : "bg-muted/30 border-border opacity-60",
                          )}
                        >
                          <Droplets className={cn("h-4 w-4 flex-shrink-0", stained > 0 ? "text-amber-500" : "text-muted-foreground")} />
                          <div>
                            <p className="text-xs text-muted-foreground leading-none mb-0.5">Stained</p>
                            <p className={cn("font-bold tabular-nums", stained > 0 ? "text-amber-600" : "text-muted-foreground")}>
                              {stained}
                            </p>
                          </div>
                        </div>
                        <div
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-2 text-sm border",
                            damaged > 0
                              ? "bg-destructive/10 border-destructive/40"
                              : "bg-muted/30 border-border opacity-60",
                          )}
                        >
                          <ShieldAlert className={cn("h-4 w-4 flex-shrink-0", damaged > 0 ? "text-destructive" : "text-muted-foreground")} />
                          <div>
                            <p className="text-xs text-muted-foreground leading-none mb-0.5">Damaged</p>
                            <p className={cn("font-bold tabular-nums", damaged > 0 ? "text-destructive" : "text-muted-foreground")}>
                              {damaged}
                            </p>
                          </div>
                        </div>
                      </div>

                      {hasConditionStock && (
                        <p className="text-[11px] text-muted-foreground">
                          {stained + damaged} unit{stained + damaged !== 1 ? "s" : ""} in condition stock — sell at discount or write off
                        </p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground pt-1">
                      Created: {formatDate(variant.createdAt)}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Condition Adjust Dialog */}
      <ConditionAdjustDialog
        variant={variantForCondition}
        open={!!variantForCondition}
        onClose={() => setVariantForCondition(null)}
      />

      {/* Delete Product Dialog */}
      <Dialog open={showDeleteProductDialog} onOpenChange={setShowDeleteProductDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{product.name}</strong>? This action cannot be undone.
              {product.variants.length > 0 && (
                <span className="mt-2 block text-destructive">
                  This will also delete {product.variants.length} variant(s).
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteProductDialog(false)}
              disabled={deleteProduct.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={deleteProduct.isPending}
            >
              {deleteProduct.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Variant Dialog */}
      <Dialog open={!!variantToDelete} onOpenChange={() => setVariantToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Variant</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this variant? This action cannot be undone.
              {variantToDelete && (
                <span className="mt-2 block text-muted-foreground">
                  SKU: {product.variants.find(v => v.id === variantToDelete)?.sku ?? "No SKU"}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVariantToDelete(null)}
              disabled={deleteVariant.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => variantToDelete && handleDeleteVariant(variantToDelete)}
              disabled={deleteVariant.isPending}
            >
              {deleteVariant.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Variant Dialog */}
      <Dialog open={!!variantToEdit} onOpenChange={(open) => !open && setVariantToEdit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Variant</DialogTitle>
            <DialogDescription>
              Update details for variant {variantToEdit?.sku ?? "without SKU"}.
            </DialogDescription>
          </DialogHeader>
          {variantToEdit && (
            <VariantForm
              productId={id}
              variant={variantToEdit}
              onSuccess={() => setVariantToEdit(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
