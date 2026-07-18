"use client";

import React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TrendingUp, AlertCircle } from "lucide-react";

export function SCurveChart({ data }: { data: any[] }) {
  // Format data for chart
  const chartData = data.map((item) => ({
    name: `Wk ${item.weekNumber}`,
    plan: Number(item.planCumulativePercent || 0),
    actual: item.actualCumulativePercent
      ? Number(item.actualCumulativePercent)
      : null,
    weeklyPlan: Number(item.planWeeklyPercent || 0),
    weeklyActual: item.actualWeeklyPercent
      ? Number(item.actualWeeklyPercent)
      : null,
  }));

  // Get current variance
  const latestActiveData = data.filter((d) => d.actualCumulativePercent > 0);
  const latestWeek = latestActiveData[latestActiveData.length - 1];
  const variance = latestWeek ? Number(latestWeek.variance || 0) : 0;

  return (
    <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden rounded-2xl pt-0">
      <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-4 px-6 pb-4 border-b border-border/20 flex flex-row items-center justify-between">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold gap-1.5 flex items-center">
            <TrendingUp className="w-5 h-5 text-primary" /> Visualisasi Master
            Schedule S-Curve
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground/80">
            Perbandingan Rencana Kumulatif (Plan) vs Progress Riil Lapangan
            (Actual).
          </CardDescription>
        </div>

        {latestWeek && (
          <div
            className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-bold ${variance >= 0 ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-destructive/10 border-destructive/20 text-destructive"}`}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              Deviasi:{" "}
              {variance >= 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2)}%
            </span>
          </div>
        )}
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPlan" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="rgb(59, 130, 246)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="rgb(59, 130, 246)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="rgb(34, 197, 94)"
                    stopOpacity={0.2}
                  />
                  <stop
                    offset="95%"
                    stopColor="rgb(34, 197, 94)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="rgba(229, 231, 235, 0.5)"
              />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                dy={10}
                interval={0}
                style={{ fontSize: "9px", fill: "var(--muted-foreground)" }}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                dx={-10}
                style={{ fontSize: "10px", fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(255, 255, 255, 0.95)",
                  border: "1px solid rgba(229, 231, 235, 0.8)",
                  borderRadius: "12px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05)",
                }}
                labelStyle={{
                  fontWeight: "bold",
                  fontSize: "11px",
                  color: "var(--foreground)",
                }}
                itemStyle={{ fontSize: "11px" }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px" }}
              />

              {/* Areas for curves */}
              <Area
                type="monotone"
                dataKey="plan"
                name="Rencana Kumulatif (Plan)"
                stroke="rgb(59, 130, 246)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPlan)"
              />
              <Area
                type="monotone"
                dataKey="actual"
                name="Aktual Kumulatif (Actual)"
                stroke="rgb(34, 197, 94)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorActual)"
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
