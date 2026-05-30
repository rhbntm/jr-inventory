"use client";

import { useState } from "react";
import { useDashboard } from "@/lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3,
  Download,
} from "lucide-react";
import { toast } from "sonner";

const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  icon: typeof DollarSign;
  trend?: "up" | "down" | "neutral";
  loading: boolean;
}

function KPICard({ title, value, change, icon: Icon, trend, loading }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="space-y-1">
            <div className="text-2xl font-bold">{value}</div>
            {change && (
              <div
                className={`text-xs flex items-center gap-1 ${
                  trend === "up"
                    ? "text-green-600"
                    : trend === "down"
                    ? "text-red-600"
                    : "text-muted-foreground"
                }`}
              >
                {trend === "up" ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : trend === "down" ? (
                  <ArrowDownRight className="h-3 w-3" />
                ) : null}
                {change}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { data, isLoading } = useDashboard();
  const [timeRange, setTimeRange] = useState<"week" | "month">("month");

  const stats = data?.stats;

  const marginDistribution = stats?.marginDistribution ?? [];

  const movementTrend = stats?.movementTrend ?? [];

  const handleExport = async () => {
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `inventory-report-${new Date().toISOString().split("T")[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Excel report exported");
    } catch {
      toast.error("Failed to export report");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Business intelligence and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-1">
            <Button
              variant={timeRange === "week" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeRange("week")}
            >
              Week
            </Button>
            <Button
              variant={timeRange === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setTimeRange("month")}
            >
              Month
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Inventory Value (Cost)"
          value={`₱${(stats?.totalInventoryCost ?? 0).toLocaleString()}`}
          icon={Package}
          loading={isLoading}
        />
        <KPICard
          title="Potential Revenue"
          value={`₱${(stats?.totalInventoryRevenue ?? 0).toLocaleString()}`}
          icon={DollarSign}
          loading={isLoading}
        />
        <KPICard
          title="Total Profit Potential"
          value={`₱${(stats?.totalProfitPotential ?? 0).toLocaleString()}`}
          change={`${stats?.averageMarginPercent ?? 0}% avg margin`}
          icon={TrendingUp}
          trend="up"
          loading={isLoading}
        />
        <KPICard
          title="Investment ROI"
          value={
            stats?.totalInventoryCost && stats?.totalInventoryCost > 0
              ? `${(
                  ((stats?.totalProfitPotential ?? 0) / stats?.totalInventoryCost) *
                  100
                ).toFixed(1)}%`
              : "N/A"
          }
          change="Return on inventory cost"
          icon={TrendingUp}
          trend="up"
          loading={isLoading}
        />
      </div>

      {/* Today's Sales Performance */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              Today&apos;s Actual Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold">₱{(stats?.todayRevenue ?? 0).toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              Based on {stats?.todayMovementsOut ?? 0} items sold today
            </p>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-green-700">
              <TrendingUp className="h-4 w-4" />
              Today&apos;s Actual Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <div className="text-3xl font-bold text-green-700">₱{(stats?.todayProfit ?? 0).toLocaleString()}</div>
            )}
            <p className="text-xs text-green-600/70 mt-1">
              Net profit after product costs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Margin Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Profit Margin Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={marginDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => {
                      if (typeof value !== "number") return ["", ""];
                      return [
                        `${value}% (${marginDistribution.find((d) => d.value === value)?.count ?? 0} items)`,
                        "Percentage",
                      ];
                    }}
                  />
                  <Bar dataKey="value">
                    {marginDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Distribution of products by profit margin brackets
            </p>
          </CardContent>
        </Card>

        {/* Stock Movement Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Stock Movement Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={movementTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="in"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Stock In"
                  />
                  <Line
                    type="monotone"
                    dataKey="out"
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Stock Out"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Weekly IN vs OUT movements
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Inventory Efficiency</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cost per Variant</span>
                  <span className="font-medium">
                    ₱
                    {stats?.totalVariants && stats?.totalVariants > 0
                      ? (
                          (stats?.totalInventoryCost ?? 0) / stats?.totalVariants
                        ).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Revenue per Variant</span>
                  <span className="font-medium">
                    ₱
                    {stats?.totalVariants && stats?.totalVariants > 0
                      ? (
                          (stats?.totalInventoryRevenue ?? 0) / stats?.totalVariants
                        ).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Low Stock Items</span>
                  <span className="font-medium text-amber-600">
                    {stats?.lowStockCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Risk Percentage</span>
                  <span className="font-medium">
                    {stats?.totalVariants && stats?.totalVariants > 0
                      ? (((stats?.lowStockCount ?? 0) / stats?.totalVariants) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Today&apos;s Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items Received</span>
                  <span className="font-medium text-green-600">
                    +{stats?.todayMovementsIn ?? 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Items Sold</span>
                  <span className="font-medium text-blue-600">
                    -{stats?.todayMovementsOut ?? 0}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Phase 2 & 3 Coming Soon Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Top Profit Potential
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.topPerformers && stats.topPerformers.length > 0 ? (
              <div className="space-y-4">
                {stats.topPerformers.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku ?? "No SKU"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">₱{item.profit.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{item.currentStock} in stock</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <TrendingDown className="h-5 w-5" />
              Slow Moving Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : stats?.slowMovingItems && stats.slowMovingItems.length > 0 ? (
              <div className="space-y-4">
                {stats.slowMovingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium leading-none">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku ?? "No SKU"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">{item.currentStock} units</p>
                      <p className="text-xs text-muted-foreground">
                        {item.daysSinceLastMovement === null 
                          ? "No sales history" 
                          : `${item.daysSinceLastMovement} days since last sale`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No slow moving items found</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
