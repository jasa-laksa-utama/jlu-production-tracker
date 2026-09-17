"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar,
  Percent,
  Save,
  Loader2,
  Layers,
  History,
  TrendingUp,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { SCurveWeekHeader } from "@/lib/s-curve-calculator";
import { updatePhaseWeeklyProgressAction } from "@/app/actions/phase-progress";

export interface PhaseWeeklyUpdateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  phase: any;
  project: any;
  weekHeaders: SCurveWeekHeader[];
  defaultWeekNum?: number;
}

export function PhaseWeeklyUpdateDialog({
  isOpen,
  onOpenChange,
  phase,
  project,
  weekHeaders,
  defaultWeekNum = 1,
}: PhaseWeeklyUpdateDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedWeek, setSelectedWeek] = useState<number>(defaultWeekNum);

  // Single straightforward progress input (%)
  const [progressPercent, setProgressPercent] = useState<string>("0");
  const [notes, setNotes] = useState<string>("");

  const phaseWeight = Number(phase?.weightPercent || 0);
  const weeklyProgresses: any[] = phase?.weeklyProgresses || [];

  // Sync state whenever dialog opens
  useEffect(() => {
    if (!isOpen || !phase) return;
    setSelectedWeek(defaultWeekNum);
  }, [isOpen, defaultWeekNum, phase]);

  useEffect(() => {
    if (!phase) return;

    // Find progress recorded for selected week
    const currentWeekEntry = weeklyProgresses.find(
      (wp) => wp.weekNumber === selectedWeek,
    );

    // Find progress recorded for previous week
    const prevWeekEntry = weeklyProgresses.find(
      (wp) => wp.weekNumber === selectedWeek - 1,
    );
    const prevVal = prevWeekEntry
      ? Number(prevWeekEntry.actualPercent || 0)
      : 0;

    if (currentWeekEntry) {
      const curVal = Number(currentWeekEntry.actualPercent || 0);
      setProgressPercent(curVal.toString());
      setNotes(currentWeekEntry.notes || "");
    } else {
      // Default to 0 for a new week
      setProgressPercent("0");
      setNotes("");
    }
  }, [selectedWeek, phase, weeklyProgresses]);

  const currentProgNum = Math.min(
    100,
    Math.max(0, parseFloat(progressPercent) || 0),
  );
  const weekWeightImpact = (currentProgNum / 100) * phaseWeight;

  // Sum of all OTHER weeks recorded
  const otherWeeksSum = weeklyProgresses
    .filter((wp) => wp.weekNumber !== selectedWeek)
    .reduce((sum, wp) => sum + Number(wp.actualPercent || 0), 0);
  const totalPhaseProgress = Math.min(100, otherWeeksSum + currentProgNum);
  const totalProjectWeightImpact = (totalPhaseProgress / 100) * phaseWeight;

  const existingCurrentEntry = weeklyProgresses.find(
    (wp) => wp.weekNumber === selectedWeek,
  );

  const handleSave = () => {
    if (!phase || !project) return;

    startTransition(async () => {
      const res = await updatePhaseWeeklyProgressAction({
        phaseId: phase.id,
        projectId: project.id,
        weekNumber: selectedWeek,
        actualPercent: currentProgNum,
        notes,
      });

      if (res.success) {
        toast.success(
          `Progress ${phase.name} Minggu #${selectedWeek} berhasil disimpan!`,
        );
        onOpenChange(false);
      } else {
        toast.error(res.error || "Gagal menyimpan progress");
      }
    });
  };

  if (!phase) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md! p-0 rounded-2xl overflow-hidden shadow-xl border-border/80">
        {/* HEADER */}
        <DialogHeader className="p-4 pb-3 border-b bg-muted/20 flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-foreground">
                Update Progress: {phase.name}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-primary/30 text-primary bg-primary/5 px-1.5 py-0 h-4"
                >
                  Bobot: {phaseWeight.toFixed(2)}%
                </Badge>
                <span>• {project?.projectName || "Proyek"}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* COMPACT CONTENT */}
        <div className="p-4 space-y-4 text-xs">
          {/* 1. PERIODE MINGGU */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                Pilih Periode Minggu
              </span>
              {existingCurrentEntry && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-0.5">
                  <Pencil className="w-2.5 h-2.5" /> Sedang Mengedit
                </span>
              )}
            </div>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer shadow-xs"
            >
              {weekHeaders.map((wh) => {
                const existing = weeklyProgresses.find(
                  (wp) => wp.weekNumber === wh.weekNumber,
                );
                return (
                  <option key={wh.weekNumber} value={wh.weekNumber}>
                    Minggu #{wh.weekNumber} ({wh.dateRange} {wh.monthName})
                    {existing
                      ? ` — Tercatat: ${Number(existing.actualPercent).toFixed(1)}%`
                      : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. PROGRESS INPUT (%) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Progress Capaian Minggu #{selectedWeek} (%):</span>
              <span className="text-[10px] text-muted-foreground font-normal">
                Bobot fase: <b>{phaseWeight.toFixed(2)}%</b>
              </span>
            </Label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={progressPercent}
                onChange={(e) => setProgressPercent(e.target.value)}
                className="pr-8 text-sm font-bold h-10 rounded-xl focus:ring-primary text-foreground"
                placeholder="0.00"
                autoFocus
              />
              <Percent className="w-4 h-4 text-muted-foreground absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* 3. CALCULATION SUMMARY STRIP */}
          <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-center text-xs">
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground font-semibold">
                Progress Minggu Ini
              </div>
              <div className="font-bold text-foreground">
                {currentProgNum.toFixed(2)}%
              </div>
            </div>
            <div className="space-y-0.5 border-x border-primary/20">
              <div className="text-[10px] text-muted-foreground font-semibold">
                Bobot Minggu Ini
              </div>
              <div className="font-bold text-emerald-600 dark:text-emerald-400">
                {weekWeightImpact.toFixed(2)}%
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[10px] text-muted-foreground font-semibold">
                Total Akumulasi
              </div>
              <div className="font-bold text-primary">
                {totalPhaseProgress.toFixed(2)}% <span className="text-[10px] text-muted-foreground font-normal">({totalProjectWeightImpact.toFixed(2)}%)</span>
              </div>
            </div>
          </div>

          {/* 4. NOTES / MEMO */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-foreground">
              Catatan Progres (Opsional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contoh: Pekerjaan clearing selesai 100%, lanjut perataan tanah..."
              rows={2}
              className="text-xs rounded-xl resize-none"
            />
          </div>

          {/* 5. HISTORY CHIPS (QUICK EDIT PAST WEEKS) */}
          {weeklyProgresses.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                <History className="w-3 h-3 text-primary" />
                Riwayat Mingguan (Klik untuk lihat / edit):
              </span>
              <div className="flex items-center gap-1.5 flex-wrap max-h-24 overflow-y-auto">
                {weeklyProgresses.map((wp) => (
                  <button
                    key={wp.id || wp.weekNumber}
                    type="button"
                    onClick={() => setSelectedWeek(wp.weekNumber)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-bold cursor-pointer transition-all ${
                      wp.weekNumber === selectedWeek
                        ? "border-primary bg-primary text-primary-foreground shadow-2xs"
                        : "border-border/60 bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Minggu #{wp.weekNumber}:{" "}
                    {Number(wp.actualPercent).toFixed(1)}%
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <DialogFooter className="m-0! p-3 px-4 border-t bg-muted/20 flex flex-row items-center justify-between gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="rounded-xl text-xs font-semibold cursor-pointer h-8"
          >
            Batal
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs gap-1.5 h-8 px-4"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Simpan Progress Minggu #{selectedWeek}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
