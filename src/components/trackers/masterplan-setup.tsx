"use client";

import React, { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Trash2,
  Calendar,
  Users,
  Layers,
  Layout,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
  Info,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { formatJakartaDate } from "@/lib/date-utils";
import { setupProjectMasterplan } from "@/app/actions/masterplan";
import { DEFAULT_CONVEYOR_PHASES } from "@/lib/progress-weights";
import { checkEngineeringPrerequisitesLocal } from "@/lib/engineering-progress";
import { calculateMasterScheduleMatrix } from "@/lib/s-curve-calculator";
import { cn } from "@/lib/utils";

function FormattedDateInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const dateObj = value ? new Date(value + "T00:00:00") : null;
  const formattedDisplay =
    dateObj && !isNaN(dateObj.getTime()) ? format(dateObj, "dd/MM/yyyy") : "";

  const [inputValue, setInputValue] = React.useState(formattedDisplay);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (dateObj && !isNaN(dateObj.getTime())) {
      setInputValue(format(dateObj, "dd/MM/yyyy"));
    }
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputValue(text);

    const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const year = parseInt(match[3], 10);
      const parsedDate = new Date(year, month, day);
      if (
        parsedDate.getFullYear() === year &&
        parsedDate.getMonth() === month &&
        parsedDate.getDate() === day
      ) {
        const yyyyMmDd = format(parsedDate, "yyyy-MM-dd");
        onChange(yyyyMmDd);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative flex items-center w-full">
        <Input
          type="text"
          placeholder="DD/MM/YYYY"
          value={inputValue}
          onChange={handleTextChange}
          className={cn(
            "pr-9 font-semibold text-xs rounded-xl h-10 shadow-none bg-background/50 focus:bg-background border-border/80",
            className,
          )}
        />
        <PopoverTrigger
          className="absolute right-2.5 p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Buka Kalender"
        >
          <Calendar className="w-4 h-4 text-primary" />
        </PopoverTrigger>
      </div>
      <PopoverContent
        className="w-auto p-0 rounded-2xl border border-border shadow-xl bg-card"
        align="start"
      >
        <CalendarComponent
          mode="single"
          selected={dateObj && !isNaN(dateObj.getTime()) ? dateObj : undefined}
          onSelect={(d) => {
            if (d) {
              const yyyyMmDd = format(d, "yyyy-MM-dd");
              onChange(yyyyMmDd);
              setOpen(false);
            }
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

export function MasterplanSetup({
  project,
  onSuccess,
}: {
  project: any;
  onSuccess?: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState("general");

  // State configurations
  // 1. Start Date (defaults to project instance created / sales deal)
  const [startDate, setStartDate] = useState<string>(() => {
    if (project.masterplan?.startDate) {
      try {
        return new Date(project.masterplan.startDate).toISOString().split("T")[0];
      } catch (e) {}
    }
    const rawVal = project.dealAt || project.startDate || project.createdAt;
    if (rawVal) {
      try {
        return new Date(rawVal).toISOString().split("T")[0];
      } catch (e) {}
    }
    return new Date().toISOString().split("T")[0];
  });

  // 2. End Date (defaults to sales expected date / target deadline)
  const [endDate, setEndDate] = useState<string>(() => {
    if (project.expectedDate) {
      try {
        return new Date(project.expectedDate).toISOString().split("T")[0];
      } catch (e) {}
    }
    // Fallback: start + 30 weeks
    const start = new Date(startDate || new Date());
    start.setDate(start.getDate() + 30 * 7);
    return start.toISOString().split("T")[0];
  });

  // 3. Total Weeks (calculated from startDate and endDate, or fallback to saved masterplan.totalWeeks)
  const [totalWeeks, setTotalWeeks] = useState<number>(() => {
    if (project.masterplan?.totalWeeks) {
      return project.masterplan.totalWeeks;
    }
    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        return Math.max(1, Math.ceil(diffDays / 7));
      }
    }
    return 30;
  });

  // Recalculate duration helpers
  const calculateDuration = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return { totalDays: 0, weeks: 0, extraDays: 0 };
    const s = new Date(startStr);
    const e = new Date(endStr);
    const diffMs = e.getTime() - s.getTime();
    const totalDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays <= 0) return { totalDays: 0, weeks: 0, extraDays: 0 };
    const weeks = Math.floor(totalDays / 7);
    const extraDays = totalDays % 7;
    return { totalDays, weeks, extraDays };
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate) {
      const { totalDays } = calculateDuration(val, endDate);
      if (totalDays > 0) {
        setTotalWeeks(Math.max(1, Math.ceil(totalDays / 7)));
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val) {
      const { totalDays } = calculateDuration(startDate, val);
      if (totalDays > 0) {
        setTotalWeeks(Math.max(1, Math.ceil(totalDays / 7)));
      }
    }
  };

  const handleTotalWeeksChange = (val: number) => {
    const numWeeks = Math.max(1, val);
    setTotalWeeks(numWeeks);
    if (startDate) {
      const s = new Date(startDate);
      s.setDate(s.getDate() + numWeeks * 7);
      setEndDate(s.toISOString().split("T")[0]);
    }
  };

  const durationInfo = calculateDuration(startDate, endDate);

  // Leaders state
  const [leaders, setLeaders] = useState<Array<{ divisionName: string; leaderName: string }>>(() => {
    if (project.masterplan?.divisionLeaders && project.masterplan.divisionLeaders.length > 0) {
      return project.masterplan.divisionLeaders.map((dl: any) => ({
        divisionName: dl.divisionName,
        leaderName: dl.leaderName,
      }));
    }
    return [{ divisionName: "", leaderName: "" }];
  });

  // Phases state (initialize with existing or default values)
  const [phases, setPhases] = useState<any[]>(() => {
    if (project.masterplan?.phases && project.masterplan.phases.length > 0) {
      return project.masterplan.phases.map((p: any) => {
        const wtMap: Record<number, number> = {};
        if (p.weeklyTargets && Array.isArray(p.weeklyTargets)) {
          p.weeklyTargets.forEach((wt: any) => {
            wtMap[wt.weekNumber] = Number(wt.targetPercent || 0);
          });
        }
        return {
          id: p.id,
          code: p.code,
          name: p.name,
          weightPercent: Number(p.weightPercent || 0),
          startWeek: p.startWeek,
          endWeek: p.endWeek,
          orderIndex: p.orderIndex,
          subSteps: p.subSteps || ([] as string[]),
          weeklyTargets: wtMap,
        };
      });
    }
    return DEFAULT_CONVEYOR_PHASES.map((p) => ({
      code: p.code,
      name: p.name,
      weightPercent: p.weight,
      startWeek: p.startWeek,
      endWeek: p.endWeek,
      orderIndex: p.orderIndex,
      subSteps:
        p.code === "SHIPMENT"
          ? ["Packing & Loading", "Transit & Delivery", "Received at Site"]
          : p.code === "ERECTION"
            ? [
                "Foundation Alignment",
                "Frame Assembly",
                "Belt & Roller Installation",
                "Drive Unit Installation",
              ]
            : p.code === "COMMISSIONING"
              ? [
                  "Dry Run Test (no load)",
                  "Wet Run Test (loaded)",
                  "Client Acceptance & Signoff",
                ]
              : ([] as string[]),
      weeklyTargets: {} as Record<number, number>,
    }));
  });

  // Units state (default loaded with existing or empty conveyor unit)
  const [units, setUnits] = useState<any[]>(() => {
    if (project.conveyorUnits && project.conveyorUnits.length > 0) {
      return project.conveyorUnits.map((u: any) => ({
        name: u.name,
        unitType: u.unitType,
        satuan: u.satuan || "unit",
        volume: u.volume || 1,
        structureItems: u.structureItems
          ? u.structureItems.map((si: any) => ({
              name: si.name,
              qty: si.qty || 1,
              satuan: si.satuan || "unit",
            }))
          : [],
        mechanicalItems: u.mechanicalItems
          ? u.mechanicalItems.map((mi: any) => ({
              name: mi.name,
              qty: mi.qty || 1,
              satuan: mi.satuan || "unit",
            }))
          : [],
      }));
    }
    return [
      {
        name: "",
        unitType: "BOTH",
        satuan: "unit",
        volume: 1,
        structureItems: [] as any[],
        mechanicalItems: [] as any[],
      },
    ];
  });

  // Helper to add conveyor unit
  const addUnit = () => {
    setUnits([
      ...units,
      {
        name: "",
        unitType: "BOTH",
        satuan: "unit",
        volume: 1,
        structureItems: [] as any[],
        mechanicalItems: [] as any[],
      },
    ]);
  };

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const MANDATORY_CODES = ["PROCUREMENT", "ENGINEERING", "FAB_STRUCT_MECH"];

  const addLeader = () => {
    setLeaders([...leaders, { divisionName: "", leaderName: "" }]);
  };

  const removeLeader = (index: number) => {
    setLeaders(leaders.filter((_, i) => i !== index));
  };

  const addPhase = () => {
    const newIdx = phases.length + 1;
    setPhases([
      ...phases,
      {
        code: `CUSTOM_PHASE_${Date.now()}`,
        name: `Tahapan Baru ${newIdx}`,
        weightPercent: 0,
        startWeek: 1,
        endWeek: totalWeeks,
        orderIndex: newIdx,
        subSteps: [] as string[],
      },
    ]);
  };

  const removePhase = (index: number) => {
    const updated = phases.filter((_, i) => i !== index);
    const adjusted = updated.map((p, idx) => ({ ...p, orderIndex: idx + 1 }));
    setPhases(adjusted);
  };

  const updateUnitField = (index: number, field: string, value: any) => {
    const updated = [...units];
    updated[index][field] = value;
    setUnits(updated);
  };

  const getEffectivePhaseWeeklyTargets = (phase: any, weeksCount: number) => {
    const wtMap: Record<number, number> = { ...(phase.weeklyTargets || {}) };
    const weight = Number(phase.weightPercent || 0);
    const startW = Math.max(1, Number(phase.startWeek || 1));
    const endW = Math.min(weeksCount, Number(phase.endWeek || weeksCount));
    const duration = Math.max(1, endW - startW + 1);

    const hasCustom = Object.values(wtMap).some((v) => Number(v || 0) > 0);
    if (!hasCustom && weight > 0 && duration > 0) {
      const share = Math.round((weight / duration) * 100) / 100;
      let sum = 0;
      for (let w = 1; w <= weeksCount; w++) {
        if (w >= startW && w <= endW) {
          const val = w === endW ? Math.round((weight - sum) * 100) / 100 : share;
          wtMap[w] = Math.max(0, val);
          sum += share;
        } else {
          wtMap[w] = 0;
        }
      }
    }
    return wtMap;
  };

  // Submit Handler
  const prereqs = checkEngineeringPrerequisitesLocal(project);

  const handleSubmit = async () => {
    if (!prereqs.canCreateMasterplan) {
      toast.error(
        `Prasyarat Engineering belum lengkap! Kurang: ${prereqs.missingItems.join(", ")}`,
      );
      return;
    }

    const totalWeight = phases.reduce(
      (sum, p) => sum + Number(p.weightPercent),
      0,
    );
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast.error(
        `Total bobot tahapan harus tepat 100.00%. Saat ini: ${totalWeight.toFixed(2)}%`,
      );
      return;
    }

    // Validate unit & component items
    for (let uIdx = 0; uIdx < units.length; uIdx++) {
      const u = units[uIdx];
      const uName = u.name || `Unit Conveyor ${uIdx + 1}`;
      if (!u.name || !u.name.trim()) {
        toast.error(`Nama unit ke-${uIdx + 1} tidak boleh kosong!`);
        return;
      }

      if (u.unitType === "BOTH" || u.unitType === "STRUCTURE") {
        for (const stItem of u.structureItems || []) {
          const itemObj =
            typeof stItem === "string"
              ? { name: stItem, qty: 1, satuan: "unit" }
              : stItem;
          if (!itemObj.name || !itemObj.name.trim()) {
            toast.error(
              `Ada nama komponen struktur yang masih kosong pada ${uName}!`,
            );
            return;
          }
          if (
            itemObj.qty === "" ||
            itemObj.qty === null ||
            itemObj.qty === undefined ||
            isNaN(Number(itemObj.qty)) ||
            Number(itemObj.qty) <= 0
          ) {
            toast.error(
              `Jumlah (Qty) komponen "${itemObj.name}" pada ${uName} tidak boleh kosong atau 0!`,
            );
            return;
          }
        }
      }

      if (u.unitType === "BOTH" || u.unitType === "MECHANICAL") {
        for (const mItem of u.mechanicalItems || []) {
          const itemObj =
            typeof mItem === "string"
              ? { name: mItem, qty: 1, satuan: "unit" }
              : mItem;
          if (!itemObj.name || !itemObj.name.trim()) {
            toast.error(
              `Ada nama komponen mekanikal yang masih kosong pada ${uName}!`,
            );
            return;
          }
          if (
            itemObj.qty === "" ||
            itemObj.qty === null ||
            itemObj.qty === undefined ||
            isNaN(Number(itemObj.qty)) ||
            Number(itemObj.qty) <= 0
          ) {
            toast.error(
              `Jumlah (Qty) komponen "${itemObj.name}" pada ${uName} tidak boleh kosong atau 0!`,
            );
            return;
          }
        }
      }
    }

    const formattedPhases = phases.map((p) => ({
      ...p,
      weeklyTargets: getEffectivePhaseWeeklyTargets(p, totalWeeks),
    }));

    startTransition(async () => {
      const res = await setupProjectMasterplan({
        projectId: project.id,
        totalWeeks,
        startDate: new Date(startDate),
        leaders,
        phases: formattedPhases,
        units,
      });

      if (res.success) {
        toast.success("Masterplan berhasil diinisialisasi untuk produksi!");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menginisialisasi masterplan");
      }
    });
  };

  return (
    <Card className="border-border/50 shadow-xl bg-card/60 backdrop-blur-md w-full overflow-hidden rounded-2xl pt-0 pr-0">
      <CardHeader className="bg-linear-to-r from-primary/5 via-transparent to-primary/5 pt-6 px-6 pb-6 border-b border-border/20 rounded-t-2xl">
        <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span>Inisialisasi Produksi</span>
        </div>
        <CardTitle className="text-2xl font-bold">
          Setup Masterplan Proyek
        </CardTitle>
        <CardDescription className="text-muted-foreground/80">
          Atur rencana produksi untuk proyek{" "}
          <strong>{project.projectName}</strong>.
        </CardDescription>
      </CardHeader>

      {/* Prerequisite Engineering Check Banner */}
      {!prereqs.canCreateMasterplan ? (
        <div className="mx-6 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-foreground space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
            <span>Masterplan Belum Dapat Dibuat! Prasyarat Engineering Belum Lengkap.</span>
          </div>
          <p className="text-muted-foreground text-[12px]">
            Masterplan hanya dapat dibuat setelah dokumen **Drawing (min. 1)**, **BoQ ber-item (min. 1)**, dan **Mechanical Part List (min. 1)** sudah di-upload/diinput oleh tim Engineering.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-semibold text-[11px]">
            <div
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg border transition-colors",
                prereqs.hasDrawing
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
              )}
            >
              {prereqs.hasDrawing ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span>Dokumen Drawing (Min. 1)</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg border transition-colors",
                prereqs.hasBoq
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
              )}
            >
              {prereqs.hasBoq ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span>BoQ dengan Item (Min. 1)</span>
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 p-2 rounded-lg border transition-colors",
                prereqs.hasPartList
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
              )}
            >
              {prereqs.hasPartList ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
              )}
              <span>Mech. Part List (Min. 1)</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-6 mt-4 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-semibold shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Seluruh Prasyarat Engineering Lengkap (Drawing, BoQ, dan Mechanical Part List siap untuk pembuatan Masterplan)</span>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-6 bg-muted/20 border-b border-border/40 py-2">
          <TabsList className="grid grid-cols-5 bg-muted/40 p-1 rounded-xl h-10 w-full max-w-3xl">
            <TabsTrigger
              value="general"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5" /> Jadwal
            </TabsTrigger>
            <TabsTrigger
              value="leaders"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" /> Tim Leader
            </TabsTrigger>
            <TabsTrigger
              value="phases"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" /> Bobot Tahap
            </TabsTrigger>
            <TabsTrigger
              value="targets"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Target Mingguan
            </TabsTrigger>
            <TabsTrigger
              value="units"
              className="rounded-lg text-xs font-semibold gap-1.5 cursor-pointer"
            >
              <Layout className="w-3.5 h-3.5" /> Unit Conveyor
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: General Info */}
        <TabsContent
          value="general"
          className="p-6 m-0 space-y-6 animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Pengisian Jadwal:
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Tentukan total rentang durasi keseluruhan proyek (dalam minggu)
                serta tanggal dimulainya minggu ke-1.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Tanggal Mulai Proyek */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Tanggal Mulai Proyek
                </Label>
                {project.dealAt && (
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Sales Deal
                  </span>
                )}
              </div>
              <FormattedDateInput
                value={startDate}
                onChange={(val) => handleStartDateChange(val)}
              />
              <p className="text-[11px] text-muted-foreground">
                Default dari tanggal deal proyek (
                {project.dealAt
                  ? format(new Date(project.dealAt), "dd/MM/yyyy")
                  : format(new Date(project.createdAt), "dd/MM/yyyy")}
                ).
              </p>
            </div>

            {/* 2. Tanggal Akhir Proyek (Deadline Sales) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Tanggal Akhir (Deadline Sales)
                </Label>
                {project.expectedDate && (
                  <span className="text-[10px] text-primary font-bold bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                    Target Sales
                  </span>
                )}
              </div>
              <FormattedDateInput
                value={endDate}
                onChange={(val) => handleEndDateChange(val)}
              />
              <p className="text-[11px] text-muted-foreground">
                Target penyelesaian proyek yang diinput Sales.
              </p>
            </div>

            {/* 3. Total Durasi Proyek (Minggu) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-foreground">
                Total Durasi (Minggu)
              </Label>
              <Input
                type="number"
                min={1}
                max={104}
                value={totalWeeks}
                onChange={(e) => handleTotalWeeksChange(Number(e.target.value))}
                className="rounded-xl border-border/80 h-10 shadow-none bg-background/50 focus:bg-background font-bold text-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Jumlah minggu berjalan pada master schedule.
              </p>
            </div>
          </div>

          {/* Duration Calculation Result Banner */}
          {durationInfo.totalDays > 0 && (
            <div className="p-4 rounded-xl bg-linear-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>Hasil Perhitungan Durasi:</span>
                    <span className="text-primary font-extrabold text-xs">
                      {durationInfo.weeks} Minggu{" "}
                      {durationInfo.extraDays > 0
                        ? `lebih ${durationInfo.extraDays} Hari`
                        : ""}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Total{" "}
                    <strong className="text-foreground">
                      {durationInfo.totalDays} hari kalender
                    </strong>{" "}
                    (
                    {startDate
                      ? format(new Date(startDate + "T00:00:00"), "dd/MM/yyyy")
                      : "-"}{" "}
                    s/d{" "}
                    {endDate
                      ? format(new Date(endDate + "T00:00:00"), "dd/MM/yyyy")
                      : "-"}
                    ).
                  </div>
                </div>
              </div>
              <div className="text-[11px] font-bold text-foreground bg-background/80 px-3.5 py-2 rounded-xl border border-border/60 shrink-0">
                Plot Grid Schedule:{" "}
                <span className="text-primary font-extrabold">
                  {totalWeeks} Minggu
                </span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Division Leaders */}
        <TabsContent
          value="leaders"
          className="p-6 m-0 space-y-4 animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Pengisian Tim Leader:
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Tentukan nama Leader untuk masing-masing divisi/bagian utama
                proyek. Klik tombol <strong>+ Tambah Tim Leader</strong> untuk
                menambah Leader Divisi.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/10 p-3 rounded-xl border border-border/40">
              <span className="text-sm font-semibold text-foreground">
                Daftar Penanggung Jawab Divisi
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLeader}
                className="text-xs flex items-center gap-1.5 h-8 cursor-pointer rounded-lg font-semibold border-primary/20 hover:bg-primary/5 text-primary"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Tim Leader
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leaders.map((leader, idx) => (
                <div
                  key={idx}
                  className="space-y-3 border border-border/50 p-4 rounded-xl bg-background/40 backdrop-blur-sm relative group/leader"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLeader(idx)}
                    className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/5 rounded-lg transition-opacity cursor-pointer"
                    title="Hapus Tim Leader"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>

                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">
                      Bagian / Divisi
                    </Label>
                    <Input
                      type="text"
                      placeholder="E.g. PROCUREMENT, CIVIL, ERECTION"
                      value={leader.divisionName}
                      onChange={(e) => {
                        const updated = [...leaders];
                        updated[idx].divisionName = e.target.value;
                        setLeaders(updated);
                      }}
                      className="rounded-lg h-9 bg-background/50 focus:bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-medium text-foreground">
                      Nama Leader
                    </Label>
                    <Input
                      type="text"
                      placeholder="Nama Penanggung Jawab"
                      value={leader.leaderName}
                      onChange={(e) => {
                        const updated = [...leaders];
                        updated[idx].leaderName = e.target.value;
                        setLeaders(updated);
                      }}
                      className="rounded-lg h-9 bg-background/50 focus:bg-background"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Tab 3: Phases Weights */}
        <TabsContent
          value="phases"
          className="p-6 m-0 space-y-4 max-h-112.5 overflow-y-auto animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Bobot & Jadwal Tahapan:
              </strong>
              <p className="text-muted-foreground text-[12px] whitespace-pre-wrap">
                Tentukan persentase bobot tiap tahapan (akumulasi total wajib
                tepat 100%). Batasi rentang jadwal pengerjaan tiap tahapan lewat
                nomor minggu mulai (Wk Mulai) dan minggu selesai (Wk Akhir).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/10 p-3 rounded-xl border border-border/40">
              <span className="text-sm font-semibold text-foreground">
                Bobot & Jadwal Proyek per Tahapan
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addPhase}
                className="text-xs flex items-center gap-1.5 h-8 cursor-pointer rounded-lg font-semibold border-primary/20 hover:bg-primary/5 text-primary"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Tahapan
              </Button>
            </div>

            <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-sm text-foreground border-b border-border/50">
                  <tr>
                    <th className="p-3 font-semibold">Nama Tahapan</th>
                    <th className="p-3 w-32 text-center font-semibold">
                      Bobot (%)
                    </th>
                    <th className="p-3 w-24 text-center font-semibold">
                      Wk Mulai
                    </th>
                    <th className="p-3 w-24 text-center font-semibold">
                      Wk Akhir
                    </th>
                    <th className="p-3 w-20 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/30">
                  {phases.map((phase, idx) => {
                    const isMandatory = MANDATORY_CODES.includes(phase.code);
                    return (
                      <tr
                        key={phase.code}
                        className="hover:bg-muted/10 transition-colors"
                      >
                        <td className="p-3">
                          {isMandatory ? (
                            <span className="font-semibold text-foreground text-xs pl-1.5">
                              {phase.name}
                            </span>
                          ) : (
                            <Input
                              type="text"
                              placeholder="Nama Tahapan Custom"
                              value={phase.name}
                              onChange={(e) => {
                                const updated = [...phases];
                                updated[idx].name = e.target.value;
                                updated[idx].code = e.target.value
                                  .toUpperCase()
                                  .replace(/[^A-Z0-9]/g, "_");
                                setPhases(updated);
                              }}
                              className="h-8 rounded-lg text-xs bg-background/50 font-semibold border-border/80"
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.01"
                            value={phase.weightPercent}
                            onChange={(e) => {
                              const updated = [...phases];
                              updated[idx].weightPercent = Number(
                                e.target.value,
                              );
                              setPhases(updated);
                            }}
                            className="h-8 rounded-lg text-center font-semibold text-xs border-border/80"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={phase.startWeek}
                            onChange={(e) => {
                              const updated = [...phases];
                              updated[idx].startWeek = Number(e.target.value);
                              setPhases(updated);
                            }}
                            className="h-8 rounded-lg text-center text-xs border-border/80"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={phase.endWeek}
                            onChange={(e) => {
                              const updated = [...phases];
                              updated[idx].endWeek = Number(e.target.value);
                              setPhases(updated);
                            }}
                            className="h-8 rounded-lg text-center text-xs border-border/80"
                          />
                        </td>
                        <td className="p-3 text-center">
                          {isMandatory ? (
                            <span className="text-[9px] text-muted-foreground/60 font-black tracking-wider uppercase bg-muted border px-1.5 py-0.5 rounded">
                              Wajib
                            </span>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removePhase(idx)}
                              className="h-7 w-7 text-destructive hover:bg-destructive/5 rounded-lg cursor-pointer"
                              title="Hapus Tahapan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
              <span className="text-sm font-semibold text-primary/80">
                Total Kumulatif Bobot:
              </span>
              <span
                className={`text-lg font-bold ${Math.abs(phases.reduce((sum, p) => sum + p.weightPercent, 0) - 100) < 0.01 ? "text-green-600" : "text-destructive"}`}
              >
                {phases.reduce((sum, p) => sum + p.weightPercent, 0).toFixed(2)}{" "}
                % / 100%
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Tab 4: Target Mingguan (Weekly Matrix Editor) */}
        <TabsContent
          value="targets"
          className="p-6 m-0 space-y-6 animate-in fade-in-50 duration-200"
        >
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <Sparkles className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Setup Target Mingguan Master Schedule (S-Curve Matrix):
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Atur alokasi target mingguan (%) untuk setiap tahapan pekerjaan. Anda dapat membagi merata secara otomatis atau mengubah persentase target mingguan secara manual.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 bg-muted/10 p-3 rounded-xl border border-border/40 flex-wrap">
            <span className="text-xs font-semibold text-foreground">
              Alokasi Target per Minggu ({totalWeeks} Minggu Total)
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const updated = phases.map((p) => {
                  const wtMap: Record<number, number> = {};
                  const weight = Number(p.weightPercent || 0);
                  const startW = Math.max(1, Number(p.startWeek || 1));
                  const endW = Math.min(totalWeeks, Number(p.endWeek || totalWeeks));
                  const duration = Math.max(1, endW - startW + 1);

                  if (weight > 0 && duration > 0) {
                    const share = Math.round((weight / duration) * 100) / 100;
                    let sum = 0;
                    for (let w = 1; w <= totalWeeks; w++) {
                      if (w >= startW && w <= endW) {
                        const val = w === endW ? Math.round((weight - sum) * 100) / 100 : share;
                        wtMap[w] = Math.max(0, val);
                        sum += share;
                      } else {
                        wtMap[w] = 0;
                      }
                    }
                  }
                  return { ...p, weeklyTargets: wtMap };
                });
                setPhases(updated);
                toast.success("Target mingguan seluruh tahapan berhasil dibagi merata!");
              }}
              className="text-xs flex items-center gap-1.5 h-8 cursor-pointer rounded-lg font-bold border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
            >
              <Sparkles className="w-3.5 h-3.5" /> Bagi Merata Semua Tahapan
            </Button>
          </div>

          {/* Matrix Spreadsheet Table */}
          <div className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-xs">
            <div className="overflow-x-auto max-w-full">
              {(() => {
                const matrix = calculateMasterScheduleMatrix(
                  totalWeeks,
                  startDate,
                  phases
                );

                return (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/60 text-foreground border-b border-border/60">
                      {/* Month Header Row */}
                      <tr>
                        <th rowSpan={3} className="p-2.5 font-bold border-r border-border/40 text-center w-10">No</th>
                        <th rowSpan={3} className="p-2.5 font-bold border-r border-border/40 min-w-44">Nama Tahapan</th>
                        <th rowSpan={3} className="p-2.5 font-bold border-r border-border/40 text-center w-20">Bobot (%)</th>
                        <th rowSpan={3} className="p-2.5 font-bold border-r border-border/40 text-center w-16">Durasi</th>
                        {matrix.monthHeaderGroups.map((mg, mIdx) => (
                          <th
                            key={mIdx}
                            colSpan={mg.weekCount}
                            className="p-1.5 text-center font-extrabold border-r border-b border-border/40 bg-muted/80 text-[11px]"
                          >
                            {mg.monthName}
                          </th>
                        ))}
                        <th rowSpan={3} className="p-2.5 font-bold text-center w-24 bg-muted/80">Total Target</th>
                      </tr>
                      {/* Week Roman Numeral Row */}
                      <tr>
                        {matrix.weekHeaders.map((wh) => (
                          <th
                            key={wh.weekNumber}
                            className="p-1 text-center font-bold border-r border-b border-border/40 text-[10px] w-12"
                          >
                            {wh.weekInMonth}
                          </th>
                        ))}
                      </tr>
                      {/* Date Range Row */}
                      <tr>
                        {matrix.weekHeaders.map((wh) => (
                          <th
                            key={wh.weekNumber}
                            className="p-1 text-center font-semibold text-muted-foreground border-r border-border/40 text-[9px] w-12"
                          >
                            {wh.dateRange}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40 bg-background/50">
                      {phases.map((phase, idx) => {
                        const startW = Math.max(1, Number(phase.startWeek || 1));
                        const endW = Math.min(totalWeeks, Number(phase.endWeek || totalWeeks));
                        const duration = Math.max(1, endW - startW + 1);
                        const weight = Number(phase.weightPercent || 0);

                        const effectiveTargets = getEffectivePhaseWeeklyTargets(phase, totalWeeks);
                        const currentSum = Object.values(effectiveTargets).reduce((sum, v) => sum + (Number(v) || 0), 0);
                        const isSumMatch = Math.abs(currentSum - weight) < 0.05;

                        return (
                          <tr key={phase.code || idx} className="hover:bg-muted/20 transition-colors">
                            <td className="p-2 text-center font-bold border-r border-border/40 text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="p-2 font-bold text-foreground border-r border-border/40 truncate max-w-44">
                              {phase.name}
                            </td>
                            <td className="p-2 text-center font-bold text-primary border-r border-border/40 bg-primary/5">
                              {weight.toFixed(2)}%
                            </td>
                            <td className="p-2 text-center font-semibold border-r border-border/40 text-muted-foreground">
                              {duration} Wk
                            </td>
                            {matrix.weekHeaders.map((wh) => {
                              const wNo = wh.weekNumber;
                              const isActiveWeek = wNo >= startW && wNo <= endW;
                              const targetVal = effectiveTargets[wNo] || 0;

                              return (
                                <td
                                  key={wNo}
                                  className={cn(
                                    "p-1 border-r border-border/40 text-center transition-all",
                                    isActiveWeek ? "bg-background" : "bg-muted/30 opacity-40 select-none"
                                  )}
                                >
                                  {isActiveWeek ? (
                                    <Input
                                      type="number"
                                      step="0.01"
                                      value={targetVal || 0}
                                      onChange={(e) => {
                                        const newVal = Number(e.target.value);
                                        const updatedPhases = [...phases];
                                        if (!updatedPhases[idx].weeklyTargets) updatedPhases[idx].weeklyTargets = {};
                                        updatedPhases[idx].weeklyTargets[wNo] = newVal;
                                        setPhases(updatedPhases);
                                      }}
                                      className="w-12 h-7 text-center font-bold text-[11px] p-0 rounded border-border/60 bg-background shadow-none"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/40 font-mono">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-2 text-center font-extrabold border-l border-border/40 bg-muted/20">
                              <span className={isSumMatch ? "text-emerald-600" : "text-amber-600 font-bold"}>
                                {currentSum.toFixed(2)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/80 font-bold text-foreground border-t-2 border-border/60 divide-y divide-border/40">
                      {/* Summary Row 1: PLAN PROGRESS MAIN WEEKS */}
                      <tr>
                        <td colSpan={4} className="p-2.5 font-extrabold border-r border-border/40 text-primary">
                          PLAN PROGRESS MAIN WEEKS
                        </td>
                        {matrix.summary.planProgressMainWeeks.map((val, wIdx) => (
                          <td key={wIdx} className="p-1.5 text-center font-bold text-[10px] border-r border-border/40 bg-primary/5">
                            {val.toFixed(2)}
                          </td>
                        ))}
                        <td className="p-2 text-center font-black text-primary">
                          {matrix.summary.planProgressMainWeeks.reduce((a, b) => a + b, 0).toFixed(2)}%
                        </td>
                      </tr>
                      {/* Summary Row 2: PLAN PROGRESS CUMULATIVE */}
                      <tr>
                        <td colSpan={4} className="p-2.5 font-extrabold border-r border-border/40 text-blue-700 dark:text-blue-300">
                          PLAN PROGRESS COMULATIVE/WEEK
                        </td>
                        {matrix.summary.planProgressCumulative.map((val, wIdx) => (
                          <td key={wIdx} className="p-1.5 text-center font-extrabold text-[10px] border-r border-border/40 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                            {val.toFixed(2)}
                          </td>
                        ))}
                        <td className="p-2 text-center font-black text-blue-700 dark:text-blue-300">
                          100.00%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}
            </div>
          </div>
        </TabsContent>

        {/* Tab 5: Conveyor Units */}
        <TabsContent
          value="units"
          className="p-6 m-0 space-y-4 max-h-112.5 overflow-y-auto animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner */}
          <div className="flex gap-2 p-3.5 rounded-xl border border-primary/10 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs animate-in fade-in duration-200">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <strong className="text-primary font-bold">
                Panduan Pengisian Unit Conveyor:
              </strong>
              <p className="text-muted-foreground text-[12px]">
                Daftarkan unit conveyor yang akan diproduksi. Tuliskan item
                checklist Struktur (rangka rangka) dan Mekanikal
                (motor/roller/pulley) untuk melacak progress di lapangan.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {units.map((unit, idx) => (
              <div
                key={idx}
                className="border border-border/50 rounded-xl p-4 bg-background/30 space-y-3 relative group"
              >
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeUnit(idx)}
                  className="absolute right-2 top-2 h-7 w-7 text-destructive hover:bg-destructive/5 rounded-lg cursor-pointer transition-opacity"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Nama Unit Conveyor
                    </Label>
                    <Input
                      type="text"
                      placeholder="Contoh: Belt Conveyor BC 01 - BW 1.2 x L.58 mtr atau Room Hopper 5x5x2.7 mtr"
                      value={unit.name}
                      onChange={(e) =>
                        updateUnitField(idx, "name", e.target.value)
                      }
                      className="h-9 rounded-lg"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Jenis Progress
                    </Label>
                    <select
                      value={unit.unitType}
                      onChange={(e) =>
                        updateUnitField(idx, "unitType", e.target.value)
                      }
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-none focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="BOTH">Structure & Mechanical</option>
                      <option value="STRUCTURE">Structure Only</option>
                      <option value="MECHANICAL">Mechanical Only</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  {(unit.unitType === "BOTH" || unit.unitType === "STRUCTURE") && (
                    <div className="space-y-2 p-3 bg-background/50 border border-border/40 rounded-xl">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          Komponen Struktur (Rangka)
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = [
                              ...(unit.structureItems || []),
                              { name: "", qty: 1, satuan: "unit" },
                            ];
                            updateUnitField(idx, "structureItems", updated);
                          }}
                          className="h-6 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Tambah Item
                        </Button>
                      </div>

                      {unit.structureItems && unit.structureItems.length > 0 ? (
                        <div className="space-y-1.5 max-h-45 overflow-y-auto pr-1">
                          <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-bold text-muted-foreground">
                            <span className="flex-1">Nama Item Rangka</span>
                            <span className="w-16 text-center">Jumlah</span>
                            <span className="w-16 text-center">Satuan</span>
                            <span className="w-7"></span>
                          </div>
                          {unit.structureItems.map((stItem: any, stIdx: number) => {
                            const itemObj =
                              typeof stItem === "string"
                                ? { name: stItem, qty: 1, satuan: "unit" }
                                : stItem;
                            return (
                              <div key={stIdx} className="flex items-center gap-1.5">
                                <Input
                                  type="text"
                                  placeholder={`Item Rangka ${stIdx + 1}`}
                                  value={itemObj.name}
                                  onChange={(e) => {
                                    const updated = [...unit.structureItems];
                                    updated[stIdx] = { ...itemObj, name: e.target.value };
                                    updateUnitField(idx, "structureItems", updated);
                                  }}
                                  className="flex-1 h-8 text-xs bg-background focus:bg-background rounded-lg border-border/70"
                                />
                                 <Input
                                  type="number"
                                  min={1}
                                  value={itemObj.qty === "" ? "" : itemObj.qty}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === "" ? "" : Number(raw);
                                    const updated = [...unit.structureItems];
                                    updated[stIdx] = { ...itemObj, qty: val };
                                    updateUnitField(idx, "structureItems", updated);
                                  }}
                                  className="w-16 h-8 text-xs text-center font-bold bg-background focus:bg-background rounded-lg border-border/70"
                                />
                                <select
                                  value={itemObj.satuan || "unit"}
                                  onChange={(e) => {
                                    const updated = [...unit.structureItems];
                                    updated[stIdx] = { ...itemObj, satuan: e.target.value };
                                    updateUnitField(idx, "structureItems", updated);
                                  }}
                                  className="w-20 h-8 text-[11px] font-semibold bg-background border border-border/70 rounded-lg px-1 cursor-pointer text-foreground"
                                >
                                  <option value="unit">unit</option>
                                  <option value="set">set</option>
                                  <option value="pcs">pcs</option>
                                  <option value="mtr">mtr</option>
                                  <option value="lot">lot</option>
                                  <option value="batang">batang</option>
                                  <option value="lembar">lembar</option>
                                  <option value="kg">kg</option>
                                </select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const updated = unit.structureItems.filter((_: any, i: number) => i !== stIdx);
                                    updateUnitField(idx, "structureItems", updated);
                                  }}
                                  className="h-8 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground/60 italic p-2 border border-dashed rounded-lg text-center bg-muted/20">
                          Belum ada item. Klik "+ Tambah Item" atau ketik teks multi-baris di bawah.
                        </div>
                      )}

                      <details className="text-[11px] text-muted-foreground group">
                        <summary className="cursor-pointer font-medium hover:text-foreground text-[10px]">
                          + Input/Paste Banyak Item Sekaligus (Multi-baris)
                        </summary>
                        <Textarea
                          placeholder="Contoh:&#10;Room Hopper&#10;Extra Hopper&#10;Structure Hopper"
                          value={
                            Array.isArray(unit.structureItems)
                              ? unit.structureItems
                                  .map((it: any) => (typeof it === "string" ? it : it.name))
                                  .filter(Boolean)
                                  .join("\n")
                              : ""
                          }
                          onChange={(e) => {
                            const items = e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter((s) => s.length > 0)
                              .map((s) => ({ name: s, qty: 1, satuan: "unit" }));
                            updateUnitField(idx, "structureItems", items);
                          }}
                          className="min-h-17.5 text-xs bg-background focus:bg-background rounded-lg resize-y mt-1.5"
                        />
                      </details>
                    </div>
                  )}

                  {(unit.unitType === "BOTH" || unit.unitType === "MECHANICAL") && (
                    <div className="space-y-2 p-3 bg-background/50 border border-border/40 rounded-xl">
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          Komponen Mekanikal (Motor/Roller/dll)
                        </Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const updated = [
                              ...(unit.mechanicalItems || []),
                              { name: "", qty: 1, satuan: "unit" },
                            ];
                            updateUnitField(idx, "mechanicalItems", updated);
                          }}
                          className="h-6 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Tambah Item
                        </Button>
                      </div>

                      {unit.mechanicalItems && unit.mechanicalItems.length > 0 ? (
                        <div className="space-y-1.5 max-h-45 overflow-y-auto pr-1">
                          <div className="flex items-center gap-1.5 px-0.5 text-[10px] font-bold text-muted-foreground">
                            <span className="flex-1">Nama Item Mekanikal</span>
                            <span className="w-16 text-center">Jumlah</span>
                            <span className="w-20 text-center">Satuan</span>
                            <span className="w-7"></span>
                          </div>
                          {unit.mechanicalItems.map((mItem: any, mIdx: number) => {
                            const itemObj =
                              typeof mItem === "string"
                                ? { name: mItem, qty: 1, satuan: "unit" }
                                : mItem;
                            return (
                              <div key={mIdx} className="flex items-center gap-1.5">
                                <Input
                                  type="text"
                                  placeholder={`Item Mekanikal ${mIdx + 1}`}
                                  value={itemObj.name}
                                  onChange={(e) => {
                                    const updated = [...unit.mechanicalItems];
                                    updated[mIdx] = { ...itemObj, name: e.target.value };
                                    updateUnitField(idx, "mechanicalItems", updated);
                                  }}
                                  className="flex-1 h-8 text-xs bg-background focus:bg-background rounded-lg border-border/70"
                                />
                                <Input
                                  type="number"
                                  min={1}
                                  value={itemObj.qty === "" ? "" : itemObj.qty}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const val = raw === "" ? "" : Number(raw);
                                    const updated = [...unit.mechanicalItems];
                                    updated[mIdx] = { ...itemObj, qty: val };
                                    updateUnitField(idx, "mechanicalItems", updated);
                                  }}
                                  className="w-16 h-8 text-xs text-center font-bold bg-background focus:bg-background rounded-lg border-border/70"
                                />
                                <select
                                  value={itemObj.satuan || "unit"}
                                  onChange={(e) => {
                                    const updated = [...unit.mechanicalItems];
                                    updated[mIdx] = { ...itemObj, satuan: e.target.value };
                                    updateUnitField(idx, "mechanicalItems", updated);
                                  }}
                                  className="w-20 h-8 text-[11px] font-semibold bg-background border border-border/70 rounded-lg px-1 cursor-pointer text-foreground"
                                >
                                  <option value="unit">unit</option>
                                  <option value="set">set</option>
                                  <option value="pcs">pcs</option>
                                  <option value="mtr">mtr</option>
                                  <option value="lot">lot</option>
                                  <option value="batang">batang</option>
                                  <option value="lembar">lembar</option>
                                  <option value="kg">kg</option>
                                </select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    const updated = unit.mechanicalItems.filter((_: any, i: number) => i !== mIdx);
                                    updateUnitField(idx, "mechanicalItems", updated);
                                  }}
                                  className="h-8 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 shrink-0 rounded-lg cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground/60 italic p-2 border border-dashed rounded-lg text-center bg-muted/20">
                          Belum ada item. Klik "+ Tambah Item" atau ketik teks multi-baris di bawah.
                        </div>
                      )}

                      <details className="text-[11px] text-muted-foreground group">
                        <summary className="cursor-pointer font-medium hover:text-foreground text-[10px]">
                          + Input/Paste Banyak Item Sekaligus (Multi-baris)
                        </summary>
                        <Textarea
                          placeholder="Contoh:&#10;Drive Pulley&#10;Idler Roller&#10;Electric Motor"
                          value={
                            Array.isArray(unit.mechanicalItems)
                              ? unit.mechanicalItems
                                  .map((it: any) => (typeof it === "string" ? it : it.name))
                                  .filter(Boolean)
                                  .join("\n")
                              : ""
                          }
                          onChange={(e) => {
                            const items = e.target.value
                              .split("\n")
                              .map((s) => s.trim())
                              .filter((s) => s.length > 0)
                              .map((s) => ({ name: s, qty: 1, satuan: "unit" }));
                            updateUnitField(idx, "mechanicalItems", items);
                          }}
                          className="min-h-17.5 text-xs bg-background focus:bg-background rounded-lg resize-y mt-1.5"
                        />
                      </details>
                    </div>
                  )}
                </div>
              </div>

            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addUnit}
              className="w-full h-9 border-dashed border-border/80 hover:bg-primary/5 hover:text-primary gap-1.5 rounded-xl font-semibold text-xs cursor-pointer shadow-none"
            >
              <Plus className="w-3.5 h-3.5" /> Tambah Unit Conveyor Baru
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <CardFooter className="bg-muted/10 border-t border-border/40 py-4 px-6 flex justify-between">
        {activeTab !== "general" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeTab === "leaders") setActiveTab("general");
              else if (activeTab === "phases") setActiveTab("leaders");
              else if (activeTab === "units") setActiveTab("phases");
            }}
            className="h-9 rounded-xl px-4 text-xs font-semibold gap-1.5 cursor-pointer shadow-none"
          >
            <ChevronLeft className="w-4 h-4" /> Sebelumnya
          </Button>
        ) : (
          <div />
        )}

        {activeTab !== "units" ? (
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              if (activeTab === "general") setActiveTab("leaders");
              else if (activeTab === "leaders") setActiveTab("phases");
              else if (activeTab === "phases") setActiveTab("units");
            }}
            className="h-9 rounded-xl px-4 text-xs font-semibold gap-1.5 cursor-pointer shadow-none"
          >
            Berikutnya <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            disabled={isPending || !prereqs.canCreateMasterplan}
            onClick={handleSubmit}
            className="h-9 rounded-xl px-5 text-xs font-bold gap-1.5 bg-linear-to-r from-primary to-primary/80 hover:opacity-95 text-primary-foreground cursor-pointer transition-all active:scale-95 shadow-md"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />{" "}
                Menginisialisasi...
              </>
            ) : (
              <>
                <span>Mulai Produksi</span>
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
