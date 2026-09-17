"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  FileText,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  CheckSquare,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatRupiah, cn } from "@/lib/utils";
import {
  createOfficeSPB,
  updateOfficeSPB,
  generateOfficeSPBNumber,
  OfficeSPBItemInput,
} from "@/app/actions/office-procurement";

interface OfficeSPBDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spbToEdit?: any | null;
  boqList?: any[];
  initialBoqId?: string | null;
  onSuccess?: () => void;
}

const DEPARTMENTS = [
  { id: "GENERAL", label: "Umum & GA (General Affairs)" },
  { id: "HR", label: "HR & Personalia" },
  { id: "IT", label: "IT & Sistem Informasi" },
  { id: "FINANCE", label: "Finance & Akuntansi" },
  { id: "MARKETING", label: "Marketing & Sales" },
  { id: "OPERATIONAL", label: "Operasional Kantor" },
];

const ITEM_CATEGORIES = [
  { id: "ATK", label: "Alat Tulis Kantor (ATK)" },
  { id: "PANTRY", label: "Kebutuhan Pantry & Konsumsi" },
  { id: "CLEANING", label: "Kebersihan & Sanitasi" },
  { id: "ELECTRONIC", label: "Elektronik & Aksesoris IT" },
  { id: "MAINTENANCE", label: "Perawatan Gedung & Fasilitas" },
  { id: "SAFETY", label: "K3 / APD Kantor" },
  { id: "OTHER", label: "Lain-lain" },
];

const COMMON_UNITS = [
  "pcs",
  "rim",
  "box",
  "pack",
  "lusin",
  "roll",
  "botol",
  "galon",
  "set",
  "unit",
  "kg",
  "meter",
];

