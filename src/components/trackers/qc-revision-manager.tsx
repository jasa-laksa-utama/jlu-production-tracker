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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Plus,
  RefreshCw,
  FileText,
  ShieldCheck,
  Hammer,
  Wrench,
  ChevronRight,
  User,
  Calendar,
  PauseCircle,
  ExternalLink,
  ChevronDown,
  RotateCcw,
  Lock,
} from "lucide-react";
import {
  getProjectQCCheckpoints,
  inspectQCItem,
  createNCR,
  submitNCRResolution,
  closeNCR,
  createDrawingRevisionRequest,
  resolveDrawingRevisionByEngineering,
  closeDrawingRevision,
} from "@/app/actions/qc";

export function getProductionStageProgress(
  item: any,
  itemType: "STRUCTURE" | "MECHANICAL",
  stageName: string,
) {
  if (!item) return { completedQty: 0, isDone: false, totalQty: 1 };
  const totalQty = item.qty || 1;

  if (itemType === "STRUCTURE") {
    switch (stageName) {
      case "CUTTING":
        return {
          completedQty: item.cuttingQty || 0,
          isDone: !!item.cuttingDone,
          totalQty,
        };
      case "SETTING":
        return {
          completedQty: item.settingQty || 0,
          isDone: !!item.settingDone,
          totalQty,
        };
      case "WELDING":
        return {
          completedQty: item.weldingQty || 0,
          isDone: !!item.weldingDone,
          totalQty,
        };
      case "FINISHING":
        return {
          completedQty: item.finishingQty || 0,
          isDone: !!item.finishingDone,
          totalQty,
        };
      case "PAINTING":
        return {
          completedQty: item.paintingQty || 0,
          isDone: !!item.paintingDone,
          totalQty,
        };
      case "PACKAGING":
        return {
          completedQty: item.packagingQty || 0,
          isDone: !!item.packagingDone,
          totalQty,
        };
      default:
        return { completedQty: 0, isDone: false, totalQty };
    }
  } else {
    // MECHANICAL
    switch (stageName) {
      case "PROCUREMENT":
        return {
          completedQty: item.procurementQty || 0,
          isDone: !!item.procurementDone,
          totalQty,
        };
      case "PO":
        return {
          completedQty: item.poQty || 0,
          isDone: !!item.poDone,
          totalQty,
        };
      case "FABRICATION":
        return {
          completedQty: item.fabricationQty || 0,
          isDone: !!item.fabricationDone,
          totalQty,
        };
      case "PACKAGING":
        return {
          completedQty: item.packagingQty || 0,
          isDone: !!item.packagingDone,
          totalQty,
        };
      default:
        return { completedQty: 0, isDone: false, totalQty };
    }
  }
}

function StageQCSelector({
  stageName,
  status,
  onPass,
  onReset,
  onNCR,
  onDR,
  isProductionReady = true,
  prodCompletedQty = 0,
  prodTotalQty = 1,
}: {
  stageName: string;
  status: string;
  onPass: () => void;
  onReset: () => void;
  onNCR: () => void;
  onDR: () => void;
  isProductionReady?: boolean;
  prodCompletedQty?: number;
  prodTotalQty?: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={!isProductionReady}
        render={
          <button
            disabled={!isProductionReady}
            title={
              !isProductionReady
                ? `Belum dikerjakan oleh Produksi (${prodCompletedQty}/${prodTotalQty})`
                : `Telah dikerjakan Produksi (${prodCompletedQty}/${prodTotalQty}) - Siap Di-QC`
            }
            className={`flex items-center justify-between gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all shadow-2xs ${
              !isProductionReady
                ? "opacity-45 cursor-not-allowed bg-muted/20 border-border/40 text-muted-foreground/60"
                : "cursor-pointer bg-background/10 hover:bg-background/20"
            }`}
          >
            <span className="text-xs font-semibold text-muted-foreground">
              {stageName.slice(0, 4)}:
            </span>
            {status === "PASS" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Pass
              </span>
            ) : status === "FAIL" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/30 animate-pulse">
                <XCircle className="w-3 h-3 text-red-600" /> Revisi
              </span>
            ) : status === "ON_HOLD" ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30 animate-pulse">
                <PauseCircle className="w-3 h-3 text-amber-600" /> DR
              </span>
            ) : !isProductionReady ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded border border-border/30">
                <Lock className="w-2.5 h-2.5 text-muted-foreground/50" /> Belum
                Siap
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded border border-border/40">
                <Clock className="w-3 h-3 text-muted-foreground" /> Pilih ▾
              </span>
            )}
          </button>
        }
      />
      {isProductionReady && (
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem
            onClick={onPass}
            className="text-xs font-semibold text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/20 gap-2 cursor-pointer p-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Lolos QC
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onReset}
            className="text-xs font-semibold text-slate-600 focus:text-slate-700 focus:bg-slate-100 dark:focus:bg-slate-900/40 gap-2 cursor-pointer p-2"
          >
            <RotateCcw className="w-4 h-4 text-slate-500" />⚪ Reset Status
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onNCR}
            className="text-xs font-semibold text-red-600 focus:text-red-700 focus:bg-red-50 dark:focus:bg-red-950/20 gap-2 cursor-pointer p-2"
          >
            <XCircle className="w-4 h-4 text-red-600" />
            Revisi Produksi
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDR}
            className="text-xs font-semibold text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/20 gap-2 cursor-pointer p-2"
          >
            <PauseCircle className="w-4 h-4 text-amber-600" />
            Revisi Drawing
          </DropdownMenuItem>
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  );
}

export interface QCNCRManagerPanelProps {
  projectId: string;
  projectName?: string;
  projectNumber?: string;
}

