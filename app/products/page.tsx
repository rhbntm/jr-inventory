"use client";

import { useState } from "react";
import Link from "next/link";
import { useProducts, useCategories, useSetProductArchived } from "@/lib/hooks";
import { describeStock, summarizeStock } from "@/lib/archive";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import type { ProductWithVariants } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Package } from "lucide-react";

function ArchivedProductCard({ product }: { product: ProductWithVariants }) {
  const setArchived = useSetProductArchived();
  const stock = describeStock(summarizeStock(product.variants));

  async function handleRestore() {
    try {
      await setArchived.mutateAsync({ id: product.id, archived: false });
      toast.success(`${product.name} restored`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore product");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-lg">
          <Link href={`/products/${product.id}`} className="min-w-0 hover:underline">
            {product.name}
          </Link>
          <Badge variant="secondary" className="shrink-0">Archived</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Category:</span>
          <span>{product.category?.name ?? "None"}</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Stock on hand:</span>
          <span className={stock ? "font-medium" : undefined}>{stock ?? "None"}</span>
        </div>
        <Button
          variant="outline"
          className="mt-4 h-11 w-full"
          onClick={handleRestore}
          disabled={setArchived.isPending}
        >
          {setArchived.isPending ? "Restoring..." : "Restore"}
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const showingArchived = view === "archived";

  const { data, isLoading } = useProducts({
    search: search || undefined,
    categoryId: categoryId || undefined,
    archived: showingArchived,
    // An archived product's stock total has to include variants retired on their own.
    showArchived: showingArchived,
  });

  const { data: categories } = useCategories();

  const products = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <Link href="/products/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Product
          </Button>
        </Link>
      </div>

      <div className="flex gap-2" role="group" aria-label="Which products to show">
        <Button
          variant={showingArchived ? "outline" : "default"}
          aria-pressed={!showingArchived}
          onClick={() => setView("active")}
        >
          Active
        </Button>
        <Button
          variant={showingArchived ? "default" : "outline"}
          aria-pressed={showingArchived}
          onClick={() => setView("archived")}
        >
          Archived
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {showingArchived ? "No archived products found" : "No products found"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => showingArchived ? (
            <ArchivedProductCard key={product.id} product={product} />
          ) : (
            <Link key={product.id} href={`/products/${product.id}`}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-lg">{product.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {product.description ?? "No description"}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Category:</span>
                    <span>{product.category?.name ?? "None"}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Variants:</span>
                    <span>{product.variants.length}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
