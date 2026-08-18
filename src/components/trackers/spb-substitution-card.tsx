"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { updateSPBItemSubstitution } from "@/app/actions/spb";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SPBSubstitutionCardProps {
  item: {
    id: string;
    name: string;
    code?: string | null;
    typeMerk?: string | null;
    hasSubstitution?: boolean;
    substitutionStatus?: string | null;
    originalName?: string | null;
    originalCode?: string | null;
    originalTypeMerk?: string | null;
    originalPrice?: number | string | null;
    substitutedName?: string | null;
    substitutedCode?: string | null;
    substitutedTypeMerk?: string | null;
    substitutedPrice?: number | string | null;
    substitutionReason?: string | null;
    approvalEngineering?: string | null;
    approvalPpic?: string | null;
    approvalPm?: string | null;
    material?: {
      code?: string | null;
      unitPrice?: number | string | null;
    } | null;
    substitutedMaterial?: {
      code?: string | null;
    } | null;
  };
  onUpdated?: () => void;
  compact?: boolean;
  index?: number;
}

export function SPBSubstitutionCard({
  item,
  onUpdated,
  compact = false,
}: SPBSubstitutionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<{
    stage: "ENGINEERING" | "PPIC" | "PM";
    action: "APPROVE" | "REJECT";
  } | null>(null);

  const router = useRouter();

  if (!item.hasSubstitution) return null;

  const status = (
    item.substitutionStatus || "PENDING_ENGINEERING"
  ).toUpperCase();
  const engStatus = (item.approvalEngineering || "NONE").toUpperCase();
  const ppicStatus = (item.approvalPpic || "NONE").toUpperCase();
  const pmStatus = (item.approvalPm || "NONE").toUpperCase();

  const handleApproveReject = async () => {
    if (!confirmTarget) return;
    const { stage, action } = confirmTarget;
    setConfirmTarget(null);
    setIsSubmitting(true);

    const actionText = action === "APPROVE" ? "Menyetujui" : "Menolak";
    const toastId = toast.loading(
      `Memproses ${actionText.toLowerCase()} pengajuan substitusi...`,
    );

    try {
      const res = await updateSPBItemSubstitution({
        spbItemId: item.id,
        stage,
        action,
      });

      if (res.success) {
        toast.success(
          res.message ||
            `Berhasil ${action === "APPROVE" ? "menyetujui" : "menolak"} pengajuan.`,
          { id: toastId },
        );
        if (onUpdated) onUpdated();
        router.refresh();
      } else {
        toast.error(res.error || "Gagal memperbarui status persetujuan.", {
          id: toastId,
        });
      }
    } catch (err: any) {
      toast.error(
        err?.message || "Terjadi kesalahan saat memproses approval.",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = () => {
    if (status === "APPROVED") {
      return (
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/30 text-[10px] font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
        >
          <CheckCircle2 className="w-3 h-3 text-primary" />
          Substitusi Disetujui (ACC 3 Pintu)
        </Badge>
      );
    }
    if (status === "REJECTED") {
      return (
        <Badge
          variant="outline"
          className="bg-muted/40 text-muted-foreground border-border text-[10px] font-medium px-2.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
        >
          <XCircle className="w-3 h-3 text-muted-foreground" />
          Substitusi Ditolak
        </Badge>
      );
    }
    if (status === "PENDING_ENGINEERING") {
      return (
        <Badge
          variant="outline"
          className="bg-primary/5 text-primary border-primary/30 text-[10px] font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
        >
          <Clock className="w-3 h-3 text-primary animate-pulse" />
          Menunggu Approval Engineering
        </Badge>
      );
    }
    if (status === "PENDING_PPIC") {
      return (
        <Badge
          variant="outline"
          className="bg-muted/40 text-foreground border-border text-[10px] font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
        >
          <Clock className="w-3 h-3 text-primary animate-pulse" />
          Menunggu Approval PPIC
        </Badge>
      );
    }
    if (status === "PENDING_PM") {
      return (
        <Badge
          variant="outline"
          className="bg-muted/40 text-foreground border-border text-[10px] font-semibold px-2.5 py-0.5 rounded-md flex items-center gap-1 shrink-0"
        >
          <Clock className="w-3 h-3 text-primary animate-pulse" />
          Menunggu Approval PM
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-muted/40 text-muted-foreground border-border text-[10px] font-medium px-2.5 py-0.5 rounded-md shrink-0"
      >
        Substitusi Pending
      </Badge>
    );
  };

  const renderStageBadge = (stageName: string, stageStatus: string) => {
    if (stageStatus === "APPROVED") {
      return (
        <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> {stageName}: ACC
        </span>
      );
    }
    if (stageStatus === "REJECTED") {
      return (
        <span className="text-[11px] font-medium text-muted-foreground line-through flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5 text-muted-foreground" /> {stageName}:
          Tolak
        </span>
      );
    }
    if (stageStatus === "PENDING") {
      return (
        <span className="text-[11px] font-bold text-foreground underline underline-offset-4 decoration-primary flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-primary animate-pulse" />{" "}
          {stageName}: Menunggu
        </span>
      );
    }
    return (
      <span className="text-[11px] text-muted-foreground">{stageName}: -</span>
    );
  };

  const origCode =
    item.originalCode || item.material?.code || item.code || null;
  const origPrice = item.originalPrice ?? item.material?.unitPrice ?? null;
  const subCode =
    item.substitutedCode || item.substitutedMaterial?.code || null;

  return (
    <div className="mt-1.5 w-full">
      <div className="flex items-center gap-2 flex-wrap justify-between">
        <div className="flex items-center gap-2">{getStatusBadge()}</div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer transition-colors"
        >
          {isOpen ? (
            <>
              Tutup Detail <ChevronUp className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Lihat Detail & Persetujuan <ChevronDown className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="mt-2.5 p-4 bg-muted/20 border border-border/50 rounded-xl space-y-3.5 text-xs animate-in fade-in duration-150">
          {/* Comparison Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-background p-3.5 rounded-lg border border-border/40">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground block">
                Barang Awal (Original)
              </span>
              <p className="font-semibold text-foreground text-xs">
                {item.originalName || item.name}
              </p>
              {origCode && (
                <p className="text-[11px] text-muted-foreground">
                  Kode: {origCode}
                </p>
              )}
              {item.originalTypeMerk && (
                <p className="text-[11px] text-muted-foreground">
                  Merk/Type: {item.originalTypeMerk}
                </p>
              )}
              {origPrice !== undefined && origPrice !== null && (
                <p className="text-[11px] text-muted-foreground">
                  Harga: Rp {Number(origPrice).toLocaleString("id-ID")}
                </p>
              )}
            </div>

            <div className="space-y-1 sm:border-l sm:border-border/30 sm:pl-4">
              <span className="text-xs font-semibold text-primary flex items-center gap-1">
                Barang Pengganti (Substitusi){" "}
                <ArrowRight className="w-3.5 h-3.5 text-primary" />
              </span>
              <p className="font-semibold text-foreground text-xs">
                {item.substitutedName || "-"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Kode: {subCode || "-"}
              </p>
              {item.substitutedTypeMerk && (
                <p className="text-[11px] text-muted-foreground">
                  Merk/Type: {item.substitutedTypeMerk}
                </p>
              )}
              {item.substitutedPrice !== undefined &&
                item.substitutedPrice !== null && (
                  <p className="text-[11px] text-muted-foreground">
                    Harga: Rp{" "}
                    {Number(item.substitutedPrice).toLocaleString("id-ID")}
                  </p>
                )}
            </div>
          </div>

          {item.substitutionReason && (
            <div className="p-2.5 bg-background border border-border/40 rounded-lg text-foreground text-[11px]">
              <span className="font-semibold text-muted-foreground">
                Alasan Pengajuan:{" "}
              </span>
              <span className="font-medium text-foreground">
                {item.substitutionReason}
              </span>
            </div>
          )}

          {/* Stepper Status (Simplifed) */}
          <div className="flex items-center gap-3 flex-wrap bg-background p-2.5 rounded-lg border border-border/40">
            {renderStageBadge("1. Engineering", engStatus)}
            <span className="text-muted-foreground/60 text-xs">•</span>
            {renderStageBadge("2. PPIC", ppicStatus)}
            <span className="text-muted-foreground/60 text-xs">•</span>
            {renderStageBadge("3. PM", pmStatus)}
          </div>

          {/* Interactive Action Buttons (Bottom-Right) */}
          <div className="pt-2 border-t border-border/30 flex items-center justify-end gap-2.5 flex-wrap">
            {status === "PENDING_ENGINEERING" && (
              <>
                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() =>
                    setConfirmTarget({
                      stage: "ENGINEERING",
                      action: "APPROVE",
                    })
                  }
                  className="h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Disetujui (ACC)"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() =>
                    setConfirmTarget({ stage: "ENGINEERING", action: "REJECT" })
                  }
                  className="h-8 px-3.5 text-xs font-medium text-foreground border-border hover:bg-muted rounded-lg cursor-pointer transition-all"
                >
                  Tolak
                </Button>
              </>
            )}

            {status === "PENDING_PPIC" && (
              <>
                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() =>
                    setConfirmTarget({ stage: "PPIC", action: "APPROVE" })
                  }
                  className="h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Disetujui (ACC PPIC)"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() =>
                    setConfirmTarget({ stage: "PPIC", action: "REJECT" })
                  }
                  className="h-8 px-3.5 text-xs font-medium text-foreground border-border hover:bg-muted rounded-lg cursor-pointer transition-all"
                >
                  Tolak
                </Button>
              </>
            )}

            {status === "PENDING_PM" && (
              <>
                <Button
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() =>
                    setConfirmTarget({ stage: "PM", action: "APPROVE" })
                  }
                  className="h-8 px-4 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg cursor-pointer transition-all"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Disetujui (ACC PM Final)"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isSubmitting}
                  onClick={() =>
                    setConfirmTarget({ stage: "PM", action: "REJECT" })
                  }
                  className="h-8 px-3.5 text-xs font-medium text-foreground border-border hover:bg-muted rounded-lg cursor-pointer transition-all"
                >
                  Tolak
                </Button>
              </>
            )}

            {status === "APPROVED" && (
              <div className="text-[11px] font-medium text-primary flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                Substitusi telah disetujui penuh oleh Engineering, PPIC & PM.
              </div>
            )}

            {status === "REJECTED" && (
              <div className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-muted-foreground" />
                Substitusi ditolak. Item kembali ke spesifikasi barang awal.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <Dialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
      >
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-xs rounded-2xl p-5 space-y-3"
        >
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              {confirmTarget?.action === "APPROVE" ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />{" "}
                  Konfirmasi Setuju
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-destructive shrink-0" />{" "}
                  Konfirmasi Tolak
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              {confirmTarget?.action === "APPROVE"
                ? `Apakah Anda yakin ingin menyetujui pengajuan barang pengganti "${item.substitutedName || "Substitusi"}"?`
                : `Apakah Anda yakin ingin menolak pengajuan barang pengganti ini? Status item akan dikembalikan.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => setConfirmTarget(null)}
              className="h-8 text-xs px-3 rounded-lg cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleApproveReject}
              className={cn(
                "h-8 text-xs px-4 font-semibold rounded-lg text-primary-foreground cursor-pointer transition-all",
                confirmTarget?.action === "APPROVE"
                  ? "bg-primary hover:bg-primary/90"
                  : "bg-destructive hover:bg-destructive/90",
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : confirmTarget?.action === "APPROVE" ? (
                "Ya, Setujui"
              ) : (
                "Ya, Tolak"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
