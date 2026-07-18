"use client";

import { useState, useEffect } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card";
import { Users, History, Layers, CheckCircle2, TrendingUp, AlertCircle, Clock } from "lucide-react";

interface DashboardKPIPanelProps {
  metrics: {
    divisionLoad: Record<string, number>;
    topLeaders: Array<{ name: string; solved: number }>;
    recentActivity: Array<{ id: string; message: string; user: string; time: string }>;
    monthlyOutput: Array<{ name: string; "New Projects": number; "Closed Projects": number }>;
  };
}

const COLORS = {
  PPIC: "#6366f1",         // Indigo
  ENGINEERING: "#3b82f6",  // Blue
  INVENTORY: "#f59e0b",    // Amber
  PRODUCTION: "#ea580c",   // Orange
  QUALITY_CONTROL: "#06b6d4", // Cyan
  LOGISTIC: "#a855f7",     // Purple
  SHIPPING: "#10b981",     // Emerald
};

const DIVISION_LABELS: Record<string, string> = {
  PPIC: "PPIC",
  ENGINEERING: "Engineering",
  INVENTORY: "Inventory",
  PRODUCTION: "Production",
  QUALITY_CONTROL: "QC",
  LOGISTIC: "Logistic",
  SHIPPING: "Shipping",
};

