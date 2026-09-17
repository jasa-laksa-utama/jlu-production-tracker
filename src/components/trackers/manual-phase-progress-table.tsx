"use client";

import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  HardHat,
  Zap,
  CheckCircle2,
  Tractor,
  Building2,
  Calendar,
  Clock,
  TrendingUp,
  Percent,
  Pencil,
  Camera,
  History,
  FileText,
  AlertCircle,
  ShieldCheck,
  ClipboardCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { generateWeekHeaders } from "@/lib/s-curve-calculator";
import { PhaseWeeklyUpdateDialog } from "@/components/trackers/phase-weekly-update-dialog";
import { ProgressPhotoDialog } from "@/components/trackers/progress-photo-dialog";
import { ClosingBeritaAcaraDialog } from "@/components/trackers/closing-berita-acara-dialog";
import { cn } from "@/lib/utils";
import { formatJakartaDate } from "@/lib/date-utils";

// Filter specifically for the 4 manual update phases
export function isManualTargetPhase(phase: any) {
  const code = (phase.code || "").toUpperCase();
  const name = (phase.name || "").toLowerCase();

  return (
    code.includes("CLEARING") ||
    code.includes("LEVELING") ||
    code.includes("CIVIL") ||
    code.includes("ELECTRICAL") ||
    code.includes("COMMISSION") ||
    code.includes("KOMISIONING") ||
    name.includes("clearing") ||
    name.includes("leveling") ||
    name.includes("civil") ||
    name.includes("sipil") ||
    name.includes("electrical") ||
    name.includes("listrik") ||
    name.includes("commissioning") ||
    name.includes("commisioning")
  );
}

function getPhaseIcon(phase: any) {
  const code = (phase.code || "").toUpperCase();
  const name = (phase.name || "").toLowerCase();

  if (
    code.includes("CLEARING") ||
    name.includes("clearing") ||
    name.includes("leveling")
  ) {
    return Tractor;
  }
  if (
    code.includes("CIVIL") ||
    name.includes("civil") ||
    name.includes("sipil")
  ) {
    return Building2;
  }
  if (
    code.includes("ELECTRICAL") ||
    name.includes("electrical") ||
    name.includes("listrik")
  ) {
    return Zap;
  }
  return CheckCircle2;
}

function getPhaseBadgeColor(phase: any) {
  const code = (phase.code || "").toUpperCase();
  const name = (phase.name || "").toLowerCase();

  if (
    code.includes("CLEARING") ||
    name.includes("clearing") ||
    name.includes("leveling")
  ) {
    return "border-amber-500/30 text-amber-600 bg-amber-500/10";
  }
  if (
    code.includes("CIVIL") ||
    name.includes("civil") ||
    name.includes("sipil")
  ) {
    return "border-blue-500/30 text-blue-600 bg-blue-500/10";
  }
  if (
    code.includes("ELECTRICAL") ||
    name.includes("electrical") ||
    name.includes("listrik")
  ) {
    return "border-purple-500/30 text-purple-600 bg-purple-500/10";
  }
  return "border-emerald-500/30 text-emerald-600 bg-emerald-500/10";
}

