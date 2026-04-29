"use client";

import { useDashboard } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Package,
  Boxes,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Activity,
  DollarSign,
  TrendingUp,
  Wallet,
  Percent,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number | string;
  icon: typeof Package;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  const stats = data?.stats;
  const lowStock = data?.lowStockItems ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

      {/* Inventory Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Products"
          value={stats?.totalProducts ?? 0}
          icon={Package}
          loading={isLoading}
        />
        <StatCard
          title="Total Variants"
          value={stats?.totalVariants ?? 0}
          icon={Boxes}
          loading={isLoading}
        />
        <StatCard
          title="Low Stock Items"
          value={stats?.lowStockCount ?? 0}
          icon={AlertTriangle}
          loading={isLoading}
        />
        <StatCard
          title="Today's Movements"
          value={`${stats?.todayMovementsIn ?? 0} / ${stats?.todayMovementsOut ?? 0}`}
          icon={Activity}
          loading={isLoading}
        />
      </div>

      {/* Financial KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Inventory Cost"
          value={`₱${(stats?.totalInventoryCost ?? 0).toLocaleString()}`}
          icon={Wallet}
          loading={isLoading}
        />
        <StatCard
          title="Potential Revenue"
          value={`₱${(stats?.totalInventoryRevenue ?? 0).toLocaleString()}`}
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard
          title="Profit Potential"
          value={`₱${(stats?.totalProfitPotential ?? 0).toLocaleString()}`}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title="Avg Margin"
          value={`${stats?.averageMarginPercent ?? 0}%`}
          icon={Percent}
          loading={isLoading}
        />
      </div>

      {/* Low Stock Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : lowStock.length === 0 ? (
            <p className="text-muted-foreground">No low stock items</p>
          ) : (
            <div className="space-y-3">
              {lowStock.map((item) => (
                <div
                  key={item.variantId}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {item.productName} — {item.sku ?? "No SKU"}
                    </div>
                    <div className="flex gap-2 text-sm text-muted-foreground">
                      {item.size && <span>Size: {item.size}</span>}
                      {item.color && <span>Color: {item.color}</span>}
                      {item.fabric && <span>Fabric: {item.fabric}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="destructive">{item.currentStock} left</Badge>
                    <span className="text-xs text-muted-foreground">
                      min {item.lowStockAt}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Movements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Movements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : stats?.recentMovements.length === 0 ? (
            <p className="text-muted-foreground">No recent movements</p>
          ) : (
            <div className="space-y-3">
              {stats?.recentMovements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {m.variant.product.name} — {m.variant.sku ?? "No SKU"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {m.note ?? "No note"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={m.type === "IN" ? "default" : "secondary"}
                      className="flex items-center gap-1"
                    >
                      {m.type === "IN" ? (
                        <ArrowDownLeft className="h-3 w-3" />
                      ) : (
                        <ArrowUpRight className="h-3 w-3" />
                      )}
                      {m.type} {m.quantity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </span>
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

