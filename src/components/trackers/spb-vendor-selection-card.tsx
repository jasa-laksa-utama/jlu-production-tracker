"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, Loader2, ShoppingCart, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  recommendSpbItemByEngineering,
  recommendSpbItemByPm,
} from "@/app/actions/spb";

interface SPBVendorSelectionCardProps {
  item: any;
  role: "ENGINEERING" | "PM";
  onUpdated: () => void;
}

export function SPBVendorSelectionCard({
  item,
  role,
  onUpdated,
}: SPBVendorSelectionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any | null>(null);
  const [recommendationNote, setRecommendationNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ambil list opsi vendor
  let candidates = item.candidateSuppliers || [];
  if (typeof candidates === "string") {
    try {
      candidates = JSON.parse(candidates);
    } catch (e) {
      candidates = [];
    }
  }

  const handleExecuteRecommend = async () => {
    if (!selectedSupplier) return;
    setIsSubmitting(true);
    const toastId = toast.loading(`Memproses rekomendasi ${selectedSupplier.supplierName}...`);

    try {
      let res;
      if (role === "ENGINEERING") {
        res = await recommendSpbItemByEngineering(
          item.id,
          selectedSupplier.supplierId,
          recommendationNote
        );
      } else {
        res = await recommendSpbItemByPm(
          item.id,
          selectedSupplier.supplierId,
          recommendationNote
        );
      }

      if (res?.success) {
        toast.success(`Berhasil merekomendasikan ${selectedSupplier.supplierName}`, { id: toastId });
        setSelectedSupplier(null);
        setRecommendationNote("");
        setIsOpen(false);
        onUpdated();
      } else {
        toast.error(res?.error || "Gagal menyimpan rekomendasi", { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan sistem", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Baris Ringkas Barang dengan Tombol Aksi Dialog */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20 p-3 rounded-xl border border-border/50 text-xs">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center">
          {/* Kolom 1: Nama Barang */}
          <div className="sm:col-span-4">
            <span className="text-[11px] text-muted-foreground block font-medium">Nama Barang</span>
            <span className="font-semibold text-foreground text-xs sm:text-sm">{item.name}</span>
          </div>

          {/* Kolom 2: Spesifikasi / Merk */}
          <div className="sm:col-span-6">
            <span className="text-[11px] text-muted-foreground block font-medium">Spesifikasi / Merk</span>
            <span className="font-semibold text-foreground whitespace-normal wrap-break-word">
              {item.typeMerk || "-"}
            </span>
          </div>

          {/* Kolom 3: Qty */}
          <div className="sm:col-span-2 sm:text-right">
            <span className="text-[11px] text-muted-foreground block font-medium">Qty / Satuan</span>
            <span className="font-semibold text-foreground">
              {item.qty} {item.unit}
            </span>
          </div>
        </div>

        {/* Tombol Buka Modal Opsi Vendor */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsOpen(true)}
          className="h-8 text-xs font-semibold rounded-lg gap-1.5 border-primary/40 text-primary hover:bg-primary/10 shrink-0 cursor-pointer"
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Lihat Opsi Vendor ({candidates.length})
        </Button>
      </div>

      {/* Catatan Pengajuan Jika Ada */}
      {item.vendorSelectionNote && (
        <div className="px-1 text-[11px] text-muted-foreground">
          <span>Catatan Pengajuan: </span>
          <span className="text-foreground italic">{item.vendorSelectionNote}</span>
        </div>
      )}

      {/* Modal Dialog 1: Opsi Vendor */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl rounded-2xl p-4 sm:p-6 max-h-[90vh] flex flex-col overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Rekomendasi Vendor untuk {item.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-0.5">
              Pilih salah satu vendor terdaftar dari Purchasing untuk diberikan rekomendasi oleh {role}.
            </DialogDescription>
          </DialogHeader>

          {/* Detail Ringkas Barang di Modal */}
          <div className="bg-muted/30 p-3 rounded-xl border border-border/50 text-xs space-y-1.5 my-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama Barang:</span>
              <span className="font-semibold text-foreground">{item.name} ({item.qty} {item.unit})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Spesifikasi:</span>
              <span className="font-semibold text-foreground">{item.typeMerk || "-"}</span>
            </div>
            {item.vendorSelectionNote && (
              <div className="flex justify-between border-t border-border/40 pt-1.5">
                <span className="text-muted-foreground">Catatan Purchasing:</span>
                <span className="italic text-foreground">{item.vendorSelectionNote}</span>
              </div>
            )}
          </div>

          {/* List Perbandingan Vendor */}
          <div className="space-y-3 py-1">
            <h4 className="font-semibold text-xs text-foreground">
              Daftar Opsi Vendor Penawaran ({candidates.length}):
            </h4>

            <div className="grid gap-3 sm:grid-cols-2">
              {candidates.map((supplier: any) => {
                const isRecommendedByEng = supplier.recommendedByEng === true;
                const isRecommendedByPm = supplier.recommendedByPm === true;
                const isSelectedByThisRole =
                  (role === "ENGINEERING" && isRecommendedByEng) ||
                  (role === "PM" && isRecommendedByPm);

                return (
                  <div
                    key={supplier.supplierId}
                    className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
                      isSelectedByThisRole
                        ? "bg-primary/5 border-primary/40 shadow-xs"
                        : "bg-card border-border/60 hover:border-border"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex justify-between items-start gap-1.5">
                        <span className="text-xs sm:text-sm font-semibold text-foreground leading-tight">
                          {supplier.supplierName}
                        </span>
                        <div className="flex flex-wrap gap-1 items-end shrink-0">
                          {isRecommendedByEng && (
                            <span className="text-[9px] font-semibold bg-green-500/10 text-green-700 border border-green-300 px-1 py-0.2 rounded">
                              Eng
                            </span>
                          )}
                          {isRecommendedByPm && (
                            <span className="text-[9px] font-semibold bg-blue-500/10 text-blue-700 border border-blue-300 px-1 py-0.2 rounded">
                              PM
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs pt-2 border-t border-border/40">
                        <span className="text-muted-foreground text-[11px]">Harga Satuan:</span>
                        <span className="text-foreground font-semibold text-xs">
                          Rp {supplier.catalogPrice?.toLocaleString("id-ID") || "-"}
                        </span>
                      </div>
                      {supplier.poNumber && (
                        <div className="flex justify-between text-[11px] text-muted-foreground/80">
                          <span>Ref / PO:</span>
                          <span className="font-semibold text-foreground text-[10px]">{supplier.poNumber}</span>
                        </div>
                      )}

                      {/* Catatan Pertimbangan Engineering */}
                      {supplier.engNote && (
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-200/80 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-0.5 mt-1">
                          <span className="font-bold flex items-center gap-1">
                            💬 Catatan Engineering:
                          </span>
                          <p className="italic">{supplier.engNote}</p>
                        </div>
                      )}

                      {/* Catatan Pertimbangan PM */}
                      {supplier.pmNote && (
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-200/80 text-[11px] text-blue-900 dark:text-blue-200 space-y-0.5 mt-1">
                          <span className="font-bold flex items-center gap-1">
                            💬 Catatan PM:
                          </span>
                          <p className="italic">{supplier.pmNote}</p>
                        </div>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedSupplier(supplier);
                        setRecommendationNote(
                          role === "ENGINEERING"
                            ? supplier.engNote || ""
                            : supplier.pmNote || ""
                        );
                      }}
                      className={`w-full h-8 text-xs font-semibold rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-none ${
                        isSelectedByThisRole
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSelectedByThisRole ? "Direkomendasikan" : "Rekomendasikan Vendor Ini"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="rounded-lg text-xs font-semibold cursor-pointer w-full sm:w-auto"
            >
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Dialog 2: Konfirmasi Rekomendasi */}
      <Dialog open={!!selectedSupplier} onOpenChange={(open) => !open && setSelectedSupplier(null)}>
        <DialogContent className="w-[90vw] sm:max-w-md rounded-2xl p-4 sm:p-6 space-y-3">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-primary shrink-0" />
              Konfirmasi Rekomendasi
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Apakah Anda yakin ingin memberikan rekomendasi untuk vendor berikut?
            </DialogDescription>
          </DialogHeader>

          <div className="bg-muted/30 p-3 rounded-xl border border-border/50 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vendor:</span>
              <span className="font-bold text-foreground">{selectedSupplier?.supplierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Harga Satuan:</span>
              <span className="font-bold text-primary">Rp {selectedSupplier?.catalogPrice?.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Barang:</span>
              <span className="font-semibold text-foreground">{item.name}</span>
            </div>
          </div>

          {/* Input Textarea Catatan Opsional */}
          <div className="space-y-1 pt-1">
            <label className="text-xs font-bold text-foreground block">
              Catatan / Pertimbangan Rekomendasi (Opsional)
            </label>
            <textarea
              placeholder="Contoh: Spesifikasi teknis paling sesuai standar JIS, harga bersaing, garansi 1 tahun..."
              value={recommendationNote}
              onChange={(e) => setRecommendationNote(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl bg-background border border-border/80 focus:border-primary focus:outline-none min-h-[70px] resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              Catatan ini akan dapat dibaca oleh {role === "ENGINEERING" ? "PM & Direksi" : "Direksi"} saat meninjau penetapan vendor.
            </p>
          </div>

          <DialogFooter className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedSupplier(null)}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteRecommend}
              disabled={isSubmitting}
              className="rounded-lg text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              Ya, Rekomendasikan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
