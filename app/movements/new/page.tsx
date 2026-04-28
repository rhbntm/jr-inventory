"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useProducts, useCreateMovement } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function NewMovementPage() {
  const router = useRouter();
  const { data: productsData } = useProducts();
  const createMovement = useCreateMovement();

  const [type, setType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");

  const selectedProduct = productsData?.data.find((p) => p.id === productId);
  const variants = selectedProduct?.variants ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variantId || !quantity) return;

    try {
      await createMovement.mutateAsync({
        variantId,
        type,
        quantity: parseInt(quantity),
        note: note.trim() || undefined,
      });
      toast.success("Movement recorded");
      router.push("/movements");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record movement");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/movements">
          <Button variant="outline" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Record Movement</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Type *</Label>
              <Select
                value={type}
                onValueChange={(v) => {
                  setType(v as "IN" | "OUT" | "ADJUSTMENT");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">Stock In</SelectItem>
                  <SelectItem value="OUT">Stock Out</SelectItem>
                  <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                value={productId}
                onValueChange={(v) => {
                  setProductId(v ?? "");
                  setVariantId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent>
                  {productsData?.data.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Variant *</Label>
              <Select
                value={variantId}
                onValueChange={(v) => setVariantId(v ?? "")}
                disabled={!productId}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      productId ? "Select a variant" : "Select a product first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.sku ?? "No SKU"} — Stock: {v.currentStock} —{" "}
                      {v.size ?? ""} {v.color ?? ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Link href="/movements">
                <Button variant="outline" type="button">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={createMovement.isPending}>
                {createMovement.isPending ? "Recording..." : "Record Movement"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