export function OfficeSPBDialog({
  open,
  onOpenChange,
  spbToEdit = null,
  boqList = [],
  initialBoqId = null,
  onSuccess,
}: OfficeSPBDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [spbNumber, setSpbNumber] = useState("");
  const [purpose, setPurpose] = useState("");
  const [department, setDepartment] = useState("GENERAL");
  const [makerName, setMakerName] = useState("");
  const [selectedBoqId, setSelectedBoqId] = useState<string>("NONE");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [items, setItems] = useState<OfficeSPBItemInput[]>([]);

  // Referensi paket BOQ terpilih
  const selectedBoq = boqList.find((b) => b.id === selectedBoqId);
  const availableBoqItems = selectedBoq?.items || [];

  // Load or generate initial data
  useEffect(() => {
    if (!open) return;

    if (spbToEdit) {
      setSpbNumber(spbToEdit.spbNumber || "");
      setPurpose(spbToEdit.purpose || "");
      setDepartment(spbToEdit.department || "GENERAL");
      setMakerName(spbToEdit.makerName || "");
      setSelectedBoqId(spbToEdit.officeBoqId || "NONE");
      setRequiredDate(
        spbToEdit.requiredDate
          ? new Date(spbToEdit.requiredDate).toISOString().split("T")[0]
          : "",
      );
      setNotes(spbToEdit.notes || "");
      setIsPickerOpen(false);
      if (spbToEdit.items && spbToEdit.items.length > 0) {
        setItems(
          spbToEdit.items.map((it: any) => ({
            id: it.id,
            name: it.name || "",
            spec: it.spec || "",
            category: it.category || "ATK",
            qty: Number(it.qty) || 1,
            unit: it.unit || "pcs",
            estimatedPrice: Number(it.estimatedPrice) || 0,
            notes: it.notes || "",
          })),
        );
      } else {
        setItems([]);
      }
    } else {
      // Create new: Mulai dengan tabel kosong sesuai permintaan
      setPurpose("");
      setDepartment("GENERAL");
      setMakerName("");
      setRequiredDate("");
      setNotes("");
      setItems([]); // Tabel item dimulai dalam kondisi KOSONG
      setIsPickerOpen(true); // Buka panel pemilih item BOQ agar pengguna langsung memilih

      if (initialBoqId && boqList.length > 0) {
        const found = boqList.find((b) => b.id === initialBoqId);
        if (found) {
          setSelectedBoqId(found.id);
          setPurpose(`Pengajuan Barang sesuai ${found.title}`);
          setDepartment(found.department || "GENERAL");
        } else {
          setSelectedBoqId("NONE");
        }
      } else if (boqList.length > 0) {
        setSelectedBoqId(boqList[0].id);
        setPurpose(`Pengajuan Barang sesuai ${boqList[0].title}`);
        setDepartment(boqList[0].department || "GENERAL");
      } else {
        setSelectedBoqId("NONE");
      }

      generateOfficeSPBNumber().then((num) => setSpbNumber(num));
    }
  }, [open, spbToEdit, initialBoqId, boqList]);

  // Saat memilih referensi BOQ dari dropdown header
  const handleSelectBoq = (boqId: string) => {
    setSelectedBoqId(boqId);
    if (boqId === "NONE") return;

    const selected = boqList.find((b) => b.id === boqId);
    if (selected) {
      if (!purpose.trim() || purpose.startsWith("Pengajuan Barang sesuai")) {
        setPurpose(`Pengajuan Barang sesuai ${selected.title}`);
      }
      setDepartment(selected.department || "GENERAL");
      // Reset tabel item ke kosong saat ganti rujukan BOQ
      setItems([]);
      setIsPickerOpen(true);
      toast.info(
        `Rujukan diubah ke "${selected.title}". Silakan pilih item yang ingin diajukan.`,
      );
    }
  };

  // Tambah item tunggal dari BOQ
  const handleAddItemFromBoq = (boqItem: any) => {
    if (!boqItem) return;

    const existingIdx = items.findIndex((it) => it.name === boqItem.name);
    if (existingIdx >= 0) {
      toast.info(`"${boqItem.name}" sudah ada di daftar SPB.`);
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        name: boqItem.name,
        spec: boqItem.itemCode || "",
        category: boqItem.category || "ATK",
        qty: Number(boqItem.qty) || 1,
        unit: boqItem.unit || "pcs",
        estimatedPrice: Number(boqItem.estimatedPrice) || 0,
        notes: boqItem.notes || "",
      },
    ]);
    toast.success(`"${boqItem.name}" dimasukkan ke tabel SPB.`);
  };

  // Masukkan semua item BOQ sekaligus
  const handleSelectAllBoqItems = () => {
    if (!availableBoqItems || availableBoqItems.length === 0) {
      toast.error("Tidak ada item pada paket BOQ ini.");
      return;
    }

    setItems(
      availableBoqItems.map((bIt: any) => ({
        name: bIt.name || "",
        spec: bIt.itemCode || "",
        category: bIt.category || "ATK",
        qty: Number(bIt.qty) || 1,
        unit: bIt.unit || "pcs",
        estimatedPrice: Number(bIt.estimatedPrice) || 0,
        notes: bIt.notes || "",
      })),
    );
    toast.success(
      `Semua (${availableBoqItems.length}) item BOQ berhasil dimasukkan.`,
    );
  };

  // Tambah baris baru di tabel (otomatis pilih item BOQ yang belum dipilih jika ada)
  const handleAddNewRow = () => {
    if (!selectedBoq || availableBoqItems.length === 0) {
      toast.error("Pilih paket rujukan BOQ terlebih dahulu.");
      return;
    }

    const unselected = availableBoqItems.find(
      (bIt: any) =>
        !items.some(
          (it) => it.name.trim().toLowerCase() === bIt.name.trim().toLowerCase(),
        ),
    );

    if (unselected) {
      handleAddItemFromBoq(unselected);
    } else {
      // Jika semua sudah terpilih
      toast.info("Semua item dari BOQ rujukan sudah ada di tabel SPB.");
    }
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    setDeleteConfirmIndex(null);
  };

  const handleItemChange = (
    index: number,
    field: keyof OfficeSPBItemInput,
    val: any,
  ) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const totalEstimate = items.reduce((sum, it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.estimatedPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!purpose.trim()) {
      toast.error("Keperluan pengadaan barang wajib diisi.");
      return;
    }

    if (!selectedBoqId || selectedBoqId === "NONE") {
      toast.error("Pilih paket rujukan BOQ untuk pengajuan SPB ini.");
      return;
    }

    const validItems = items.filter(
      (it) => it.name.trim().length > 0 && Number(it.qty) > 0,
    );
    if (validItems.length === 0) {
      toast.error("Pilih minimal 1 item barang dari BOQ rujukan untuk diajukan.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (spbToEdit) {
        const res = await updateOfficeSPB(spbToEdit.id, {
          spbNumber,
          purpose: purpose.trim(),
          department,
          officeBoqId: selectedBoqId !== "NONE" ? selectedBoqId : null,
          requiredDate: requiredDate || null,
          notes: notes.trim() || undefined,
          items: validItems,
        });

        if (!res.success) throw new Error(res.error);
        toast.success(res.message || "SPB Umum berhasil diperbarui.");
      } else {
        const res = await createOfficeSPB({
          spbNumber,
          purpose: purpose.trim(),
          department,
          officeBoqId: selectedBoqId !== "NONE" ? selectedBoqId : null,
          requiredDate: requiredDate || null,
          makerName: makerName.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validItems,
        });

        if (!res.success) throw new Error(res.error);
        toast.success(res.message || "Pengajuan SPB Umum berhasil dikirim.");
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan SPB Umum.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                {spbToEdit ? "Edit SPB Umum Kantor" : "Buat Pengajuan SPB Umum Kantor"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Surat Permintaan Barang (SPB) operasional kantor non-proyek untuk diajukan ke manajemen.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 py-3 pr-1">
          {/* Header Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-muted/20 rounded-xl border border-border/60">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Nomor SPB <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={spbNumber}
                onChange={(e) => setSpbNumber(e.target.value)}
                placeholder="SPB-KTR-..."
                className="h-8.5 text-xs font-mono font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Departemen / Divisi
              </Label>
              <Select
                value={department}
                onValueChange={(val) => setDepartment(val || "GENERAL")}
              >
                <SelectTrigger className="h-8.5 text-xs">
                  <SelectValue placeholder="Pilih Departemen" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d.id} value={d.id} className="text-xs">
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Tanggal Kebutuhan (Batas Waktu)
              </Label>
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="h-8.5 text-xs"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Keperluan Pengadaan <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Contoh: Pengadaan stok kertas, tinta printer, dan kopi pantry GA"
                className="h-8.5 text-xs font-medium"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Rujukan BOQ Umum <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={selectedBoqId}
                onValueChange={(val) => handleSelectBoq(val || "NONE")}
              >
                <SelectTrigger className="h-8.5 text-xs">
                  <SelectValue placeholder="Pilih Rujukan BOQ" />
                </SelectTrigger>
                <SelectContent>
                  {boqList.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs cursor-pointer">
                      {b.boqNumber} - {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-3 space-y-1">
              <Label className="text-xs font-semibold text-foreground">
                Catatan Pengajuan (Opsional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan spesifikasi pembelian atau vendor rekomendasi..."
                className="text-xs min-h-16 resize-y"
              />
            </div>
          </div>

          {/* Daftar Barang Pengajuan SPB */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Rincian Barang yang Diajukan ({items.length} item)
                </span>
                {selectedBoq && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-mono">
                    Rujukan: {selectedBoq.boqNumber}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {availableBoqItems.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsPickerOpen(!isPickerOpen)}
                    className="h-7.5 text-xs font-semibold gap-1.5 rounded-lg border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    {isPickerOpen ? "Tutup Pemilih BOQ" : "Pilih dari BOQ"}
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddNewRow}
                  className="h-7.5 text-xs font-semibold gap-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Baris
                </Button>
              </div>
            </div>

            {/* Panel Interaktif Pemilih Item BOQ */}
            {isPickerOpen && availableBoqItems.length > 0 && (
              <div className="p-3.5 rounded-2xl border border-primary/25 bg-primary/5 dark:bg-primary/10 space-y-2.5 animate-in fade-in-50 duration-200">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/15 pb-2">
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Daftar Kebutuhan dari {selectedBoq?.boqNumber} ({selectedBoq?.title})
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Pilih item yang ingin diajukan pada SPB ini:
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAllBoqItems}
                      className="h-6.5 px-2.5 text-[11px] font-semibold rounded-lg bg-background hover:bg-muted cursor-pointer"
                    >
                      Pilih Semua ({availableBoqItems.length})
                    </Button>
                    {items.length > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setItems([])}
                        className="h-6.5 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 cursor-pointer"
                      >
                        Kosongkan
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsPickerOpen(false)}
                      className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                      title="Tutup pemilih"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {availableBoqItems.map((bIt: any) => {
                    const isAdded = items.some((it) => it.name === bIt.name);
                    const currentItem = items.find((it) => it.name === bIt.name);

                    return (
                      <div
                        key={bIt.id || bIt.name}
                        className={cn(
                          "flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs transition-all",
                          isAdded
                            ? "border-primary/50 bg-background shadow-xs ring-1 ring-primary/20"
                            : "border-border/70 bg-card hover:border-primary/40 hover:bg-background"
                        )}
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground truncate block">
                              {bIt.name}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-muted text-muted-foreground shrink-0">
                              {bIt.category || "ATK"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>
                              Anggaran BOQ:{" "}
                              <strong className="text-foreground font-mono">
                                {bIt.qty} {bIt.unit}
                              </strong>
                            </span>
                            <span>•</span>
                            <span className="font-mono">
                              {formatRupiah(bIt.estimatedPrice || 0)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isAdded ? (
                            <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2 py-1 rounded-lg">
                              <span className="text-xs font-bold text-primary font-mono">
                                {currentItem?.qty} {bIt.unit}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setItems((prev) =>
                                    prev.filter((it) => it.name !== bIt.name)
                                  );
                                }}
                                className="h-5 w-5 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded cursor-pointer"
                                title="Hapus dari SPB"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleAddItemFromBoq(bIt)}
                              className="h-7 px-2.5 text-xs font-bold gap-1 bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 cursor-pointer shadow-2xs"
                            >
                              <Plus className="w-3 h-3" />
                              Pilih
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Tabel Rincian Item SPB */}
            <div className="border border-border/70 rounded-xl overflow-hidden bg-background">
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold sticky top-0 border-b z-10">
                    <tr>
                      <th className="p-2.5 w-10 text-center">No</th>
                      <th className="p-2.5 min-w-48">Nama Barang (Dari BOQ)</th>
                      <th className="p-2.5 min-w-36">Spesifikasi / Merk</th>
                      <th className="p-2.5 min-w-32">Kategori</th>
                      <th className="p-2.5 w-24 text-center">Qty</th>
                      <th className="p-2.5 w-24">Satuan</th>
                      <th className="p-2.5 min-w-32 text-right">Estimasi Harga</th>
                      <th className="p-2.5 min-w-32 text-right">Subtotal</th>
                      <th className="p-2.5 min-w-32">Catatan</th>
                      <th className="p-2.5 w-10 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          <div className="max-w-md mx-auto space-y-2.5">
                            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-2xs">
                              <Layers className="w-5 h-5" />
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-xs">
                                Tabel SPB Masih Kosong
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Pilih item barang dan tentukan kuantitas yang diajukan dari
                                paket rujukan BOQ{" "}
                                {selectedBoq && (
                                  <span className="font-semibold text-primary font-mono">
                                    {selectedBoq.boqNumber}
                                  </span>
                                )}
                                .
                              </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 pt-1">
                              {availableBoqItems.length > 0 && (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => setIsPickerOpen(true)}
                                    className="h-8 px-3 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5" />
                                    Pilih Item dari BOQ
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSelectAllBoqItems}
                                    className="h-8 px-3 text-xs font-semibold gap-1.5 border-border hover:bg-muted cursor-pointer"
                                  >
                                    Pilih Semua ({availableBoqItems.length})
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      items.map((it, idx) => {
                        const sub = (Number(it.qty) || 0) * (Number(it.estimatedPrice) || 0);
                        const boqRef = availableBoqItems.find(
                          (b: any) => b.name.trim().toLowerCase() === it.name.trim().toLowerCase()
                        );
                        const isExceeding = boqRef && Number(it.qty) > Number(boqRef.qty);

                        return (
                          <tr key={idx} className="hover:bg-muted/15 transition-colors">
                            <td className="p-2 text-center text-muted-foreground font-mono">
                              {idx + 1}
                            </td>
                            <td className="p-2">
                              {availableBoqItems.length > 0 ? (
                                <Select
                                  value={it.name}
                                  onValueChange={(selectedName) => {
                                    const targetBoqItem = availableBoqItems.find(
                                      (b: any) => b.name === selectedName
                                    );
                                    if (targetBoqItem) {
                                      setItems((prev) => {
                                        const next = [...prev];
                                        next[idx] = {
                                          ...next[idx],
                                          name: targetBoqItem.name,
                                          spec: targetBoqItem.itemCode || next[idx].spec || "",
                                          category: targetBoqItem.category || next[idx].category || "ATK",
                                          qty: Number(targetBoqItem.qty) || next[idx].qty || 1,
                                          unit: targetBoqItem.unit || next[idx].unit || "pcs",
                                          estimatedPrice: Number(targetBoqItem.estimatedPrice) || next[idx].estimatedPrice || 0,
                                          notes: targetBoqItem.notes || next[idx].notes || "",
                                        };
                                        return next;
                                      });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs font-medium bg-background">
                                    <SelectValue placeholder="Pilih item BOQ..." />
                                  </SelectTrigger>
                                  <SelectContent className="z-70 max-h-60">
                                    {availableBoqItems.map((bIt: any) => {
                                      const isAlreadyAdded = items.some(
                                        (otherIt, otherIdx) =>
                                          otherIdx !== idx && otherIt.name === bIt.name
                                      );
                                      return (
                                        <SelectItem
                                          key={bIt.id || bIt.name}
                                          value={bIt.name}
                                          className="text-xs"
                                          disabled={isAlreadyAdded}
                                        >
                                          <div className="flex items-center justify-between gap-2 w-full">
                                            <span className="font-semibold">{bIt.name}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                              (BOQ: {bIt.qty} {bIt.unit})
                                              {isAlreadyAdded ? " • Terpilih" : ""}
                                            </span>
                                          </div>
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={it.name}
                                  onChange={(e) =>
                                    handleItemChange(idx, "name", e.target.value)
                                  }
                                  placeholder="Kertas HVS / Tinta / Sabun..."
                                  className="h-8 text-xs font-medium"
                                  required
                                />
                              )}
                            </td>
                            <td className="p-2">
                              <Input
                                value={it.spec || ""}
                                onChange={(e) =>
                                  handleItemChange(idx, "spec", e.target.value)
                                }
                                placeholder="Merk / Tipe / Ukuran..."
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2">
                              <Select
                                value={it.category || "ATK"}
                                onValueChange={(val) =>
                                  handleItemChange(idx, "category", val || "ATK")
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ITEM_CATEGORIES.map((cat) => (
                                    <SelectItem
                                      key={cat.id}
                                      value={cat.id}
                                      className="text-xs"
                                    >
                                      {cat.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <div className="space-y-0.5">
                                <Input
                                  type="number"
                                  min="0.01"
                                  step="any"
                                  value={it.qty || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      idx,
                                      "qty",
                                      parseFloat(e.target.value) || 0,
                                    )
                                  }
                                  className={cn(
                                    "h-8 text-xs text-center font-bold",
                                    isExceeding && "text-amber-600 border-amber-500 bg-amber-50/20"
                                  )}
                                  required
                                />
                                {boqRef && (
                                  <div
                                    className={cn(
                                      "text-[9px] text-center truncate",
                                      isExceeding
                                        ? "text-amber-600 font-bold"
                                        : "text-muted-foreground"
                                    )}
                                    title={`Kuantitas BOQ: ${boqRef.qty} ${boqRef.unit}`}
                                  >
                                    Maks BOQ: {boqRef.qty}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="p-2">
                              <Input
                                value={it.unit}
                                onChange={(e) =>
                                  handleItemChange(idx, "unit", e.target.value)
                                }
                                placeholder="pcs"
                                list="office-spb-units"
                                className="h-8 text-xs"
                                required
                              />
                            </td>
                            <td className="p-2">
                              <Input
                                type="number"
                                min="0"
                                value={it.estimatedPrice || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    idx,
                                    "estimatedPrice",
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                placeholder="0"
                                className="h-8 text-xs text-right font-mono"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-semibold text-foreground">
                              {formatRupiah(sub)}
                            </td>
                            <td className="p-2">
                              <Input
                                value={it.notes || ""}
                                onChange={(e) =>
                                  handleItemChange(idx, "notes", e.target.value)
                                }
                                placeholder="Alasan / Ket..."
                                className="h-8 text-xs"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <Popover
                                open={deleteConfirmIndex === idx}
                                onOpenChange={(isOpen) =>
                                  setDeleteConfirmIndex(isOpen ? idx : null)
                                }
                              >
                                <PopoverTrigger
                                  type="button"
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                  title="Hapus baris"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </PopoverTrigger>
                                <PopoverContent
                                  className="w-56 p-2.5 shadow-xl rounded-xl border border-border bg-popover text-foreground z-70"
                                  align="end"
                                  side="left"
                                  sideOffset={4}
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                      <div className="p-1 rounded-md bg-rose-500/10 text-rose-600 shrink-0 mt-0.5">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-xs font-bold text-foreground">
                                          Hapus item ini?
                                        </p>
                                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                          {it.name || "Item belum dinamai"}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/60">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeleteConfirmIndex(null)}
                                        className="h-6 px-2 text-[11px] font-medium cursor-pointer"
                                      >
                                        Batal
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() => {
                                          handleRemoveItem(idx);
                                          setDeleteConfirmIndex(null);
                                        }}
                                        className="h-6 px-2 text-[11px] font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs"
                                      >
                                        Hapus
                                      </Button>
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Unit suggestions datalist */}
              <datalist id="office-spb-units">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>

              {/* Total Summary Footer Strip */}
              <div className="p-3 bg-muted/30 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold">
                <span className="text-muted-foreground">
                  Total Estimasi Biaya Pengajuan SPB:
                </span>
                <span className="text-sm font-bold text-primary font-mono">
                  {formatRupiah(totalEstimate)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-2 border-t mt-3 flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs font-medium cursor-pointer"
            >
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              {spbToEdit ? "Simpan Perubahan SPB" : "Kirim Pengajuan SPB"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
