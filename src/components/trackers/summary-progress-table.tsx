"use client";

import React, { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Calendar,
  Building2,
  MapPin,
  FileCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  Layers,
  Camera,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { generateWeekHeaders } from "@/lib/s-curve-calculator";
import {
  getPhaseProgressAtCutoff,
  getItemProgressAtCutoff,
} from "@/lib/masterplan-cutoff-utils";
import { calculateRealProcurementProgress } from "@/lib/procurement-calculator";
import { ProgressPhotoDialog } from "@/components/trackers/progress-photo-dialog";
import { WeeklyReportPreviewDialog } from "@/components/trackers/weekly-report-preview-dialog";

export interface SummaryRowItem {
  no: number;
  name: string;
  satuan: string;
  volume: number;
  weightPercent: number;
  phase?: any;
  isManualPhase?: boolean;
  mingguLalu: {
    vol: number;
    prestasi: number;
    bobot: number;
  };
  mingguIni: {
    vol: number;
    prestasi: number;
    bobot: number;
  };
  sdMingguIni: {
    vol: number;
    prestasi: number;
    bobot: number;
  };
}

export function SummaryProgressTable({
  project,
  masterplan,
  units = [],
}: {
  project: any;
  masterplan: any;
  units: any[];
}) {
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  // Total weeks from masterplan (default 30)
  const totalWeeks = Number(masterplan?.totalWeeks || 30);
  const startDateStr =
    masterplan?.startDate || project?.createdAt || new Date().toISOString();

  // Generate week headers
  const weekHeaders = useMemo(
    () => generateWeekHeaders(startDateStr, totalWeeks),
    [startDateStr, totalWeeks],
  );

  // Active week selection (default: current live week)
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(() => {
    const start = new Date(startDateStr).getTime();
    const now = Date.now();
    const diffWeeks = Math.floor((now - start) / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, Math.min(totalWeeks, diffWeeks));
  });

  const selectedWeekHeader = weekHeaders[selectedWeekNum - 1] || weekHeaders[0];

  // Dynamic customer and location metadata directly from project data
  const customerName =
    project?.customer?.company ||
    project?.customer?.name ||
    project?.lead?.customer?.company ||
    project?.lead?.customer?.name ||
    project?.customerName ||
    "-";

  const customerCity =
    project?.city ||
    project?.lead?.city ||
    project?.customer?.city ||
    project?.lead?.customer?.city;

  const customerProvince =
    project?.province ||
    project?.lead?.province ||
    project?.customer?.province ||
    project?.lead?.customer?.province;

  const cityProvinceStr = [customerCity, customerProvince]
    .filter(Boolean)
    .join(" - ");

  const location =
    cityProvinceStr ||
    project?.customer?.address ||
    project?.lead?.customer?.address ||
    project?.location ||
    project?.lead?.location ||
    "-";

  const revision = project?.revisionNumber || "00";

  // Calculate rows for Units and Non-Fabrication Phases
  const { rows, totalRow } = useMemo(() => {
    const phases = masterplan?.phases || [];

    // 1. Find Fabrication phase
    const fabPhase = phases.find(
      (p: any) =>
        p.code === "FABRICATION_STRUCTURE" ||
        p.code === "FABRICATION_MECHANICAL" ||
        p.code === "FABRICATION" ||
        p.code === "FAB_STRUCT_MECH" ||
        p.name?.toUpperCase().includes("FABRIKASI") ||
        p.name?.toUpperCase().includes("FABRICATION") ||
        p.name?.toUpperCase().includes("STRUKTUR") ||
        p.name?.toUpperCase().includes("MEKANIKAL"),
    );

    // Filter non-fabrication site work phases (e.g. Civil, Electrical, Shipment, Erection, Commissioning)
    // Engineering and Procurement are tracked separately in Pillar Rekap (Page 4) and excluded from Summary Progress table
    const nonFabPhases = phases.filter((p: any) => {
      const code = (p.code || "").toUpperCase();
      const name = (p.name || "").toUpperCase();
      const isFab =
        code === "FABRICATION_STRUCTURE" ||
        code === "FABRICATION_MECHANICAL" ||
        code === "FABRICATION" ||
        code === "FAB_STRUCT_MECH" ||
        name.includes("FABRIKASI") ||
        name.includes("FABRICATION") ||
        name.includes("STRUKTUR") ||
        name.includes("MEKANIKAL");
      const isEngOrProc =
        code.includes("ENG") ||
        code.includes("PROCURE") ||
        name.includes("ENGINEER") ||
        name.includes("PROCURE");
      return !isFab && !isEngOrProc;
    });

    // Raw weights calculation
    const unitWeights = units.map((u: any) => {
      const up = u.progresses?.find(
        (p: any) => p.phaseId === fabPhase?.id || Number(p.weightPercent) > 0,
      );
      if (up && Number(up.weightPercent) > 0) {
        return Number(up.weightPercent);
      }
      return 0;
    });

    const sumUnitRaw = unitWeights.reduce((s: number, w: number) => s + w, 0);
    const fabWeightPercent = fabPhase ? Number(fabPhase.weightPercent) : 50;

    // Build raw item list
    const rawItems: Array<{
      name: string;
      satuan: string;
      volume: number;
      rawWeight: number;
      actualProgressNow: number;
      actualProgressPast: number;
      phase?: any;
      isManualPhase?: boolean;
    }> = [];

    // Add Units
    units.forEach((unit: any, idx: number) => {
      let weight = 0;
      if (sumUnitRaw > 0) {
        weight =
          (unitWeights[idx] / sumUnitRaw) *
          (fabPhase
            ? fabWeightPercent
            : (100 / (units.length + nonFabPhases.length)) * units.length);
      } else if (units.length > 0) {
        weight = (fabPhase ? fabWeightPercent : 50) / units.length;
      }

      // Selected week cutoffs
      const currentWeekHeader = weekHeaders[selectedWeekNum - 1];
      const selectedCutoff = currentWeekHeader?.endDate
        ? new Date(currentWeekHeader.endDate)
        : new Date();
      selectedCutoff.setHours(23, 59, 59, 999);

      const sItems = unit.structureItems || [];
      const mItems = unit.mechanicalItems || [];

      // Progress at selected week cutoff
      let progNow = 0;
      if (sItems.length > 0 || mItems.length > 0) {
        const sProgs = sItems.map((i: any) =>
          getItemProgressAtCutoff(
            i,
            "Structure",
            unit.name,
            project,
            selectedCutoff,
          ),
        );
        const mProgs = mItems.map((i: any) =>
          getItemProgressAtCutoff(
            i,
            "Mechanical",
            unit.name,
            project,
            selectedCutoff,
          ),
        );

        const avgS =
          sProgs.length > 0
            ? sProgs.reduce((sum: number, p: number) => sum + p, 0) /
              sProgs.length
            : 0;
        const avgM =
          mProgs.length > 0
            ? mProgs.reduce((sum: number, p: number) => sum + p, 0) /
              mProgs.length
            : 0;

        if (unit.unitType === "STRUCTURE") progNow = avgS;
        else if (unit.unitType === "MECHANICAL") progNow = avgM;
        else
          progNow =
            sItems.length > 0 && mItems.length > 0
              ? (avgS + avgM) / 2
              : sItems.length > 0
                ? avgS
                : avgM;
      } else {
        const up = unit.progresses?.find((p: any) => p.phaseId === fabPhase?.id);
        if (up && Number(up.actualPercent) > 0) {
          progNow = Number(up.actualPercent);
        } else if (fabPhase) {
          progNow = getPhaseProgressAtCutoff(fabPhase, project, selectedCutoff);
        }
      }

      // Past progress at selected week's previous cutoff (or 0 if week 1)
      let progPast = 0;
      if (selectedWeekNum > 1) {
        const prevWeekHeader = weekHeaders[selectedWeekNum - 2];
        if (prevWeekHeader?.endDate) {
          const prevCutoff = new Date(prevWeekHeader.endDate);
          prevCutoff.setHours(23, 59, 59, 999);

          if (sItems.length > 0 || mItems.length > 0) {
            const sProgsPast = sItems.map((i: any) =>
              getItemProgressAtCutoff(
                i,
                "Structure",
                unit.name,
                project,
                prevCutoff,
              ),
            );
            const mProgsPast = mItems.map((i: any) =>
              getItemProgressAtCutoff(
                i,
                "Mechanical",
                unit.name,
                project,
                prevCutoff,
              ),
            );

            const avgSPast =
              sProgsPast.length > 0
                ? sProgsPast.reduce((sum: number, p: number) => sum + p, 0) /
                  sProgsPast.length
                : 0;
            const avgMPast =
              mProgsPast.length > 0
                ? mProgsPast.reduce((sum: number, p: number) => sum + p, 0) /
                  mProgsPast.length
                : 0;

            if (unit.unitType === "STRUCTURE") progPast = avgSPast;
            else if (unit.unitType === "MECHANICAL") progPast = avgMPast;
            else
              progPast =
                sItems.length > 0 && mItems.length > 0
                  ? (avgSPast + avgMPast) / 2
                  : sItems.length > 0
                    ? avgSPast
                    : avgMPast;
          } else if (fabPhase) {
            progPast = getPhaseProgressAtCutoff(fabPhase, project, prevCutoff);
          }
        }
      }

      rawItems.push({
        name: unit.name,
        satuan: unit.satuan || "unit",
        volume: Number(unit.volume) || 1,
        rawWeight: weight,
        actualProgressNow: progNow,
        actualProgressPast: progPast,
      });
    });

    // Add Non-Fab Phases (Procurement, Engineering, Civil, Electrical, Shipment, Erection, Commissioning, etc.)
    nonFabPhases.forEach((phase: any) => {
      const weight = Number(phase.weightPercent) || 0;

      const currentWeekHeader = weekHeaders[selectedWeekNum - 1];
      const selectedCutoff = currentWeekHeader?.endDate
        ? new Date(currentWeekHeader.endDate)
        : new Date();
      selectedCutoff.setHours(23, 59, 59, 999);

      const progNow = getPhaseProgressAtCutoff(
        phase,
        project,
        selectedCutoff,
      );

      let progPast = 0;
      if (selectedWeekNum > 1) {
        const prevWeekHeader = weekHeaders[selectedWeekNum - 2];
        if (prevWeekHeader?.endDate) {
          const prevCutoff = new Date(prevWeekHeader.endDate);
          prevCutoff.setHours(23, 59, 59, 999);
          progPast = getPhaseProgressAtCutoff(phase, project, prevCutoff);
        }
      }

      const code = (phase.code || phase.name || "").toUpperCase();
      const isManualPhase =
        !code.includes("PROCURE") &&
        !code.includes("PPIC") &&
        !code.includes("ENG") &&
        !code.includes("FAB") &&
        !code.includes("STRUKTUR") &&
        !code.includes("MEKANIKAL");

      rawItems.push({
        name: phase.name,
        satuan: "lot",
        volume: 1,
        rawWeight: weight,
        actualProgressNow: progNow,
        actualProgressPast: progPast,
        phase,
        isManualPhase,
      });
    });

    // Normalize weights so the sum across all items is STRICTLY 100.00%
    const totalRawWeight = rawItems.reduce((s, it) => s + it.rawWeight, 0);

    const calculatedRows: SummaryRowItem[] = rawItems.map((item, idx) => {
      const weightPercent =
        totalRawWeight > 0
          ? (item.rawWeight / totalRawWeight) * 100
          : 100 / rawItems.length;

      const pPast = item.actualProgressPast;
      const pNow = item.actualProgressNow;
      const pDelta = Math.max(0, pNow - pPast);

      const volPast = (item.volume * pPast) / 100;
      const volNow = (item.volume * pNow) / 100;
      const volDelta = Math.max(0, volNow - volPast);

      const bPast = (weightPercent * pPast) / 100;
      const bNow = (weightPercent * pNow) / 100;
      const bDelta = Math.max(0, bNow - bPast);

      return {
        no: idx + 1,
        name: item.name,
        satuan: item.satuan,
        volume: item.volume,
        weightPercent,
        phase: (item as any).phase,
        isManualPhase: (item as any).isManualPhase,
        mingguLalu: {
          vol: volPast,
          prestasi: pPast,
          bobot: bPast,
        },
        mingguIni: {
          vol: volDelta,
          prestasi: pDelta,
          bobot: bDelta,
        },
        sdMingguIni: {
          vol: volNow,
          prestasi: pNow,
          bobot: bNow,
        },
      };
    });

    // Calculate totals
    const totalBobot = calculatedRows.reduce((s, r) => s + r.weightPercent, 0);
    const totalMingguLaluBobot = calculatedRows.reduce(
      (s, r) => s + r.mingguLalu.bobot,
      0,
    );
    const totalMingguIniBobot = calculatedRows.reduce(
      (s, r) => s + r.mingguIni.bobot,
      0,
    );
    const totalSdMingguIniBobot = calculatedRows.reduce(
      (s, r) => s + r.sdMingguIni.bobot,
      0,
    );

    return {
      rows: calculatedRows,
      totalRow: {
        bobot: totalBobot,
        mingguLaluBobot: totalMingguLaluBobot,
        mingguIniBobot: totalMingguIniBobot,
        sdMingguIniBobot: totalSdMingguIniBobot,
      },
    };
  }, [
    units,
    masterplan,
    project,
    selectedWeekNum,
    weekHeaders,
  ]);

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total S.d Minggu Ini */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Total Kumulatif S.d Minggu Ini
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {totalRow.sdMingguIniBobot.toFixed(2)}%
              </div>
              <Badge
                variant="outline"
                className="text-[10px] font-bold border-primary/40 text-primary bg-primary/5"
              >
                S.d Minggu Ke-{selectedWeekNum}
              </Badge>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, totalRow.sdMingguIniBobot)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Bobot Total Proyek: 100.00%</span>
              <span className="font-bold text-foreground">
                {(100 - totalRow.sdMingguIniBobot).toFixed(2)}% Sisa
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Capaian Minggu Ini */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Progres Minggu Ini
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                +{totalRow.mingguIniBobot.toFixed(2)}%
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                Delta Minggu Ke-{selectedWeekNum}
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(100, totalRow.mingguIniBobot * 10)}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Kenaikan bobot pekerjaan dalam minggu ini
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Realisasi Minggu Lalu */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Realisasi Minggu Lalu
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {totalRow.mingguLaluBobot.toFixed(2)}%
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                Cutoff Minggu Ke-{Math.max(0, selectedWeekNum - 1)}
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-amber-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, totalRow.mingguLaluBobot)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Akumulasi sebelum periode minggu berjalan
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Total Scope Pekerjaan */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Total Scope Pekerjaan
            </CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {rows.length} Item
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold">
                100.00% Bobot
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground">
                {units.length} Unit Conveyor
              </span>
              <span>+</span>
              <span className="font-semibold text-foreground">
                {rows.length - units.length} Site Works
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. SUMMARY PROGRESS TABLE */}
      <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md overflow-hidden rounded-2xl pt-0">
        {/* Card Header with Metadata and Week Selector */}
        <div className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-5 px-6 pb-5 border-b border-border/20 flex flex-col lg:flex-row lg:items-center justify-between gap-4 w-full">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-foreground">
                  SUMMARY PROGRESS
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground/90 font-medium">
                  Rekapitulasi pencapaian progres keseluruhan tahapan & unit conveyor masterplan
                </CardDescription>
              </div>
            </div>

            {/* Project Meta Info Badges (Dynamic from Project) */}
            <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
              <Badge variant="outline" className="gap-1 font-semibold bg-background/80 py-1">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>
                  Customer: <b>{customerName}</b>
                </span>
              </Badge>
              <Badge variant="outline" className="gap-1 font-semibold bg-background/80 py-1">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>
                  Lokasi: <b>{location}</b>
                </span>
              </Badge>
              <Badge variant="outline" className="gap-1 font-semibold bg-background/80 py-1">
                <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  Rev: <b>{revision}</b>
                </span>
              </Badge>
            </div>
          </div>

          {/* Week Selector Dropdown & Action Buttons (Aligned to Right Edge) */}
          <div className="flex items-center gap-2 flex-wrap lg:justify-end lg:ml-auto shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPdfDialogOpen(true)}
              className="h-8 px-3 rounded-xl text-xs font-bold text-foreground border-border/80 hover:bg-muted/50 cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span>Cetak Laporan PDF</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPhotoDialogOpen(true)}
              className="h-8 px-3 rounded-xl text-xs font-bold text-primary border-primary/30 hover:bg-primary/5 cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              Dokumentasi Foto
            </Button>
            <div className="flex items-center gap-1.5 bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs shadow-xs">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold text-muted-foreground">Periode:</span>
              <select
                value={selectedWeekNum}
                onChange={(e) => setSelectedWeekNum(Number(e.target.value))}
                className="bg-transparent font-bold text-foreground focus:outline-none cursor-pointer pr-1 text-xs"
              >
                {weekHeaders.map((wh) => (
                  <option
                    key={wh.weekNumber}
                    value={wh.weekNumber}
                    className="bg-popover text-popover-foreground"
                  >
                    Minggu #{wh.weekNumber} ({wh.dateRange} {wh.monthName})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <CardContent className="p-0 sm:p-6 pt-4">
          <div className="rounded-xl border border-border/60 overflow-hidden shadow-xs bg-background">
            <div className="overflow-x-auto">
              <Table>
                {/* Two-tier Table Header */}
                <TableHeader className="bg-muted/40">
                  {/* Tier 1 Header */}
                  <TableRow className="border-b border-border/60 text-center font-bold text-xs">
                    <TableHead
                      rowSpan={2}
                      className="w-12 text-center font-black border-r border-border/40 py-2"
                    >
                      No
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="text-left font-black min-w-56 border-r border-border/40 py-2"
                    >
                      Keterangan
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="w-16 text-center font-black border-r border-border/40 py-2"
                    >
                      Sat
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="w-16 text-center font-black border-r border-border/40 py-2"
                    >
                      Vol
                    </TableHead>
                    <TableHead
                      rowSpan={2}
                      className="w-24 text-center font-black border-r-2 border-border/80 py-2 bg-muted/30"
                    >
                      Bobot{"\n"}(%)
                    </TableHead>

                    {/* Minggu Lalu Header */}
                    <TableHead
                      colSpan={3}
                      className="text-center font-black border-r-2 border-border/80 py-2 bg-amber-500/5 text-amber-900 dark:text-amber-300"
                    >
                      Minggu Lalu
                    </TableHead>

                    {/* Minggu Ini Header */}
                    <TableHead
                      colSpan={3}
                      className="text-center font-black border-r-2 border-border/80 py-2 bg-emerald-500/5 text-emerald-900 dark:text-emerald-300"
                    >
                      Minggu Ini
                    </TableHead>

                    {/* S.d Minggu Ini Header */}
                    <TableHead
                      colSpan={3}
                      className="text-center font-black py-2 bg-primary/5 text-primary"
                    >
                      S.d Minggu Ini
                    </TableHead>
                  </TableRow>

                  {/* Tier 2 Header (Sub-columns) */}
                  <TableRow className="border-b border-border/60 text-center font-semibold text-[11px] bg-muted/20">
                    {/* Minggu Lalu Sub-headers */}
                    <TableHead className="w-16 text-center border-r border-border/40 py-1.5">
                      Vol
                    </TableHead>
                    <TableHead className="w-20 text-center border-r border-border/40 py-1.5">
                      Prestasi (%)
                    </TableHead>
                    <TableHead className="w-20 text-center border-r-2 border-border/80 py-1.5 font-bold">
                      Bobot (%)
                    </TableHead>

                    {/* Minggu Ini Sub-headers */}
                    <TableHead className="w-16 text-center border-r border-border/40 py-1.5">
                      Vol
                    </TableHead>
                    <TableHead className="w-20 text-center border-r border-border/40 py-1.5">
                      Prestasi (%)
                    </TableHead>
                    <TableHead className="w-20 text-center border-r-2 border-border/80 py-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                      Bobot (%)
                    </TableHead>

                    {/* S.d Minggu Ini Sub-headers */}
                    <TableHead className="w-16 text-center border-r border-border/40 py-1.5">
                      Vol
                    </TableHead>
                    <TableHead className="w-20 text-center border-r border-border/40 py-1.5">
                      Prestasi (%)
                    </TableHead>
                    <TableHead className="w-20 text-center py-1.5 font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/20">
                      Bobot (%)
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={14}
                        className="text-center py-10 text-muted-foreground text-xs"
                      >
                        Belum ada data unit atau tahapan masterplan pada proyek ini.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const hasActiveProgress =
                        row.sdMingguIni.prestasi > 0 || row.sdMingguIni.bobot > 0;
                      const hasRecentProgress =
                        row.mingguIni.prestasi > 0 || row.mingguIni.bobot > 0;

                      return (
                        <TableRow
                          key={row.no}
                          className={cn(
                            "transition-colors text-xs border-b border-border/30",
                            hasActiveProgress
                              ? "bg-primary/4 hover:bg-primary/8"
                              : "hover:bg-muted/30",
                          )}
                        >
                          {/* No */}
                          <TableCell className="text-center font-bold text-muted-foreground border-r border-border/40 py-2.5">
                            {row.no}
                          </TableCell>

                          {/* Keterangan */}
                          <TableCell className="font-semibold text-foreground border-r border-border/40 py-2.5">
                            <div className="flex items-center gap-2">
                              <span>{row.name}</span>
                              {hasActiveProgress && (
                                <Badge
                                  variant="outline"
                                  className="text-[9px] px-1 py-0 h-4 border-primary/40 text-primary bg-primary/10 font-bold"
                                >
                                  {row.sdMingguIni.prestasi >= 100
                                    ? "Selesai"
                                    : `${row.sdMingguIni.prestasi.toFixed(1)}%`}
                                </Badge>
                              )}
                            </div>
                          </TableCell>

                          {/* Sat */}
                          <TableCell className="text-center font-medium text-muted-foreground border-r border-border/40 py-2.5">
                            {row.satuan}
                          </TableCell>

                          {/* Vol */}
                          <TableCell className="text-center font-semibold border-r border-border/40 py-2.5">
                            {row.volume}
                          </TableCell>

                          {/* Bobot (%) */}
                          <TableCell className="text-center font-bold border-r-2 border-border/80 py-2.5 bg-muted/10">
                            {row.weightPercent.toFixed(2)}
                          </TableCell>

                          {/* Minggu Lalu: Vol, Prestasi, Bobot */}
                          <TableCell className="text-center text-muted-foreground border-r border-border/40 py-2.5">
                            {row.mingguLalu.vol > 0
                              ? row.mingguLalu.vol.toFixed(2)
                              : "0.00"}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground border-r border-border/40 py-2.5">
                            {row.mingguLalu.prestasi > 0
                              ? row.mingguLalu.prestasi.toFixed(2)
                              : "0.00"}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-muted-foreground border-r-2 border-border/80 py-2.5">
                            {row.mingguLalu.bobot > 0
                              ? row.mingguLalu.bobot.toFixed(2)
                              : "0.00"}
                          </TableCell>

                          {/* Minggu Ini: Vol, Prestasi, Bobot */}
                          <TableCell className="text-center border-r border-border/40 py-2.5">
                            {row.mingguIni.vol > 0
                              ? row.mingguIni.vol.toFixed(2)
                              : "0.00"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-center font-semibold border-r border-border/40 py-2.5",
                              hasRecentProgress
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : "text-muted-foreground",
                            )}
                          >
                            {row.mingguIni.prestasi > 0
                              ? row.mingguIni.prestasi.toFixed(2)
                              : "0.00"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-center font-bold border-r-2 border-border/80 py-2.5",
                              hasRecentProgress
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "text-muted-foreground",
                            )}
                          >
                            {row.mingguIni.bobot > 0
                              ? row.mingguIni.bobot.toFixed(2)
                              : "0.00"}
                          </TableCell>

                          {/* S.d Minggu Ini: Vol, Prestasi, Bobot */}
                          <TableCell className="text-center border-r border-border/40 py-2.5">
                            {row.sdMingguIni.vol > 0
                              ? row.sdMingguIni.vol.toFixed(2)
                              : "0.00"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-center font-bold border-r border-border/40 py-2.5",
                              hasActiveProgress
                                ? "text-primary"
                                : "text-muted-foreground",
                            )}
                          >
                            {row.sdMingguIni.prestasi > 0
                              ? row.sdMingguIni.prestasi.toFixed(2)
                              : "0.00"}
                          </TableCell>
                          <TableCell
                            className="text-center font-black py-2.5 bg-emerald-500/15 text-emerald-950 dark:text-emerald-200"
                          >
                            {row.sdMingguIni.bobot > 0
                              ? row.sdMingguIni.bobot.toFixed(2)
                              : "0.00"}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>

                {/* TOTAL ROW */}
                <TableFooter className="bg-[#ffff00] text-black font-black text-xs border-t-2 border-black/40">
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="py-3 px-4 font-black uppercase text-left border-r border-black/20 text-black"
                    >
                      TOTAL PEKERJAAN CONVEYOR
                    </TableCell>
                    <TableCell className="text-center font-black border-r-2 border-black/20 py-3 text-black">
                      {totalRow.bobot.toFixed(2)}
                    </TableCell>

                    {/* Minggu Lalu Total */}
                    <TableCell className="text-center border-r border-black/20 py-3 text-black">
                      -
                    </TableCell>
                    <TableCell className="text-center border-r border-black/20 py-3 text-black">
                      -
                    </TableCell>
                    <TableCell className="text-center font-black border-r-2 border-black/20 py-3 text-black">
                      {totalRow.mingguLaluBobot.toFixed(2)}
                    </TableCell>

                    {/* Minggu Ini Total */}
                    <TableCell className="text-center border-r border-black/20 py-3 text-black">
                      -
                    </TableCell>
                    <TableCell className="text-center border-r border-black/20 py-3 text-black">
                      -
                    </TableCell>
                    <TableCell className="text-center font-black border-r-2 border-black/20 py-3 text-black">
                      {totalRow.mingguIniBobot.toFixed(2)}
                    </TableCell>

                    {/* S.d Minggu Ini Total */}
                    <TableCell className="text-center border-r border-black/20 py-3 text-black">
                      -
                    </TableCell>
                    <TableCell className="text-center border-r border-black/20 py-3 text-black">
                      -
                    </TableCell>
                    <TableCell className="text-center font-black py-3 text-sm text-black bg-[#ffff00]">
                      {totalRow.sdMingguIniBobot.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Photo Dialog */}
      {project && (
        <ProgressPhotoDialog
          isOpen={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          projectId={project.id}
          projectName={project.projectName}
          category="GENERAL"
        />
      )}

      {/* Weekly Report PDF Preview & Download Dialog (Opsi 1 & Opsi 2) */}
      {project && (
        <WeeklyReportPreviewDialog
          open={pdfDialogOpen}
          onOpenChange={setPdfDialogOpen}
          project={project}
          masterplan={masterplan}
          units={units}
          rows={rows}
          totalRow={totalRow}
          initialWeekNum={selectedWeekNum}
          weekHeaders={weekHeaders}
        />
      )}
    </div>
  );
}
