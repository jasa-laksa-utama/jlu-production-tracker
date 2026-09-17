"use client";

import React, { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Hammer,
  Search,
  SlidersHorizontal,
  RotateCcw,
  ShieldAlert,
  AlertTriangle,
  TrendingUp,
  CheckCheck,
  Layers,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { QCRevisionDetailDialog } from "@/components/trackers/qc-revision-detail-dialog";
import { ProgressPhotoDialog } from "@/components/trackers/progress-photo-dialog";
import { StageProgressDialog } from "@/components/trackers/stage-progress-dialog";
import {
  updateStructureItemChecklist,
  bulkUpdateStructureStage,
} from "@/app/actions/conveyor-progress";
import { toggleSubComponentComplete } from "@/app/actions/sub-components";
import { calcStructureItemProgress } from "@/lib/progress-calculator";

export interface StructureProgressTableProps {
  currentProject?: any;
  units: any[];
}

export function StructureProgressTable({
  currentProject,
  units,
}: StructureProgressTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");

  const [filterType, setFilterType] = useState<
    "ALL" | "IN_PROGRESS" | "COMPLETED" | "HAS_REVISION"
  >("ALL");

  // Accordion state (default all open)
  const [expandedUnits, setExpandedUnits] = useState<string[]>(
    units.map((u) => u.id),
  );
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhotoUnit, setSelectedPhotoUnit] = useState<{
    id?: string;
    name?: string;
  }>({});

  // Dialog input catatan & foto dokumentasi tahapan fabrikasi struktur
  const [stageDocDialogData, setStageDocDialogData] = useState<{
    open: boolean;
    unitId: string;
    unitName: string;
    componentId: string;
    componentName: string;
    stage: string;
    stageLabel: string;
    currentQty: number;
    totalQty: number;
    isInitiallyChecked: boolean;
  } | null>(null);

  // Find Structure Masterplan Phase
  const structurePhase = currentProject?.masterplan?.phases?.find(
    (p: any) =>
      p.code === "FABRICATION_STRUCTURE" ||
      p.code === "STRUCTURE" ||
      p.code === "FABRICATION" ||
      p.name?.toUpperCase().includes("STRUKTUR") ||
      p.name?.toUpperCase().includes("STRUCTURE"),
  );

  const phaseWeight = Number(structurePhase?.weightPercent) || 50.0;
  const phasePlanProgress = Number(structurePhase?.planProgress) || 0;

  // Filter units that have structure components or are structure/both
  const structureUnits = units.filter((u) => u.unitType !== "MECHANICAL");

  // Calculate normalized unit weight plan so total is ALWAYS exactly 100%
  const rawUnitWeights = structureUnits.map((u) => {
    const upRecord = u.progresses?.find(
      (up: any) => up.phaseId === structurePhase?.id,
    );
    return upRecord && Number(upRecord.weightPercent) > 0
      ? Number(upRecord.weightPercent)
      : 0;
  });
  const totalRawWeight = rawUnitWeights.reduce((sum, w) => sum + w, 0);

  // Calculate Unit Progresses and Project Total Structure Progress
  const unitStats = structureUnits.map((u, idx) => {
    const sItems = u.structureItems || [];
    const totalItems = sItems.length;
    const avgProgress =
      totalItems > 0
        ? sItems.reduce(
            (sum: number, item: any) =>
              sum + Number(item.progressPercent || 0),
            0,
          ) / totalItems
        : 0;

    // Normalize so sum of weightPlan across active units is strictly 100%
    let weightPlan = 0;
    if (totalRawWeight > 0) {
      weightPlan = (rawUnitWeights[idx] / totalRawWeight) * 100;
    } else if (structureUnits.length > 0) {
      weightPlan = 100 / structureUnits.length;
    }

    const actualWeight = (avgProgress * weightPlan) / 100;

    return {
      ...u,
      indexLetter: String(idx + 1), // 1, 2, 3...
      avgProgress,
      weightPlan,
      actualWeight,
      totalItemsCount: totalItems,
      completedItemsCount: sItems.filter(
        (it: any) => Number(it.progressPercent || 0) >= 100,
      ).length,
    };
  });

  const totalActualProgress = unitStats.reduce(
    (sum, u) => sum + u.actualWeight,
    0,
  );
  const totalCompletedItems = unitStats.reduce(
    (sum, u) => sum + u.completedItemsCount,
    0,
  );
  const totalAllItems = unitStats.reduce(
    (sum, u) => sum + u.totalItemsCount,
    0,
  );
  const sCurveContribution = (totalActualProgress * phaseWeight) / 100;

  const [selectedRevisionData, setSelectedRevisionData] = useState<{
    open: boolean;
    revision: any;
    itemType: "STRUCTURE" | "MECHANICAL";
    itemName: string;
    stageName: string;
    unitName: string;
  } | null>(null);

  const handleStageCheckChange = (
    itemId: string,
    stageKey: string,
    isChecked: boolean,
    itemQty: number,
  ) => {
    startTransition(async () => {
      const res = await updateStructureItemChecklist(itemId, {
        [stageKey]: isChecked ? itemQty : 0,
      });

      if (res.success) {
        toast.success("Progress komponen diperbarui!");
      } else {
        toast.error(res.error || "Gagal memperbarui progress");
      }
    });
  };

  const handleToggleSubItem = (subId: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleSubComponentComplete(
        subId,
        "STRUCTURE",
        !currentStatus
      );
      if (res.success) {
        toast.success(
          !currentStatus
            ? "Sub-part ditandai selesai!"
            : "Status sub-part direset!"
        );
      } else {
        toast.error(res.error || "Gagal memperbarui status sub-part");
      }
    });
  };

  const handleBulkStage = (
    unitId: string,
    stage:
      | "CUTTING"
      | "SETTING"
      | "WELDING"
      | "FINISHING"
      | "PAINTING"
      | "PACKAGING"
      | "RESET"
      | "ALL",
    isDone: boolean,
  ) => {
    startTransition(async () => {
      const res = await bulkUpdateStructureStage(unitId, stage, isDone);
      if (res.success) {
        if (stage === "RESET") {
          toast.success("Progress unit berhasil direset ke 0%!");
        } else {
          toast.success(`Tahapan ${stage} unit berhasil diperbarui!`);
        }
      } else {
        toast.error(res.error || "Gagal memperbarui progress");
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Progress Fabrikasi Struktur */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Total Progress Struktur
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Hammer className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {totalActualProgress.toFixed(2)}%
              </div>
              <Badge
                variant={
                  totalActualProgress >= 100
                    ? "default"
                    : totalActualProgress > 0
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px] font-bold"
              >
                {totalActualProgress >= 100
                  ? "Selesai"
                  : totalActualProgress > 0
                    ? "In Progress"
                    : "Belum Mulai"}
              </Badge>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, totalActualProgress)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Target Plan: {phasePlanProgress.toFixed(2)}%</span>
              <span
                className={cn(
                  "font-bold",
                  totalActualProgress >= phasePlanProgress
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400",
                )}
              >
                {(totalActualProgress - phasePlanProgress >= 0 ? "+" : "") +
                  (totalActualProgress - phasePlanProgress).toFixed(2)}
                %
              </span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Kontribusi ke S-Curve Proyek */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Kontribusi Masterplan
            </CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {sCurveContribution.toFixed(2)}%
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                dari {phaseWeight.toFixed(2)}% Bobot
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-purple-600 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    phaseWeight > 0
                      ? (sCurveContribution / phaseWeight) * 100
                      : 0,
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <span>Sesuai formula S-Curve (Hal. 8 Report)</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Komponen Selesai Fabrikasi */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Komponen Selesai
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCheck className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {totalCompletedItems}{" "}
                <span className="text-sm font-semibold text-muted-foreground">
                  / {totalAllItems}
                </span>
              </div>
              <span className="text-xs font-bold text-emerald-600">
                {totalAllItems > 0
                  ? ((totalCompletedItems / totalAllItems) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-full transition-all duration-500 rounded-full"
                style={{
                  width: `${
                    totalAllItems > 0
                      ? (totalCompletedItems / totalAllItems) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
              <span>Packaging 100% Selesai</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Unit Conveyor Struktur */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Unit Struktur
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {structureUnits.length} Unit
              </div>
              <span className="text-xs font-semibold text-muted-foreground">
                Setup Dinamis
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 text-[11px] text-muted-foreground flex-wrap">
              <span className="font-semibold text-foreground">
                {currentProject?.projectNumber || "PRJ"}
              </span>
              <span>{currentProject?.projectName}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. REKAPITULASI STRUCTURE PROGRESS TABLE (Sesuai Hal. 8 PDF) */}
      <Card className="rounded-2xl border shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Hammer className="w-4 h-4 text-blue-600" />
              Rekapitulasi Structure Progress
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rangkuman pencapaian bobot fabrikasi struktur per unit conveyor (Halaman 8 PDF Laporan).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedPhotoUnit({});
                setPhotoDialogOpen(true);
              }}
              className="h-8 px-3 rounded-xl text-xs font-bold text-primary border-primary/30 hover:bg-primary/5 cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Camera className="w-3.5 h-3.5" />
              Foto Struktur
            </Button>
            <Badge
              variant="outline"
              className="text-xs font-bold px-3 py-1 bg-background"
            >
              Total Actual:{" "}
              <span className="text-blue-600 ml-1">
                {totalActualProgress.toFixed(2)}%
              </span>
            </Badge>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="w-12 text-center text-xs font-bold">
                  No
                </TableHead>
                <TableHead className="text-xs font-bold">
                  Unit Conveyor / Description
                </TableHead>
                <TableHead className="text-center text-xs font-bold w-32">
                  Bobot Plan (%)
                </TableHead>
                <TableHead className="text-center text-xs font-bold w-32 text-blue-600 dark:text-blue-400">
                  Bobot Actual (%)
                </TableHead>
                <TableHead className="text-center text-xs font-bold w-32">
                  Progress Unit (%)
                </TableHead>
                <TableHead className="text-center text-xs font-bold w-36">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unitStats.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground text-xs"
                  >
                    Belum ada unit conveyor struktur pada proyek ini. Silakan atur di menu Kelola Unit & Komponen.
                  </TableCell>
                </TableRow>
              ) : (
                unitStats.map((u) => (
                  <TableRow
                    key={u.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell className="text-center font-bold text-xs text-muted-foreground">
                      {u.indexLetter}
                    </TableCell>
                    <TableCell className="font-semibold text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{u.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold text-xs text-muted-foreground">
                      {u.weightPlan.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center font-black text-xs text-blue-600 dark:text-blue-400">
                      {u.actualWeight.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs">
                      <div className="flex flex-col items-center gap-1">
                        <span>{u.avgProgress.toFixed(2)}%</span>
                        <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{
                              width: `${Math.min(100, u.avgProgress)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md",
                          u.avgProgress >= 100
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                            : u.avgProgress > 0
                              ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                              : "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {u.avgProgress >= 100
                          ? "Selesai"
                          : u.avgProgress > 0
                            ? "Fabrikasi In Progress"
                            : "Belum Mulai"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            <TableFooter className="bg-muted/60 font-bold text-xs">
              <TableRow>
                <TableCell
                  colSpan={2}
                  className="text-right font-black uppercase"
                >
                  TOTAL STRUKTUR
                </TableCell>
                <TableCell className="text-center font-black">
                  {unitStats
                    .reduce((sum, u) => sum + u.weightPlan, 0)
                    .toFixed(2)}
                  %
                </TableCell>
                <TableCell className="text-center font-black text-blue-600 dark:text-blue-400 text-sm">
                  {totalActualProgress.toFixed(2)}%
                </TableCell>
                <TableCell className="text-center">-</TableCell>
                <TableCell className="text-center">-</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </Card>

      {/* 3. DETAIL CHECKLIST FABRIKASI STRUKTUR PER UNIT */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Hammer className="w-4 h-4 text-primary" />
              Detail Checklist Fabrikasi Struktur
            </h3>
            <p className="text-xs text-muted-foreground">
              Tahapan langkah fabrikasi rangka: <b>C/D (15%)</b>, <b>Setting (35%)</b>,{" "}
              <b>Welding (40%)</b>, <b>Finishing (5%)</b>, <b>Painting (3.5%)</b>, dan <b>Packaging (1.5%)</b>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari komponen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8 w-48 sm:w-60 rounded-lg font-medium"
              />
            </div>
          </div>
        </div>

        {/* Accordion Units */}
        <Accordion
          type="multiple"
          value={expandedUnits}
          onValueChange={setExpandedUnits}
          className="space-y-3"
        >
          {unitStats.map((unit) => {
            const structureItems = (unit.structureItems || []).filter(
              (it: any) =>
                !searchQuery ||
                it.name.toLowerCase().includes(searchQuery.toLowerCase()),
            );

            return (
              <AccordionItem
                key={unit.id}
                value={unit.id}
                className="rounded-2xl border bg-card shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors hover:no-underline">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full pr-4 gap-2 text-left">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className="font-bold text-xs w-6 h-6 rounded-md flex items-center justify-center p-0 shrink-0"
                      >
                        {unit.indexLetter}
                      </Badge>
                      <div>
                        <div className="font-bold text-sm text-foreground flex items-center gap-2">
                          <span>{unit.name}</span>
                          <span className="text-[11px] font-normal text-muted-foreground">
                            ({unit.totalItemsCount} Komponen)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-[11px]">
                          Bobot: <b>{unit.weightPlan.toFixed(2)}%</b>
                        </span>
                        <span>•</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          Progres: {unit.avgProgress.toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-24 bg-muted/60 rounded-full h-2 overflow-hidden hidden sm:block">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, unit.avgProgress)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-0 border-t bg-muted/5">
                  {/* Bulk Action Buttons Bar */}
                  <div className="p-3 sm:px-5 border-b bg-muted/20 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>Aksi Cepat Unit ({unit.name}):</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, "CUTTING", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 cursor-pointer"
                      >
                        ✓ C/D Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, "SETTING", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 cursor-pointer"
                      >
                        ✓ Setting Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, "WELDING", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900/40 dark:text-purple-400 cursor-pointer"
                      >
                        ✓ Welding Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, "FINISHING", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-900/40 dark:text-teal-400 cursor-pointer"
                      >
                        ✓ Finish Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, "PAINTING", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900/40 dark:text-orange-400 cursor-pointer"
                      >
                        ✓ Paint Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, "PACKAGING", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 cursor-pointer"
                      >
                        ✓ Pack Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          handleBulkStage(unit.id, "RESET", false)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-red-600 rounded-md cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3 mr-1" /> Reset Unit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedPhotoUnit({
                            id: unit.id,
                            name: unit.name,
                          });
                          setPhotoDialogOpen(true);
                        }}
                        className="h-7 text-[11px] font-semibold rounded-md border-primary/40 text-primary hover:bg-primary/10 cursor-pointer flex items-center gap-1"
                        title={`Dokumentasi Foto untuk ${unit.name}`}
                      >
                        <Camera className="w-3 h-3" /> Foto Unit
                      </Button>
                    </div>
                  </div>

                  {structureItems.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      {searchQuery
                        ? "Tidak ada komponen struktur yang cocok dengan pencarian."
                        : `Belum ada komponen struktur untuk unit ${unit.name}. Silakan tambahkan di menu Kelola Unit & Komponen.`}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="w-16 text-center text-[11px] font-bold">
                              No
                            </TableHead>
                            <TableHead className="text-[11px] font-bold">
                              Deskripsi Komponen
                            </TableHead>
                            <TableHead className="w-24 text-center text-[11px] font-bold">
                              Kategori
                            </TableHead>
                            <TableHead className="w-20 text-center text-[11px] font-bold">
                              Qty (Set)
                            </TableHead>
                            <TableHead className="w-24 text-center text-[11px] font-bold text-blue-700 dark:text-blue-400">
                              C/D (15%)
                            </TableHead>
                            <TableHead className="w-24 text-center text-[11px] font-bold text-amber-700 dark:text-amber-400">
                              Sett (35%)
                            </TableHead>
                            <TableHead className="w-24 text-center text-[11px] font-bold text-purple-700 dark:text-purple-400">
                              Weld (40%)
                            </TableHead>
                            <TableHead className="w-20 text-center text-[11px] font-bold text-teal-700 dark:text-teal-400">
                              Finish (5%)
                            </TableHead>
                            <TableHead className="w-24 text-center text-[11px] font-bold text-orange-700 dark:text-orange-400">
                              Paint (3.5%)
                            </TableHead>
                            <TableHead className="w-24 text-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              Pack (1.5%)
                            </TableHead>
                            <TableHead className="w-28 text-center text-[11px] font-bold">
                              Progress (%)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Structure Section Banner */}
                          <TableRow className="bg-muted/40 font-bold text-xs">
                            <TableCell
                              colSpan={11}
                              className="py-1.5 px-4 text-orange-600 dark:text-orange-400 text-[11px] tracking-wide uppercase font-bold"
                            >
                              🏗️ STRUCTURE COMPONENTS ({structureItems.length} ITEMS)
                            </TableCell>
                          </TableRow>

                          {structureItems.map((item: any, itemIdx: number) => {
                            const qty = Math.max(1, item.qty || 1);
                            const itemProgress = calcStructureItemProgress(item);

                            const isCDChecked =
                              (item.cuttingQty ?? (item.cuttingDone ? qty : 0)) >= qty;
                            const isSettChecked =
                              (item.settingQty ?? (item.settingDone ? qty : 0)) >= qty;
                            const isWeldChecked =
                              (item.weldingQty ?? (item.weldingDone ? qty : 0)) >= qty;
                            const isFinChecked =
                              (item.finishingQty ?? (item.finishingDone ? qty : 0)) >= qty;
                            const isPaintChecked =
                              (item.paintingQty ?? (item.paintingDone ? qty : 0)) >= qty;
                            const isPackChecked =
                              (item.packagingQty ?? (item.packagingDone ? qty : 0)) >= qty;

                            const hasSubItems =
                              item.subItems && item.subItems.length > 0;

                            return (
                              <React.Fragment key={item.id}>
                                <TableRow className="hover:bg-muted/20 transition-colors text-xs">
                                  <TableCell className="text-center font-medium text-muted-foreground text-[11px]">
                                    {itemIdx + 1}
                                  </TableCell>
                                  <TableCell className="font-semibold text-foreground">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span>{item.name}</span>

                                      {/* Bundel Pengiriman Badge */}
                                      {item.bundleTag && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-medium"
                                          title={`Bundel/Palet: ${item.bundleTag}`}
                                        >
                                          📦 {item.bundleTag}
                                        </Badge>
                                      )}

                                      {/* Badge Counter Sub-Komponen */}
                                      {hasSubItems && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border border-primary/20 font-semibold"
                                        >
                                          {item.subItems.filter((s: any) => s.isCompleted).length}/{item.subItems.length} Sub-Part
                                        </Badge>
                                      )}

                                      {(() => {
                                        const problematicCp =
                                          unit.qcCheckpoints?.find(
                                            (cp: any) =>
                                              cp.itemId === item.id &&
                                              (cp.status === "FAIL" ||
                                                cp.status === "ON_HOLD"),
                                          );
                                        const openRevision =
                                          unit.qcRevisions?.find(
                                            (rev: any) =>
                                              rev.itemId === item.id &&
                                              rev.status === "OPEN",
                                          );

                                        if (openRevision) {
                                          return (
                                            <Badge
                                              variant="destructive"
                                              onClick={() =>
                                                setSelectedRevisionData({
                                                  open: true,
                                                  revision: openRevision,
                                                  itemType: "STRUCTURE",
                                                  itemName: item.name,
                                                  stageName:
                                                    openRevision.stage ||
                                                    "Fabrikasi",
                                                  unitName: unit.name,
                                                })
                                              }
                                              className="text-[9px] px-1 py-0 h-4 font-bold flex items-center gap-1 cursor-pointer bg-red-600 hover:bg-red-700 text-white animate-pulse"
                                            >
                                              <ShieldAlert className="w-2.5 h-2.5" />
                                              REVISI QC
                                            </Badge>
                                          );
                                        }

                                        if (problematicCp) {
                                          return (
                                            <Badge
                                              variant="outline"
                                              className="text-[9px] px-1 py-0 h-4 font-bold flex items-center gap-1 text-amber-500 border-amber-500/30 bg-amber-500/10"
                                            >
                                              <AlertTriangle className="w-2.5 h-2.5" />
                                              QC ISU
                                            </Badge>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge
                                      variant="outline"
                                      className="text-[9px] font-semibold uppercase px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50/50"
                                    >
                                      STRUCTURE
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center font-semibold">
                                    {qty} {item.satuan || "set"}
                                  </TableCell>

                                  {/* C/D Checkbox */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isCDChecked}
                                        onCheckedChange={(checked) =>
                                          setStageDocDialogData({
                                            open: true,
                                            unitId: unit.id,
                                            unitName: unit.name,
                                            componentId: item.id,
                                            componentName: item.name,
                                            stage: "CUTTING",
                                            stageLabel: "Cutting (C/D)",
                                            currentQty: item.cuttingQty || 0,
                                            totalQty: qty,
                                            isInitiallyChecked: !!checked,
                                          })
                                        }
                                        disabled={isPending}
                                        className="cursor-pointer data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                      />
                                    </div>
                                  </TableCell>

                                  {/* Sett Checkbox */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isSettChecked}
                                        onCheckedChange={(checked) =>
                                          setStageDocDialogData({
                                            open: true,
                                            unitId: unit.id,
                                            unitName: unit.name,
                                            componentId: item.id,
                                            componentName: item.name,
                                            stage: "SETTING",
                                            stageLabel: "Setting",
                                            currentQty: item.settingQty || 0,
                                            totalQty: qty,
                                            isInitiallyChecked: !!checked,
                                          })
                                        }
                                        disabled={isPending}
                                        className="cursor-pointer data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                      />
                                    </div>
                                  </TableCell>

                                  {/* Weld Checkbox */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isWeldChecked}
                                        onCheckedChange={(checked) =>
                                          setStageDocDialogData({
                                            open: true,
                                            unitId: unit.id,
                                            unitName: unit.name,
                                            componentId: item.id,
                                            componentName: item.name,
                                            stage: "WELDING",
                                            stageLabel: "Welding",
                                            currentQty: item.weldingQty || 0,
                                            totalQty: qty,
                                            isInitiallyChecked: !!checked,
                                          })
                                        }
                                        disabled={isPending}
                                        className="cursor-pointer data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                                      />
                                    </div>
                                  </TableCell>

                                  {/* Finish Checkbox */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isFinChecked}
                                        onCheckedChange={(checked) =>
                                          setStageDocDialogData({
                                            open: true,
                                            unitId: unit.id,
                                            unitName: unit.name,
                                            componentId: item.id,
                                            componentName: item.name,
                                            stage: "FINISHING",
                                            stageLabel: "Finishing",
                                            currentQty: item.finishingQty || 0,
                                            totalQty: qty,
                                            isInitiallyChecked: !!checked,
                                          })
                                        }
                                        disabled={isPending}
                                        className="cursor-pointer data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600"
                                      />
                                    </div>
                                  </TableCell>

                                  {/* Paint Checkbox */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isPaintChecked}
                                        onCheckedChange={(checked) =>
                                          setStageDocDialogData({
                                            open: true,
                                            unitId: unit.id,
                                            unitName: unit.name,
                                            componentId: item.id,
                                            componentName: item.name,
                                            stage: "PAINTING",
                                            stageLabel: "Painting",
                                            currentQty: item.paintingQty || 0,
                                            totalQty: qty,
                                            isInitiallyChecked: !!checked,
                                          })
                                        }
                                        disabled={isPending}
                                        className="cursor-pointer data-[state=checked]:bg-orange-600 data-[state=checked]:border-orange-600"
                                      />
                                    </div>
                                  </TableCell>

                                  {/* Pack Checkbox */}
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center">
                                      <Checkbox
                                        checked={isPackChecked}
                                        onCheckedChange={(checked) =>
                                          setStageDocDialogData({
                                            open: true,
                                            unitId: unit.id,
                                            unitName: unit.name,
                                            componentId: item.id,
                                            componentName: item.name,
                                            stage: "PACKAGING",
                                            stageLabel: "Packaging",
                                            currentQty: item.packagingQty || 0,
                                            totalQty: qty,
                                            isInitiallyChecked: !!checked,
                                          })
                                        }
                                        disabled={isPending}
                                        className="cursor-pointer data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                      />
                                    </div>
                                  </TableCell>

                                  {/* Progress % Box */}
                                  <TableCell className="text-center">
                                    <div className="inline-flex items-center justify-center border border-border/80 bg-background/80 px-2 py-0.5 rounded-md text-[11px] font-bold text-foreground min-w-16">
                                      {itemProgress.toFixed(2)}%
                                    </div>
                                  </TableCell>
                                </TableRow>

                                {/* Baris Sub-Komponen di Bawah Komponen Utama */}
                                {hasSubItems &&
                                  item.subItems.map((sub: any, subIdx: number) => (
                                    <TableRow
                                      key={sub.id || `${item.id}-sub-${subIdx}`}
                                      className={cn(
                                        "bg-muted/15 border-b border-border/30 hover:bg-muted/30 transition-colors text-xs",
                                        sub.isCompleted ? "bg-emerald-500/5" : ""
                                      )}
                                    >
                                      {/* Sub No */}
                                      <TableCell className="text-center font-bold text-primary/80 p-1.5 text-[11px]">
                                        <span className="font-mono text-muted-foreground/40 mr-1 select-none">└─</span>
                                        {itemIdx + 1}.{subIdx + 1}
                                      </TableCell>

                                      {/* Sub-Part Name & Details (Tanpa Coretan) */}
                                      <TableCell className="font-medium py-1.5 px-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] px-1 py-0 h-3.5 bg-background text-muted-foreground font-semibold border-border/80"
                                          >
                                            Sub-Part
                                          </Badge>
                                          <span className="text-xs text-foreground font-medium">
                                            {sub.name}
                                          </span>
                                          {sub.dimension && (
                                            <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded font-mono">
                                              {sub.dimension}
                                            </span>
                                          )}
                                        </div>
                                      </TableCell>

                                      {/* Kategori */}
                                      <TableCell className="text-center">
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] font-medium px-1.5 py-0 border-blue-200/60 text-blue-600/80 bg-blue-50/30"
                                        >
                                          SUB-PART
                                        </Badge>
                                      </TableCell>

                                      {/* Qty */}
                                      <TableCell className="text-center text-muted-foreground text-xs font-medium">
                                        {sub.qty || 1} {sub.satuan || "pcs"}
                                      </TableCell>

                                      {/* C/D, Sett, Weld, Finish, Paint, Pack Columns: Kosong */}
                                      <TableCell className="p-1.5" />
                                      <TableCell className="p-1.5" />
                                      <TableCell className="p-1.5" />
                                      <TableCell className="p-1.5" />
                                      <TableCell className="p-1.5" />
                                      <TableCell className="p-1.5" />

                                      {/* Kolom Paling Kanan (Progress): Checklist Penyelesaian Sub-Part */}
                                      <TableCell className="text-center p-1.5">
                                        <div className="flex items-center justify-center">
                                          <Checkbox
                                            checked={sub.isCompleted}
                                            onCheckedChange={() =>
                                              handleToggleSubItem(sub.id, sub.isCompleted)
                                            }
                                            disabled={isPending}
                                            className="cursor-pointer h-4 w-4 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                            title={sub.isCompleted ? "Selesai (Klik untuk batal)" : "Tandai Selesai"}
                                          />
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>

                        {/* Unit Table Footer */}
                        {(() => {
                          const totalUnitPercent =
                            unit.structureItems.length > 0
                              ? unit.structureItems.reduce(
                                  (sum: number, it: any) =>
                                    sum + Number(it.progressPercent || 0),
                                  0,
                                ) / unit.structureItems.length
                              : 0;

                          return (
                            <TableFooter className="bg-muted/40 font-bold text-xs">
                              <TableRow>
                                <TableCell
                                  colSpan={4}
                                  className="text-right font-bold uppercase py-2.5"
                                >
                                  Rata-Rata Progres {unit.name}
                                </TableCell>
                                <TableCell colSpan={6} className="py-2.5"></TableCell>
                                <TableCell className="text-center font-black text-primary py-2.5 text-xs">
                                  <div className="inline-flex items-center justify-center border border-primary/40 bg-primary/10 text-primary px-2.5 py-0.5 rounded-md font-black text-xs min-w-16">
                                    {totalUnitPercent.toFixed(2)}%
                                  </div>
                                </TableCell>
                              </TableRow>
                            </TableFooter>
                          );
                        })()}
                      </Table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* QC Revision Detail Dialog */}
      {selectedRevisionData && (
        <QCRevisionDetailDialog
          open={selectedRevisionData.open}
          onOpenChange={(open) => {
            if (!open) setSelectedRevisionData(null);
          }}
          revision={selectedRevisionData.revision}
          projectId={
            units[0]?.projectId || selectedRevisionData.revision?.projectId
          }
          itemType={selectedRevisionData.itemType}
          itemName={selectedRevisionData.itemName}
          stageName={selectedRevisionData.stageName}
          unitName={selectedRevisionData.unitName}
        />
      )}

      {/* Stage Progress Documentation Dialog (Optional Notes & Photos) */}
      {stageDocDialogData && currentProject && (
        <StageProgressDialog
          open={stageDocDialogData.open}
          onOpenChange={(open) => {
            if (!open) setStageDocDialogData(null);
          }}
          componentType="STRUCTURE"
          projectId={currentProject.id}
          unitId={stageDocDialogData.unitId}
          unitName={stageDocDialogData.unitName}
          componentId={stageDocDialogData.componentId}
          componentName={stageDocDialogData.componentName}
          stage={stageDocDialogData.stage}
          stageLabel={stageDocDialogData.stageLabel}
          currentQty={stageDocDialogData.currentQty}
          totalQty={stageDocDialogData.totalQty}
          isInitiallyChecked={stageDocDialogData.isInitiallyChecked}
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}

      {/* Progress Photo Dialog */}
      {currentProject && (
        <ProgressPhotoDialog
          isOpen={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          projectId={currentProject.id}
          projectName={currentProject.projectName}
          unitId={selectedPhotoUnit.id}
          unitName={selectedPhotoUnit.name}
          category="FABRICATION_STRUCTURE"
        />
      )}
    </div>
  );
}