export function ManualPhaseProgressTable({
  project,
  masterplan,
}: {
  project: any;
  masterplan: any;
}) {
  const router = useRouter();
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [closingBeritaAcaraOpen, setClosingBeritaAcaraOpen] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState<any>(null);
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(1);

  if (!project || !masterplan) {
    return (
      <div className="p-8 text-center border border-dashed rounded-2xl bg-muted/10 text-muted-foreground">
        Masterplan belum dibuat untuk proyek ini.
      </div>
    );
  }

  const totalWeeks = Number(masterplan.totalWeeks || 30);
  const startDateStr =
    masterplan.startDate || project.createdAt || new Date().toISOString();
  const weekHeaders = generateWeekHeaders(startDateStr, totalWeeks);

  // Determine current active week relative to startDate
  const start = new Date(startDateStr);
  const now = new Date();
  const diffDays = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const currentWeek = Math.min(
    totalWeeks,
    Math.max(1, Math.floor(diffDays / 7) + 1),
  );

  // Extract 4 target phases from masterplan
  const allPhases: any[] = masterplan.phases || [];
  const manualPhases = allPhases.filter(isManualTargetPhase);

  // If none matched, display fallback note
  if (manualPhases.length === 0) {
    return (
      <Card className="rounded-2xl border border-border/80 shadow-xs">
        <CardContent className="p-8 text-center text-muted-foreground space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto opacity-80" />
          <h4 className="text-sm font-bold text-foreground">
            Tidak Ada Tahapan Manual Terdeteksi
          </h4>
          <p className="text-xs max-w-md mx-auto">
            Fase seperti *Clearing / Leveling*, *Civil Work*, *Electrical
            System*, atau *Commissioning* tidak ditemukan di masterplan proyek
            ini.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Summary Metrics
  const totalManualWeight = manualPhases.reduce(
    (sum, p) => sum + Number(p.weightPercent || 0),
    0,
  );

  const totalWeightedProgress = manualPhases.reduce((sum, p) => {
    const w = Number(p.weightPercent || 0);
    const wRecords: any[] = p.weeklyProgresses || [];
    const totalAcc = wRecords.reduce(
      (s, wp) => s + Number(wp.actualPercent || 0),
      0,
    );
    const act = Math.min(
      100,
      totalAcc > 0 ? totalAcc : Number(p.actualProgress || 0),
    );
    return sum + (act / 100) * w;
  }, 0);

  const avgActualProgress =
    totalManualWeight > 0
      ? (totalWeightedProgress / totalManualWeight) * 100
      : 0;

  const handleOpenUpdateDialog = (phase: any, weekNum?: number) => {
    setSelectedPhase(phase);
    setSelectedWeekNum(weekNum || currentWeek);
    setUpdateDialogOpen(true);
  };

  const handleOpenPhotoDialog = (phase: any) => {
    setSelectedPhase(phase);
    setPhotoDialogOpen(true);
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* 1. TOP KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Bobot Proyek */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">
                Total Bobot 4 Kategori
              </span>
              <div className="text-xl font-bold text-foreground">
                {totalManualWeight.toFixed(2)}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                dari total bobot keseluruhan proyek
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <HardHat className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Capaian Rata-rata */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">
                Rata-rata Capaian Aktual
              </span>
              <div className="text-xl font-bold text-foreground">
                {avgActualProgress.toFixed(2)}%
              </div>
              <span className="text-[10px] text-emerald-600 font-semibold">
                Prestasi gabungan 4 tahapan
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Kontribusi Bobot ke Proyek */}
        <Card className="rounded-2xl border border-border/80 bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-xs font-bold text-muted-foreground">
                Kontribusi ke Total Proyek
              </span>
              <div className="text-xl font-bold text-primary">
                {totalWeightedProgress.toFixed(2)}%
              </div>
              <span className="text-[10px] text-muted-foreground">
                Prestasi aktual tertimbang bobot
              </span>
            </div>
            <div className="p-3 rounded-2xl bg-primary/10 text-primary">
              <Percent className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. HEADER INFO BANNER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/70 gap-3">
        <div className="space-y-0.5">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            Update Progres Manual (Pekerjaan Lapangan & Site)
          </h4>
          <p className="text-xs text-muted-foreground">
            Pencatatan mingguan khusus untuk 4 tahapan: <b>Clearing/Leveling</b>
            , <b>Civil Work</b>, <b>Electrical System</b>, dan{" "}
            <b>Commissioning</b>.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <Calendar className="w-3.5 h-3.5 text-primary" />
          <span>Minggu Berjalan:</span>
          <Badge
            variant="outline"
            className="font-bold border-primary/40 text-primary bg-primary/10 text-xs px-2 py-0.5"
          >
            Minggu #{currentWeek}
          </Badge>
        </div>
      </div>

      {/* 3. 4 MANUAL PHASES CARDS & HISTORIES */}
      <div className="grid grid-cols-1 gap-6">
        {manualPhases.map((phase) => {
          const PhaseIcon = getPhaseIcon(phase);
          const badgeColor = getPhaseBadgeColor(phase);
          const weight = Number(phase.weightPercent || 0);
          const weeklyRecords: any[] = phase.weeklyProgresses || [];

          // Calculate total progress from all weekly entries
          const totalAccumulatedProgress = weeklyRecords.reduce(
            (sum, wp) => sum + Number(wp.actualPercent || 0),
            0,
          );
          const actualProg = Math.min(
            100,
            totalAccumulatedProgress > 0
              ? totalAccumulatedProgress
              : Number(phase.actualProgress || 0),
          );
          const projectImpact = (actualProg / 100) * weight;

          const isCommissioning =
            (phase.code || "").toUpperCase().includes("COMMISSION") ||
            (phase.code || "").toUpperCase().includes("KOMISIONING") ||
            (phase.name || "").toLowerCase().includes("commissioning") ||
            (phase.name || "").toLowerCase().includes("commisioning") ||
            (phase.name || "").toLowerCase().includes("komisioning");

          const isProjectClosed =
            project.status === "CLOSED" || project.status === "COMPLETED";

          return (
            <Card
              key={phase.id}
              className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-primary/40 transition-all"
            >
              {/* CARD HEADER */}
              <CardHeader className="p-5 pb-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-background border border-border/60 shadow-2xs text-primary">
                    <PhaseIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2 flex-wrap">
                      <span>{phase.name}</span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-extrabold px-2 py-0.5 rounded-md",
                          badgeColor,
                        )}
                      >
                        Bobot: {weight.toFixed(2)}%
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md",
                          phase.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                            : phase.status === "IN_PROGRESS"
                              ? "bg-blue-500/10 text-blue-600 border-blue-500/30"
                              : "bg-muted text-muted-foreground border-border/60",
                        )}
                      >
                        {phase.status === "COMPLETED"
                          ? "Selesai"
                          : phase.status === "IN_PROGRESS"
                            ? "Sedang Berjalan"
                            : "Belum Mulai"}
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>
                        Jadwal Rencana: Minggu #{phase.startWeek} s/d #
                        {phase.endWeek}
                      </span>
                      <span>•</span>
                      <span>
                        Total Durasi:{" "}
                        {Math.max(1, phase.endWeek - phase.startWeek + 1)}{" "}
                        Minggu
                      </span>
                    </CardDescription>
                  </div>
                </div>

                {/* HEADER ACTIONS */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenPhotoDialog(phase)}
                    className="h-8 px-3 rounded-xl text-xs font-bold gap-1.5 border-border/80 hover:bg-muted cursor-pointer shadow-2xs"
                  >
                    <Camera className="w-3.5 h-3.5 text-muted-foreground" />
                    Foto Lapangan
                  </Button>

                  <Button
                    size="sm"
                    onClick={() => handleOpenUpdateDialog(phase)}
                    className="h-8 px-3.5 rounded-xl text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Update Capaian Mingguan
                  </Button>
                </div>
              </CardHeader>

              {/* CARD CONTENT */}
              <CardContent className="p-5 space-y-5">
                {/* BANNER CLOSING BERITA ACARA JIKA COMMISSIONING SELESAI */}
                {isCommissioning && (actualProg >= 100 || isProjectClosed) && (
                  <div
                    className={cn(
                      "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all",
                      isProjectClosed
                        ? "bg-slate-500/10 border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300",
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      {isProjectClosed ? (
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shrink-0">
                          <ClipboardCheck className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0 animate-pulse">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <span className="font-bold block text-foreground">
                          {isProjectClosed
                            ? "Proyek Telah Ditutup Resmi (Closed)"
                            : "Commissioning 100% Selesai: Proyek Siap Ditutup"}
                        </span>
                        <span className="text-[11px] opacity-90">
                          {isProjectClosed
                            ? "Berita Acara dan laporan hasil pengujian conveyor di site telah diarsipkan secara resmi."
                            : "Tim Engineering dapat melakukan submit Berita Acara dan hasil pengujian conveyor di site untuk proses penutupan proyek resmi."}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setClosingBeritaAcaraOpen(true)}
                      className={cn(
                        "h-8 text-xs font-bold shrink-0 cursor-pointer",
                        isProjectClosed
                          ? "bg-background hover:bg-muted text-foreground border border-border/80"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs",
                      )}
                    >
                      {isProjectClosed ? (
                        <>
                          <ClipboardCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Lihat Berita Acara
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          Submit Berita Acara
                        </>
                      )}
                    </Button>
                  </div>
                )}
                {/* PROGRESS OVERVIEW STRIP */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-background border border-border/60 shadow-2xs">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-muted-foreground">
                        Prestasi Fase:
                      </span>
                      <span className="font-bold text-foreground">
                        {actualProg.toFixed(2)}%
                      </span>
                    </div>
                    <div className="w-full bg-muted dark:bg-muted/40 rounded-full h-2 overflow-hidden border border-border/20">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          actualProg >= 100
                            ? "bg-emerald-500"
                            : actualProg > 0
                              ? "bg-primary"
                              : "bg-muted-foreground/30",
                        )}
                        style={{ width: `${Math.min(100, actualProg)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1 text-center sm:border-x border-border/60 px-3">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Kontribusi Bobot Proyek
                    </span>
                    <div className="text-base font-bold text-primary">
                      {projectImpact.toFixed(2)}%{" "}
                      <span className="text-[10px] text-muted-foreground font-normal">
                        / {weight.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-center sm:text-right">
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      Update Terakhir
                    </span>
                    <div className="text-xs font-bold text-foreground flex items-center justify-center sm:justify-end gap-1">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{formatJakartaDate(phase.updatedAt, "date")}</span>
                    </div>
                  </div>
                </div>

                {/* WEEKLY RECORDS TABLE / LIST */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-primary" />
                      Riwayat Pencatatan Mingguan ({weeklyRecords.length} Minggu
                      Terisi)
                    </h5>
                    <button
                      type="button"
                      onClick={() => handleOpenUpdateDialog(phase)}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                    >
                      + Tambah / Edit Minggu
                    </button>
                  </div>

                  {weeklyRecords.length === 0 ? (
                    <div className="p-4 rounded-xl bg-muted/20 border border-dashed border-border/80 text-center text-xs text-muted-foreground">
                      Belum ada pencatatan mingguan untuk fase ini. Klik tombol{" "}
                      <b>"Update Capaian Mingguan"</b> untuk mencatat capaian
                      progres lapangan.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border/60 overflow-hidden bg-background">
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/40 border-b border-border/60 text-[11px] font-bold text-muted-foreground">
                            <tr>
                              <th className="p-2.5 text-center w-16">Minggu</th>
                              <th className="p-2.5">Periode Tanggal</th>
                              <th className="p-2.5 text-center">
                                Progress (%)
                              </th>
                              <th className="p-2.5 text-center">
                                Bobot
                              </th>
                              <th className="p-2.5">
                                Catatan Progres Lapangan
                              </th>
                              <th className="p-2.5 text-center">
                                Diperbarui Oleh
                              </th>
                              <th className="p-2.5 text-center w-20">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/40">
                            {weeklyRecords.map((wp) => {
                              const wh = weekHeaders.find(
                                (w) => w.weekNumber === wp.weekNumber,
                              );
                              const isCurrent = wp.weekNumber === currentWeek;
                              const progVal = Number(wp.actualPercent || 0);
                              const weekWeight = (progVal / 100) * weight;

                              return (
                                <tr
                                  key={wp.id || wp.weekNumber}
                                  className={cn(
                                    "hover:bg-muted/30 transition-colors",
                                    isCurrent && "bg-primary/5 font-semibold",
                                  )}
                                >
                                  <td className="p-2.5 text-center font-bold">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-bold px-1.5 py-0 h-5",
                                        isCurrent
                                          ? "border-primary/40 text-primary bg-primary/10"
                                          : "border-border/60 text-muted-foreground",
                                      )}
                                    >
                                      #{wp.weekNumber}
                                    </Badge>
                                  </td>
                                  <td className="p-2.5 text-muted-foreground whitespace-nowrap">
                                    {wh
                                      ? `${wh.dateRange} ${wh.monthName}`
                                      : `Minggu ke-${wp.weekNumber}`}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-foreground">
                                    {progVal.toFixed(2)}%
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-primary">
                                    {weekWeight.toFixed(2)}%
                                  </td>
                                  <td
                                    className="p-2.5 text-foreground max-w-xs truncate"
                                    title={wp.notes || "-"}
                                  >
                                    {wp.notes || (
                                      <span className="text-muted-foreground/60 italic">
                                        -
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center text-muted-foreground text-[11px]">
                                    {wp.updatedBy || "System"}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        handleOpenUpdateDialog(
                                          phase,
                                          wp.weekNumber,
                                        )
                                      }
                                      className="h-6 w-6 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                                      title={`Edit Progres Minggu #${wp.weekNumber}`}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* DIALOGS */}
      {selectedPhase && (
        <PhaseWeeklyUpdateDialog
          isOpen={updateDialogOpen}
          onOpenChange={setUpdateDialogOpen}
          phase={selectedPhase}
          project={project}
          weekHeaders={weekHeaders}
          defaultWeekNum={selectedWeekNum}
        />
      )}

      {selectedPhase && (
        <ProgressPhotoDialog
          isOpen={photoDialogOpen}
          onOpenChange={setPhotoDialogOpen}
          projectId={project.id}
          projectName={project.projectName}
          category="GENERAL"
        />
      )}

      {/* Closing Berita Acara Dialog */}
      <ClosingBeritaAcaraDialog
        project={project}
        open={closingBeritaAcaraOpen}
        onOpenChange={setClosingBeritaAcaraOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
