"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Package,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Camera,
  ImagePlus,
  X,
  Save,
  Check,
} from "lucide-react";
import {
  submitSingleItemQCValidation,
  uploadQCAttachmentAction,
} from "@/app/actions/qc-receipt";
import { compressImage } from "@/lib/image-compressor";
import { formatJakartaDate } from "@/lib/date-utils";

interface QCReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  purchaseOrder: any | null;
  onSuccess?: () => void;
}

interface ItemState {
  itemId: string;
  namaBarang: string;
  qtyTotal: number;
  satuan: string;
  ukuran?: string | null;
  noSpb?: string | null;
  qtyPassed: number | string;
  qtyReject: number | string;
  qcNotes: string;
  qcDefectReason: string;
  qcAttachments: string[];
  itemStatus: string; // NONE, PENDING_INSPECTION, PASSED, FAILED, PARTIAL
  isUploadingFile?: boolean;
  isSubmitting?: boolean;
  isSavedSuccess?: boolean;
}

export function QCReceiptDialog({
  open,
  onOpenChange,
  purchaseOrder,
  onSuccess,
}: QCReceiptDialogProps) {
  const [itemsState, setItemsState] = useState<ItemState[]>([]);

  useEffect(() => {
    if (purchaseOrder && purchaseOrder.items) {
      const initialItems: ItemState[] = purchaseOrder.items.map((item: any) => {
        const total = Number(item.qty) || 0;
        const pQty = item.qtyPassed !== undefined ? item.qtyPassed : 0;
        const rQty = item.qtyFailed !== undefined ? item.qtyFailed : 0;
        const status = item.qcStatus || "PENDING_INSPECTION";

        let attachments: string[] = [];
        if (Array.isArray(item.qcAttachments)) {
          attachments = item.qcAttachments;
        } else if (
          typeof item.qcAttachments === "string" &&
          item.qcAttachments.trim()
        ) {
          try {
            attachments = JSON.parse(item.qcAttachments);
          } catch (e) {
            attachments = [item.qcAttachments];
          }
        }

        return {
          itemId: item.id,
          namaBarang: item.namaBarang,
          qtyTotal: total,
          satuan: item.satuan || "Pcs",
          ukuran: item.ukuran,
          noSpb: item.noSpb,
          qtyPassed: pQty,
          qtyReject: rQty,
          qcNotes: item.qcNotes || "",
          qcDefectReason: item.qcDefectReason || "",
          qcAttachments: attachments,
          itemStatus: status,
          isUploadingFile: false,
          isSubmitting: false,
          isSavedSuccess: false,
        };
      });
      setItemsState(initialItems);
    }
  }, [purchaseOrder]);

  if (!purchaseOrder) return null;

  const handleItemFieldChange = (
    index: number,
    field: keyof ItemState,
    value: any,
  ) => {
    setItemsState((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value,
        isSavedSuccess: false,
      };
      return updated;
    });
  };

  const handleFileUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setItemsState((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isUploadingFile: true };
      return updated;
    });

    const uploadedUrls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const compressedFile = await compressImage(file, {
          maxDimension: 1600,
          quality: 0.8,
          maxSizeBytes: 5 * 1024 * 1024,
        });

        const formData = new FormData();
        formData.append("file", compressedFile);

        const uploadRes = await uploadQCAttachmentAction(formData);
        if (uploadRes.success && uploadRes.url) {
          uploadedUrls.push(uploadRes.url);
        } else {
          toast.error(
            uploadRes.error || `Gagal mengunggah foto "${file.name}"`,
          );
        }
      } catch (err: any) {
        toast.error(err?.message || `Gagal memproses foto "${file.name}"`);
      }
    }

    setItemsState((prev) => {
      const updated = [...prev];
      const target = updated[index];
      const newAttachments = [...(target.qcAttachments || []), ...uploadedUrls];
      updated[index] = {
        ...target,
        qcAttachments: newAttachments,
        isUploadingFile: false,
        isSavedSuccess: false,
      };
      return updated;
    });

    e.target.value = "";
  };

  const handleRemoveAttachment = (itemIndex: number, photoIndex: number) => {
    setItemsState((prev) => {
      const updated = [...prev];
      const target = updated[itemIndex];
      const newAttachments = target.qcAttachments.filter(
        (_, idx) => idx !== photoIndex,
      );
      updated[itemIndex] = {
        ...target,
        qcAttachments: newAttachments,
        isSavedSuccess: false,
      };
      return updated;
    });
  };

  // Submit MANDIRI per-item barang
  const handleSubmitSingleItem = async (index: number) => {
    const item = itemsState[index];
    const pQty = Number(item.qtyPassed) || 0;
    const rQty = Number(item.qtyReject) || 0;
    const sum = pQty + rQty;

    if (sum > item.qtyTotal) {
      toast.error(
        `Jumlah Qty Passed (${pQty}) + Qty Reject (${rQty}) pada "${item.namaBarang}" melebihi Qty PO (${item.qtyTotal} ${item.satuan})!`,
      );
      return;
    }

    if (rQty > 0 && !item.qcDefectReason.trim()) {
      toast.error(
        `Alasan kerusakan (Defect) wajib diisi untuk item "${item.namaBarang}" karena ada Qty Reject!`,
      );
      return;
    }

    setItemsState((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], isSubmitting: true };
      return updated;
    });

    const toastId = toast.loading(`Menyimpan QC item "${item.namaBarang}"...`);

    const res = await submitSingleItemQCValidation({
      poId: purchaseOrder.id,
      itemId: item.itemId,
      qtyPassed: pQty,
      qtyFailed: rQty,
      qcNotes: item.qcNotes.trim() || null,
      qcDefectReason: item.qcDefectReason.trim() || null,
      qcAttachments: item.qcAttachments || [],
    });

    setItemsState((prev) => {
      const updated = [...prev];
      const newItemStatus =
        res.success && res.data?.qcStatus
          ? res.data.qcStatus
          : updated[index].itemStatus;
      updated[index] = {
        ...updated[index],
        itemStatus: newItemStatus,
        isSubmitting: false,
        isSavedSuccess: res.success,
      };
      return updated;
    });

    if (res.success) {
      toast.success(res.message, { id: toastId });
      onSuccess?.();
    } else {
      toast.error(res.error || "Gagal menyimpan hasil QC item", {
        id: toastId,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] sm:max-w-2xl max-h-[94vh] overflow-y-auto rounded-2xl p-3.5 sm:p-5 space-y-3">
        {/* Header Dialog Ringkas */}
        <DialogHeader className="space-y-1 pb-2 border-b border-border/60">
          <DialogTitle className="text-sm sm:text-base font-semibold flex items-center justify-between gap-2 text-foreground">
            <div className="flex items-center gap-1.5 min-w-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
              <span className="truncate">
                Inspeksi QC PO:{" "}
                <span className="font-semibold text-primary">
                  {purchaseOrder.nomorPO}
                </span>
              </span>
            </div>
          </DialogTitle>
          <DialogDescription className="text-[11px] sm:text-xs text-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              Supplier:{" "}
              <span className="text-foreground font-semibold">
                {purchaseOrder.kepada || "-"}
              </span>
            </span>
            <span>•</span>
            <span>
              Proyek:{" "}
              <span className="text-foreground font-semibold">
                {purchaseOrder.projek || "Gudang"}
              </span>
            </span>
            <span>•</span>
            <span>
              Tgl:{" "}
              <span className="text-foreground font-semibold">
                {formatJakartaDate(
                  purchaseOrder.qcRequestedAt || purchaseOrder.createdAt,
                  "date",
                )}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Form List Item PO */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              Daftar Barang PO ({itemsState.length} Item)
            </Label>
          </div>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {itemsState.map((item, idx) => {
              const pQty = Number(item.qtyPassed) || 0;
              const rQty = Number(item.qtyReject) || 0;
              const qtyBelumDicek = item.qtyTotal - (pQty + rQty);
              const isOverLimit = pQty + rQty > item.qtyTotal;

              // Render Badge Status Per Item
              let itemBadge = null;
              if (
                item.itemStatus === "PASSED" ||
                (pQty === item.qtyTotal && rQty === 0)
              ) {
                itemBadge = (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-400 font-bold text-[10px] px-1.5 py-0"
                  >
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 text-emerald-600" />{" "}
                    PASSED
                  </Badge>
                );
              } else if (
                item.itemStatus === "FAILED" ||
                (rQty === item.qtyTotal && pQty === 0)
              ) {
                itemBadge = (
                  <Badge
                    variant="outline"
                    className="bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-400 font-bold text-[10px] px-1.5 py-0"
                  >
                    <XCircle className="w-2.5 h-2.5 mr-0.5 text-rose-600" />{" "}
                    REJECTED
                  </Badge>
                );
              } else if (pQty > 0 || rQty > 0) {
                itemBadge = (
                  <Badge
                    variant="outline"
                    className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-400 font-bold text-[10px] px-1.5 py-0"
                  >
                    <AlertTriangle className="w-2.5 h-2.5 mr-0.5 text-amber-600" />{" "}
                    PARTIAL
                  </Badge>
                );
              } else {
                itemBadge = (
                  <Badge
                    variant="secondary"
                    className="text-[10px] font-medium px-1.5 py-0 bg-muted text-muted-foreground"
                  >
                    MENUNGGU QC
                  </Badge>
                );
              }

              return (
                <div
                  key={item.itemId}
                  className={cn(
                    "p-3 rounded-xl border transition-all space-y-2.5 shadow-2xs text-xs",
                    isOverLimit
                      ? "border-rose-500/80 bg-rose-500/10"
                      : item.isSavedSuccess
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-border bg-card",
                  )}
                >
                  {/* Header Item & Status Sisa */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-1.5">
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-semibold text-xs text-foreground truncate flex items-center gap-1.5">
                        <span>
                          {idx + 1}. {item.namaBarang}
                        </span>
                        {itemBadge}
                      </div>
                      {item.ukuran && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          Spesifikasi:{" "}
                          <span className="font-medium text-foreground">
                            {item.ukuran}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Badge
                        variant="outline"
                        className="text-[10px] font-semibold px-1.5 py-0"
                      >
                        Total: {item.qtyTotal} {item.satuan}
                      </Badge>

                      {isOverLimit ? (
                        <Badge
                          variant="destructive"
                          className="text-[10px] font-bold px-1.5 py-0"
                        >
                          Over Limit
                        </Badge>
                      ) : qtyBelumDicek > 0 ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-medium px-1.5 py-0 bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/40"
                        >
                          Sisa: <strong>{qtyBelumDicek}</strong>
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] font-bold px-1.5 py-0 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40 flex items-center gap-0.5"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />{" "}
                          Done
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Input Side by Side: Qty Passed & Qty Reject */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <Label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Qty Passed</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.qtyTotal}
                        value={item.qtyPassed}
                        onChange={(e) =>
                          handleItemFieldChange(
                            idx,
                            "qtyPassed",
                            e.target.value,
                          )
                        }
                        className="h-7 text-xs rounded-lg mt-0.5 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/5 border-emerald-400/60 focus-visible:ring-emerald-500"
                        placeholder="0"
                      />
                    </div>

                    <div>
                      <Label className="text-[10px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3 h-3 text-rose-600 shrink-0" />
                        <span>Qty Reject</span>
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={item.qtyTotal}
                        value={item.qtyReject}
                        onChange={(e) =>
                          handleItemFieldChange(
                            idx,
                            "qtyReject",
                            e.target.value,
                          )
                        }
                        className="h-8 sm:h-7 text-xs rounded-lg mt-0.5 font-bold text-rose-700 dark:text-rose-300 bg-rose-500/5 border-rose-400/60 focus-visible:ring-rose-500"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Alasan Kerusakan / Defect (bila Qty Reject > 0) */}
                  {rQty > 0 && (
                    <div className="space-y-0.5">
                      <Label className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                        Alasan Kerusakan / Defect (Wajib)
                      </Label>
                      <Textarea
                        rows={2}
                        placeholder="Contoh: Dimensi melebihi toleransi ±2mm"
                        value={item.qcDefectReason}
                        onChange={(e) =>
                          handleItemFieldChange(
                            idx,
                            "qcDefectReason",
                            e.target.value,
                          )
                        }
                        className="text-xs rounded-lg border-rose-400/80 text-rose-700 dark:text-rose-300 bg-rose-500/5 min-h-[46px] py-1.5 resize-y"
                      />
                    </div>
                  )}

                  {/* Catatan Pengujian Fisik / Analisa Item */}
                  <div className="space-y-0.5">
                    <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                      <FileText className="w-3 h-3 text-indigo-500 shrink-0" />
                      Catatan Fisik / Hasil Uji Lab (Opsional)
                    </Label>
                    <Textarea
                      rows={2}
                      placeholder="Catatan fisik / hasil uji lab (opsional)..."
                      value={item.qcNotes}
                      onChange={(e) =>
                        handleItemFieldChange(idx, "qcNotes", e.target.value)
                      }
                      className="text-xs rounded-lg bg-background text-foreground placeholder:text-muted-foreground/60 min-h-[46px] py-1.5 resize-y"
                    />
                  </div>

                  {/* Area Unggah Foto Bukti QC (Multi-Image, Opsional) */}
                  <div className="space-y-1 pt-1 border-t border-border/40">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
                        <Camera className="w-3 h-3 text-indigo-500 shrink-0" />
                        Foto Bukti Inspeksi (Opsional, max 5 MB)
                      </Label>
                      {item.isUploadingFile && (
                        <span className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 animate-pulse">
                          <Loader2 className="w-3 h-3 animate-spin" />{" "}
                          Mengompres & Mengunggah...
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap pt-0.5">
                      {item.qcAttachments &&
                        item.qcAttachments.map((url, pIdx) => (
                          <div
                            key={pIdx}
                            className="relative w-12 h-12 rounded-lg overflow-hidden border border-border group bg-muted/40 shrink-0 shadow-2xs"
                          >
                            <img
                              src={url}
                              alt={`Bukti QC ${pIdx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveAttachment(idx, pIdx)}
                              className="absolute top-0.5 right-0.5 bg-black/60 hover:bg-rose-600 text-white rounded-full p-0.5 cursor-pointer transition-colors"
                              title="Hapus foto ini"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                      <label className="w-12 h-12 rounded-lg border border-dashed border-indigo-400/60 bg-indigo-500/5 hover:bg-indigo-500/10 flex flex-col items-center justify-center cursor-pointer transition-colors shrink-0">
                        <ImagePlus className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="text-[8px] font-bold text-indigo-600 mt-0.5">
                          + Foto
                        </span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={(e) => handleFileUpload(idx, e)}
                          disabled={item.isUploadingFile}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Tombol Submit Mandiri PER-ITEM BARANG */}
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {item.isSavedSuccess ? (
                        <span className="text-emerald-600 font-bold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Tersimpan
                        </span>
                      ) : (
                        "Belum disimpan"
                      )}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSubmitSingleItem(idx)}
                      disabled={item.isSubmitting || item.isUploadingFile}
                      className={cn(
                        "h-7 text-[11px] font-bold rounded-lg cursor-pointer transition-all flex items-center gap-1 px-3 shadow-2xs",
                        item.isSavedSuccess
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white",
                      )}
                    >
                      {item.isSubmitting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : item.isSavedSuccess ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {item.isSavedSuccess ? "Submit Ulang" : "Submit QC"}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <DialogFooter className="mt-2 flex flex-col sm:flex-row justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg text-xs cursor-pointer h-8 font-semibold"
          >
            Tutup Dialog
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
