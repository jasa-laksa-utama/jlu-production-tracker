"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, CheckCircle2, AlertCircle, Truck, ExternalLink, History } from "lucide-react";
import { calculateMasterScheduleMatrix, generateWeekHeaders } from "@/lib/s-curve-calculator";
import { cn } from "@/lib/utils";
import { getPhaseProgressAtCutoff } from "@/lib/masterplan-cutoff-utils";
import { ShippingProgressDetailDialog } from "./shipping-progress-detail-dialog";
import { MasterplanWeeklyLogPanel } from "./masterplan-weekly-log-dialog";

/**
 * Monotonic Cubic Spline Interpolation for smooth, non-oscillating S-curves
 */
function generateMonotonicSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  if (points.length === 1)
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  if (points.length === 2)
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;

  const n = points.length;
  const dxs: number[] = [];
  const dys: number[] = [];
  const ms: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    dxs.push(dx);
    dys.push(dy);
    ms.push(dy / (dx || 1));
  }

  const c1s: number[] = [ms[0]];
  for (let i = 0; i < n - 2; i++) {
    const m = ms[i];
    const nextM = ms[i + 1];
    if (m * nextM <= 0) {
      c1s.push(0);
    } else {
      const dx_ = dxs[i];
      const dxNext = dxs[i + 1];
      const common = dx_ + dxNext;
      c1s.push((3 * common) / ((common + dxNext) / m + (common + dx_) / nextM));
    }
  }
  c1s.push(ms[ms.length - 1]);

  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const dx = dxs[i];
    const cp1x = p1.x + dx / 3;
    const cp1y = p1.y + (c1s[i] * dx) / 3;
    const cp2x = p2.x - dx / 3;
    const cp2y = p2.y - (c1s[i + 1] * dx) / 3;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

/**
 * Record actual weight contribution in the active week (without splitting across future weeks)
 */
function getWeeklyActValues(
  actualWeightContrib: number,
  totalWeeks: number,
  currentWeekNum: number,
): number[] {
  const result = new Array(totalWeeks).fill(0);
  if (actualWeightContrib <= 0) return result;

  const targetWeekIdx = Math.max(
    0,
    Math.min(totalWeeks - 1, currentWeekNum - 1),
  );
  result[targetWeekIdx] = Math.round(actualWeightContrib * 100) / 100;

  return result;
}