export function QCNCRManagerPanel({
  projectId,
  projectName = "Proyek Produksi",
  projectNumber = "PRJ",
}: QCNCRManagerPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<
    "STRUCTURE" | "MECHANICAL" | "NCRS" | "DRS"
  >("STRUCTURE");
  const [qcData, setQcData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Form Raise NCR state
  const [selectedItemForNCR, setSelectedItemForNCR] = useState<{
    unitId: string;
    unitName: string;
    itemType: "STRUCTURE" | "MECHANICAL";
    itemId: string;
    itemName: string;
    stage: string;
  } | null>(null);

  const [ncrCategory, setNcrCategory] = useState<string>("DIMENSI");
  const [ncrDescription, setNcrDescription] = useState<string>("");
  const [correctiveAction, setCorrectiveAction] = useState<string>("");
  const [resetStage, setResetStage] = useState<boolean>(true);
  const [raisedBy, setRaisedBy] = useState<string>("QC Inspector");

  // Form Raise DR (Drawing Revision) state
  const [selectedItemForDR, setSelectedItemForDR] = useState<{
    unitId: string;
    unitName: string;
    itemType: "STRUCTURE" | "MECHANICAL";
    itemId: string;
    itemName: string;
    stage: string;
  } | null>(null);

  const [drawingRef, setDrawingRef] = useState<string>("");
  const [fieldCondition, setFieldCondition] = useState<string>("");
  const [requestedChange, setRequestedChange] = useState<string>("");

  // Actions states
  const [selectedNCRForResolve, setSelectedNCRForResolve] = useState<any>(null);
  const [resolvedNotes, setResolvedNotes] = useState<string>("");
  const [resolvedBy, setResolvedBy] = useState<string>("Tim Produksi");

  const [selectedNCRForClose, setSelectedNCRForClose] = useState<any>(null);
  const [closedNotes, setClosedNotes] = useState<string>("");
  const [closedBy, setClosedBy] = useState<string>("QC Inspector");

  const [selectedDRForResolve, setSelectedDRForResolve] = useState<any>(null);
  const [revisedDocUrl, setRevisedDocUrl] = useState<string>("");
  const [drResolvedNotes, setDrResolvedNotes] = useState<string>("");
  const [drResolvedBy, setDrResolvedBy] = useState<string>("Tim Engineering");

  const [selectedDRForClose, setSelectedDRForClose] = useState<any>(null);
  const [drClosedNotes, setDrClosedNotes] = useState<string>("");
  const [drClosedBy, setDrClosedBy] = useState<string>("QC Inspector");

  const fetchQCData = async () => {
    if (!projectId) return;
    setLoading(true);
    const res = await getProjectQCCheckpoints(projectId);
    if (res.success) {
      setQcData(res.data);
    } else {
      toast.error(res.error || "Gagal memuat data QC");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (projectId) {
      fetchQCData();
    }
  }, [projectId]);

  // Quick inspect PASS
  const handleInspectPass = (
    unitId: string,
    unitName: string,
    itemType: "STRUCTURE" | "MECHANICAL",
    itemId: string,
    itemName: string,
    stage: string,
  ) => {
    startTransition(async () => {
      const res = await inspectQCItem({
        projectId,
        unitId,
        unitName,
        itemType,
        itemId,
        itemName,
        stage,
        status: "PASS",
        inspectedBy: raisedBy || "QC Inspector",
        notes: "Inspeksi QC memenuhi standar (PASS)",
      });

      if (res.success) {
        toast.success(`Inspeksi Tahap ${stage} disetujui (PASS)`);
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal menyimpan inspeksi");
      }
    });
  };

  // Quick inspect RESET (Pending)
  const handleInspectReset = (
    unitId: string,
    unitName: string,
    itemType: "STRUCTURE" | "MECHANICAL",
    itemId: string,
    itemName: string,
    stage: string,
  ) => {
    startTransition(async () => {
      const res = await inspectQCItem({
        projectId,
        unitId,
        unitName,
        itemType,
        itemId,
        itemName,
        stage,
        status: "PENDING",
        inspectedBy: raisedBy || "QC Inspector",
        notes: "Reset status QC (Belum Diuji)",
      });

      if (res.success) {
        toast.success(`Status Tahap ${stage} di-reset ke Belum Diuji`);
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal mereset status inspeksi");
      }
    });
  };

  // Submit Raise NCR
  const handleCreateNCR = () => {
    if (!selectedItemForNCR) return;
    if (!ncrDescription.trim()) {
      toast.error("Deskripsi temuan ketidaksesuaian wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await createNCR({
        projectId,
        unitId: selectedItemForNCR.unitId,
        itemType: selectedItemForNCR.itemType,
        itemId: selectedItemForNCR.itemId,
        stage: selectedItemForNCR.stage,
        ncrCategory,
        ncrDescription,
        correctiveAction,
        resetStage,
        raisedBy: raisedBy || "QC Inspector",
      });

      if (res.success) {
        toast.success(
          `Laporan Revisi Produksi ${res.data?.ncrNumber} berhasil diterbitkan!`,
        );
        setSelectedItemForNCR(null);
        setNcrDescription("");
        setCorrectiveAction("");
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal menerbitkan Laporan Revisi Produksi");
      }
    });
  };

  // Submit Raise DR (Drawing Revision Request)
  const handleCreateDR = () => {
    if (!drawingRef.trim()) {
      toast.error("Nomor/Nama Drawing Referensi wajib diisi");
      return;
    }
    if (!fieldCondition.trim()) {
      toast.error("Kendala kondisi lapangan wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await createDrawingRevisionRequest({
        projectId,
        unitId: selectedItemForDR?.unitId,
        itemType: selectedItemForDR?.itemType,
        itemId: selectedItemForDR?.itemId,
        stage: selectedItemForDR?.stage,
        drawingRef,
        fieldCondition,
        requestedChange,
        raisedBy: raisedBy || "QC Inspector",
      });

      if (res.success) {
        toast.success(
          `Request Revisi Drawing ${res.data?.drNumber} dikirim ke Engineering! Item diset ke Status ON_HOLD.`,
        );
        setSelectedItemForDR(null);
        setDrawingRef("");
        setFieldCondition("");
        setRequestedChange("");
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal mengajukan revisi drawing");
      }
    });
  };

  // Submit Resolution by Production (NCR)
  const handleSubmitResolution = () => {
    if (!selectedNCRForResolve) return;
    if (!resolvedNotes.trim()) {
      toast.error("Catatan perbaikan wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await submitNCRResolution({
        ncrId: selectedNCRForResolve.id,
        resolvedNotes,
        resolvedBy: resolvedBy || "Tim Produksi",
      });

      if (res.success) {
        toast.success(
          `Laporan perbaikan Revisi Produksi ${selectedNCRForResolve.ncrNumber} telah dikirim ke QC`,
        );
        setSelectedNCRForResolve(null);
        setResolvedNotes("");
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal memperbarui status Revisi Produksi");
      }
    });
  };

  // Close or Re-open NCR by QC
  const handleCloseNCR = (isPassed: boolean) => {
    if (!selectedNCRForClose) return;

    startTransition(async () => {
      const res = await closeNCR({
        ncrId: selectedNCRForClose.id,
        isPassed,
        closedNotes,
        closedBy: closedBy || "QC Inspector",
      });

      if (res.success) {
        if (isPassed) {
          toast.success(
            `Laporan Revisi Produksi ${selectedNCRForClose.ncrNumber} telah DITUTUP (PASS)!`,
          );
        } else {
          toast.warning(
            `Laporan Revisi Produksi ${selectedNCRForClose.ncrNumber} ditolak & dibuka kembali (RE-OPEN)`,
          );
        }
        setSelectedNCRForClose(null);
        setClosedNotes("");
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal memproses penutupan Revisi Produksi");
      }
    });
  };

  // Engineering Resolves DR
  const handleResolveDR = () => {
    if (!selectedDRForResolve) return;
    if (!drResolvedNotes.trim()) {
      toast.error("Catatan revisi engineering wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await resolveDrawingRevisionByEngineering({
        drId: selectedDRForResolve.id,
        revisedDocUrl,
        resolvedNotes: drResolvedNotes,
        resolvedBy: drResolvedBy || "Tim Engineering",
      });

      if (res.success) {
        toast.success(
          `Revisi Drawing ${selectedDRForResolve.drNumber} dikonfirmasi Engineering`,
        );
        setSelectedDRForResolve(null);
        setDrResolvedNotes("");
        setRevisedDocUrl("");
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal menyimpan revisi drawing");
      }
    });
  };

  // QC / Production Closes DR (Unfreezes Hold)
  const handleCloseDR = () => {
    if (!selectedDRForClose) return;

    startTransition(async () => {
      const res = await closeDrawingRevision({
        drId: selectedDRForClose.id,
        closedNotes: drClosedNotes,
        closedBy: drClosedBy || "QC Inspector",
      });

      if (res.success) {
        toast.success(
          `Drawing Revision ${selectedDRForClose.drNumber} DITUTUP. Item dilepas dari status Hold.`,
        );
        setSelectedDRForClose(null);
        setDrClosedNotes("");
        fetchQCData();
      } else {
        toast.error(res.error || "Gagal menutup request revisi drawing");
      }
    });
  };

  const getCheckpointStatus = (
    unitId: string,
    itemType: string,
    itemId: string,
    stage: string,
  ) => {
    if (!qcData || !qcData.units) return "PENDING";
    const unit = qcData.units.find((u: any) => u.id === unitId);
    if (!unit) return "PENDING";
    const cp = unit.qcCheckpoints.find(
      (c: any) =>
        c.itemId === itemId &&
        c.itemType === itemType &&
        c.stage.toUpperCase() === stage.toUpperCase(),
    );
    return cp ? cp.status : "PENDING";
  };

  const allNCRs = (qcData?.ncrs || []).filter(
    (r: any) => r.revisionType !== "DRAWING_REVISION",
  );
  const allDRs = (qcData?.ncrs || []).filter(
    (r: any) => r.revisionType === "DRAWING_REVISION",
  );

  // P2: Calculate QC Masterplan Metrics
  let totalCheckpoints = 0;
  let passCount = 0;
  let ncrCount = 0;
  let drCount = 0;

  if (qcData?.units) {
    qcData.units.forEach((u: any) => {
      const structCount = (u.structureItems?.length || 0) * 6;
      const mechCount = (u.mechanicalItems?.length || 0) * 4;
      totalCheckpoints += structCount + mechCount;

      (u.qcCheckpoints || []).forEach((cp: any) => {
        if (cp.status === "PASS") passCount++;
        else if (cp.status === "FAIL") ncrCount++;
        else if (cp.status === "ON_HOLD") drCount++;
      });
    });
  }

  const completionPercent =
    totalCheckpoints > 0
      ? Number(((passCount / totalCheckpoints) * 100).toFixed(1))
      : 0;

  return (
    <div className="bg-card border rounded-2xl p-4 sm:p-5 shadow-2xs space-y-5 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600 border border-red-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2 text-foreground">
              Quality Control & Revision Manager
            </h3>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchQCData}
          disabled={loading || isPending}
          className="gap-1.5 text-xs h-8 cursor-pointer"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh Data
        </Button>
      </div>

      {/* P2: QC Masterplan Dashboard Metrics Bar */}
      {qcData && (
        <div className="bg-background border rounded-xl p-3 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs shadow-xs">
          <div className="p-2 rounded-lg bg-muted/30 border flex flex-col justify-center">
            <span className="text-muted-foreground font-medium text-[11px]">
              Total Checkpoints
            </span>
            <span className="text-base font-bold text-foreground">
              {totalCheckpoints} Stage
            </span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex flex-col justify-center">
            <span className="text-emerald-700 dark:text-emerald-300 font-medium text-[11px]">
              Lolos (PASS)
            </span>
            <span className="text-base font-bold text-emerald-800 dark:text-emerald-200">
              {passCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 flex flex-col justify-center">
            <span className="text-red-700 dark:text-red-300 font-medium text-[11px]">
              Revisi Produksi
            </span>
            <span className="text-base font-bold text-red-800 dark:text-red-200">
              {ncrCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex flex-col justify-center">
            <span className="text-amber-700 dark:text-amber-300 font-medium text-[11px]">
              Revisi Drawing
            </span>
            <span className="text-base font-bold text-amber-800 dark:text-amber-200">
              {drCount}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 col-span-2 sm:col-span-1 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[11px] font-medium text-blue-700 dark:text-blue-300">
              <span>QC Completion</span>
              <span className="font-bold">{completionPercent}%</span>
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-900 h-2 rounded-full overflow-hidden mt-1.5">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Navigation Dropdown Selector */}
      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Tampilan:
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 gap-2 text-xs font-semibold bg-background shadow-2xs border-border hover:bg-accent cursor-pointer min-w-60 justify-between"
                >
                  <span className="flex items-center gap-2 text-foreground">
                    {activeTab === "STRUCTURE" && (
                      <>
                        <Hammer className="w-4 h-4 text-blue-500" />
                        Inspeksi Fabrikasi Struktur
                      </>
                    )}
                    {activeTab === "MECHANICAL" && (
                      <>
                        <Wrench className="w-4 h-4 text-amber-500" />
                        Inspeksi Mekanikal
                      </>
                    )}
                    {activeTab === "NCRS" && (
                      <>
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        Revisi Produksi ({allNCRs.length})
                      </>
                    )}
                    {activeTab === "DRS" && (
                      <>
                        <PauseCircle className="w-4 h-4 text-amber-500" />
                        Drawing Revision / DR ({allDRs.length})
                      </>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem
                onClick={() => setActiveTab("STRUCTURE")}
                className="text-xs font-semibold gap-2 cursor-pointer p-2.5"
              >
                <Hammer className="w-4 h-4 text-blue-500" />
                Inspeksi Fabrikasi Struktur
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("MECHANICAL")}
                className="text-xs font-semibold gap-2 cursor-pointer p-2.5"
              >
                <Wrench className="w-4 h-4 text-amber-500" />
                Inspeksi Mekanikal
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setActiveTab("NCRS")}
                className="text-xs font-semibold gap-2 cursor-pointer p-2.5"
              >
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Revisi Produksi ({allNCRs.length})
                {allNCRs.filter((n: any) => n.status !== "CLOSED").length >
                  0 && (
                  <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 ml-auto flex items-center justify-center rounded-full">
                    {allNCRs.filter((n: any) => n.status !== "CLOSED").length}
                  </Badge>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setActiveTab("DRS")}
                className="text-xs font-semibold gap-2 cursor-pointer p-2.5"
              >
                <PauseCircle className="w-4 h-4 text-amber-500" />
                Drawing Revision / DR ({allDRs.length})
                {allDRs.filter((d: any) => d.status !== "CLOSED").length >
                  0 && (
                  <Badge className="bg-amber-500/10 text-white text-[10px] px-1.5 py-0 h-4 min-w-4 ml-auto flex items-center justify-center rounded-full">
                    {allDRs.filter((d: any) => d.status !== "CLOSED").length}
                  </Badge>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm font-medium">
              Memuat data QC & Checkpoint proyek...
            </p>
          </div>
        ) : activeTab === "STRUCTURE" ? (
          /* TAB 1: INSPEKSI FABRIKASI STRUKTUR */
          <div className="space-y-6">
            {!qcData?.units || qcData.units.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold">Belum Ada Unit Pengerjaan</p>
                <p className="text-xs">
                  Unit conveyor & item produksi perlu didefinisikan di
                  Masterplan Produksi terlebih dahulu.
                </p>
              </div>
            ) : (
              qcData.units.map((unit: any) => (
                <div
                  key={unit.id}
                  className="border rounded-2xl bg-card overflow-hidden shadow-xs space-y-3"
                >
                  {/* Unit Header */}
                  <div className="bg-primary/5 p-3 px-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-foreground">
                        {unit.name}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        ({unit.volume} {unit.satuan})
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="text-sm font-semibold text-foreground flex items-center gap-2 pb-1 border-b border-border/40">
                      <Hammer className="w-4 h-4" />
                      Komponen Fabrikasi Struktur (
                      {unit.structureItems?.length || 0})
                    </div>

                    {!unit.structureItems ||
                    unit.structureItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 italic">
                        Tidak ada komponen fabrikasi struktur di unit ini.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {unit.structureItems.map((item: any, idx: number) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className="bg-muted text-foreground text-xs px-1.5"
                              >
                                {idx + 1}
                              </Badge>
                              <div>
                                <span className="font-semibold text-foreground text-sm">
                                  {item.name}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium ml-2">
                                  ({item.qty} {item.satuan})
                                </span>
                              </div>
                            </div>

                            {/* 6 Stages Dropdowns */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {[
                                "CUTTING",
                                "SETTING",
                                "WELDING",
                                "FINISHING",
                                "PAINTING",
                                "PACKAGING",
                              ].map((stg) => {
                                const status = getCheckpointStatus(
                                  unit.id,
                                  "STRUCTURE",
                                  item.id,
                                  stg,
                                );
                                const { completedQty, isDone, totalQty } =
                                  getProductionStageProgress(
                                    item,
                                    "STRUCTURE",
                                    stg,
                                  );
                                const isProductionReady =
                                  completedQty > 0 || isDone;

                                return (
                                  <StageQCSelector
                                    key={stg}
                                    stageName={stg}
                                    status={status}
                                    isProductionReady={isProductionReady}
                                    prodCompletedQty={completedQty}
                                    prodTotalQty={totalQty}
                                    onPass={() =>
                                      handleInspectPass(
                                        unit.id,
                                        unit.name,
                                        "STRUCTURE",
                                        item.id,
                                        item.name,
                                        stg,
                                      )
                                    }
                                    onReset={() =>
                                      handleInspectReset(
                                        unit.id,
                                        unit.name,
                                        "STRUCTURE",
                                        item.id,
                                        item.name,
                                        stg,
                                      )
                                    }
                                    onNCR={() =>
                                      setSelectedItemForNCR({
                                        unitId: unit.id,
                                        unitName: unit.name,
                                        itemType: "STRUCTURE",
                                        itemId: item.id,
                                        itemName: item.name,
                                        stage: stg,
                                      })
                                    }
                                    onDR={() =>
                                      setSelectedItemForDR({
                                        unitId: unit.id,
                                        unitName: unit.name,
                                        itemType: "STRUCTURE",
                                        itemId: item.id,
                                        itemName: item.name,
                                        stage: stg,
                                      })
                                    }
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "MECHANICAL" ? (
          /* TAB 2: INSPEKSI MEKANIKAL */
          <div className="space-y-6">
            {!qcData?.units || qcData.units.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold">Belum Ada Unit Pengerjaan</p>
                <p className="text-xs">
                  Unit conveyor & item produksi perlu didefinisikan di
                  Masterplan Produksi terlebih dahulu.
                </p>
              </div>
            ) : (
              qcData.units.map((unit: any) => (
                <div
                  key={unit.id}
                  className="border rounded-2xl bg-card overflow-hidden shadow-xs space-y-3"
                >
                  {/* Unit Header */}
                  <div className="bg-primary/5 p-3 px-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm text-foreground">
                        {unit.name}
                      </span>
                      <span className="text-xs text-foreground font-medium">
                        ({unit.volume} {unit.satuan})
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="text-sm font-semibold flex items-center gap-2 pb-1 border-b border-border/40">
                      <Wrench className="w-4 h-4" />
                      Komponen Mekanikal ({unit.mechanicalItems?.length || 0})
                    </div>

                    {!unit.mechanicalItems ||
                    unit.mechanicalItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground p-3 italic">
                        Tidak ada komponen mekanikal di unit ini.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2.5">
                        {unit.mechanicalItems.map((item: any, idx: number) => (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl border border-border/80 bg-background hover:border-primary/40 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <Badge
                                variant="outline"
                                className="bg-muted text-foreground-foreground text-xs px-1.5"
                              >
                                {idx + 1}
                              </Badge>
                              <div>
                                <span className="font-semibold text-foreground text-sm">
                                  {item.name}
                                </span>
                                <span className="text-xs text-muted-foreground font-medium ml-2">
                                  ({item.qty} {item.satuan})
                                </span>
                              </div>
                            </div>

                            {/* Stages Dropdowns */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {[
                                "PROCUREMENT",
                                "PO",
                                "FABRICATION",
                                "PACKAGING",
                              ].map((stg) => {
                                const status = getCheckpointStatus(
                                  unit.id,
                                  "MECHANICAL",
                                  item.id,
                                  stg,
                                );
                                const { completedQty, isDone, totalQty } =
                                  getProductionStageProgress(
                                    item,
                                    "MECHANICAL",
                                    stg,
                                  );
                                const isProductionReady =
                                  completedQty > 0 || isDone;

                                return (
                                  <StageQCSelector
                                    key={stg}
                                    stageName={stg}
                                    status={status}
                                    isProductionReady={isProductionReady}
                                    prodCompletedQty={completedQty}
                                    prodTotalQty={totalQty}
                                    onPass={() =>
                                      handleInspectPass(
                                        unit.id,
                                        unit.name,
                                        "MECHANICAL",
                                        item.id,
                                        item.name,
                                        stg,
                                      )
                                    }
                                    onReset={() =>
                                      handleInspectReset(
                                        unit.id,
                                        unit.name,
                                        "MECHANICAL",
                                        item.id,
                                        item.name,
                                        stg,
                                      )
                                    }
                                    onNCR={() =>
                                      setSelectedItemForNCR({
                                        unitId: unit.id,
                                        unitName: unit.name,
                                        itemType: "MECHANICAL",
                                        itemId: item.id,
                                        itemName: item.name,
                                        stage: stg,
                                      })
                                    }
                                    onDR={() =>
                                      setSelectedItemForDR({
                                        unitId: unit.id,
                                        unitName: unit.name,
                                        itemType: "MECHANICAL",
                                        itemId: item.id,
                                        itemName: item.name,
                                        stage: stg,
                                      })
                                    }
                                  />
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "NCRS" ? (
          /* TAB 2: NCR TRACKER LIST */
          <div className="space-y-4">
            {allNCRs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="font-semibold">
                  Tidak Ada Laporan Revisi Produksi
                </p>
                <p className="text-xs">
                  Seluruh hasil inspeksi pengerjaan produksi berjalan dengan
                  baik.
                </p>
              </div>
            ) : (
              <div className="space-y-3 divide-y border rounded-xl p-4 bg-background">
                {allNCRs.map((ncr: any) => (
                  <div key={ncr.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-red-600 text-sm">
                            {ncr.ncrNumber}
                          </span>
                          <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/30 text-xs">
                            {ncr.ncrCategory}
                          </Badge>
                          <Badge
                            className={
                              ncr.status === "OPEN"
                                ? "bg-red-500/10 text-red-700 border-red-500/30"
                                : ncr.status === "RESOLVED"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                            }
                          >
                            {ncr.status === "OPEN"
                              ? "PERLU PERBAIKAN (OPEN)"
                              : ncr.status === "RESOLVED"
                                ? "PERBAIKAN SUBMITTED (RESOLVED)"
                                : "DITUTUP (CLOSED PASS)"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Unit:{" "}
                          <span className="font-medium text-foreground">
                            {ncr.unit?.name || "-"}
                          </span>{" "}
                          | Raised by:{" "}
                          <span className="font-medium text-foreground">
                            {ncr.raisedBy}
                          </span>{" "}
                          pada {new Date(ncr.raisedAt).toLocaleString("id-ID")}
                        </p>
                      </div>

                      {/* Action Buttons based on status */}
                      <div className="flex items-center gap-2">
                        {ncr.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedNCRForResolve(ncr)}
                            className="text-xs gap-1 border-blue-500/40 text-blue-700 hover:bg-blue-500/10"
                          >
                            Input Perbaikan Produksi
                          </Button>
                        )}
                        {ncr.status === "RESOLVED" && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedNCRForClose(ncr)}
                            className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Re-Inspeksi QC
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Temuan & Perbaikan Details */}
                    <div className="bg-muted/30 p-3 rounded-lg text-xs space-y-1.5 border">
                      <p>
                        <span className="font-bold text-foreground">
                          Deskripsi Temuan QC:
                        </span>{" "}
                        {ncr.ncrDescription}
                      </p>
                      {ncr.correctiveAction && (
                        <p className="text-amber-700 dark:text-amber-300 font-medium">
                          <span className="font-bold text-foreground">
                            Tindakan Korektif Dituntut:
                          </span>{" "}
                          {ncr.correctiveAction}
                        </p>
                      )}
                      {ncr.resolvedNotes && (
                        <p className="text-blue-700 dark:text-blue-300 border-t pt-1 mt-1">
                          <span className="font-bold text-foreground">
                            Laporan Perbaikan Produksi ({ncr.resolvedBy}):
                          </span>{" "}
                          {ncr.resolvedNotes}
                        </p>
                      )}
                    </div>

                    {/* P3: Audit Trail Timeline */}
                    <div className="pt-2 flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border/40 overflow-x-auto">
                      <span className="font-semibold text-foreground shrink-0">
                        Audit Trail:
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20 px-2 py-0.5 rounded-full font-medium">
                          1. Raised: {ncr.raisedBy} (
                          {new Date(ncr.raisedAt).toLocaleDateString("id-ID")})
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            ncr.resolvedAt
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium"
                              : "opacity-40"
                          }
                        >
                          2. Perbaikan:{" "}
                          {ncr.resolvedBy
                            ? `${ncr.resolvedBy} (${new Date(ncr.resolvedAt).toLocaleDateString("id-ID")})`
                            : "Pending"}
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            ncr.closedAt
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium"
                              : "opacity-40"
                          }
                        >
                          3. Closed:{" "}
                          {ncr.closedBy
                            ? `${ncr.closedBy} (${new Date(ncr.closedAt).toLocaleDateString("id-ID")})`
                            : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* TAB 3: DRAWING REVISION (DR) LIST */
          <div className="space-y-4">
            {allDRs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border rounded-xl bg-muted/10">
                <PauseCircle className="w-10 h-10 mx-auto mb-2 text-amber-500 opacity-60" />
                <p className="font-semibold">
                  Tidak Ada Request Revisi Drawing (DR)
                </p>
                <p className="text-xs">
                  Tidak ada pengerjaan yang sedang di-hold akibat kendala
                  drawing.
                </p>
              </div>
            ) : (
              <div className="space-y-3 divide-y border rounded-xl p-4 bg-background">
                {allDRs.map((dr: any) => (
                  <div key={dr.id} className="pt-3 first:pt-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-amber-600 text-sm">
                            {dr.drNumber}
                          </span>
                          <Badge className="bg-blue-500/10 text-blue-700 border-blue-500/30 text-xs">
                            DWG Ref: {dr.drawingRef}
                          </Badge>
                          <Badge
                            className={
                              dr.status === "SUBMITTED_TO_ENG"
                                ? "bg-amber-500/10 text-amber-700 border-amber-500/30 animate-pulse"
                                : dr.status === "RESOLVED_BY_ENG"
                                  ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                                  : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                            }
                          >
                            {dr.status === "SUBMITTED_TO_ENG"
                              ? "MENUNGGU REVISI ENGINEERING"
                              : dr.status === "RESOLVED_BY_ENG"
                                ? "DRAWING REVISI TERSEDIA"
                                : "DITUTUP & UNFREEZE HOLD"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Unit:{" "}
                          <span className="font-medium text-foreground">
                            {dr.unit?.name || "-"}
                          </span>{" "}
                          | Diajukan oleh:{" "}
                          <span className="font-medium text-foreground">
                            {dr.raisedBy}
                          </span>{" "}
                          pada {new Date(dr.raisedAt).toLocaleString("id-ID")}
                        </p>
                      </div>

                      {/* Action Buttons for DR */}
                      <div className="flex items-center gap-2">
                        {dr.status === "SUBMITTED_TO_ENG" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedDRForResolve(dr)}
                            className="text-xs gap-1 border-blue-500/40 text-blue-700 hover:bg-blue-500/10"
                          >
                            Confirm Engineering Revision
                          </Button>
                        )}
                        {dr.status === "RESOLVED_BY_ENG" && (
                          <Button
                            size="sm"
                            onClick={() => setSelectedDRForClose(dr)}
                            className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Unfreeze Hold & Close DR
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Detail Kendala & Usulan */}
                    <div className="bg-muted/30 p-3 rounded-lg text-xs space-y-1.5 border">
                      <p>
                        <span className="font-bold text-foreground">
                          Kondisi Aktual Lapangan:
                        </span>{" "}
                        {dr.fieldCondition}
                      </p>
                      {dr.requestedChange && (
                        <p className="text-amber-700 dark:text-amber-300 font-medium">
                          <span className="font-bold text-foreground">
                            Usulan Perubahan Drawing:
                          </span>{" "}
                          {dr.requestedChange}
                        </p>
                      )}
                      {dr.resolvedNotes && (
                        <div className="text-blue-700 dark:text-blue-300 border-t pt-1 mt-1 space-y-1">
                          <p>
                            <span className="font-bold text-foreground">
                              Tanggapan Engineering ({dr.resolvedBy}):
                            </span>{" "}
                            {dr.resolvedNotes}
                          </p>
                          {dr.revisedDocUrl && (
                            <a
                              href={dr.revisedDocUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
                            >
                              <ExternalLink className="w-3.5 h-3.5" /> Lihat
                              Dokumen Drawing Revisi
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    {/* P3: Audit Trail Timeline for DR */}
                    <div className="pt-2 flex items-center gap-2 text-[11px] text-muted-foreground border-t border-border/40 overflow-x-auto">
                      <span className="font-semibold text-foreground shrink-0">
                        Audit Trail:
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                          1. DR Raised: {dr.raisedBy} (
                          {new Date(dr.raisedAt).toLocaleDateString("id-ID")})
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            dr.resolvedAt
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 px-2 py-0.5 rounded-full font-medium"
                              : "opacity-40"
                          }
                        >
                          2. Revisi Engineering:{" "}
                          {dr.resolvedBy
                            ? `${dr.resolvedBy} (${new Date(dr.resolvedAt).toLocaleDateString("id-ID")})`
                            : "Pending"}
                        </span>
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span
                          className={
                            dr.closedAt
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium"
                              : "opacity-40"
                          }
                        >
                          3. Unfreeze & Closed:{" "}
                          {dr.closedBy
                            ? `${dr.closedBy} (${new Date(dr.closedAt).toLocaleDateString("id-ID")})`
                            : "Pending"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* DIALOG 1: FORM RAISE NCR */}
      {selectedItemForNCR && (
        <Dialog
          open={!!selectedItemForNCR}
          onOpenChange={() => setSelectedItemForNCR(null)}
        >
          <DialogContent className="max-w-xl!">
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Terbitkan Laporan Revisi Produksi
              </DialogTitle>
              <DialogDescription className="text-xs">
                Item:{" "}
                <span className="font-semibold text-foreground">
                  {selectedItemForNCR.itemName}
                </span>{" "}
                ({selectedItemForNCR.stage})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Kategori Ketidaksesuaian
                </Label>
                <Select
                  value={ncrCategory}
                  onValueChange={(val) => val && setNcrCategory(val)}
                >
                  <SelectTrigger className="text-xs h-9 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="min-w-85 sm:min-w-100"
                  >
                    <SelectItem value="DIMENSI">
                      Dimensi / Ukuran Tidak Sesuai Drawing
                    </SelectItem>
                    <SelectItem value="WELD_QUALITY">
                      Kualitas Las (Weld Size / Defect)
                    </SelectItem>
                    <SelectItem value="MATERIAL">
                      Spesifikasi Material Salah
                    </SelectItem>
                    <SelectItem value="ASSEMBLY">
                      Kesalahan Perakitan / Fit-up
                    </SelectItem>
                    <SelectItem value="PAINTING">
                      Cat / Surface Finishing Cacat
                    </SelectItem>
                    <SelectItem value="OTHER">Lainnya</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Deskripsi Temuan Kesalahan *
                </Label>
                <Textarea
                  placeholder="Jelaskan detail ketidaksesuaian hasil inspeksi..."
                  value={ncrDescription}
                  onChange={(e) => setNcrDescription(e.target.value)}
                  className="text-xs min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Tindakan Korektif Yang Diminta
                </Label>
                <Textarea
                  placeholder="Misal: Lakukan gerinda ulang, stel ulang fit-up, atau perbaiki sambungan las..."
                  value={correctiveAction}
                  onChange={(e) => setCorrectiveAction(e.target.value)}
                  className="text-xs min-h-16"
                />
              </div>

              <div className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Progress tahap [{selectedItemForNCR.stage}] otomatis di-reset
                  ke 0% (Wajib Dikerjakan Ulang)
                </span>
              </div>

              <div className="space-y-1.5 pt-1">
                <Label className="text-xs font-semibold">Inspector QC</Label>
                <Input
                  value={raisedBy}
                  onChange={(e) => setRaisedBy(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItemForNCR(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleCreateNCR}
                disabled={isPending}
                className="gap-1.5 cursor-pointer"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Konfirmasi Revisi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG 2: FORM RAISE DR (DRAWING REVISION REQUEST) */}
      {selectedItemForDR && (
        <Dialog
          open={!!selectedItemForDR}
          onOpenChange={() => setSelectedItemForDR(null)}
        >
          <DialogContent className="max-w-xl!">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-amber-600 flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-600" />
                Request Revisi Drawing (DR)
              </DialogTitle>
              <DialogDescription className="text-xs">
                Item:{" "}
                <span className="font-bold text-foreground">
                  {selectedItemForDR.itemName}
                </span>{" "}
                ({selectedItemForDR.stage}). Pekerjaan akan di-hold hingga
                Engineering merilis drawing revisi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Nomor / Kode Drawing Referensi *
                </Label>
                <Input
                  placeholder="Misal: DWG-STR-004 Rev.1"
                  value={drawingRef}
                  onChange={(e) => setDrawingRef(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Kondisi Lapangan / Kendala *
                </Label>
                <Textarea
                  placeholder="Misal: Bentrok dengan kolom eksisting, dimensi elevasi berbeda 50mm..."
                  value={fieldCondition}
                  onChange={(e) => setFieldCondition(e.target.value)}
                  className="text-xs min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Usulan Perubahan ke Engineering
                </Label>
                <Textarea
                  placeholder="Misal: Geser lubang baut 30mm ke kanan atau potong flange 20mm..."
                  value={requestedChange}
                  onChange={(e) => setRequestedChange(e.target.value)}
                  className="text-xs min-h-16"
                />
              </div>

              <div className="space-y-1.5 pt-1 border-t">
                <Label className="text-xs font-semibold">
                  Pemohon (QC / Produksi)
                </Label>
                <Input
                  value={raisedBy}
                  onChange={(e) => setRaisedBy(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedItemForDR(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleCreateDR}
                disabled={isPending}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kirim Request ke Engineering
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG 3: FORM SUBMIT PERBAIKAN PRODUKSI (NCR) */}
      {selectedNCRForResolve && (
        <Dialog
          open={!!selectedNCRForResolve}
          onOpenChange={() => setSelectedNCRForResolve(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-blue-600 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-blue-600" />
                Lapor Perbaikan Revisi Produksi (
                {selectedNCRForResolve.ncrNumber})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Laporkan tindakan perbaikan yang telah diselesaikan oleh tim
                produksi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 border">
                <p>
                  <span className="font-bold">Temuan QC:</span>{" "}
                  {selectedNCRForResolve.ncrDescription}
                </p>
                {selectedNCRForResolve.correctiveAction && (
                  <p className="text-amber-700 font-medium">
                    <span className="font-bold">Tindakan Diminta:</span>{" "}
                    {selectedNCRForResolve.correctiveAction}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Rincian Perbaikan Yang Telah Dilakukan *
                </Label>
                <Textarea
                  placeholder="Jelaskan perbaikan yang sudah diselesaikan..."
                  value={resolvedNotes}
                  onChange={(e) => setResolvedNotes(e.target.value)}
                  className="text-xs min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Penanggung Jawab Produksi
                </Label>
                <Input
                  value={resolvedBy}
                  onChange={(e) => setResolvedBy(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedNCRForResolve(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleSubmitResolution}
                disabled={isPending}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Kirim Laporan Perbaikan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG 4: RE-INSPEKSI QC (CLOSE / RE-OPEN NCR) */}
      {selectedNCRForClose && (
        <Dialog
          open={!!selectedNCRForClose}
          onOpenChange={() => setSelectedNCRForClose(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Re-Inspeksi QC ({selectedNCRForClose.ncrNumber})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Periksa kembali hasil perbaikan yang telah dilaporkan tim
                produksi.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 border">
                <p>
                  <span className="font-bold">
                    Laporan Perbaikan Produksi ({selectedNCRForClose.resolvedBy}
                    ):
                  </span>
                </p>
                <p className="text-blue-700 font-medium">
                  {selectedNCRForClose.resolvedNotes}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Catatan Re-Inspeksi QC
                </Label>
                <Textarea
                  placeholder="Misal: Perbaikan sesuai spesifikasi, hasil las sudah baik..."
                  value={closedNotes}
                  onChange={(e) => setClosedNotes(e.target.value)}
                  className="text-xs min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Inspector QC</Label>
                <Input
                  value={closedBy}
                  onChange={(e) => setClosedBy(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCloseNCR(false)}
                disabled={isPending}
                className="border-red-500/40 text-red-600 hover:bg-red-500/10 text-xs"
              >
                Tolak & Re-Open
              </Button>
              <Button
                size="sm"
                onClick={() => handleCloseNCR(true)}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 cursor-pointer"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Setujui & Tutup Revisi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG 5: ENGINEERING CONFIRM REVISED DRAWING (RESOLVE DR) */}
      {selectedDRForResolve && (
        <Dialog
          open={!!selectedDRForResolve}
          onOpenChange={() => setSelectedDRForResolve(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-blue-600 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Upload Revisi Drawing ({selectedDRForResolve.drNumber})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Masukkan rincian gambar revisi baru dari Tim Engineering.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 border">
                <p>
                  <span className="font-bold">Kondisi Lapangan:</span>{" "}
                  {selectedDRForResolve.fieldCondition}
                </p>
                {selectedDRForResolve.requestedChange && (
                  <p className="text-amber-700 font-medium">
                    <span className="font-bold">Usulan Perubahan:</span>{" "}
                    {selectedDRForResolve.requestedChange}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  URL / Link Dokumen Drawing Baru
                </Label>
                <Input
                  placeholder="https://drive.google.com/... atau link dokumen revisi"
                  value={revisedDocUrl}
                  onChange={(e) => setRevisedDocUrl(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Catatan Engineering *
                </Label>
                <Textarea
                  placeholder="Jelaskan perubahan revisi drawing (misal: Dimensi flange diubah dari 200mm ke 180mm)..."
                  value={drResolvedNotes}
                  onChange={(e) => setDrResolvedNotes(e.target.value)}
                  className="text-xs min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Drafter / Engineer
                </Label>
                <Input
                  value={drResolvedBy}
                  onChange={(e) => setDrResolvedBy(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDRForResolve(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleResolveDR}
                disabled={isPending}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Konfirmasi Gambar Revisi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* DIALOG 6: UNFREEZE HOLD & CLOSE DR */}
      {selectedDRForClose && (
        <Dialog
          open={!!selectedDRForClose}
          onOpenChange={() => setSelectedDRForClose(null)}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Verifikasi Drawing & Unfreeze Hold (
                {selectedDRForClose.drNumber})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Gambar revisi telah disiapkan oleh Engineering. Melepas status
                Hold sehingga pengerjaan produksi dapat dilanjutkan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1 border">
                <p>
                  <span className="font-bold">
                    Tanggapan Engineering ({selectedDRForClose.resolvedBy}):
                  </span>
                </p>
                <p className="text-blue-700 font-medium">
                  {selectedDRForClose.resolvedNotes}
                </p>
                {selectedDRForClose.revisedDocUrl && (
                  <a
                    href={selectedDRForClose.revisedDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-bold mt-1"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Buka Gambar Revisi
                    Baru
                  </a>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Catatan Verifikasi
                </Label>
                <Textarea
                  placeholder="Misal: Drawing Rev.2 telah diterima di bengkel, pengerjaan dilanjutkan..."
                  value={drClosedNotes}
                  onChange={(e) => setDrClosedNotes(e.target.value)}
                  className="text-xs min-h-20"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Inspector / Team Leader
                </Label>
                <Input
                  value={drClosedBy}
                  onChange={(e) => setDrClosedBy(e.target.value)}
                  className="text-xs h-8"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDRForClose(null)}
                disabled={isPending}
              >
                Batal
              </Button>
              <Button
                size="sm"
                onClick={handleCloseDR}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lepas Hold & Tutup DR
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export interface NCRManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  projectNumber?: string;
}

export function NCRManagerDialog({
  isOpen,
  onOpenChange,
  projectId,
  projectName,
  projectNumber,
}: NCRManagerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl! max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="p-4 overflow-y-auto max-h-[85vh]">
          <QCNCRManagerPanel
            projectId={projectId}
            projectName={projectName}
            projectNumber={projectNumber}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
