"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  History,
  Clock,
  ChevronLeft,
  ChevronRight,
  X,
  User,
} from "lucide-react";
import {
  getMasterplanWeeklyLogs,
  MasterplanWeeklyLogItem,
} from "@/app/actions/masterplan";
import { cn } from "@/lib/utils";

interface MasterplanWeeklyLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName?: string;
  totalWeeks: number;
  initialWeekNumber: number;
  weekHeaders: Array<{
    weekNumber: number;
    weekInMonth: string;
    dateRange: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }>;
  weeklyActValues?: number[];
  cachedLogs?: any[];
}

/**
 * Format tanggal & jam lokal dinamis mengikuti sistem/perangkat pengguna.
 */
export function formatDeviceDateTime(dateInput: Date | string | number): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";

    const formatter = new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZoneName: "short",
    });

    return formatter.format(d);
  } catch {
    const d = new Date(dateInput);
    return d.toLocaleTimeString("id-ID") + " WIB";
  }
}

export function MasterplanWeeklyLogPanel({
  isOpen,
  onClose,
  projectId,
  totalWeeks,
  initialWeekNumber,
  weekHeaders,
  weeklyActValues = [],
  cachedLogs = [],
}: MasterplanWeeklyLogPanelProps) {
  const [currentWeek, setCurrentWeek] = useState(initialWeekNumber || 1);
  const [sourceFilter, setSourceFilter] = useState<"ALL" | "PRODUCTION" | "QC">("ALL");
  const [logs, setLogs] = useState<MasterplanWeeklyLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (initialWeekNumber && initialWeekNumber >= 1 && initialWeekNumber <= totalWeeks) {
      setCurrentWeek(initialWeekNumber);
    }
  }, [initialWeekNumber, totalWeeks]);

  const activeHeader = weekHeaders[currentWeek - 1] || {
    weekNumber: currentWeek,
    weekInMonth: "I",
    dateRange: "",
  };

  const currentActWeight = weeklyActValues[currentWeek - 1] || 0;

  useEffect(() => {
    if (!isOpen || !projectId) return;

    const startDate = activeHeader.startDate;
    const endDate = activeHeader.endDate;

    if (!startDate || !endDate) {
      setLogs([]);
      return;
    }

    setIsLoading(true);
    startTransition(async () => {
      const res = await getMasterplanWeeklyLogs(
        projectId,
        new Date(startDate).toISOString(),
        new Date(endDate).toISOString(),
      );

      if (res.success && res.data) {
        setLogs(res.data);
      } else {
        const startMs = new Date(startDate).setHours(0, 0, 0, 0);
        const endMs = new Date(endDate).setHours(23, 59, 59, 999);
        const fallback = (cachedLogs || [])
          .filter((l: any) => {
            const t = new Date(l.createdAt).getTime();
            return t >= startMs && t <= endMs;
          })
          .map((l: any) => {
            const msg = l.message || "";
            const isQC = msg.toLowerCase().includes("qc") || msg.toLowerCase().includes("inspeksi");
            return {
              id: l.id,
              timestamp: l.createdAt,
              rawDate: new Date(l.createdAt),
              user: l.user || "Operator",
              source: (isQC ? "QC" : "PRODUCTION") as any,
              category: "GENERAL" as any,
              categoryLabel: isQC ? "Quality Control" : "Produksi",
              title: l.message,
              message: l.message,
            };
          });
        setLogs(fallback);
      }
      setIsLoading(false);
    });
  }, [isOpen, projectId, currentWeek, activeHeader.startDate, activeHeader.endDate, cachedLogs]);

  // Label zona waktu dinamis yang mendeteksi IANA timezone & offset sistem perangkat pengguna secara realtime
  const dynamicTimeZoneLabel = useMemo(() => {
    try {
      const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Jakarta";
      const offsetMinutes = -new Date().getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "-";
      const hours = Math.floor(Math.abs(offsetMinutes) / 60);
      const mins = Math.abs(offsetMinutes) % 60;
      const formattedOffset = mins === 0 ? `UTC${sign}${hours}` : `UTC${sign}${hours}:${String(mins).padStart(2, "0")}`;
      return `${tzName} (${formattedOffset})`;
    } catch {
      return "WIB (UTC+7)";
    }
  }, []);

  // Hitung jumlah log untuk masing-masing filter
  const counts = useMemo(() => {
    let production = 0;
    let qc = 0;
    for (const l of logs) {
      if (l.source === "QC" || l.category === "QC") {
        qc++;
      } else {
        production++;
      }
    }
    return { all: logs.length, production, qc };
  }, [logs]);

  // Filter logs berdasarkan sumber (Semua | Produksi | QC)
  const visibleLogs = useMemo(() => {
    if (sourceFilter === "ALL") return logs;
    if (sourceFilter === "QC") return logs.filter((l) => l.source === "QC" || l.category === "QC");
    return logs.filter((l) => l.source !== "QC" && l.category !== "QC");
  }, [logs, sourceFilter]);

  if (!isOpen) return null;

  return (
    <div className="border-b border-border bg-background text-foreground animate-in fade-in slide-in-from-top-1 duration-150">
      {/* 1. Header Bar Minimalis dengan Filter Sumber */}
      <div className="px-4 py-2 bg-muted/30 border-b border-border/50 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <History className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="font-bold text-foreground">
            Audit Log Minggu {activeHeader.weekNumber}
          </span>
          {activeHeader.dateRange && (
            <span className="text-muted-foreground text-[11px]">
              ({activeHeader.dateRange})
            </span>
          )}

          {/* Filter Sumber: Semua | Produksi | QC */}
          <div className="inline-flex items-center border border-border/70 rounded-md overflow-hidden bg-background text-[11px] p-0.5 ml-1">
            <button
              type="button"
              onClick={() => setSourceFilter("ALL")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors text-[10.5px]",
                sourceFilter === "ALL"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              Semua ({counts.all})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter("PRODUCTION")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors text-[10.5px]",
                sourceFilter === "PRODUCTION"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              Produksi ({counts.production})
            </button>
            <button
              type="button"
              onClick={() => setSourceFilter("QC")}
              className={cn(
                "px-2 py-0.5 rounded font-medium transition-colors text-[10.5px]",
                sourceFilter === "QC"
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "hover:bg-muted text-muted-foreground",
              )}
            >
              QC ({counts.qc})
            </button>
          </div>

          <span className="text-muted-foreground/60 hidden lg:inline">•</span>
          <span className="text-[10px] text-muted-foreground hidden lg:inline-flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground/80" />
            {dynamicTimeZoneLabel}
          </span>
        </div>

        {/* Paging, Bobot & Close Button */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] font-medium hidden sm:inline">
            Bobot:{" "}
            <span className={currentActWeight > 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
              {currentActWeight > 0 ? `+${currentActWeight.toFixed(2)}%` : "0.00%"}
            </span>
          </span>

          <div className="flex items-center border border-border/60 rounded-md bg-background overflow-hidden h-6">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              disabled={currentWeek <= 1}
              onClick={() => setCurrentWeek((prev) => Math.max(1, prev - 1))}
              title="Minggu Lalu"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="px-2 text-[10.5px] font-semibold text-foreground select-none">
              W-{currentWeek} / {totalWeeks}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted"
              disabled={currentWeek >= totalWeeks}
              onClick={() => setCurrentWeek((prev) => Math.min(totalWeeks, prev + 1))}
              title="Minggu Depan"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Tutup log"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 2. Daftar Log Minimalis & Bersih */}
      <div className="max-h-56 overflow-y-auto divide-y divide-border/40 text-[11px]">
        {isLoading ? (
          <div className="py-4 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
            <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span>Memuat log...</span>
          </div>
        ) : visibleLogs.length === 0 ? (
          <div className="py-4 px-4 text-center text-muted-foreground text-xs">
            {sourceFilter === "ALL"
              ? `Tidak ada aktivitas update progress pada Minggu ${activeHeader.weekNumber}.`
              : `Tidak ada log dari kategori ${sourceFilter === "QC" ? "QC" : "Produksi"} pada Minggu ${activeHeader.weekNumber}.`}
          </div>
        ) : (
          visibleLogs.map((log) => {
            const isQC = log.source === "QC" || log.category === "QC";

            return (
              <div
                key={log.id}
                className="px-4 py-1.5 flex items-center justify-between gap-3 hover:bg-muted/20 transition-colors"
              >
                {/* Left: Info Aktivitas */}
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    {formatDeviceDateTime(log.timestamp)}
                  </span>

                  {/* Badge Sumber */}
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1 py-0.2 rounded shrink-0",
                      isQC
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
                    )}
                  >
                    {isQC ? "QC" : "PROD"}
                  </span>

                  <span className="font-semibold text-foreground truncate">
                    {log.title}
                  </span>

                  {log.progressPercent !== undefined && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.2 rounded shrink-0">
                      {log.progressPercent.toFixed(1)}%
                    </span>
                  )}

                  <span className="text-muted-foreground truncate hidden sm:inline text-[10.5px]">
                    — {log.message}
                  </span>
                </div>

                {/* Right: Operator */}
                <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground shrink-0">
                  <User className="w-2.5 h-2.5 opacity-60" />
                  <span>{log.user}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// Backwards compatibility alias
export const MasterplanWeeklyLogDialog = MasterplanWeeklyLogPanel;