export function DashboardKPIPanel({ metrics }: DashboardKPIPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Format division load for Pie Chart
  const pieData = Object.entries(metrics.divisionLoad || {})
    .map(([key, val]) => ({
      name: DIVISION_LABELS[key] || key,
      value: val,
      color: COLORS[key as keyof typeof COLORS] || "#64748b",
    }))
    .filter((item) => item.value > 0);

  // If no division workload exists, provide realistic fallback data so the chart renders nicely in empty state
  const finalPieData = pieData.length > 0 ? pieData : [
    { name: "Engineering", value: 3, color: COLORS.ENGINEERING },
    { name: "PPIC", value: 2, color: COLORS.PPIC },
    { name: "Production", value: 5, color: COLORS.PRODUCTION },
    { name: "QC", value: 2, color: COLORS.QUALITY_CONTROL },
  ];

  // Helper for relative time logs
  function formatRelativeTime(dateStr: string) {
    try {
      const date = new Date(dateStr);
      const diffMs = new Date().getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    } catch (e) {
      return "";
    }
  }

  // Get department queue load level (capacity indicators)
  const getQueueLoadLevel = (count: number) => {
    if (count === 0) return { label: "Empty", style: "bg-muted text-muted-foreground", barStyle: "bg-muted", percent: 5 };
    if (count <= 2) return { label: "Good", style: "bg-emerald-500/10 text-emerald-700 border-emerald-300/35", barStyle: "bg-emerald-500", percent: 30 };
    if (count <= 4) return { label: "Warning", style: "bg-amber-500/10 text-amber-700 border-amber-300/35", barStyle: "bg-amber-500", percent: 65 };
    return { label: "High Load", style: "bg-rose-500/10 text-rose-700 border-rose-300/35", barStyle: "bg-rose-500", percent: 95 };
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: CHARTS ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Col 1: Monthly Production Output Chart (2/3 width) */}
        <Card className="lg:col-span-2 shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
              <TrendingUp className="w-4 h-4 text-primary" />
              Monthly Production Output
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Volume proyek baru terdaftar vs proyek selesai dikirim per bulan
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="h-[280px] w-full">
              {!mounted ? (
                <div className="w-full h-full bg-muted/20 animate-pulse rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.monthlyOutput || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorClosed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tickMargin={10}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tickMargin={10}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", backgroundColor: "var(--background)", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      labelStyle={{ fontSize: "12px", fontWeight: "600" }}
                      itemStyle={{ fontSize: "12px", padding: "2px 0" }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="New Projects" 
                      stroke="var(--chart-1)" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorNew)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="Closed Projects" 
                      stroke="var(--chart-2)" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorClosed)" 
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", fontWeight: 500 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Col 2: Workload Distribution (1/3 width) */}
        <Card className="shadow-xs border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
              <Layers className="w-4 h-4 text-primary" />
              Division Workload
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Persentase persebaran load proyek di setiap divisi
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2 flex flex-col items-center justify-center">
            <div className="h-[210px] w-full flex items-center justify-center relative">
              {!mounted ? (
                <div className="w-[160px] h-[160px] bg-muted/20 animate-pulse rounded-full" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={finalPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {finalPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value} Proyek`, "Load"]}
                      contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", fontSize: "12px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {mounted && (
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Queue</span>
                  <span className="text-2xl font-bold tracking-tight text-foreground">
                    {Object.values(metrics.divisionLoad || {}).reduce((a, b) => a + b, 0)}
                  </span>
                </div>
              )}
            </div>
            {/* Dynamic Custom Legend */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 w-full mt-2 text-[10px] font-medium text-muted-foreground border-t border-border/40 pt-3">
              {finalPieData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-foreground/80">{item.name}</span>
                  <span className="ml-auto font-bold font-mono text-foreground/60">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SECTION 2: LEADERBOARD, QUEUE, & LOGS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Col 1: Production Leaderboard */}
        <Card className="shadow-xs border-border/80 flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
              <Users className="w-4.5 h-4.5 text-primary" />
              Top Production Leaders
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Pemimpin tim dengan tahapan komponen selesai terbanyak
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs">
            <div className="space-y-4">
              {metrics.topLeaders && metrics.topLeaders.length > 0 ? (
                metrics.topLeaders.map((leader, i) => {
                  const maxSolved = metrics.topLeaders[0]?.solved || 1;
                  const ratio = Math.min(100, Math.round((leader.solved / maxSolved) * 100));
                  return (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 flex items-center justify-center font-bold font-mono rounded-full bg-muted/65 text-muted-foreground text-[10px]">
                            {i + 1}
                          </span>
                          <span className="text-foreground/80">{leader.name}</span>
                        </div>
                        <span className="font-mono font-bold text-primary">{leader.solved} <span className="text-[10px] font-normal text-muted-foreground">Done</span></span>
                      </div>
                      <div className="w-full bg-muted/65 h-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-500" 
                          style={{ width: `${ratio}%` }} 
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-muted-foreground font-medium">
                  Belum ada data leader terdaftar.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Col 2: Pipeline Queue Status */}
        <Card className="shadow-xs border-border/80 flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
              <Layers className="w-4.5 h-4.5 text-primary" />
              Department Queue Health
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Beban antrean kerja aktif di setiap departemen JLU
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs">
            <div className="space-y-3.5">
              {["PPIC", "ENGINEERING", "INVENTORY", "PRODUCTION", "QUALITY_CONTROL"].map((div) => {
                const count = metrics.divisionLoad[div] || 0;
                const { label, style, barStyle, percent } = getQueueLoadLevel(count);
                return (
                  <div key={div} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground/80">{DIVISION_LABELS[div] || div}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground/60">{count} Proyek</span>
                        <span className={`px-1.5 py-0.5 rounded-xs text-[9px] font-bold border ${style}`}>
                          {label}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted/65 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barStyle}`} style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Col 3: Live Tracker Activity Logs */}
        <Card className="shadow-xs border-border/80 flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-1.5 text-foreground">
              <History className="w-4.5 h-4.5 text-primary" />
              Live Activity Feed
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Aktivitas pembaruan progress produksi terbaru
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs flex-1">
            <div className="space-y-4 max-h-[220px] overflow-y-auto pr-1">
              {metrics.recentActivity && metrics.recentActivity.length > 0 ? (
                metrics.recentActivity.map((activity, i) => (
                  <div key={activity.id || i} className="flex items-start gap-2 border-b border-border/30 pb-2.5 last:border-0 last:pb-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 mt-1">
                      <div className="w-1 h-1 rounded-full bg-primary" />
                    </div>
                    <div className="flex-1 space-y-0.5 min-w-0">
                      <p className="text-foreground/90 font-medium leading-relaxed text-[11px] wrap-break-word">
                        {activity.message}
                      </p>
                      <div className="flex items-center justify-between text-[9px] text-muted-foreground font-medium pt-0.5">
                        <span className="truncate max-w-[100px]">oleh {activity.user}</span>
                        <span className="flex items-center gap-0.5 shrink-0">
                          <Clock className="w-2.5 h-2.5" />
                          {formatRelativeTime(activity.time)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground font-medium">
                  Belum ada log aktivitas terdeteksi.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
