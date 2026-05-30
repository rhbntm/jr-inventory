"use client";

import { useState } from "react";
import Link from "next/link";
import { useMovements } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowDownLeft, ArrowUpRight, Plus, Activity } from "lucide-react";

export default function MovementsPage() {
  const [type, setType] = useState<"" | "IN" | "OUT" | "ADJUSTMENT">("");
  const { data, isLoading } = useMovements({
    type: type || undefined,
  });

  const movements = data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Stock Movements</h1>
        <Link href="/movements/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Record Movement
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Types</SelectItem>
            <SelectItem value="IN">Stock In</SelectItem>
            <SelectItem value="OUT">Stock Out</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Movements List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : movements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No movements found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {movements.map((m) => (
            <Card key={m.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="space-y-1">
                  <div className="font-medium">
                    {m.variant.product.name} — {m.variant.sku ?? "No SKU"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {m.note ?? "No note"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(m.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={m.type === "IN" ? "default" : m.type === "OUT" ? "secondary" : "outline"}
                    className="flex items-center gap-1"
                  >
                    {m.type === "IN" ? (
                      <ArrowDownLeft className="h-3 w-3" />
                    ) : m.type === "OUT" ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : null}
                    {m.type} {m.quantity}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
