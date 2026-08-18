"use client";

import React, { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Calendar,
  Wrench,
  Send,
  Loader2,
  FileText,
  ShieldAlert,
  PenTool,
  ExternalLink,
  PauseCircle,
} from "lucide-react";
import { submitNCRResolution } from "@/app/actions/qc";
import { DocumentManagerDialog } from "@/components/document-manager-dialog";
import { cn } from "@/lib/utils";
import { formatJakartaDate } from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import { FolderOpen } from "lucide-react";

interface QCRevisionDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  revision: any;
  projectId?: string;
  leadId?: string;
  itemType?: "STRUCTURE" | "MECHANICAL";
  itemName?: string;
  stageName?: string;
  unitName?: string;
  onSuccess?: () => void;
}

export function QCRevisionDetailDialog({
  open,
  onOpenChange,
  revision,
  projectId,
  leadId,
  itemType = "STRUCTURE",
  itemName = "Komponen",
  stageName = "TAHAP",
  unitName = "Unit",
  onSuccess,
}: QCRevisionDetailDialogProps) {
  const router = useRouter();
  const [resolvedNotes, setResolvedNotes] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!revision) return null;

  const targetProjectId =
    projectId ||
    revision.projectId ||
    revision.checkpoint?.projectId ||
    revision.unit?.projectId;

  const isDR =
    revision.revisionType === "DRAWING_REVISION" ||
    revision.revisionType === "DR" ||
    Boolean(revision.drNumber) ||
    Boolean(revision.ncrNumber?.startsWith("DR/")) ||
    revision.status === "ON_HOLD" ||
    revision.ncrDescription?.toUpperCase().includes("DRAWING REVISION") ||
    revision.fieldCondition?.toUpperCase().includes("DRAWING REVISION") ||
    revision.notes?.toUpperCase().includes("DRAWING REVISION");

  const isEngResolved =
    revision.status === "RESOLVED_BY_ENG" ||
    revision.status === "RESOLVED" ||
    revision.status === "CLOSED" ||
    Boolean(revision.revisedDocUrl) ||
    Boolean(revision.resolvedNotes);

  const isResolved =
    revision.status === "RESOLVED" || revision.status === "CLOSED";

  const canProductionAct = !isDR || isEngResolved;

  const handleSubmitResolution = () => {
    if (!canProductionAct) {
      toast.error(
        "Revisi drawing belum diselesaikan oleh tim Engineering. Mohon tunggu tim Engineering merilis gambar kerja terbaru.",
      );
      return;
    }

    if (!resolvedNotes.trim()) {
      toast.error("Mohon isi catatan tindakan perbaikan yang telah dilakukan.");
      return;
    }

    startTransition(async () => {
      const res = await submitNCRResolution({
        ncrId: revision.id,
        resolvedNotes,
        resolvedBy: "Tim Produksi",
      });

      if (res.success) {
        toast.success("Perbaikan berhasil dilaporkan ke QC untuk re-inspeksi!");
        onOpenChange(false);
        setResolvedNotes("");
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal melaporkan perbaikan ke QC");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl! rounded-2xl p-5 border border-border shadow-xl">
        <DialogHeader className="space-y-1.5 border-b border-border/60 pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "font-bold text-[11px] px-2.5 py-0.5 flex items-center gap-1.5",
                isDR
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-300"
                  : "bg-rose-500/10 text-rose-600 border-rose-300",
              )}
            >
              {isDR ? (
                <PenTool className="w-3.5 h-3.5 text-amber-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
              )}
              <span>
                {revision.drNumber ||
                  revision.ncrNumber ||
                  (isDR ? "Request Revisi Drawing" : "Laporan Revisi Produksi")}
              </span>
            </Badge>

            <Badge
              variant="outline"
              className={cn(
                "font-bold text-[10px] px-2 py-0.5",
                isDR
                  ? !isEngResolved
                    ? "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400 animate-pulse"
                    : "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-300"
                  : isResolved
                    ? "bg-amber-500/10 text-amber-600 border-amber-300"
                    : "bg-rose-500/10 text-rose-600 border-rose-300 animate-pulse",
              )}
            >
              {isDR
                ? !isEngResolved
                  ? "ON HOLD (Menunggu Revisi Engineering)"
                  : "Gambar Revisi Rilis (Siap Diperbaiki)"
                : isResolved
                  ? "Menunggu Re-inspeksi QC"
                  : "Membutuhkan Perbaikan Produksi"}
            </Badge>
          </div>

          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              {itemName}
            </DialogTitle>
            <DialogDescription className="text-[11px] text-muted-foreground font-medium mt-0.5">
              {unitName} • Tahap:{" "}
              <span className="font-bold text-foreground">{stageName}</span>
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {/* Metadata Strip Line */}
          <div className="flex items-center justify-between gap-2 text-[11px] bg-muted/40 px-3 py-2 rounded-xl border border-border/50 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Jenis:</span>
              <span
                className={cn(
                  "font-bold uppercase",
                  isDR ? "text-amber-700 dark:text-amber-300" : "text-rose-600",
                )}
              >
                {isDR ? "Revisi Drawing" : "Revisi Produksi"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Oleh:</span>
              <span className="font-semibold text-foreground">
                {revision.raisedBy || "QC Inspector"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Tgl:</span>
              <span className="font-semibold text-foreground">
                {revision.raisedAt ? formatJakartaDate(revision.raisedAt) : "-"}
              </span>
            </div>
            {revision.resetStage && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Tahap:</span>
                <span className="font-bold text-rose-600">
                  {revision.resetStage}
                </span>
              </div>
            )}
          </div>

          {/* Warning Banner if Engineering hasn't resolved DR yet */}
          {isDR && !isEngResolved && (
            <div className="p-3 rounded-xl border border-amber-300/80 bg-amber-500/10 space-y-1 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 text-[11px]">
                <PauseCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Menunggu Tindakan Tim Engineering</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90 pl-5">
                Komponen ini di-<strong>HOLD</strong> karena membutuhkan revisi
                gambar kerja dari Engineering. Tim Produksi{" "}
                <strong>belum bisa menindaklanjuti perbaikan</strong> sampai tim
                Engineering merilis gambar kerja terbaru.
              </p>
            </div>
          )}

          {/* Engineering Release Info Card if DR resolved by Engineering */}
          {isDR && isEngResolved && (
            <div className="p-3 rounded-xl border border-blue-200/80 bg-blue-500/5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-blue-600" />
                  Catatan Gambar Revisi Dari Engineering:
                </span>
                {revision.resolvedBy && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {revision.resolvedBy}
                  </span>
                )}
              </div>
              <p className="text-foreground font-medium text-[11px] pl-5 wrap-break-word">
                {revision.resolvedNotes ||
                  "Gambar kerja telah disesuaikan oleh tim Engineering."}
              </p>

              {/* Action Buttons: Document Hub (Drawing) & Direct Link */}
              <div className="pt-1 pl-5 flex items-center gap-2 flex-wrap">
                {targetProjectId && (
                  <DocumentManagerDialog
                    categories={["DRAWING"]}
                    defaultCategory="DRAWING"
                    ownerId={targetProjectId}
                    ownerType="PROJECT"
                    leadId={leadId || revision.leadId}
                    globalDriveUrl={revision.globalDriveUrl}
                    onUploadSuccess={() => router.refresh()}
                    trigger={
                      <Button
                        variant="outline"
                        size="xs"
                        type="button"
                        className="h-7 px-2.5 text-[11px] font-bold gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 border-blue-300/80 cursor-pointer shadow-2xs rounded-lg"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Buka Document Hub (Drawing Revisi)</span>
                      </Button>
                    }
                  />
                )}

                {revision.revisedDocUrl && (
                  <a
                    href={revision.revisedDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-300/80 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                    <span>Buka Direct Link File</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Unified Findings Card */}
          <div className="rounded-xl border border-border/70 overflow-hidden bg-card text-[11px] divide-y divide-border/40">
            <div
              className={cn(
                "p-2.5 space-y-0.5",
                isDR ? "bg-amber-500/5" : "bg-rose-500/5",
              )}
            >
              <span
                className={cn(
                  "font-bold flex items-center gap-1 text-[11px]",
                  isDR
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-rose-700 dark:text-rose-400",
                )}
              >
                {isDR ? (
                  <PenTool className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                )}
                {isDR ? "Detail Revisi Drawing:" : "Temuan Defect (QC):"}
              </span>
              <p className="text-foreground font-medium pl-4.5 wrap-break-word">
                {revision.ncrDescription ||
                  revision.fieldCondition ||
                  "Tidak ada rincian temuan."}
              </p>
            </div>

            {revision.correctiveAction && (
              <div className="p-2.5 bg-blue-500/5 space-y-0.5">
                <span className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1 text-[11px]">
                  <Wrench className="w-3.5 h-3.5 text-blue-500" />
                  Rekomendasi Perbaikan:
                </span>
                <p className="text-foreground font-medium pl-4.5 wrap-break-word">
                  {revision.correctiveAction}
                </p>
              </div>
            )}
          </div>

          {/* Jika sudah di-submit perbaikan oleh produksi */}
          {isResolved && revision.resolvedNotes && (
            <div className="p-2.5 rounded-xl border border-emerald-200/70 bg-emerald-500/5 space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Laporan Perbaikan Lapangan:
                </span>
                <span className="text-[10px] text-muted-foreground italic">
                  {revision.resolvedBy} •{" "}
                  {revision.resolvedAt
                    ? formatJakartaDate(revision.resolvedAt)
                    : "-"}
                </span>
              </div>
              <p className="text-foreground font-medium pl-4.5 wrap-break-word">
                {revision.resolvedNotes}
              </p>
            </div>
          )}

          {/* Input Form Perbaikan jika belum diselesaikan produksi */}
          {!isResolved && (
            <div className="space-y-1 pt-1">
              <Label className="text-[11px] font-bold text-foreground flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-amber-500" />
                Input Tindakan Perbaikan Lapangan:
              </Label>
              <Textarea
                placeholder={
                  !canProductionAct
                    ? "Menunggu tim Engineering menindaklanjuti dan merilis gambar kerja revisi..."
                    : "Jelaskan tindakan perbaikan yang telah dilakukan..."
                }
                disabled={!canProductionAct}
                className="text-[11px] rounded-lg h-16 min-h-16 p-2 bg-muted/20 focus:bg-background transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                value={resolvedNotes}
                onChange={(e) => setResolvedNotes(e.target.value)}
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-1.5 border-t border-border/60 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg h-8 text-xs font-bold px-3 cursor-pointer"
          >
            Tutup
          </Button>
          {!isResolved && (
            <Button
              size="sm"
              onClick={handleSubmitResolution}
              disabled={isPending || !canProductionAct}
              className={cn(
                "rounded-lg h-8 text-xs font-bold gap-1.5 px-3 shadow-xs transition-all",
                !canProductionAct
                  ? "bg-muted text-muted-foreground cursor-not-allowed border border-border"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer",
              )}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Mengirimkan...
                </>
              ) : !canProductionAct ? (
                <>
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Menunggu Gambar Revisi Engineering</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Selesai Perbaiki & Ajukan QC Ulang</span>
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
