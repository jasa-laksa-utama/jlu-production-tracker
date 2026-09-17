"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Calendar,
  Building,
  Loader2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { formatJakartaDate } from "@/lib/date-utils";
import { formatRupiah, cn } from "@/lib/utils";
import {
  approveOfficeSPB,
  rejectOfficeSPB,
  completeOfficeSPB,
} from "@/app/actions/office-procurement";

interface OfficeSPBDetailDialogProps {
  spb: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function OfficeSPBDetailDialog({
  spb,
  open,
  onOpenChange,
  onSuccess,
}: OfficeSPBDetailDialogProps) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!spb) return null;

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      const res = await approveOfficeSPB(spb.id);
      if (!res.success) throw new Error(res.error);
      toast.success(res.message || "SPB Umum berhasil disetujui.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyetujui SPB.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Harap isi alasan penolakan.");
      return;
    }

    setIsProcessing(true);
    try {
      const res = await rejectOfficeSPB(spb.id, rejectReason.trim());
      if (!res.success) throw new Error(res.error);
      toast.success(res.message || "SPB Umum telah ditolak.");
      setIsRejecting(false);
      setRejectReason("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Gagal menolak SPB.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComplete = async () => {
    setIsProcessing(true);
    try {
      const res = await completeOfficeSPB(spb.id);
      if (!res.success) throw new Error(res.error);
      toast.success(res.message || "SPB Umum telah diselesaikan.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyelesaikan SPB.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs font-bold gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Disetujui
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs font-bold gap-1">
            <XCircle className="w-3.5 h-3.5" />
            Ditolak
          </Badge>
        );
      case "COMPLETED":
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30 text-xs font-bold gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Selesai Dibeli
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs font-bold gap-1">
            <Clock className="w-3.5 h-3.5" />
            Menunggu Persetujuan
          </Badge>
        );
    }
  };

  const items: any[] = spb.items || [];
  const totalAmount = items.reduce(
    (sum, it) => sum + (Number(it.subtotal) || Number(it.qty) * Number(it.estimatedPrice) || 0),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl overflow-hidden print:p-0 print:border-none print:shadow-none">
        {/* HEADER */}
        <DialogHeader className="border-b pb-3.5 flex flex-row items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {spb.spbNumber}
                </DialogTitle>
                {getStatusBadge(spb.status)}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Surat Permintaan Barang Umum & Operasional Kantor Non-Proyek
              </DialogDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-8 text-xs font-semibold gap-1.5 rounded-lg border-border/80 hover:bg-muted cursor-pointer shrink-0 print:hidden"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak SPB
          </Button>
        </DialogHeader>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/20 rounded-xl border border-border/60 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Departemen / Divisi:</span>
                <strong className="text-foreground font-semibold">
                  {spb.department || "Umum & GA"}
                </strong>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Pemohon (Maker):</span>
                <strong className="text-foreground font-semibold">
                  {spb.makerName || "Admin Kantor"}
                </strong>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Tanggal Pengajuan:</span>
                <strong className="text-foreground font-semibold">
                  {formatJakartaDate(spb.date || spb.createdAt, "date")}
                </strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Target Kebutuhan:</span>
                <strong className="text-foreground font-semibold">
                  {spb.requiredDate
                    ? formatJakartaDate(spb.requiredDate, "date")
                    : "Segera"}
                </strong>
              </div>
              {spb.officeBoq && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Layers className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Rujukan BOQ:</span>
                  <span className="font-semibold text-primary font-mono text-[11px]">
                    {spb.officeBoq.boqNumber}
                  </span>
                </div>
              )}
              {spb.approvedBy && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Disetujui oleh:</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    {spb.approvedBy}{" "}
                    {spb.approvedAt && `(${formatJakartaDate(spb.approvedAt, "date")})`}
                  </strong>
                </div>
              )}
            </div>

            <div className="sm:col-span-2 pt-1 border-t border-border/50">
              <span className="text-muted-foreground font-semibold block mb-0.5">
                Keperluan Pengadaan:
              </span>
              <p className="text-foreground font-medium">{spb.purpose}</p>
            </div>

            {spb.notes && (
              <div className="sm:col-span-2 pt-1 border-t border-border/50">
                <span className="text-muted-foreground font-semibold block mb-0.5">
                  Catatan Tambahan:
                </span>
                <p className="text-muted-foreground whitespace-pre-line">
                  {spb.notes}
                </p>
              </div>
            )}
          </div>

          {/* Banner Alasan Penolakan Jika Ditolak */}
          {spb.status === "REJECTED" && spb.rejectedReason && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Pengajuan Ditolak</strong>
                <span className="opacity-95">{spb.rejectedReason}</span>
              </div>
            </div>
          )}

          {/* Items Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              Daftar Barang yang Diajukan ({items.length} item)
            </h4>

            <div className="border border-border/70 rounded-xl overflow-hidden bg-background">
              <div className="overflow-x-auto max-h-64">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold sticky top-0 border-b">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5">Nama Barang</th>
                      <th className="p-2.5">Spesifikasi / Merk</th>
                      <th className="p-2.5">Kategori</th>
                      <th className="p-2.5 w-20 text-center">Qty</th>
                      <th className="p-2.5 w-20">Satuan</th>
                      <th className="p-2.5 text-right">Estimasi Harga</th>
                      <th className="p-2.5 text-right">Subtotal</th>
                      <th className="p-2.5">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {items.map((it, idx) => {
                      const sub =
                        Number(it.subtotal) ||
                        (Number(it.qty) || 0) * (Number(it.estimatedPrice) || 0);
                      return (
                        <tr key={it.id || idx} className="hover:bg-muted/15">
                          <td className="p-2 text-center text-muted-foreground font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-2 font-semibold text-foreground">
                            {it.name}
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {it.spec || "-"}
                          </td>
                          <td className="p-2">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold"
                            >
                              {it.category || "ATK"}
                            </Badge>
                          </td>
                          <td className="p-2 text-center font-bold text-foreground">
                            {it.qty}
                          </td>
                          <td className="p-2 text-muted-foreground">
                            {it.unit}
                          </td>
                          <td className="p-2 text-right font-mono text-muted-foreground">
                            {formatRupiah(Number(it.estimatedPrice) || 0)}
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">
                            {formatRupiah(sub)}
                          </td>
                          <td className="p-2 text-muted-foreground text-[11px]">
                            {it.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Total Footer */}
              <div className="p-3 bg-muted/30 border-t flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">
                  Total Estimasi Nilai Pengadaan:
                </span>
                <span className="text-sm font-bold text-primary font-mono">
                  {formatRupiah(totalAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Form Input Alasan Penolakan (Jika sedang klik tolak) */}
          {isRejecting && (
            <div className="p-3.5 rounded-xl border border-rose-500/40 bg-rose-500/5 space-y-2">
              <span className="text-xs font-bold text-rose-600 block">
                Masukkan Alasan Penolakan SPB:
              </span>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Tuliskan catatan alasan pengajuan ditolak atau perlu direvisi..."
                className="w-full text-xs p-2 rounded-lg border border-border bg-background min-h-16 resize-y"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejecting(false)}
                  disabled={isProcessing}
                  className="h-7 text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleReject}
                  disabled={isProcessing}
                  className="h-7 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <XCircle className="w-3 h-3 mr-1" />
                  )}
                  Konfirmasi Tolak
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <DialogFooter className="border-t pt-3 flex flex-col sm:flex-row items-center justify-between gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-medium cursor-pointer"
          >
            Tutup
          </Button>

          {/* Tombol Aksi Persetujuan / Selesai */}
          <div className="flex items-center gap-2 flex-wrap">
            {spb.status === "PENDING_APPROVAL" && !isRejecting && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejecting(true)}
                  disabled={isProcessing}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-200 cursor-pointer"
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Tolak Pengajuan
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="text-xs font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                >
                  {isProcessing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  Setujui SPB
                </Button>
              </>
            )}

            {spb.status === "APPROVED" && (
              <Button
                type="button"
                size="sm"
                onClick={handleComplete}
                disabled={isProcessing}
                className="text-xs font-bold gap-1 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                Tandai Selesai Pengadaan
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
