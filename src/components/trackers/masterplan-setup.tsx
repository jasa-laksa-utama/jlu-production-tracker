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
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Copy,
  Boxes,
  X,
  Hammer,
  Cog,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { formatJakartaDate } from "@/lib/date-utils";
import { setupProjectMasterplan } from "@/app/actions/masterplan";
import {
  DEFAULT_CONVEYOR_PHASES,
  getDefaultPhasesForDuration,
} from "@/lib/progress-weights";
import { checkEngineeringPrerequisitesLocal } from "@/lib/engineering-progress";
import { calculateMasterScheduleMatrix } from "@/lib/s-curve-calculator";
import { cn } from "@/lib/utils";


const SATUAN_OPTIONS = [
  "unit",
  "set",
  "pcs",
  "mtr",
  "lot",
  "batang",
  "lembar",
  "kg",
];

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
        return new Date(project.masterplan.startDate)
          .toISOString()
          .split("T")[0];
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
      const diffDays = Math.round(
        (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24),
      );
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

  // Helper to clamp phases when duration changes
  const clampPhasesWeeks = (maxWeeks: number) => {
    setPhases((prev) =>
      prev.map((p) => {
        const clampedEnd = Math.min(
          maxWeeks,
          Math.max(1, Number(p.endWeek || maxWeeks)),
        );
        const clampedStart = Math.min(
          clampedEnd,
          Math.max(1, Number(p.startWeek || 1)),
        );
        return {
          ...p,
          startWeek: clampedStart,
          endWeek: clampedEnd,
        };
      }),
    );
  };

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (val && endDate) {
      const { totalDays } = calculateDuration(val, endDate);
      if (totalDays > 0) {
        const newWeeks = Math.max(1, Math.ceil(totalDays / 7));
        setTotalWeeks(newWeeks);
        clampPhasesWeeks(newWeeks);
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (startDate && val) {
      const { totalDays } = calculateDuration(startDate, val);
      if (totalDays > 0) {
        const newWeeks = Math.max(1, Math.ceil(totalDays / 7));
        setTotalWeeks(newWeeks);
        clampPhasesWeeks(newWeeks);
      }
    }
  };

  const handleTotalWeeksChange = (val: number) => {
    const numWeeks = Math.max(1, val);
    setTotalWeeks(numWeeks);
    clampPhasesWeeks(numWeeks);
    if (startDate) {
      const s = new Date(startDate);
      s.setDate(s.getDate() + numWeeks * 7);
      setEndDate(s.toISOString().split("T")[0]);
    }
  };

  const durationInfo = calculateDuration(startDate, endDate);

  // Leaders state
  const [leaders, setLeaders] = useState<
    Array<{ divisionName: string; leaderName: string }>
  >(() => {
    if (
      project.masterplan?.divisionLeaders &&
      project.masterplan.divisionLeaders.length > 0
    ) {
      return project.masterplan.divisionLeaders.map((dl: any) => ({
        divisionName: dl.divisionName,
        leaderName: dl.leaderName,
      }));
    }
    return [{ divisionName: "", leaderName: "" }];
  });

  // Phases state (initialize with existing or default values scaled to project duration)
  const [phases, setPhases] = useState<any[]>(() => {
    if (project.masterplan?.phases && project.masterplan.phases.length > 0) {
      return project.masterplan.phases.map((p: any) => {
        const wtMap: Record<number, number> = {};
        if (p.weeklyTargets && Array.isArray(p.weeklyTargets)) {
          p.weeklyTargets.forEach((wt: any) => {
            wtMap[wt.weekNumber] = Number(wt.targetPercent || 0);
          });
        }
        const clampedEnd = Math.min(
          totalWeeks,
          Math.max(1, Number(p.endWeek || totalWeeks)),
        );
        const clampedStart = Math.min(
          clampedEnd,
          Math.max(1, Number(p.startWeek || 1)),
        );

        return {
          id: p.id,
          code: p.code,
          name: p.name,
          weightPercent: Number(p.weightPercent || 0),
          startWeek: clampedStart,
          endWeek: clampedEnd,
          orderIndex: p.orderIndex,
          subSteps: p.subSteps || ([] as string[]),
          weeklyTargets: wtMap,
        };
      });
    }
    return getDefaultPhasesForDuration(totalWeeks).map((p) => ({
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
      return project.conveyorUnits.map((u: any) => {
        const up = u.progresses?.[0];
        return {
          name: u.name,
          unitType: u.unitType,
          satuan: u.satuan || "unit",
          volume: u.volume || 1,
          weightPercent:
            up && Number(up.weightPercent) > 0
              ? Number(up.weightPercent)
              : Math.round((100 / project.conveyorUnits.length) * 100) / 100,
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
        };
      });
    }
    return [
      {
        name: "",
        unitType: "BOTH",
        satuan: "unit",
        volume: 1,
        weightPercent: 100,
        structureItems: [] as any[],
        mechanicalItems: [] as any[],
      },
    ];
  });

  // Active component sub-tab per unit: { [unitIndex]: "structure" | "mechanical" }
  const [activeUnitSubTabs, setActiveUnitSubTabs] = useState<
    Record<number, "structure" | "mechanical">
  >({});

  // Expanded units state: { [unitIndex]: boolean }
  const [expandedUnits, setExpandedUnits] = useState<Record<number, boolean>>({
    0: true,
  });

  const toggleUnitExpand = (idx: number) => {
    setExpandedUnits((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  const getActiveSubTab = (
    idx: number,
    unitType: string,
  ): "structure" | "mechanical" => {
    if (unitType === "MECHANICAL") return "mechanical";
    if (unitType === "STRUCTURE") return "structure";
    return activeUnitSubTabs[idx] || "structure";
  };

  const setActiveSubTab = (idx: number, tab: "structure" | "mechanical") => {
    setActiveUnitSubTabs((prev) => ({
      ...prev,
      [idx]: tab,
    }));
  };

  const clearAllItems = (idx: number, type: "structure" | "mechanical") => {
    const field = type === "structure" ? "structureItems" : "mechanicalItems";
    updateUnitField(idx, field, []);
    toast.info(
      `Seluruh komponen ${type === "structure" ? "struktur" : "mekanikal"} telah dibersihkan.`,
    );
  };

  const copyItemsFromAnotherUnit = (
    targetUnitIdx: number,
    sourceUnitIdx: number,
  ) => {
    const source = units[sourceUnitIdx];
    if (!source) return;

    const updatedUnits = [...units];
    const sItems = (source.structureItems || []).map((it: any) => ({ ...it }));
    const mItems = (source.mechanicalItems || []).map((it: any) => ({ ...it }));

    updatedUnits[targetUnitIdx].structureItems = sItems;
    updatedUnits[targetUnitIdx].mechanicalItems = mItems;
    setUnits(updatedUnits);
    toast.success(
      `Berhasil menyalin komponen dari ${source.name || `Unit ${sourceUnitIdx + 1}`}!`,
    );
  };

  // Helper to add conveyor unit
  const addUnit = () => {
    const newIdx = units.length;
    setUnits([
      ...units,
      {
        name: "",
        unitType: "BOTH",
        satuan: "unit",
        volume: 1,
        weightPercent: 0,
        structureItems: [] as any[],
        mechanicalItems: [] as any[],
      },
    ]);
    setExpandedUnits((prev) => ({ ...prev, [newIdx]: true }));
  };

  const removeUnit = (index: number) => {
    setUnits(units.filter((_, i) => i !== index));
  };

  const equalizeUnitWeights = () => {
    if (units.length === 0) return;
    const equal = Math.round((100 / units.length) * 100) / 100;
    const updated = units.map((u, i) => ({
      ...u,
      weightPercent:
        i === units.length - 1
          ? Math.round((100 - equal * (units.length - 1)) * 100) / 100
          : equal,
    }));
    setUnits(updated);
    toast.success("Bobot unit berhasil dibagi rata 100%!");
  };

  const normalizeUnitWeights = () => {
    const total = units.reduce((s, u) => s + (Number(u.weightPercent) || 0), 0);
    if (total <= 0) {
      equalizeUnitWeights();
      return;
    }
    const updated = units.map((u) => ({
      ...u,
      weightPercent:
        Math.round(((Number(u.weightPercent) || 0) / total) * 10000) / 100,
    }));
    setUnits(updated);
    toast.success("Bobot unit berhasil dinormalisasi menjadi 100%!");
  };

  const MANDATORY_CODES = ["PROCUREMENT", "ENGINEERING", "FAB_STRUCT_MECH"];

  const addLeader = () => {
    setLeaders([...leaders, { divisionName: "", leaderName: "" }]);
  };

  const removeLeader = (index: number) => {
    setLeaders(leaders.filter((_, i) => i !== index));
  };

  const autoScalePhasesToDuration = (targetWeeks: number) => {
    const N = Math.max(1, targetWeeks);
    const updated = phases.map((p, idx, arr) => {
      const def = DEFAULT_CONVEYOR_PHASES.find((dp) => dp.code === p.code);
      let sStart: number;
      let sEnd: number;

      if (def) {
        sStart =
          def.startWeek === 1
            ? 1
            : Math.max(1, Math.min(N, Math.round((def.startWeek / 30) * N)));
        sEnd =
          idx === arr.length - 1 || def.endWeek >= 30
            ? N
            : Math.max(sStart, Math.min(N, Math.round((def.endWeek / 30) * N)));
      } else {
        const currentMax = Math.max(
          totalWeeks,
          30,
          ...phases.map((x) => Number(x.endWeek || 1)),
        );
        sStart = Math.max(
          1,
          Math.min(N, Math.round((Number(p.startWeek || 1) / currentMax) * N)),
        );
        sEnd = Math.max(
          sStart,
          Math.min(
            N,
            Math.round((Number(p.endWeek || currentMax) / currentMax) * N),
          ),
        );
      }

      if (sStart > sEnd) sStart = sEnd;

      return {
        ...p,
        startWeek: sStart,
        endWeek: sEnd,
      };
    });

    setPhases(updated);
    toast.success(
      `Jadwal pekan seluruh tahapan berhasil diselaraskan ke rentang 1 s/d ${N} minggu!`,
    );
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
          const val =
            w === endW ? Math.round((weight - sum) * 100) / 100 : share;
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

    // Validate phase weeks against project totalWeeks
    for (const p of phases) {
      const sW = Number(p.startWeek || 1);
      const eW = Number(p.endWeek || totalWeeks);
      if (sW < 1) {
        toast.error(
          `Tahapan "${p.name}": Minggu Mulai tidak boleh kurang dari 1!`,
        );
        return;
      }
      if (eW > totalWeeks) {
        toast.error(
          `Tahapan "${p.name}": Minggu Akhir (${eW}) tidak boleh melebihi durasi proyek (${totalWeeks} Minggu)! Silakan sesuaikan atau klik "Sesuaikan Pekan".`,
        );
        return;
      }
      if (sW > eW) {
        toast.error(
          `Tahapan "${p.name}": Minggu Mulai (${sW}) tidak boleh lebih besar dari Minggu Akhir (${eW})!`,
        );
        return;
      }
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-primary font-medium text-sm mb-1">
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Inisialisasi Produksi</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Durasi Proyek: <strong>{totalWeeks} Minggu</strong>
              {durationInfo.totalDays > 0
                ? ` (${durationInfo.totalDays} Hari)`
                : ""}
            </span>
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">
          Setup Masterplan Proyek
        </CardTitle>
        <CardDescription className="text-muted-foreground/80">
          Atur rencana produksi untuk proyek{" "}
          <strong>{project.projectName}</strong> (Target: {totalWeeks} Minggu,{" "}
          {startDate
            ? format(new Date(startDate + "T00:00:00"), "dd/MM/yyyy")
            : "-"}{" "}
          s/d{" "}
          {endDate
            ? format(new Date(endDate + "T00:00:00"), "dd/MM/yyyy")
            : "-"}
          ).
        </CardDescription>
      </CardHeader>

      {/* Prerequisite Engineering Check Banner */}
      {!prereqs.canCreateMasterplan ? (
        <div className="mx-6 mt-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-foreground space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-sm">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0" />
            <span>
              Masterplan Belum Dapat Dibuat! Prasyarat Engineering Belum
              Lengkap.
            </span>
          </div>

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
          <span>
            Seluruh Prasyarat Engineering Lengkap (Drawing, BoQ, dan Mechanical
            Part List siap untuk pembuatan Masterplan)
          </span>
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
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Target
              Mingguan
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
          {/* Guide Banner with Project Duration Info & Auto-scale Action */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs">
            <div className="flex items-start gap-2.5">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-primary font-bold">
                    Panduan Bobot & Jadwal Tahapan
                  </strong>
                </div>
                <p className="text-muted-foreground text-[12px]">
                  Tentukan persentase bobot tiap tahapan (akumulasi total wajib
                  100%). Batas pekan pengerjaan tahapan adalah{" "}
                  <strong>{totalWeeks} Minggu</strong>.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => autoScalePhasesToDuration(totalWeeks)}
              className="text-xs flex items-center gap-1.5 h-8 shrink-0 cursor-pointer rounded-lg font-bold border-primary/30 bg-background hover:bg-primary/10 text-primary shadow-2xs"
              title={`Sesuaikan rentang pekan seluruh tahapan secara proporsional ke durasi ${totalWeeks} minggu`}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sesuaikan Otomatis
            </Button>
          </div>

          {/* Warning Banner if any phase exceeds totalWeeks */}
          {phases.some(
            (p) =>
              Number(p.endWeek || 0) > totalWeeks ||
              Number(p.startWeek || 0) > totalWeeks,
          ) && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-destructive" />
                <span>
                  Terdapat tahapan dengan minggu melebihi durasi proyek (
                  <strong>{totalWeeks} Minggu</strong>). Klik tombol di samping
                  untuk menyelaraskan secara otomatis.
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => autoScalePhasesToDuration(totalWeeks)}
                className="h-7 text-xs font-semibold cursor-pointer shrink-0"
              >
                Selaraskan ke {totalWeeks} Minggu
              </Button>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex justify-between items-center bg-muted/10 p-3 rounded-xl border border-border/40">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-primary">
                  Bobot & Jadwal Proyek per Tahapan
                </span>
                <span className="text-[11px] text-muted-foreground font-medium bg-muted/60 px-2.5 py-0.5 rounded-full border border-border/50">
                  Durasi Proyek: <strong>{totalWeeks} Pekan</strong>
                </span>
              </div>
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
                    <th className="p-3 w-28 text-center font-semibold">
                      <div>Pekan Mulai</div>
                      <div className="text-[10px] text-muted-foreground font-normal">
                        Min. 1
                      </div>
                    </th>
                    <th className="p-3 w-28 text-center font-semibold">
                      <div>Pekan Akhir</div>
                      <div className="text-[10px] text-primary font-bold">
                        Maks. {totalWeeks}
                      </div>
                    </th>
                    <th className="p-3 w-20 text-center font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 bg-background/30">
                  {phases.map((phase, idx) => {
                    const isMandatory = MANDATORY_CODES.includes(phase.code);
                    const isStartInvalid =
                      Number(phase.startWeek) < 1 ||
                      Number(phase.startWeek) > totalWeeks ||
                      Number(phase.startWeek) > Number(phase.endWeek);
                    const isEndInvalid =
                      Number(phase.endWeek) < 1 ||
                      Number(phase.endWeek) > totalWeeks ||
                      Number(phase.endWeek) < Number(phase.startWeek);

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
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              min={1}
                              max={totalWeeks}
                              value={phase.startWeek}
                              onChange={(e) => {
                                const updated = [...phases];
                                updated[idx].startWeek = Number(e.target.value);
                                setPhases(updated);
                              }}
                              className={cn(
                                "h-8 rounded-lg text-center text-xs border-border/80",
                                isStartInvalid &&
                                  "border-destructive text-destructive font-bold bg-destructive/5",
                              )}
                            />
                            {Number(phase.startWeek) >
                              Number(phase.endWeek) && (
                              <div className="text-[10px] text-destructive text-center leading-tight">
                                &gt; Wk Akhir
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="space-y-0.5">
                            <Input
                              type="number"
                              min={1}
                              max={totalWeeks}
                              value={phase.endWeek}
                              onChange={(e) => {
                                const updated = [...phases];
                                updated[idx].endWeek = Number(e.target.value);
                                setPhases(updated);
                              }}
                              className={cn(
                                "h-8 rounded-lg text-center text-xs border-border/80",
                                isEndInvalid &&
                                  "border-destructive text-destructive font-bold bg-destructive/5",
                              )}
                            />
                            {Number(phase.endWeek) > totalWeeks && (
                              <div className="text-[10px] text-destructive text-center leading-tight font-semibold">
                                &gt; {totalWeeks} Wk
                              </div>
                            )}
                          </div>
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
                Atur alokasi target mingguan (%) untuk setiap tahapan pekerjaan.
                Anda dapat membagi merata secara otomatis atau mengubah
                persentase target mingguan secara manual.
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
                  const endW = Math.min(
                    totalWeeks,
                    Number(p.endWeek || totalWeeks),
                  );
                  const duration = Math.max(1, endW - startW + 1);

                  if (weight > 0 && duration > 0) {
                    const share = Math.round((weight / duration) * 100) / 100;
                    let sum = 0;
                    for (let w = 1; w <= totalWeeks; w++) {
                      if (w >= startW && w <= endW) {
                        const val =
                          w === endW
                            ? Math.round((weight - sum) * 100) / 100
                            : share;
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
                toast.success(
                  "Target mingguan seluruh tahapan berhasil dibagi merata!",
                );
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
                  phases,
                );

                return (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/60 text-foreground border-b border-border/60">
                      {/* Month Header Row */}
                      <tr>
                        <th
                          rowSpan={3}
                          className="p-2.5 font-bold border-r border-border/40 text-center w-10"
                        >
                          No
                        </th>
                        <th
                          rowSpan={3}
                          className="p-2.5 font-bold border-r border-border/40 min-w-44"
                        >
                          Nama Tahapan
                        </th>
                        <th
                          rowSpan={3}
                          className="p-2.5 font-bold border-r border-border/40 text-center w-20"
                        >
                          Bobot (%)
                        </th>
                        <th
                          rowSpan={3}
                          className="p-2.5 font-bold border-r border-border/40 text-center w-16"
                        >
                          Durasi
                        </th>
                        {matrix.monthHeaderGroups.map((mg, mIdx) => (
                          <th
                            key={mIdx}
                            colSpan={mg.weekCount}
                            className="p-1.5 text-center font-extrabold border-r border-b border-border/40 bg-muted/80 text-[11px]"
                          >
                            {mg.monthName}
                          </th>
                        ))}
                        <th
                          rowSpan={3}
                          className="p-2.5 font-bold text-center w-24 bg-muted/80"
                        >
                          Total Target
                        </th>
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
                        const startW = Math.max(
                          1,
                          Number(phase.startWeek || 1),
                        );
                        const endW = Math.min(
                          totalWeeks,
                          Number(phase.endWeek || totalWeeks),
                        );
                        const duration = Math.max(1, endW - startW + 1);
                        const weight = Number(phase.weightPercent || 0);

                        const effectiveTargets = getEffectivePhaseWeeklyTargets(
                          phase,
                          totalWeeks,
                        );
                        const currentSum = Object.values(
                          effectiveTargets,
                        ).reduce((sum, v) => sum + (Number(v) || 0), 0);
                        const isSumMatch = Math.abs(currentSum - weight) < 0.05;

                        return (
                          <tr
                            key={phase.code || idx}
                            className="hover:bg-muted/20 transition-colors"
                          >
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
                                    isActiveWeek
                                      ? "bg-background"
                                      : "bg-muted/30 opacity-40 select-none",
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
                                        if (!updatedPhases[idx].weeklyTargets)
                                          updatedPhases[idx].weeklyTargets = {};
                                        updatedPhases[idx].weeklyTargets[wNo] =
                                          newVal;
                                        setPhases(updatedPhases);
                                      }}
                                      className="w-12 h-7 text-center font-bold text-[11px] p-0 rounded border-border/60 bg-background shadow-none"
                                    />
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                                      -
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="p-2 text-center font-extrabold border-l border-border/40 bg-muted/20">
                              <span
                                className={
                                  isSumMatch
                                    ? "text-emerald-600"
                                    : "text-amber-600 font-bold"
                                }
                              >
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
                        <td
                          colSpan={4}
                          className="p-2.5 font-extrabold border-r border-border/40 text-primary"
                        >
                          PLAN PROGRESS MAIN WEEKS
                        </td>
                        {matrix.summary.planProgressMainWeeks.map(
                          (val, wIdx) => (
                            <td
                              key={wIdx}
                              className="p-1.5 text-center font-bold text-[10px] border-r border-border/40 bg-primary/5"
                            >
                              {val.toFixed(2)}
                            </td>
                          ),
                        )}
                        <td className="p-2 text-center font-black text-primary">
                          {matrix.summary.planProgressMainWeeks
                            .reduce((a, b) => a + b, 0)
                            .toFixed(2)}
                          %
                        </td>
                      </tr>
                      {/* Summary Row 2: PLAN PROGRESS CUMULATIVE */}
                      <tr>
                        <td
                          colSpan={4}
                          className="p-2.5 font-extrabold border-r border-border/40 text-blue-700 dark:text-blue-300"
                        >
                          PLAN PROGRESS COMULATIVE/WEEK
                        </td>
                        {matrix.summary.planProgressCumulative.map(
                          (val, wIdx) => (
                            <td
                              key={wIdx}
                              className="p-1.5 text-center font-extrabold text-[10px] border-r border-border/40 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                            >
                              {val.toFixed(2)}
                            </td>
                          ),
                        )}
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
          className="p-6 m-0 space-y-5 max-h-125 overflow-y-auto animate-in fade-in-50 duration-200"
        >
          {/* Guide Banner & Bobot Summary */}
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-foreground/80 leading-relaxed shadow-2xs space-y-3">
            {/* Baris Atas: Judul di kiri & Kontrol Bobot di kanan (auto wrap) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/10 pb-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Boxes className="w-5 h-5 text-primary shrink-0" />
                <strong className="text-primary font-bold text-sm">
                  Pengaturan Unit Conveyor & Komponen
                </strong>
                <span className="text-[11px] text-muted-foreground font-medium bg-background/80 px-2.5 py-0.5 rounded-full border border-border/50">
                  Total Unit: <strong>{units.length}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-background text-xs font-bold shadow-2xs">
                  <span>Total Bobot:</span>
                  <span
                    className={cn(
                      "font-extrabold text-sm",
                      Math.abs(
                        units.reduce(
                          (s, u) => s + (Number(u.weightPercent) || 0),
                          0,
                        ) - 100,
                      ) < 0.05
                        ? "text-emerald-600"
                        : "text-amber-600",
                    )}
                  >
                    {units
                      .reduce((s, u) => s + (Number(u.weightPercent) || 0), 0)
                      .toFixed(2)}
                    %
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={equalizeUnitWeights}
                  className="h-8 text-xs font-semibold rounded-lg cursor-pointer hover:bg-muted"
                  title="Bagi rata persentase bobot ke seluruh unit"
                >
                  Bagi Rata
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={normalizeUnitWeights}
                  className="h-8 text-xs font-semibold rounded-lg cursor-pointer hover:bg-muted"
                  title="Skalakan persentase bobot menjadi tepat 100%"
                >
                  Normalisasi
                </Button>
              </div>
            </div>

            {/* Baris Bawah: Teks Penjelasan Lebar Penuh (Wrap Bebas) */}
            <p className="text-muted-foreground text-[12px] leading-relaxed">
              Tentukan daftar unit conveyor dan porsi <strong>Bobot Plan (%)</strong> tiap unit (total akumulasi harus tepat 100%). Lengkapi rincian komponen struktur dan mekanikal untuk monitoring fabrikasi.
            </p>
          </div>

          {/* Unit List */}
          <div className="space-y-4">
            {units.map((unit, idx) => {
              const isExpanded = expandedUnits[idx] ?? true;
              const subTab = getActiveSubTab(idx, unit.unitType);
              const stCount = unit.structureItems?.length || 0;
              const mechCount = unit.mechanicalItems?.length || 0;

              return (
                <div
                  key={idx}
                  className={cn(
                    "border rounded-xl transition-all duration-200 bg-card overflow-hidden shadow-xs",
                    isExpanded
                      ? "border-primary/30 ring-1 ring-primary/10"
                      : "border-border/60 hover:border-border",
                  )}
                >
                  {/* Unit Card Header (Collapsible) */}
                  <div className="p-3.5 bg-muted/20 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleUnitExpand(idx)}
                        className="flex items-center gap-2.5 text-left group/btn cursor-pointer flex-1 min-w-0"
                        title={isExpanded ? "Lipat Unit" : "Buka Detail Unit"}
                      >
                        <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0 group-hover/btn:bg-primary group-hover/btn:text-primary-foreground transition-colors">
                          #{idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-sm text-foreground truncate flex items-center gap-2">
                            <span>{unit.name?.trim() || `Unit Conveyor ${idx + 1}`}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="font-medium text-foreground/80">
                              {unit.unitType === "BOTH"
                                ? "Struktur & Mekanikal"
                                : unit.unitType === "STRUCTURE"
                                  ? "Hanya Struktur"
                                  : "Hanya Mekanikal"}
                            </span>
                            <span>•</span>
                            <span>
                              {unit.unitType !== "MECHANICAL" && `${stCount} Komp. Struktur`}
                              {unit.unitType === "BOTH" && " • "}
                              {unit.unitType !== "STRUCTURE" && `${mechCount} Komp. Mekanikal`}
                            </span>
                          </div>
                        </div>
                      </button>
                    </div>

                    <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                      <div className="flex items-center gap-1.5 bg-background border border-border/70 rounded-lg px-2.5 py-1">
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Bobot:
                        </span>
                        <span className="text-xs font-extrabold text-primary">
                          {Number(unit.weightPercent || 0).toFixed(2)}%
                        </span>
                      </div>

                      {units.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeUnit(idx)}
                          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                          title="Hapus Unit Ini"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Unit Card Body (when expanded) */}
                  {isExpanded && (
                    <div className="p-4 space-y-4 animate-in fade-in-50 duration-150">
                      {/* Top Config: Name, Type, and Weight */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-muted/10 p-3.5 rounded-xl border border-border/40">
                        {/* 1. Nama Unit */}
                        <div className="sm:col-span-5 space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            Nama Unit Conveyor <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            type="text"
                            placeholder="Contoh: Belt Conveyor 01 (BC-01) atau Hopper 5x5m"
                            value={unit.name}
                            onChange={(e) => updateUnitField(idx, "name", e.target.value)}
                            className="h-9 rounded-lg bg-background text-xs font-medium"
                          />
                        </div>

                        {/* 2. Jenis Pekerjaan (Segmented Radio Pills) */}
                        <div className="sm:col-span-5 space-y-1.5">
                          <Label className="text-xs font-bold text-foreground">
                            Jenis Pekerjaan
                          </Label>
                          <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-lg border border-border/50">
                            <button
                              type="button"
                              onClick={() => updateUnitField(idx, "unitType", "BOTH")}
                              className={cn(
                                "text-[11px] font-semibold py-1 rounded-md transition-all cursor-pointer text-center",
                                unit.unitType === "BOTH"
                                  ? "bg-background text-primary shadow-xs font-bold"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              Struktur & Mekanikal
                            </button>
                            <button
                              type="button"
                              onClick={() => updateUnitField(idx, "unitType", "STRUCTURE")}
                              className={cn(
                                "text-[11px] font-semibold py-1 rounded-md transition-all cursor-pointer text-center",
                                unit.unitType === "STRUCTURE"
                                  ? "bg-background text-primary shadow-xs font-bold"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              Hanya Struktur
                            </button>
                            <button
                              type="button"
                              onClick={() => updateUnitField(idx, "unitType", "MECHANICAL")}
                              className={cn(
                                "text-[11px] font-semibold py-1 rounded-md transition-all cursor-pointer text-center",
                                unit.unitType === "MECHANICAL"
                                  ? "bg-background text-primary shadow-xs font-bold"
                                  : "text-muted-foreground hover:text-foreground",
                              )}
                            >
                              Hanya Mekanikal
                            </button>
                          </div>
                        </div>

                        {/* 3. Bobot Plan (%) */}
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs font-bold text-primary flex items-center justify-between">
                            <span>Bobot Plan (%)</span>
                          </Label>
                          <div className="relative">
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={100}
                              placeholder="0.00"
                              value={unit.weightPercent ?? ""}
                              onChange={(e) =>
                                updateUnitField(
                                  idx,
                                  "weightPercent",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="h-9 rounded-lg font-bold text-primary bg-background pr-7 text-xs text-center"
                            />
                            <span className="absolute right-2.5 top-2.5 text-xs font-bold text-muted-foreground pointer-events-none">
                              %
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Component Section: Sub-Tabs & Full-Width Table */}
                      <div className="space-y-3">
                        {/* Sub-Tab Switcher (when BOTH) */}
                        {unit.unitType === "BOTH" ? (
                          <div className="flex items-center justify-between border-b border-border/50 pb-2 flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border/50">
                              <button
                                type="button"
                                onClick={() => setActiveSubTab(idx, "structure")}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer",
                                  subTab === "structure"
                                    ? "bg-background text-foreground shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <Hammer className="w-3.5 h-3.5 text-blue-600" />
                                <span>Komponen Struktur</span>
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                                    stCount > 0
                                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {stCount}
                                </span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setActiveSubTab(idx, "mechanical")}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer",
                                  subTab === "mechanical"
                                    ? "bg-background text-foreground shadow-xs font-bold"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                              >
                                <Cog className="w-3.5 h-3.5 text-amber-600" />
                                <span>Komponen Mekanikal</span>
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                                    mechCount > 0
                                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                      : "bg-muted text-muted-foreground",
                                  )}
                                >
                                  {mechCount}
                                </span>
                              </button>
                            </div>

                            {/* Salin dari Unit Lain selector */}
                            {units.length > 1 && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value !== "") {
                                    copyItemsFromAnotherUnit(
                                      idx,
                                      Number(e.target.value),
                                    );
                                    e.target.value = "";
                                  }
                                }}
                                className="h-8 text-[11px] font-medium bg-background border border-border/60 rounded-lg px-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <option value="" disabled>
                                  Salin komponen dari unit lain...
                                </option>
                                {units.map((otherU, otherIdx) => {
                                  if (otherIdx === idx) return null;
                                  return (
                                    <option key={otherIdx} value={otherIdx}>
                                      Unit #{otherIdx + 1}: {otherU.name || `Unit ${otherIdx + 1}`} ({otherU.structureItems?.length || 0} str, {otherU.mechanicalItems?.length || 0} mech)
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <div className="flex items-center gap-2 font-bold text-xs text-foreground">
                              {unit.unitType === "STRUCTURE" ? (
                                <>
                                  <Hammer className="w-4 h-4 text-blue-600" />
                                  <span>Daftar Komponen Struktur (Rangka Baja)</span>
                                  <span className="text-[10px] bg-blue-500/15 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                                    {stCount} Item
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Cog className="w-4 h-4 text-amber-600" />
                                  <span>Daftar Komponen Mekanikal (Motor, Pulley & Roller)</span>
                                  <span className="text-[10px] bg-amber-500/15 text-amber-700 px-2 py-0.5 rounded-full font-bold">
                                    {mechCount} Item
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Render Active Component Table */}
                        {(() => {
                          const currentType = subTab;
                          const currentItems =
                            currentType === "structure"
                              ? unit.structureItems || []
                              : unit.mechanicalItems || [];
                          const field =
                            currentType === "structure"
                              ? "structureItems"
                              : "mechanicalItems";

                          return (
                            <div className="space-y-3">
                              {/* Action Toolbar */}
                              <div className="flex flex-wrap items-center justify-between gap-2 bg-background p-2.5 rounded-xl border border-border/50">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={() => {
                                      const updated = [
                                        ...currentItems,
                                        { name: "", qty: 1, satuan: "unit" },
                                      ];
                                      updateUnitField(idx, field, updated);
                                    }}
                                    className="h-8 text-xs font-semibold rounded-lg gap-1.5 cursor-pointer shadow-2xs"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                                  </Button>
                                </div>

                                {currentItems.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => clearAllItems(idx, currentType)}
                                    className="h-8 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                  >
                                    Bersihkan
                                  </Button>
                                )}
                              </div>

                              {/* Table or Empty State */}
                              {currentItems.length > 0 ? (
                                <div className="rounded-xl border border-border/50 overflow-hidden bg-background">
                                  <table className="w-full text-left text-xs">
                                    <thead className="bg-muted/40 text-foreground border-b border-border/50">
                                      <tr>
                                        <th className="p-2.5 w-10 text-center font-bold text-muted-foreground">
                                          #
                                        </th>
                                        <th className="p-2.5 font-bold">
                                          Nama Komponen / Bagian
                                        </th>
                                        <th className="p-2.5 w-24 text-center font-bold">
                                          Jumlah (Qty)
                                        </th>
                                        <th className="p-2.5 w-28 text-center font-bold">
                                          Satuan
                                        </th>
                                        <th className="p-2.5 w-12 text-center font-bold">
                                          Aksi
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40">
                                      {currentItems.map(
                                        (item: any, itIdx: number) => {
                                          const itemObj =
                                            typeof item === "string"
                                              ? {
                                                  name: item,
                                                  qty: 1,
                                                  satuan: "unit",
                                                }
                                              : item;

                                          return (
                                            <tr
                                              key={itIdx}
                                              className="hover:bg-muted/15 transition-colors"
                                            >
                                              <td className="p-2.5 text-center text-muted-foreground font-semibold">
                                                {itIdx + 1}
                                              </td>
                                              <td className="p-2.5">
                                                <Input
                                                  type="text"
                                                  placeholder={
                                                    currentType === "structure"
                                                      ? "Contoh: Rangka Utama / Frame"
                                                      : "Contoh: Drive Pulley / Carry Roller"
                                                  }
                                                  value={itemObj.name}
                                                  onChange={(e) => {
                                                    const updated = [
                                                      ...currentItems,
                                                    ];
                                                    updated[itIdx] = {
                                                      ...itemObj,
                                                      name: e.target.value,
                                                    };
                                                    updateUnitField(
                                                      idx,
                                                      field,
                                                      updated,
                                                    );
                                                  }}
                                                  className="h-8 text-xs bg-background focus:bg-background rounded-lg border-border/70 font-medium"
                                                />
                                              </td>
                                              <td className="p-2.5">
                                                <Input
                                                  type="number"
                                                  min={1}
                                                  value={
                                                    itemObj.qty === ""
                                                      ? ""
                                                      : itemObj.qty
                                                  }
                                                  onChange={(e) => {
                                                    const raw = e.target.value;
                                                    const val =
                                                      raw === ""
                                                        ? ""
                                                        : Number(raw);
                                                    const updated = [
                                                      ...currentItems,
                                                    ];
                                                    updated[itIdx] = {
                                                      ...itemObj,
                                                      qty: val,
                                                    };
                                                    updateUnitField(
                                                      idx,
                                                      field,
                                                      updated,
                                                    );
                                                  }}
                                                  className="h-8 text-xs text-center font-bold bg-background focus:bg-background rounded-lg border-border/70"
                                                />
                                              </td>
                                              <td className="p-2.5">
                                                <select
                                                  value={
                                                    itemObj.satuan || "unit"
                                                  }
                                                  onChange={(e) => {
                                                    const updated = [
                                                      ...currentItems,
                                                    ];
                                                    updated[itIdx] = {
                                                      ...itemObj,
                                                      satuan: e.target.value,
                                                    };
                                                    updateUnitField(
                                                      idx,
                                                      field,
                                                      updated,
                                                    );
                                                  }}
                                                  className="w-full h-8 text-xs font-medium bg-background border border-border/70 rounded-lg px-2 cursor-pointer text-foreground"
                                                >
                                                  {SATUAN_OPTIONS.map(
                                                    (sat) => (
                                                      <option
                                                        key={sat}
                                                        value={sat}
                                                      >
                                                        {sat}
                                                      </option>
                                                    ),
                                                  )}
                                                </select>
                                              </td>
                                              <td className="p-2.5 text-center">
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon"
                                                  onClick={() => {
                                                    const updated =
                                                      currentItems.filter(
                                                        (_: any, i: number) =>
                                                          i !== itIdx,
                                                      );
                                                    updateUnitField(
                                                      idx,
                                                      field,
                                                      updated,
                                                    );
                                                  }}
                                                  className="h-7 w-7 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                                                  title="Hapus Baris"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                </Button>
                                              </td>
                                            </tr>
                                          );
                                        },
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="p-6 rounded-xl border border-dashed border-border/80 text-center bg-muted/10 space-y-2">
                                  <div className="w-9 h-9 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                                    <Boxes className="w-4.5 h-4.5" />
                                  </div>
                                  <p className="text-xs text-muted-foreground font-medium">
                                    Belum ada rincian komponen {currentType === "structure" ? "struktur" : "mekanikal"} pada unit ini.
                                  </p>
                                  <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const updated = [
                                          { name: "", qty: 1, satuan: "unit" },
                                        ];
                                        updateUnitField(idx, field, updated);
                                      }}
                                      className="h-7 text-[11px] font-semibold rounded-lg"
                                    >
                                      <Plus className="w-3 h-3 mr-1" /> Tambah Baris
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bottom Add Unit Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addUnit}
              className="w-full h-10 border-dashed border-primary/30 hover:border-primary hover:bg-primary/5 text-primary gap-1.5 rounded-xl font-bold text-xs cursor-pointer shadow-none transition-all"
            >
              <Plus className="w-4 h-4" /> Tambah Unit Conveyor Baru
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