export function MasterScheduleTable({ project }: { project: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const [overlayBounds, setOverlayBounds] = useState<{
    width: number;
    height: number;
    left: number;
    top: number;
  }>({
    width: 0,
    height: 0,
    left: 0,
    top: 0,
  });
  const [isShippingDetailOpen, setIsShippingDetailOpen] = useState(false);
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [selectedWeekForLog, setSelectedWeekForLog] = useState<number>(1);

  const handleOpenWeekLog = (weekNumber: number) => {
    setSelectedWeekForLog(weekNumber);
    setIsLogDialogOpen(true);
  };

  if (!project || !project.masterplan) {
    return (
      <div className="p-8 text-center border border-dashed rounded-2xl bg-muted/10 text-muted-foreground">
        Masterplan belum diinisialisasi untuk proyek ini.
      </div>
    );
  }

  const masterplan = project.masterplan;
  const totalWeeks = masterplan.totalWeeks || 30;
  const startDate = masterplan.startDate || project.createdAt || new Date();
  const phases = masterplan.phases || [];

  // Map actual progress for each phase (e.g. Procurement, Engineering, Fabrication)
  const phaseActualMap: Record<string, number> = {};
  for (const p of phases) {
    phaseActualMap[p.code] = getPhaseProgressAtCutoff(p, project, new Date());
  }

  // 1. Calculate real-time total actual progress from all masterplan phases
  const totalActualProgressFromPhases = phases.reduce(
    (sum: number, phase: any) => {
      const weight = Number(phase.weightPercent || 0);
      const prog = getPhaseProgressAtCutoff(phase, project, new Date());
      return sum + (prog / 100) * weight;
    },
    0,
  );

  // 2. Determine current week number based on startDate
  const start = startDate ? new Date(startDate) : new Date();
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const elapsedDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const currentWeekNum = Math.min(
    totalWeeks,
    Math.max(1, Math.floor(elapsedDays / 7) + 1),
  );

  // 3. Build actual weekly progress map based on cutoff dates for each week
  const actualWeeklyCumulativeMap: Record<number, number> = {};
  const weekHeaderList = generateWeekHeaders(startDate, totalWeeks);

  for (let w = 1; w <= currentWeekNum; w++) {
    const wh = weekHeaderList[w - 1];
    if (wh && wh.endDate) {
      const weekCutoff = new Date(wh.endDate);
      weekCutoff.setHours(23, 59, 59, 999);

      const weekActualCum = phases.reduce((sum: number, phase: any) => {
        const weight = Number(phase.weightPercent || 0);
        const phaseProgAtCutoff = getPhaseProgressAtCutoff(
          phase,
          project,
          weekCutoff,
        );
        return sum + (phaseProgAtCutoff / 100) * weight;
      }, 0);

      actualWeeklyCumulativeMap[w] = Math.round(weekActualCum * 100) / 100;
    }
  }

  const matrix = calculateMasterScheduleMatrix(
    totalWeeks,
    startDate,
    phases,
    actualWeeklyCumulativeMap,
  );

  // Latest deviation
  const activeDeviations = matrix.summary.deviation.filter(
    (_, i) => (matrix.summary.actualProgressCumulative[i] || 0) > 0,
  );
  const latestDeviation =
    activeDeviations.length > 0
      ? activeDeviations[activeDeviations.length - 1]
      : matrix.summary.deviation[0] || 0;

  // Measure timeline grid area bounds relative to table container
  useEffect(() => {
    const updateBounds = () => {
      if (!tbodyRef.current || !containerRef.current) return;
      const containerEl = containerRef.current;
      const tbodyEl = tbodyRef.current;
      const firstRow = tbodyEl.querySelector("tr");
      if (!firstRow) return;

      const cells = firstRow.querySelectorAll("td");
      // Cells: 0=No, 1=Desc, 2=Index, 3=Duration, 4..N+3=Timeline weeks, N+4=Total
      if (cells.length < totalWeeks + 5) return;

      const firstWeekCell = cells[4];
      const lastWeekCell = cells[4 + totalWeeks - 1];

      const containerRect = containerEl.getBoundingClientRect();
      const tbodyRect = tbodyEl.getBoundingClientRect();
      const firstRect = firstWeekCell.getBoundingClientRect();
      const lastRect = lastWeekCell.getBoundingClientRect();

      const left = firstRect.left - containerRect.left;
      const top = tbodyRect.top - containerRect.top;
      const width = lastRect.right - firstRect.left;
      const height = tbodyRect.height;

      setOverlayBounds((prev) => {
        if (
          Math.abs(prev.width - width) < 1 &&
          Math.abs(prev.height - height) < 1 &&
          Math.abs(prev.left - left) < 1 &&
          Math.abs(prev.top - top) < 1
        ) {
          return prev;
        }
        return { width, height, left, top };
      });
    };

    updateBounds();
    window.addEventListener("resize", updateBounds);
    const timer = setTimeout(updateBounds, 150);
    return () => {
      window.removeEventListener("resize", updateBounds);
      clearTimeout(timer);
    };
  }, [totalWeeks, phases.length]);

  // Generate SVG points for Plan & Actual S-Curves
  const planPoints: Array<{ x: number; y: number }> = [];
  const actualPoints: Array<{ x: number; y: number }> = [];

  if (overlayBounds.width > 0 && overlayBounds.height > 0) {
    const colWidth = overlayBounds.width / totalWeeks;
    const paddingY = 10; // Inner padding from top/bottom borders of tbody
    const usableHeight = Math.max(10, overlayBounds.height - paddingY * 2);
    const bottomY = paddingY + usableHeight;

    // Start both S-Curves from Week 0 (x = 0, 0% progress at bottom)
    planPoints.push({ x: 0, y: bottomY });
    
    if (totalActualProgressFromPhases > 0 || matrix.summary.actualProgressCumulative.some(v => v > 0)) {
      actualPoints.push({ x: 0, y: bottomY });
    }

    for (let w = 1; w <= totalWeeks; w++) {
      const wIdx = w - 1;
      const x = (wIdx + 0.5) * colWidth;

      // Plan Y position
      const planVal = matrix.summary.planProgressCumulative[wIdx] || 0;
      const yPlan =
        paddingY +
        usableHeight * (1 - Math.min(100, Math.max(0, planVal)) / 100);
      planPoints.push({ x, y: yPlan });

      // Actual Y position
      const actualVal = matrix.summary.actualProgressCumulative[wIdx] || 0;
      if (
        actualVal > 0 ||
        (w <= currentWeekNum && totalActualProgressFromPhases > 0)
      ) {
        const effectiveActual =
          actualVal > 0 ? actualVal : totalActualProgressFromPhases;
        const yActual =
          paddingY +
          usableHeight *
            (1 - Math.min(100, Math.max(0, effectiveActual)) / 100);
        actualPoints.push({ x, y: yActual });
      }
    }
  }

  const planSvgPath = generateMonotonicSmoothPath(planPoints);
  const actualSvgPath = generateMonotonicSmoothPath(actualPoints);

  return (
    <Card className="border-border/60 shadow-xl bg-card/70 backdrop-blur-md overflow-hidden rounded-2xl pt-0 w-full max-w-full">
      <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-4 px-6 pb-4 border-b border-border/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground font-medium">
              Duration: {totalWeeks} Weeks
            </span>
          </div>
          <CardTitle className="text-lg font-extrabold gap-2 flex items-center text-foreground">
            <Table className="w-5 h-5 text-primary shrink-0" />
            MASTER SCHEDULE S-CURVE
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Tabel S-Curve Progress Plan dan Aktual
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          {/* S-Curve Legend */}
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-muted/40 border border-border/50 text-[11px] font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-b-2 border-dashed border-blue-600 dark:border-blue-400 inline-block"></span>
              <span className="text-blue-700 dark:text-blue-300">
                Plan S-Curve
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-1 rounded-full bg-red-600 dark:bg-red-400 inline-block"></span>
              <span className="text-red-600 dark:text-red-400">
                Actual S-Curve
              </span>
            </div>
          </div>

          <div
            className={cn(
              "px-3.5 py-1.5 rounded-xl border flex items-center gap-2 text-xs font-semibold shadow-2xs",
              latestDeviation >= 0
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
            )}
          >
            {latestDeviation >= 0 ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <div>
              <div className="text-xs opacity-80">Deviasi Terkini</div>
              <div className="text-xs font-medium leading-none pt-0.5">
                {latestDeviation >= 0
                  ? `+${latestDeviation.toFixed(2)}`
                  : latestDeviation.toFixed(2)}
                %
                <span className="text-[10px] ml-1 font-normal">
                  ({latestDeviation >= 0 ? "Ahead" : "Delay"})
                </span>
              </div>
            </div>
          </div>

          {/* Tombol Audit Log Progres Masterplan (Menu Toggle) */}
          <button
            type="button"
            onClick={() => {
              if (isLogDialogOpen) {
                setIsLogDialogOpen(false);
              } else {
                handleOpenWeekLog(currentWeekNum);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer",
              isLogDialogOpen
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted text-foreground border-border/70 hover:border-primary/40",
            )}
            title="Buka / tutup menu audit log progres mingguan masterplan"
          >
            <History
              className={cn(
                "w-3.5 h-3.5",
                isLogDialogOpen ? "text-primary-foreground" : "text-primary",
              )}
            />
            <span>Audit Log Progres</span>
          </button>
        </div>
      </CardHeader>

      {/* Menu Audit Log Progres Mingguan Simpel (Inline Panel) */}
      {project && (
        <MasterplanWeeklyLogPanel
          isOpen={isLogDialogOpen}
          onClose={() => setIsLogDialogOpen(false)}
          projectId={project.id}
          projectName={project.projectName || project.projectNumber}
          totalWeeks={totalWeeks}
          initialWeekNumber={selectedWeekForLog}
          weekHeaders={matrix.weekHeaders}
          weeklyActValues={matrix.summary.progressVarianceWeeks}
          cachedLogs={project.productionLogs}
        />
      )}

      <CardContent className="p-0">
        {/* Relative container wrapping table & SVG overlay with min-w-max */}
        <div ref={containerRef} className="relative overflow-x-auto max-w-full">
          {/* SVG S-Curve Overlay - Child of DIV container, NOT tbody (Valid HTML5) */}
          {overlayBounds.width > 0 && overlayBounds.height > 0 && (
            <svg
              className="absolute pointer-events-none z-20 overflow-visible"
              style={{
                left: `${overlayBounds.left}px`,
                top: `${overlayBounds.top}px`,
                width: `${overlayBounds.width}px`,
                height: `${overlayBounds.height}px`,
              }}
            >
              <defs>
                <filter
                  id="glowBlue"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="1"
                    stdDeviation="2"
                    floodColor="#2563eb"
                    floodOpacity="0.25"
                  />
                </filter>
                <filter
                  id="glowRed"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="1"
                    stdDeviation="2"
                    floodColor="#dc2626"
                    floodOpacity="0.3"
                  />
                </filter>
              </defs>

              {/* 1. Plan Cumulative S-Curve (Blue Dashed Line - Thinner & Subtle) */}
              {planSvgPath && (
                <path
                  d={planSvgPath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="1.5"
                  strokeOpacity="0.7"
                  strokeDasharray="5 3"
                  filter="url(#glowBlue)"
                />
              )}

              {/* 2. Actual Cumulative S-Curve (Red Solid Line - Thinner & Subtle) */}
              {actualSvgPath && (
                <path
                  d={actualSvgPath}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="2"
                  strokeOpacity="0.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glowRed)"
                />
              )}

              {/* Actual Points Markers (Subtle) */}
              {actualPoints.slice(1).map((pt, idx) => (
                <g key={idx}>
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r="3"
                    fill="#dc2626"
                    fillOpacity="0.9"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </g>
              ))}
            </svg>
          )}

          <table className="w-full text-left border-collapse font-sans min-w-max text-[10px]">
            <thead className="bg-muted/70 text-foreground border-b-2 border-border/60">
              {/* Row 1: Month Group Headers */}
              <tr>
                <th
                  rowSpan={3}
                  className="font-extrabold border-r border-border/40 text-center w-8 p-1.5"
                >
                  No
                </th>
                <th
                  rowSpan={3}
                  className="font-extrabold border-r border-border/40 p-1.5 min-w-44 max-w-56"
                >
                  Description
                </th>
                <th
                  rowSpan={3}
                  className="font-extrabold border-r border-border/40 text-center p-1.5 w-16"
                >
                  Index (%)
                </th>
                <th
                  rowSpan={3}
                  className="font-extrabold border-r border-border/40 text-center p-1.5 w-14"
                >
                  Duration (Week)
                </th>
                {matrix.monthHeaderGroups.map((mg, mIdx) => (
                  <th
                    key={mIdx}
                    colSpan={mg.weekCount}
                    className="text-center font-black border-r border-b border-border/50 bg-muted/90 text-foreground p-1 text-[10px]"
                  >
                    {mg.monthName}
                  </th>
                ))}
                {/* Total Percentage Column Header */}
                <th
                  rowSpan={3}
                  className="font-extrabold text-center bg-muted/90 border-l border-border/40 p-1.5 w-28 text-[10px]"
                >
                  <div>Total Percentage (%)</div>
                </th>
              </tr>
              {/* Row 2: Roman Numeral Week Headers */}
              <tr>
                {matrix.weekHeaders.map((wh) => (
                  <th
                    key={wh.weekNumber}
                    onClick={() => handleOpenWeekLog(wh.weekNumber)}
                    className="p-1 text-center font-extrabold border-r border-b border-border/40 bg-muted/60 w-9 text-[9px] cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors select-none"
                    title={`Klik untuk melihat detail log aktivitas Minggu ${wh.weekNumber}`}
                  >
                    {wh.weekInMonth}
                  </th>
                ))}
              </tr>
              {/* Row 3: Date Range Headers */}
              <tr>
                {matrix.weekHeaders.map((wh) => (
                  <th
                    key={wh.weekNumber}
                    onClick={() => handleOpenWeekLog(wh.weekNumber)}
                    className="p-1 text-center font-semibold text-muted-foreground border-r border-border/40 bg-muted/40 w-9 text-[8.5px] cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors select-none"
                    title={`Klik untuk melihat detail log aktivitas ${wh.dateRange}`}
                  >
                    {wh.dateRange}
                  </th>
                ))}
              </tr>
            </thead>

            {/* Work Items Rows - Each Item Has 2 Sub-Rows: Plan (Top) & Act (Bottom) */}
            <tbody
              ref={tbodyRef}
              className="divide-y-2 divide-border/60 bg-background/40"
            >
              {matrix.items.map((item, idx) => {
                const totalItemTarget = item.weeklyTargets.reduce(
                  (a, b) => a + b,
                  0,
                );
                // Find matching phase object
                const phaseObj = phases.find(
                  (p: any) => p.code === item.code || p.id === item.phaseId,
                );

                // Calculate incremental actual weight contribution per week for this phase
                const weeklyActValues = new Array(totalWeeks).fill(0);
                let prevProg = 0;

                if (phaseObj) {
                  for (let w = 1; w <= totalWeeks; w++) {
                    if (w <= currentWeekNum) {
                      const wh = matrix.weekHeaders[w - 1];
                      const weekCutoff = wh?.endDate
                        ? new Date(wh.endDate)
                        : new Date();
                      weekCutoff.setHours(23, 59, 59, 999);

                      const currentProg = getPhaseProgressAtCutoff(
                        phaseObj,
                        project,
                        weekCutoff,
                      );
                      const incProg = Math.max(0, currentProg - prevProg);
                      const incWeight =
                        (incProg / 100) * Number(phaseObj.weightPercent || 0);

                      weeklyActValues[w - 1] =
                        Math.round(incWeight * 100) / 100;
                      prevProg = currentProg;
                    }
                  }
                }

                const isManualPhase =
                  phaseObj &&
                  !phaseObj.code?.includes("PROCURE") &&
                  !phaseObj.code?.includes("PPIC") &&
                  !phaseObj.code?.includes("ENG") &&
                  !phaseObj.code?.includes("FAB") &&
                  !phaseObj.code?.includes("STRUKTUR") &&
                  !phaseObj.code?.includes("MEKANIKAL");

                return (
                  <React.Fragment key={item.code || idx}>
                    {/* Sub-Row 1: PLAN */}
                    <tr className="hover:bg-muted/20 transition-colors bg-muted-foreground/5">
                      <td
                        rowSpan={2}
                        className="text-center font-extrabold border-r border-border/40 text-muted-foreground align-middle bg-background/60 p-1"
                      >
                        {idx + 1}
                      </td>
                      <td
                        rowSpan={2}
                        className="font-semibold text-foreground border-r border-border/40 whitespace-pre-wrap align-middle bg-background/60 p-1.5 max-w-48 text-[11px]"
                      >
                        <div className="flex flex-col gap-1">
                          <span>{item.name}</span>
                          {(item.code === "SHIPMENT" ||
                            item.name?.toUpperCase().includes("SHIPMENT") ||
                            item.name?.toUpperCase().includes("PENGIRIMAN")) && (
                            <button
                              type="button"
                              onClick={() => setIsShippingDetailOpen(true)}
                              className="inline-flex items-center gap-1 text-[9.5px] text-primary hover:underline font-bold bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded w-fit transition-colors cursor-pointer border border-primary/20"
                              title="Klik untuk melihat monitoring status pengiriman per unit conveyor"
                            >
                              <Truck className="w-3 h-3 text-primary" />
                              <span>Detail Unit</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td
                        rowSpan={2}
                        className="text-center font-bold text-foreground border-r border-border/40 bg-background/60 align-middle p-1"
                      >
                        {item.weightPercent.toFixed(2)}
                      </td>
                      <td
                        rowSpan={2}
                        className="text-center font-bold border-r border-border/40 text-foreground align-middle bg-background/60 p-1"
                      >
                        {item.durationWeeks}
                      </td>

                      {/* Timeline Cells for PLAN */}
                      {matrix.weekHeaders.map((wh) => {
                        const wIdx = wh.weekNumber - 1;
                        const targetVal = item.weeklyTargets[wIdx] || 0;
                        const isActive = targetVal > 0;

                        return (
                          <td
                            key={wh.weekNumber}
                            className={cn(
                              "border-r border-border/40 text-center font-bold transition-colors p-0.5 text-[9.5px] w-9",
                              isActive
                                ? "bg-muted-foreground/20 text-foreground"
                                : "text-muted-foreground/30",
                            )}
                          >
                            {isActive ? targetVal.toFixed(2) : "-"}
                          </td>
                        );
                      })}

                      {/* Rightmost Cell for PLAN */}
                      <td className="border-l border-border/40 bg-muted-foreground/20 text-center p-1">
                        <div className="flex items-center justify-between px-1.5 py-0.5 text-foreground font-bold text-[9.5px]">
                          <span>{totalItemTarget.toFixed(2)}%</span>
                          <span className="text-[8.5px] px-1 rounded bg-muted-foreground/20">
                            Plan
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Sub-Row 2: ACT */}
                    <tr className="hover:bg-muted/20 transition-colors border-b border-border/50 bg-primary/5">
                      {/* Timeline Cells for ACT */}
                      {matrix.weekHeaders.map((wh) => {
                        const wIdx = wh.weekNumber - 1;
                        const actVal = weeklyActValues[wIdx] || 0;

                        return (
                          <td
                            key={wh.weekNumber}
                            onClick={() => handleOpenWeekLog(wh.weekNumber)}
                            className={cn(
                              "border-r border-border/40 text-center font-bold transition-colors p-0.5 text-[9.5px] w-9 cursor-pointer select-none",
                              actVal > 0
                                ? "bg-primary/20 text-foreground hover:bg-primary/40 hover:scale-105"
                                : "text-muted-foreground/20 hover:bg-muted/40",
                            )}
                            title={actVal > 0 ? `Klik untuk melihat rincian progres +${actVal.toFixed(2)}% pada Minggu ${wh.weekNumber}` : `Klik untuk melihat log Minggu ${wh.weekNumber}`}
                          >
                            {actVal > 0 ? actVal.toFixed(2) : "-"}
                          </td>
                        );
                      })}

                      {/* Rightmost Cell for ACT */}
                      <td className="border-l border-border/40 bg-primary/20 text-center p-1">
                        <div className="flex items-center justify-between px-1.5 py-0.5 text-foreground font-bold text-[9.5px]">
                          <span>
                            {(
                              ((Number(
                                (phaseObj?.code &&
                                  phaseActualMap[phaseObj.code] !== undefined &&
                                  phaseActualMap[phaseObj.code] > 0)
                                  ? phaseActualMap[phaseObj.code]
                                  : phaseObj?.actualProgress || 0,
                              ) /
                                100) *
                                item.weightPercent)
                            ).toFixed(2)}
                            %
                          </span>
                          <span className="text-[8.5px] px-1 rounded bg-primary/20">
                            Act
                          </span>
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* Total & Summary Rows */}
            <tfoot className="border-t-2 border-border/80 font-bold text-xs divide-y divide-border/40">
              {/* Total Header Row */}
              <tr className="bg-muted/50 font-semibold">
                <td
                  colSpan={2}
                  className="p-2 text-right font-semibold border-r border-border/40"
                >
                  Total
                </td>
                <td className="p-2 text-center font-semibold text-foreground border-r border-border/40">
                  100,00
                </td>
                <td
                  colSpan={totalWeeks + 1}
                  className="p-2 border-r border-border/40"
                ></td>
                <td className="p-2 text-center font-bold text-foreground bg-muted/60 border-r border-border/40"></td>
              </tr>

              {/* DEDICATED WEEK NUMBERS HEADER ROW */}
              <tr className="bg-muted/80 font-bold text-[10px]">
                <td
                  colSpan={4}
                  className="p-1.5 text-right border-r border-border/40 text-foreground"
                >
                  Week No.
                </td>
                {matrix.weekHeaders.map((wh) => (
                  <td
                    key={wh.weekNumber}
                    onClick={() => handleOpenWeekLog(wh.weekNumber)}
                    className="text-center font-black border-r border-border/40 text-foreground bg-muted/90 p-0.5 text-[9px] w-9 cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors select-none"
                    title={`Klik untuk melihat detail log aktivitas Minggu ${wh.weekNumber}`}
                  >
                    {wh.weekNumber}
                  </td>
                ))}
                <td className="p-1 text-center font-bold border-l border-border/40 bg-muted/60"></td>
              </tr>

              {/* SUMMARY ROW 1: PLAN PROGRESS MAIN WEEKS */}
              <tr className="bg-background">
                <td
                  colSpan={4}
                  className="p-2 font-bold border-r border-border/40 text-foreground uppercase text-[10px]"
                >
                  PLAN PROGRESS MAIN WEEKS
                </td>
                {matrix.summary.planProgressMainWeeks.map((val, wIdx) => (
                  <td
                    key={wIdx}
                    className="text-center font-bold border-r border-border/40 text-foreground p-0.5 text-[9px]"
                  >
                    {val > 0 ? val.toFixed(2) : "0,00"}
                  </td>
                ))}
                {/* Merged PLAN Cell on Far Right (rowSpan=2) */}
                <td
                  rowSpan={2}
                  className="p-2 text-center font-black text-foreground bg-muted-foreground/20 border-l border-border/40 text-xs align-middle"
                >
                  Plan
                </td>
              </tr>

              {/* SUMMARY ROW 2: PLAN PROGRESS CUMULATIVE/WEEK (Blue Line) */}
              <tr className="bg-muted-foreground/20">
                <td
                  colSpan={4}
                  className="p-2 font-bold border-r border-border/40 text-foreground uppercase text-[10px]"
                >
                  PLAN PROGRESS COMULATIVE/WEEK
                </td>
                {matrix.summary.planProgressCumulative.map((val, wIdx) => (
                  <td
                    key={wIdx}
                    className="text-center font-bold border-r border-border/40 text-foreground p-0.5 text-[9px]"
                  >
                    {val.toFixed(2)}
                  </td>
                ))}
              </tr>

              {/* SUMMARY ROW 3: PROGRESS VARIANCE / WEEKS */}
              <tr className="bg-background">
                <td
                  colSpan={4}
                  className="p-2 font-bold border-r border-border/40 text-foreground uppercase text-[10px]"
                >
                  PROGRESS VARIANCE / WEEKS
                </td>
                {matrix.summary.progressVarianceWeeks.map((val, wIdx) => (
                  <td
                    key={wIdx}
                    className="text-center font-bold border-r border-border/40 text-foreground p-0.5 text-[9px]"
                  >
                    {val.toFixed(2)}
                  </td>
                ))}
                {/* Lower Merged ACT Cell on Far Right */}
                <td
                  rowSpan={2}
                  className="p-2 text-center font-bold text-foreground bg-primary/20 border-l border-border/40 text-xs align-middle"
                >
                  Act
                </td>
              </tr>

              {/* SUMMARY ROW 4: ACTUAL PROGRESS CUMULATIVE/WEEK (Red Line) */}
              <tr className="bg-primary/20">
                <td
                  colSpan={4}
                  className="p-2 font-bold border-r border-border/40 text-foreground uppercase text-[10px]"
                >
                  ACTUAL PROGRES COMULATIVE/WEEK
                </td>
                {matrix.summary.actualProgressCumulative.map((val, wIdx) => (
                  <td
                    key={wIdx}
                    className="text-center font-bold border-r border-border/40 text-foreground p-0.5 text-[9px]"
                  >
                    {val > 0 ? val.toFixed(2) : "0,00"}
                  </td>
                ))}
              </tr>

              {/* SUMMARY ROW 5: DEVIASI */}
              <tr className="bg-background">
                <td
                  colSpan={4}
                  className="p-2 font-bold border-r border-border/40 text-foreground uppercase text-[10px]"
                >
                  DEVIASI
                </td>
                {matrix.summary.deviation.map((devVal, wIdx) => {
                  const actualCum =
                    matrix.summary.actualProgressCumulative[wIdx] || 0;
                  const isRecorded = actualCum > 0;
                  const isPositive = devVal >= 0;

                  return (
                    <td
                      key={wIdx}
                      className={cn(
                        "text-center font-black border-r border-border/40 p-0.5 text-[9px]",
                        !isRecorded
                          ? "text-muted-foreground/40 font-normal"
                          : isPositive
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/15"
                            : "text-red-700 dark:text-red-400 bg-red-500/15",
                      )}
                    >
                      {isRecorded
                        ? isPositive
                          ? `+${devVal.toFixed(2)}`
                          : devVal.toFixed(2)
                        : devVal.toFixed(2)}
                    </td>
                  );
                })}
                <td className="p-2 text-center font-bold text-foreground border-l border-border/40 text-xs"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Modal Detail Shipping Per Unit */}
        {project && (
          <ShippingProgressDetailDialog
            isOpen={isShippingDetailOpen}
            onClose={() => setIsShippingDetailOpen(false)}
            projectId={project.id}
            projectName={project.projectName || project.projectNumber || "Project"}
            projectNumber={project.projectNumber || "-"}
            clientName={
              project.customer?.company ||
              project.customer?.name ||
              project.clientName ||
              "-"
            }
          />
        )}
      </CardContent>
    </Card>
  );
}
