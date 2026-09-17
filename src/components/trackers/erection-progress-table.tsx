"use client";

import React, { useState, useTransition } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  CheckCircle2,
  Clock,
  Layers,
  Search,
  Wrench,
  Sparkles,
  TrendingUp,
  Percent,
  CheckCheck,
  RotateCcw,
  SlidersHorizontal,
  Calendar,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ProgressPhotoDialog } from "@/components/trackers/progress-photo-dialog";
import {
  calcErectionItemProgress,
  calcUnitErectionProgress,
} from "@/lib/erection-calculator";
import {
  updateErectionItemChecklist,
  bulkUpdateErectionStage,
} from "@/app/actions/erection-progress";

export interface ErectionProgressTableProps {
  currentProject: any;
  units: any[];
}

export function ErectionProgressTable({
  currentProject,
  units: initialUnits,
}: ErectionProgressTableProps) {
  const [units, setUnits] = useState<any[]>(initialUnits);
  const [activeTab, setActiveTab] = useState<
    "ALL" | "STRUCTURE" | "MECHANICAL"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUnits, setExpandedUnits] = useState<string[]>(
    initialUnits.map((u) => u.id),
  );
  const [isPending, startTransition] = useTransition();
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedPhotoUnit, setSelectedPhotoUnit] = useState<{
    id?: string;
    name?: string;
  }>({});

  // Find Erection Masterplan Phase
  const erectionPhase = currentProject?.masterplan?.phases?.find(
    (p: any) =>
      p.code === "ERECTION" ||
      p.name.toUpperCase().includes("ERECTION") ||
      p.name.toUpperCase().includes("EREKSI"),
  );

  const phaseWeight = Number(erectionPhase?.weightPercent) || 8.55;
  const phasePlanProgress = Number(erectionPhase?.planProgress) || 0;

  // Calculate normalized unit weight plan so total is ALWAYS exactly 100%
  const rawUnitWeights = units.map((u) => {
    const upRecord = u.progresses?.find(
      (up: any) => up.phaseId === erectionPhase?.id,
    );
    return upRecord && Number(upRecord.weightPercent) > 0
      ? Number(upRecord.weightPercent)
      : 0;
  });
  const totalRawWeight = rawUnitWeights.reduce((sum, w) => sum + w, 0);

  // Calculate Unit Progresses and Project Total Erection Progress
  const unitStats = units.map((u, idx) => {
    const sItems = u.structureItems || [];
    const mItems = u.mechanicalItems || [];
    const unitProgress = calcUnitErectionProgress(sItems, mItems);

    // Normalize so sum of weightPlan across units is strictly 100%
    let weightPlan = 0;
    if (totalRawWeight > 0) {
      weightPlan = (rawUnitWeights[idx] / totalRawWeight) * 100;
    } else if (units.length > 0) {
      weightPlan = 100 / units.length;
    }

    const actualWeight = (unitProgress * weightPlan) / 100;

    return {
      ...u,
      indexLetter: String.fromCharCode(65 + idx), // A, B, C, D...
      unitProgress,
      weightPlan,
      actualWeight,
      totalItemsCount: sItems.length + mItems.length,
      completedItemsCount: [...sItems, ...mItems].filter(
        (it) => calcErectionItemProgress(it) >= 100,
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

  // Handle single item update
  const handleItemCheck = async (
    itemId: string,
    itemType: "STRUCTURE" | "MECHANICAL",
    stage: "SETT" | "INSTALL" | "FINISH",
    currentDone: boolean,
    totalQty: number,
  ) => {
    const newDone = !currentDone;
    const toastId = toast.loading("Memperbarui status ereksi...");

    // Optimistic UI Update
    setUnits((prev) =>
      prev.map((u) => {
        const updateList = (items: any[]) =>
          items.map((it) => {
            if (it.id !== itemId) return it;
            const updated = { ...it };
            if (stage === "SETT") {
              updated.erectionSettDone = newDone;
              updated.erectionSettQty = newDone ? totalQty : 0;
            } else if (stage === "INSTALL") {
              updated.erectionInstallDone = newDone;
              updated.erectionInstallQty = newDone ? totalQty : 0;
            } else if (stage === "FINISH") {
              updated.erectionFinishDone = newDone;
              updated.erectionFinishQty = newDone ? totalQty : 0;
            }
            updated.erectionProgress = calcErectionItemProgress(updated);
            return updated;
          });

        return {
          ...u,
          structureItems:
            itemType === "STRUCTURE"
              ? updateList(u.structureItems || [])
              : u.structureItems,
          mechanicalItems:
            itemType === "MECHANICAL"
              ? updateList(u.mechanicalItems || [])
              : u.mechanicalItems,
        };
      }),
    );

    startTransition(async () => {
      const dataInput: any = {};
      if (stage === "SETT") {
        dataInput.erectionSettDone = newDone;
        dataInput.erectionSettQty = newDone ? totalQty : 0;
      } else if (stage === "INSTALL") {
        dataInput.erectionInstallDone = newDone;
        dataInput.erectionInstallQty = newDone ? totalQty : 0;
      } else if (stage === "FINISH") {
        dataInput.erectionFinishDone = newDone;
        dataInput.erectionFinishQty = newDone ? totalQty : 0;
      }

      const res = await updateErectionItemChecklist(
        itemId,
        itemType,
        dataInput,
      );
      if (res.success) {
        toast.success("Progress Erection berhasil disimpan!", { id: toastId });
      } else {
        toast.error(res.error || "Gagal memperbarui progress", { id: toastId });
      }
    });
  };

  // Handle Bulk Stage Update
  const handleBulkStage = async (
    unitId: string,
    category: "ALL" | "STRUCTURE" | "MECHANICAL",
    stage: "SETT" | "INSTALL" | "FINISH",
    done: boolean,
  ) => {
    const toastId = toast.loading(`Menyimpan pembaruan massal ${stage}...`);

    startTransition(async () => {
      const res = await bulkUpdateErectionStage(unitId, category, stage, done);
      if (res.success) {
        toast.success(res.message, { id: toastId });
        // Update local state
        setUnits((prev) =>
          prev.map((u) => {
            if (u.id !== unitId) return u;

            const applyBulk = (items: any[]) =>
              items.map((it) => {
                const qty = Math.max(1, it.qty || 1);
                const updated = { ...it };
                if (stage === "SETT") {
                  updated.erectionSettDone = done;
                  updated.erectionSettQty = done ? qty : 0;
                } else if (stage === "INSTALL") {
                  updated.erectionInstallDone = done;
                  updated.erectionInstallQty = done ? qty : 0;
                } else if (stage === "FINISH") {
                  updated.erectionFinishDone = done;
                  updated.erectionFinishQty = done ? qty : 0;
                }
                updated.erectionProgress = calcErectionItemProgress(updated);
                return updated;
              });

            return {
              ...u,
              structureItems:
                category === "ALL" || category === "STRUCTURE"
                  ? applyBulk(u.structureItems || [])
                  : u.structureItems,
              mechanicalItems:
                category === "ALL" || category === "MECHANICAL"
                  ? applyBulk(u.mechanicalItems || [])
                  : u.mechanicalItems,
            };
          }),
        );
      } else {
        toast.error(res.error || "Gagal melakukan update massal", {
          id: toastId,
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI SUMMARY & S-CURVE METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Progress Erection */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Total Progress Erection
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {totalActualProgress.toFixed(2)}%
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-md",
                  totalActualProgress >= 100
                    ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                    : totalActualProgress > 0
                      ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                      : "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {totalActualProgress >= 100
                  ? "Selesai Penuh"
                  : totalActualProgress > 0
                    ? "In Progress"
                    : "Belum Mulai"}
              </Badge>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-muted/60 rounded-full h-2 mt-2.5 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-500 rounded-full"
                style={{ width: `${Math.min(100, totalActualProgress)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 flex items-center justify-between">
              <span>Target S-Curve: {phasePlanProgress.toFixed(2)}%</span>
              <span
                className={cn(
                  "font-bold",
                  totalActualProgress >= phasePlanProgress
                    ? "text-emerald-600"
                    : "text-amber-600",
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
              <span>Sesuai formula S-Curve</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Komponen Selesai Ereksi */}
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
              <span>Finishing & Alignment 100% Selesai</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Unit Conveyor Aktif */}
        <Card className="rounded-2xl border bg-card/80 backdrop-blur shadow-sm overflow-hidden">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold text-muted-foreground">
              Unit Conveyor
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-baseline justify-between">
              <div className="text-2xl font-black tracking-tight text-foreground">
                {units.length} Unit
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

      {/* 2. REKAPITULASI ERECTION PROGRESS TABLE (Sesuai Hal. 16 PDF) */}
      <Card className="rounded-2xl border shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Building2 className="w-4 h-4 text-blue-600" />
              Rekapitulasi Erection Progress
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rangkuman pencapaian bobot ereksi per unit conveyor (Halaman 16
              PDF Laporan).
            </p>
          </div>
          <div className="flex items-center gap-2">
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
                    Belum ada unit conveyor pada proyek ini. Silakan atur di
                    Masterplan Setup.
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
                        <span>{u.unitProgress.toFixed(2)}%</span>
                        <div className="w-20 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{
                              width: `${Math.min(100, u.unitProgress)}%`,
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
                          u.unitProgress >= 100
                            ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                            : u.unitProgress > 0
                              ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                              : "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {u.unitProgress >= 100
                          ? "Selesai"
                          : u.unitProgress > 0
                            ? "Erection In Progress"
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
                  TOTAL ERECTION
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

      {/* 3. DETAIL CHECKLIST KOMPONEN PER UNIT (Sesuai Hal. 12-15 PDF) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              Detail Checklist Erection per Unit
            </h3>
            <p className="text-xs text-muted-foreground">
              Tahapan lapangan: <b>Sett (30%)</b>,{" "}
              <b>Install (65% $\rightarrow$ 95%)</b>, dan{" "}
              <b>Finish (5% $\rightarrow$ 100%)</b>.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari komponen..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 text-xs pl-8 w-44 sm:w-56 rounded-lg font-medium"
              />
            </div>

            {/* Filter Category */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as any)}
              className="h-8"
            >
              <TabsList className="h-8 p-0.5 rounded-lg bg-muted/60">
                <TabsTrigger value="ALL" className="text-xs h-7 px-2.5">
                  Semua
                </TabsTrigger>
                <TabsTrigger value="STRUCTURE" className="text-xs h-7 px-2.5">
                  Structure
                </TabsTrigger>
                <TabsTrigger value="MECHANICAL" className="text-xs h-7 px-2.5">
                  Mechanical
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

            const mechanicalItems = (unit.mechanicalItems || []).filter(
              (it: any) =>
                !searchQuery ||
                it.name.toLowerCase().includes(searchQuery.toLowerCase()),
            );

            const shouldShowStructure =
              activeTab === "ALL" || activeTab === "STRUCTURE";
            const shouldShowMechanical =
              activeTab === "ALL" || activeTab === "MECHANICAL";

            const visibleItemCount =
              (shouldShowStructure ? structureItems.length : 0) +
              (shouldShowMechanical ? mechanicalItems.length : 0);

            return (
              <AccordionItem
                key={unit.id}
                value={unit.id}
                className="rounded-2xl border bg-card shadow-sm overflow-hidden"
              >
                <AccordionTrigger className="px-4 sm:px-5 py-3 hover:bg-muted/30 transition-colors">
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
                          Progres: {unit.unitProgress.toFixed(2)}%
                        </span>
                      </div>
                      <div className="w-24 bg-muted/60 rounded-full h-2 overflow-hidden hidden sm:block">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.min(100, unit.unitProgress)}%`,
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
                          handleBulkStage(unit.id, activeTab, "SETT", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/40 dark:text-blue-400 cursor-pointer"
                      >
                        ✓ Sett Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, activeTab, "INSTALL", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 cursor-pointer"
                      >
                        ✓ Install Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleBulkStage(unit.id, activeTab, "FINISH", true)
                        }
                        disabled={isPending}
                        className="h-7 text-[11px] font-semibold rounded-md border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-400 cursor-pointer"
                      >
                        ✓ Finish Semua
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          handleBulkStage(unit.id, activeTab, "SETT", false);
                          handleBulkStage(unit.id, activeTab, "INSTALL", false);
                          handleBulkStage(unit.id, activeTab, "FINISH", false);
                        }}
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
                        title={`Dokumentasi Foto Erection untuk ${unit.name}`}
                      >
                        <Camera className="w-3 h-3" /> Foto Erection
                      </Button>
                    </div>
                  </div>

                  {visibleItemCount === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Tidak ada komponen yang cocok dengan pencarian / filter.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead className="w-12 text-center text-[11px] font-bold">
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
                            <TableHead className="w-28 text-center text-[11px] font-bold text-blue-700 dark:text-blue-400">
                              Sett (30%)
                            </TableHead>
                            <TableHead className="w-28 text-center text-[11px] font-bold text-amber-700 dark:text-amber-400">
                              Install (65%)
                            </TableHead>
                            <TableHead className="w-28 text-center text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                              Finish (5%)
                            </TableHead>
                            <TableHead className="w-28 text-center text-[11px] font-bold">
                              Progress (%)
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* Structure Section */}
                          {shouldShowStructure && structureItems.length > 0 && (
                            <>
                              <TableRow className="bg-muted/40 font-bold text-xs">
                                <TableCell
                                  colSpan={8}
                                  className="py-1.5 px-4 text-primary text-[11px] tracking-wide uppercase"
                                >
                                  🏗️ Structure Components (
                                  {structureItems.length} items)
                                </TableCell>
                              </TableRow>
                              {structureItems.map(
                                (item: any, itemIdx: number) => {
                                  const itemProgress =
                                    calcErectionItemProgress(item);
                                  const qty = Math.max(1, item.qty || 1);

                                  return (
                                    <TableRow
                                      key={item.id}
                                      className="hover:bg-muted/20 transition-colors text-xs"
                                    >
                                      <TableCell className="text-center font-medium text-muted-foreground text-[11px]">
                                        {itemIdx + 1}
                                      </TableCell>
                                      <TableCell className="font-semibold text-foreground">
                                        {item.name}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge
                                          variant="outline"
                                          className="text-[9px] font-semibold uppercase px-1.5 py-0 border-blue-200 text-blue-600 bg-blue-50/50"
                                        >
                                          Structure
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center font-semibold">
                                        {qty} {item.satuan || "set"}
                                      </TableCell>

                                      {/* Sett Checkbox */}
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center">
                                          <Checkbox
                                            checked={!!item.erectionSettDone}
                                            onCheckedChange={() =>
                                              handleItemCheck(
                                                item.id,
                                                "STRUCTURE",
                                                "SETT",
                                                !!item.erectionSettDone,
                                                qty,
                                              )
                                            }
                                            disabled={isPending}
                                            className="cursor-pointer data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                          />
                                        </div>
                                      </TableCell>

                                      {/* Install Checkbox */}
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center">
                                          <Checkbox
                                            checked={!!item.erectionInstallDone}
                                            onCheckedChange={() =>
                                              handleItemCheck(
                                                item.id,
                                                "STRUCTURE",
                                                "INSTALL",
                                                !!item.erectionInstallDone,
                                                qty,
                                              )
                                            }
                                            disabled={isPending}
                                            className="cursor-pointer data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                          />
                                        </div>
                                      </TableCell>

                                      {/* Finish Checkbox */}
                                      <TableCell className="text-center">
                                        <div className="flex items-center justify-center">
                                          <Checkbox
                                            checked={!!item.erectionFinishDone}
                                            onCheckedChange={() =>
                                              handleItemCheck(
                                                item.id,
                                                "STRUCTURE",
                                                "FINISH",
                                                !!item.erectionFinishDone,
                                                qty,
                                              )
                                            }
                                            disabled={isPending}
                                            className="cursor-pointer data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                          />
                                        </div>
                                      </TableCell>

                                      {/* Progress % */}
                                      <TableCell className="text-center">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded",
                                            itemProgress >= 100
                                              ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                                              : itemProgress >= 95
                                                ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                                                : itemProgress > 0
                                                  ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40"
                                                  : "border-muted-foreground/30 text-muted-foreground",
                                          )}
                                        >
                                          {itemProgress.toFixed(2)}%
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                },
                              )}
                            </>
                          )}

                          {/* Mechanical Section */}
                          {shouldShowMechanical &&
                            mechanicalItems.length > 0 && (
                              <>
                                <TableRow className="bg-muted/40 font-bold text-xs">
                                  <TableCell
                                    colSpan={8}
                                    className="py-1.5 px-4 text-purple-600 dark:text-purple-400 text-[11px] tracking-wide uppercase"
                                  >
                                    ⚙️ Mechanical Components (
                                    {mechanicalItems.length} items)
                                  </TableCell>
                                </TableRow>
                                {mechanicalItems.map(
                                  (item: any, itemIdx: number) => {
                                    const itemProgress =
                                      calcErectionItemProgress(item);
                                    const qty = Math.max(1, item.qty || 1);

                                    return (
                                      <TableRow
                                        key={item.id}
                                        className="hover:bg-muted/20 transition-colors text-xs"
                                      >
                                        <TableCell className="text-center font-medium text-muted-foreground text-[11px]">
                                          {itemIdx + 1}
                                        </TableCell>
                                        <TableCell className="font-semibold text-foreground">
                                          {item.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] font-semibold uppercase px-1.5 py-0 border-purple-200 text-purple-600 bg-purple-50/50"
                                          >
                                            Mechanical
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-semibold">
                                          {qty} {item.satuan || "unit"}
                                        </TableCell>

                                        {/* Sett Checkbox */}
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center">
                                            <Checkbox
                                              checked={!!item.erectionSettDone}
                                              onCheckedChange={() =>
                                                handleItemCheck(
                                                  item.id,
                                                  "MECHANICAL",
                                                  "SETT",
                                                  !!item.erectionSettDone,
                                                  qty,
                                                )
                                              }
                                              disabled={isPending}
                                              className="cursor-pointer data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                            />
                                          </div>
                                        </TableCell>

                                        {/* Install Checkbox */}
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center">
                                            <Checkbox
                                              checked={
                                                !!item.erectionInstallDone
                                              }
                                              onCheckedChange={() =>
                                                handleItemCheck(
                                                  item.id,
                                                  "MECHANICAL",
                                                  "INSTALL",
                                                  !!item.erectionInstallDone,
                                                  qty,
                                                )
                                              }
                                              disabled={isPending}
                                              className="cursor-pointer data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                                            />
                                          </div>
                                        </TableCell>

                                        {/* Finish Checkbox */}
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center">
                                            <Checkbox
                                              checked={
                                                !!item.erectionFinishDone
                                              }
                                              onCheckedChange={() =>
                                                handleItemCheck(
                                                  item.id,
                                                  "MECHANICAL",
                                                  "FINISH",
                                                  !!item.erectionFinishDone,
                                                  qty,
                                                )
                                              }
                                              disabled={isPending}
                                              className="cursor-pointer data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                            />
                                          </div>
                                        </TableCell>

                                        {/* Progress % */}
                                        <TableCell className="text-center">
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[10px] font-bold px-2 py-0.5 rounded",
                                              itemProgress >= 100
                                                ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                                                : itemProgress >= 95
                                                  ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/40"
                                                  : itemProgress > 0
                                                    ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/40"
                                                    : "border-muted-foreground/30 text-muted-foreground",
                                            )}
                                          >
                                            {itemProgress.toFixed(2)}%
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  },
                                )}
                              </>
                            )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Progress Photo Dialog */}
      {currentProject && (
        <ProgressPhotoDialog
          isOpen={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          projectId={currentProject.id}
          projectName={currentProject.projectName}
          unitId={selectedPhotoUnit.id}
          unitName={selectedPhotoUnit.name}
          category="ERECTION"
        />
      )}
    </div>
  );
}
