"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type TrendDay = { name: string; in: number; out: number };

const SERIES = [
  { key: "in", label: "Stock in", color: "var(--stock-in)" },
  { key: "out", label: "Stock out", color: "var(--stock-out)" },
] as const;

/** Trend names look like "Sat, Oct 31"; the axis only has room for the weekday. */
const weekday = (name: string) => name.split(",")[0];

export function MovementTrendChart({ data }: { data: TrendDay[] }) {
  const [view, setView] = useState<"chart" | "table">("chart");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-4 text-[13px] text-muted-foreground">
          {SERIES.map((series) => (
            <span key={series.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-[2px]" style={{ background: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          {(["chart", "table"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              onClick={() => setView(option)}
              className={cn(
                "min-h-8 cursor-pointer rounded-md border px-2.5 text-[13px] capitalize",
                view === option ? "border-foreground" : "border-border hover:bg-muted"
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <div className="h-52 w-full" role="img" aria-label="Units moved per day for the last 7 days. Switch to the table for exact numbers.">
          <ResponsiveContainer width="100%" height={208} initialDimension={{ width: 480, height: 208 }}>
            <BarChart data={data} barGap={2} margin={{ top: 4, right: 0, bottom: 0, left: -28 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="name"
                tickFormatter={weekday}
                tickLine={false}
                axisLine={{ stroke: "var(--input)" }}
                fontSize={12}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tick={{ fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--background)" }}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 13 }}
                labelStyle={{ fontWeight: 600, color: "var(--foreground)" }}
                itemStyle={{ color: "var(--foreground)", padding: 0 }}
              />
              {SERIES.map((series) => (
                <Bar
                  key={series.key}
                  dataKey={series.key}
                  name={series.label}
                  fill={series.color}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={16}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-right text-xs text-muted-foreground">
              <th scope="col" className="py-1 text-left font-medium">Day</th>
              <th scope="col" className="py-1 font-medium">Stock in</th>
              <th scope="col" className="py-1 font-medium">Stock out</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr key={day.name} className="border-t text-right">
                <td className="py-1 text-left">{day.name}</td>
                <td className="py-1">{day.in}</td>
                <td className="py-1">{day.out}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
