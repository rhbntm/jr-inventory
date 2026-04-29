"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useProduct, useCreateVariant, useUpdateVariant, useDeleteProduct, useDeleteVariant } from "@/lib/hooks";
import { variantSchema } from "@/lib/schemas";
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
  Save,
  X,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: product, isLoading } = useProduct(id);
  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();
  const deleteProduct = useDeleteProduct();
  const deleteVariant = useDeleteVariant();

  // Delete confirmation states
  const [showDeleteProductDialog, setShowDeleteProductDialog] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState<string | null>(null);

  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);

  // New variant form state
  const [sku, setSku] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [fabric, setFabric] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [price, setPrice] = useState("");
  const [lowStockAt, setLowStockAt] = useState("10");
  const [currentStock, setCurrentStock] = useState("0");

  // Edit variant state
  const [editPrice, setEditPrice] = useState("");
  const [editLowStock, setEditLowStock] = useState("");

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

  async function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    
    const input = {
      productId: id,
      sku: sku.trim() || undefined,
      size: size.trim() || undefined,
      color: color.trim() || undefined,
      fabric: fabric.trim() || undefined,
      costPrice: costPrice ? parseFloat(costPrice) : 0,
      price: parseFloat(price),
      lowStockAt: parseInt(lowStockAt),
    };

    const result = variantSchema.safeParse(input);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    try {
      await createVariant.mutateAsync(result.data);
      toast.success("Variant added");
      setShowVariantForm(false);
      setSku(""); setSize(""); setColor(""); setFabric(""); setCostPrice(""); setPrice(""); setLowStockAt("10");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add variant");
    }
  }

  async function handleUpdateVariant(variantId: string) {
    const input = {
      price: editPrice ? parseFloat(editPrice) : undefined,
      lowStockAt: editLowStock ? parseInt(editLowStock) : undefined,
    };

    const result = variantSchema.partial().safeParse(input);
    if (!result.success) {
      toast.error(result.error.errors[0].message);
      return;
    }

    try {
      await updateVariant.mutateAsync({
        id: variantId,
        data: result.data,
      });
      toast.success("Variant updated");
      setEditingVariant(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update variant");
    }
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
              <form onSubmit={handleAddVariant} className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
                </div>
                <div className="space-y-2">
                  <Label>Cost Price (Buy)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Selling Price (Sell) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Size</Label>
                  <Input value={size} onChange={(e) => setSize(e.target.value)} placeholder="S, M, L..." />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="Red, Blue..." />
                </div>
                <div className="space-y-2">
                  <Label>Fabric</Label>
                  <Input value={fabric} onChange={(e) => setFabric(e.target.value)} placeholder="Cotton..." />
                </div>
                <div className="space-y-2">
                  <Label>Low Stock Alert</Label>
                  <Input
                    type="number"
                    value={lowStockAt}
                    onChange={(e) => setLowStockAt(e.target.value)}
                    required
                  />
                </div>
                {/* Profit Preview */}
                {price && parseFloat(price) > 0 && (
                  <div className="md:col-span-2 p-3 bg-muted rounded-md text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Profit per unit:</span>
                      <span className={parseFloat(price) - (costPrice ? parseFloat(costPrice) : 0) >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                        {(parseFloat(price) - (costPrice ? parseFloat(costPrice) : 0)).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-muted-foreground">Margin:</span>
                      <span className="text-muted-foreground">
                        {((parseFloat(price) - (costPrice ? parseFloat(costPrice) : 0)) / parseFloat(price) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 flex justify-end gap-2">
                  <Button type="submit" disabled={createVariant.isPending}>
                    {createVariant.isPending ? "Adding..." : "Add Variant"}
                  </Button>
                </div>
              </form>
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
            {product.variants.map((variant) => (
              <Card key={variant.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{variant.sku ?? "No SKU"}</CardTitle>
                    <div className="flex gap-2">
                      {editingVariant === variant.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleUpdateVariant(variant.id)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setEditingVariant(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setEditingVariant(variant.id);
                              setEditPrice(String(variant.price));
                              setEditLowStock(String(variant.lowStockAt));
                            }}
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
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {variant.size && <Badge variant="outline">Size: {variant.size}</Badge>}
                    {variant.color && <Badge variant="outline">Color: {variant.color}</Badge>}
                    {variant.fabric && <Badge variant="outline">Fabric: {variant.fabric}</Badge>}
                  </div>
                  {/* Pricing Info */}
                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Cost: </span>
                        <span className="font-medium">{(Number((variant as any).costPrice) || 0).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sell: </span>
                        <span className="font-medium">{Number(variant.price).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Profit: </span>
                        <span className={Number(variant.price) - (Number((variant as any).costPrice) || 0) >= 0 ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                          {(Number(variant.price) - (Number((variant as any).costPrice) || 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Stock: </span>
                      <span className="font-medium">{variant.currentStock}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Low at: </span>
                      <span className="font-medium">{variant.lowStockAt}</span>
                    </div>
                  </div>
                  {editingVariant === variant.id && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                      <div className="space-y-1">
                        <Label className="text-xs">Price</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Low Stock</Label>
                        <Input
                          type="number"
                          value={editLowStock}
                          onChange={(e) => setEditLowStock(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Product Confirmation Dialog */}
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

      {/* Delete Variant Confirmation Dialog */}
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
    </div>
  );
}
