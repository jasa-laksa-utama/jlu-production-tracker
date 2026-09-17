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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Layers,
  Pencil,
  PackagePlus,
  Package,
  Search,
  Check,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatRupiah } from "@/lib/utils";
import {
  createOfficeBoQ,
  updateOfficeBoQ,
  getOfficeMasterItems,
  getOfficeUnits,
  OfficeBoQItemInput,
  OfficeMasterItem,
  OfficeUnit,
} from "@/app/actions/office-procurement";

interface OfficeBoQDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boqToEdit?: any | null;
  onSuccess?: () => void;
}

const ITEM_CATEGORIES = [
  { id: "ATK", label: "Alat Tulis Kantor (ATK)" },
  { id: "PANTRY", label: "Pantry & Konsumsi" },
  { id: "IT", label: "Perangkat / Aksesori IT" },
  { id: "FACILITY", label: "Kebersihan & Fasilitas" },
  { id: "MAINTENANCE", label: "Perawatan & Servis Gedung" },
  { id: "OTHER", label: "Lain-lain" },
];

const BOQ_DRAFT_KEY = "jlu_office_boq_create_draft";

export function OfficeBoQDialog({
  open,
  onOpenChange,
  boqToEdit,
  onSuccess,
}: OfficeBoQDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [boqNumber, setBoqNumber] = useState("");
  const [title, setTitle] = useState("");
  const [makerName, setMakerName] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<OfficeBoQItemInput[]>([]);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  // Master data items kategori B & C dan master units
  const [masterItems, setMasterItems] = useState<OfficeMasterItem[]>([]);
  const [isLoadingMasterItems, setIsLoadingMasterItems] = useState(false);
  const [units, setUnits] = useState<OfficeUnit[]>([]);
  const [isLoadingUnits, setIsLoadingUnits] = useState(false);

  // Sub-dialog form state untuk input / edit item
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState<number | null>(
    null,
  );

  // Field item sementara di sub-dialog
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [selectedItemCode, setSelectedItemCode] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemCategory, setItemCategory] = useState("ATK");
  const [itemQty, setItemQty] = useState<number>(1);
  const [itemUnit, setItemUnit] = useState("PCS");
  const [itemEstimatedPrice, setItemEstimatedPrice] = useState<number>(0);
  const [priceDisplay, setPriceDisplay] = useState<string>("");
  const [itemNotes, setItemNotes] = useState("");
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);

  // Tangani tombol Escape saat form item terbuka agar tidak menutup dialog utama
  useEffect(() => {
    if (!isItemDialogOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setIsItemDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isItemDialogOpen]);

  // Fetch master items kategori B & C serta master satuan dari tabel units saat modal terbuka
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    setIsLoadingMasterItems(true);
    setIsLoadingUnits(true);

    Promise.all([getOfficeMasterItems(), getOfficeUnits()]).then(
      ([itemRes, unitRes]) => {
        if (isMounted) {
          if (itemRes.success && itemRes.data) {
            setMasterItems(itemRes.data);
          }
          if (unitRes.success && unitRes.data) {
            setUnits(unitRes.data);
          }
          setIsLoadingMasterItems(false);
          setIsLoadingUnits(false);
        }
      },
    );

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Inisialisasi nomor atau muat data edit / pulihkan draft tersimpan
  useEffect(() => {
    if (!open) return;

    if (boqToEdit) {
      setHasRestoredDraft(false);
      setBoqNumber(boqToEdit.boqNumber || "");
      setTitle(boqToEdit.title || "");
      setMakerName(boqToEdit.makerName || "");
      setNotes(boqToEdit.notes || "");
      if (boqToEdit.items && boqToEdit.items.length > 0) {
        setItems(
          boqToEdit.items.map((it: any) => ({
            id: it.id,
            itemId: it.itemId || null,
            itemCode: it.itemCode || null,
            name: it.name || "",
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
      // Create new: periksa apakah ada draft tersimpan di localStorage
      try {
        const savedDraftRaw = localStorage.getItem(BOQ_DRAFT_KEY);
        if (savedDraftRaw) {
          const draft = JSON.parse(savedDraftRaw);
          if (Array.isArray(draft.items) && draft.items.length > 0) {
            setBoqNumber(draft.boqNumber || "");
            setTitle(draft.title || "");
            setMakerName(draft.makerName || "");
            setNotes(draft.notes || "");
            setItems(draft.items);
            setHasRestoredDraft(true);
            return;
          }
        }
      } catch (err) {
        console.warn("Gagal membaca draft BOQ:", err);
      }

      setBoqNumber("");
      setTitle("");
      setMakerName("");
      setNotes("");
      setItems([]);
      setHasRestoredDraft(false);
    }
  }, [open, boqToEdit]);

  // Simpan draft secara otomatis ke localStorage saat ada perubahan data di mode buat baru
  useEffect(() => {
    if (!open || boqToEdit) return;
    if (
      items.length > 0 ||
      title.trim() ||
      notes.trim() ||
      makerName.trim() ||
      boqNumber.trim()
    ) {
      try {
        const draft = {
          boqNumber,
          title,
          makerName,
          notes,
          items,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(BOQ_DRAFT_KEY, JSON.stringify(draft));
      } catch {}
    }
  }, [open, boqToEdit, boqNumber, title, makerName, notes, items]);

  // Bersihkan draft tersimpan jika user ingin mulai dari awal
  const handleClearDraft = () => {
    try {
      localStorage.removeItem(BOQ_DRAFT_KEY);
    } catch {}
    setBoqNumber("");
    setTitle("");
    setMakerName("");
    setNotes("");
    setItems([]);
    setHasRestoredDraft(false);
    toast.info("Draft BOQ telah dibersihkan. Memulai form baru.");
  };

  // Handler penutupan dialog dengan proteksi konfirmasi data tersimpan
  const handleDialogClose = (newOpen: boolean) => {
    if (!newOpen && items.length > 0 && !boqToEdit && !isSubmitting) {
      toast.info(
        "Draft item BOQ tersimpan otomatis. Anda dapat melanjutkannya nanti.",
      );
    }
    onOpenChange(newOpen);
  };

  // Buka modal untuk tambah item baru
  const handleOpenAddItem = () => {
    setEditingItemIndex(null);
    setSelectedItemId(null);
    setSelectedItemCode(null);
    setItemName("");
    setItemCategory("ATK");
    setItemQty(1);
    setItemUnit(units.length > 0 ? units[0].name : "PCS");
    setItemEstimatedPrice(0);
    setPriceDisplay("");
    setItemNotes("");
    setIsComboboxOpen(false);
    setIsItemDialogOpen(true);
  };

  // Buka modal untuk edit item yang sudah ada
  const handleOpenEditItem = (index: number) => {
    const it = items[index];
    if (!it) return;
    setEditingItemIndex(index);
    setSelectedItemId(it.itemId || null);
    setSelectedItemCode(it.itemCode || null);
    setItemName(it.name || "");
    setItemCategory(it.category || "ATK");
    setItemQty(Number(it.qty) || 1);
    setItemUnit(it.unit || "pcs");
    const pr = Number(it.estimatedPrice) || 0;
    setItemEstimatedPrice(pr);
    setPriceDisplay(pr > 0 ? formatRupiah(pr) : "");
    setItemNotes(it.notes || "");
    setIsComboboxOpen(false);
    setIsItemDialogOpen(true);
  };

  // Pilih item dari Master Data Combobox
  const handleSelectMasterItem = (item: OfficeMasterItem) => {
    setSelectedItemId(item.id);
    setSelectedItemCode(item.code);
    setItemName(item.name);
    setItemUnit(item.unit || (units.length > 0 ? units[0].name : "PCS"));
    const pr = Number(item.unitPrice) || 0;
    setItemEstimatedPrice(pr);
    setPriceDisplay(pr > 0 ? formatRupiah(pr) : "");

    // Kategori default bila cocok
    if (item.code.startsWith("ATK")) {
      setItemCategory("ATK");
    } else if (item.code.startsWith("PAN")) {
      setItemCategory("PANTRY");
    } else if (item.code.startsWith("IT")) {
      setItemCategory("IT");
    } else if (item.code.startsWith("FAC")) {
      setItemCategory("FACILITY");
    } else if (item.category === "B") {
      setItemCategory("ATK");
    } else if (item.category === "C") {
      setItemCategory("FACILITY");
    }

    setIsComboboxOpen(false);
  };

  // Handler input harga satuan berformat Rupiah
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawDigits = e.target.value.replace(/[^0-9]/g, "");
    if (!rawDigits) {
      setItemEstimatedPrice(0);
      setPriceDisplay("");
      return;
    }
    const num = parseInt(rawDigits, 10);
    setItemEstimatedPrice(num);
    setPriceDisplay(formatRupiah(num));
  };

  // Simpan item dari sub-dialog ke daftar tabel
  const handleSaveItem = () => {
    if (!itemName.trim()) {
      toast.error("Pilih barang dari daftar master data.");
      return;
    }
    const qtyNum = Number(itemQty);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      toast.error("Jumlah (Qty) harus lebih besar dari 0.");
      return;
    }
    if (!itemUnit.trim()) {
      toast.error("Satuan barang wajib diisi (misal: pcs, rim, box).");
      return;
    }

    const priceNum = Number(itemEstimatedPrice) || 0;
    const newItem: OfficeBoQItemInput = {
      itemId: selectedItemId,
      itemCode: selectedItemCode,
      name: itemName.trim(),
      category: itemCategory,
      qty: qtyNum,
      unit: itemUnit.trim(),
      estimatedPrice: priceNum,
      notes: itemNotes.trim() || "",
    };

    if (editingItemIndex !== null) {
      setItems((prev) => {
        const next = [...prev];
        next[editingItemIndex] = newItem;
        return next;
      });
      toast.success("Item berhasil diperbarui.");
    } else {
      setItems((prev) => [...prev, newItem]);
      toast.success("Item berhasil ditambahkan ke daftar.");
    }

    setIsItemDialogOpen(false);
  };

  // Hapus item dari daftar
  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
    toast.info("Item dihapus dari daftar.");
  };

  // Helper badge kategori
  const getCategoryBadge = (catId?: string) => {
    switch (catId) {
      case "ATK":
        return (
          <Badge
            variant="outline"
            className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20 text-[10px] font-semibold"
          >
            ATK
          </Badge>
        );
      case "PANTRY":
        return (
          <Badge
            variant="outline"
            className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] font-semibold"
          >
            Pantry
          </Badge>
        );
      case "IT":
        return (
          <Badge
            variant="outline"
            className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 text-[10px] font-semibold"
          >
            IT
          </Badge>
        );
      case "FACILITY":
        return (
          <Badge
            variant="outline"
            className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px] font-semibold"
          >
            Kebersihan
          </Badge>
        );
      case "MAINTENANCE":
        return (
          <Badge
            variant="outline"
            className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20 text-[10px] font-semibold"
          >
            Perawatan
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="bg-muted text-muted-foreground border-border text-[10px] font-semibold"
          >
            Lain-lain
          </Badge>
        );
    }
  };

  // Kalkulasi total estimasi anggaran
  const totalEstimate = items.reduce((sum, it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.estimatedPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Judul rencana kebutuhan wajib diisi.");
      return;
    }

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      toast.error("Tambahkan minimal 1 item kebutuhan pada daftar.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (boqToEdit) {
        const res = await updateOfficeBoQ(boqToEdit.id, {
          boqNumber: boqNumber.trim(),
          title: title.trim(),
          department: "GENERAL",
          makerName: makerName.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validItems,
        });

        if (!res.success) throw new Error(res.error);
        toast.success(res.message || "BOQ Umum berhasil diperbarui.");
      } else {
        const res = await createOfficeBoQ({
          boqNumber: boqNumber.trim(),
          title: title.trim(),
          department: "GENERAL",
          makerName: makerName.trim() || undefined,
          notes: notes.trim() || undefined,
          items: validItems,
        });

        if (!res.success) throw new Error(res.error);
        toast.success(res.message || "BOQ Umum berhasil dibuat.");
        try {
          localStorage.removeItem(BOQ_DRAFT_KEY);
        } catch {}
        setHasRestoredDraft(false);
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan saat menyimpan BOQ Umum.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const itemSubtotal =
    (Number(itemQty) || 0) * (Number(itemEstimatedPrice) || 0);

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="w-full sm:max-w-7xl! max-h-[90vh] flex flex-col p-4 sm:p-6 rounded-2xl overflow-hidden">
          <DialogHeader className="border-b pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                  {boqToEdit
                    ? "Edit BOQ Umum Kantor"
                    : "Buat BOQ Umum Kantor Baru"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Rencana anggaran estimasi pengadaan barang operasional kantor
                  non-proyek.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form
            onSubmit={handleSubmit}
            className="flex-1 overflow-y-auto space-y-4 py-3 pr-1"
          >
            {/* Banner Draft Tersimpan yang Dipulihkan */}
            {hasRestoredDraft && items.length > 0 && !boqToEdit && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">
                      Draft BOQ Dipulihkan ({items.length} item tersimpan
                      otomatis)
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      Data barang dari sesi sebelumnya telah dimuat kembali
                      secara otomatis agar tidak hilang.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setHasRestoredDraft(false)}
                    className="h-6.5 px-2 text-[11px] font-medium text-foreground hover:bg-amber-500/20 cursor-pointer"
                  >
                    Lanjutkan
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearDraft}
                    className="h-6.5 px-2 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 border-rose-500/30 cursor-pointer"
                  >
                    Reset Form
                  </Button>
                </div>
              </div>
            )}

            {/* Header Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-muted/20 rounded-xl border border-border/60">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Nomor BOQ <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={boqNumber}
                  onChange={(e) => setBoqNumber(e.target.value)}
                  placeholder="Nomor BOQ..."
                  className="h-8.5 text-xs font-mono font-medium"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Pemohon / Pembuat
                </Label>
                <Input
                  value={makerName}
                  onChange={(e) => setMakerName(e.target.value)}
                  placeholder="Nama Admin Kantor / Pembuat..."
                  className="h-8.5 text-xs"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Judul Rencana Kebutuhan{" "}
                  <span className="text-rose-500">*</span>
                </Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Pengadaan ATK & Pantry Kantor Periode September 2026"
                  className="h-8.5 text-xs font-medium"
                  required
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Catatan / Keterangan (Opsional)
                </Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan tambahan justifikasi atau instruksi pengadaan..."
                  className="text-xs min-h-16 resize-y"
                />
              </div>
            </div>

            {/* Daftar Item Kebutuhan */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">
                    Daftar Barang / Kebutuhan ({items.length} item)
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleOpenAddItem}
                  className="h-7.5 text-xs font-semibold gap-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Item
                </Button>
              </div>

              <div className="border border-border/70 rounded-xl overflow-hidden bg-background">
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold sticky top-0 border-b z-10">
                      <tr>
                        <th className="p-2.5 w-10 text-center">No</th>
                        <th className="p-2.5 min-w-44">Nama Barang / Jasa</th>
                        <th className="p-2.5 w-28 text-center">Kategori</th>
                        <th className="p-2.5 w-24 text-center">Volume</th>
                        <th className="p-2.5 min-w-32 text-right">
                          Harga Satuan
                        </th>
                        <th className="p-2.5 min-w-32 text-right">Subtotal</th>
                        <th className="p-2.5 min-w-36">Catatan</th>
                        <th className="p-2.5 w-20 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-8 text-center text-muted-foreground"
                          >
                            <div className="max-w-xs mx-auto space-y-2">
                              <PackagePlus className="w-8 h-8 text-muted-foreground/40 mx-auto" />
                              <p className="font-semibold text-foreground text-xs">
                                Belum ada item kebutuhan
                              </p>
                              <p className="text-[11px]">
                                Klik tombol <strong>+ Tambah Item</strong> untuk
                                memasukkan rincian barang dan estimasi harga.
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleOpenAddItem}
                                className="h-7 px-2.5 text-xs font-medium gap-1 rounded-lg border-border/80 hover:bg-muted cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 text-primary" />
                                Tambah Item Sekarang
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        items.map((it, idx) => {
                          const sub =
                            (Number(it.qty) || 0) *
                            (Number(it.estimatedPrice) || 0);
                          return (
                            <tr
                              key={idx}
                              className="hover:bg-muted/15 transition-colors"
                            >
                              <td className="p-2.5 text-center text-muted-foreground font-mono">
                                {idx + 1}
                              </td>
                              <td className="p-2.5">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-foreground">
                                      {it.name}
                                    </span>
                                    {it.itemCode && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[9px] px-1.5 py-0 h-4 bg-muted text-muted-foreground border border-border/60"
                                      >
                                        {it.itemCode}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="p-2.5 text-center">
                                {getCategoryBadge(it.category)}
                              </td>
                              <td className="p-2.5 text-center font-medium text-foreground">
                                {it.qty} {it.unit}
                              </td>
                              <td className="p-2.5 text-right text-foreground">
                                {formatRupiah(Number(it.estimatedPrice) || 0)}
                              </td>
                              <td className="p-2.5 text-right font-semibold text-foreground">
                                {formatRupiah(sub)}
                              </td>
                              <td className="p-2.5 text-muted-foreground">
                                {it.notes ? (
                                  <span className="line-clamp-2">
                                    {it.notes}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40 italic">
                                    -
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleOpenEditItem(idx)}
                                    className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                                    title="Edit item"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Popover
                                    open={deleteConfirmIndex === idx}
                                    onOpenChange={(isOpen) =>
                                      setDeleteConfirmIndex(isOpen ? idx : null)
                                    }
                                  >
                                    <PopoverTrigger
                                      type="button"
                                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-colors"
                                      title="Hapus item"
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
                                              {it.name}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-border/60">
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setDeleteConfirmIndex(null)
                                            }
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
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Total Summary Footer Strip */}
                <div className="p-3 bg-muted/30 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-semibold">
                  <span className="text-muted-foreground">
                    Total Estimasi Anggaran ({items.length} item):
                  </span>
                  <span className="text-sm font-bold text-primary tracking-wider">
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
                onClick={() => handleDialogClose(false)}
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
                {boqToEdit ? "Simpan Perubahan BOQ" : "Simpan BOQ Umum"}
              </Button>
            </DialogFooter>
          </form>

          {/* IN-DIALOG MODAL OVERLAY: FORM INPUT / EDIT ITEM KEBUTUHAN (ZERO UI DRIFT / NO NESTED SCROLL LOCK) */}
          {isItemDialogOpen && (
            <div
              className="absolute inset-0 z-40 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150"
              onClick={() => setIsItemDialogOpen(false)}
            >
              <div
                className="w-full max-w-xl max-h-[85vh] overflow-y-auto bg-card border border-border shadow-2xl rounded-2xl p-4 sm:p-5 gap-3 flex flex-col animate-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Sub-Form */}
                <div className="border-b pb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-semibold text-foreground">
                        {editingItemIndex !== null
                          ? "Edit Item Kebutuhan"
                          : "Tambah Item Kebutuhan"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Lengkapi nama barang, volume, dan estimasi harga.
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsItemDialogOpen(false)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSaveItem();
                  }}
                  className="space-y-3 pt-1"
                >
                  {/* Baris 1: Pilihan Barang Master & Kategori BOQ */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-7 space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold text-foreground">
                          Nama Barang <span className="text-rose-500">*</span>
                        </Label>
                        {selectedItemCode && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Kode: {selectedItemCode}
                          </span>
                        )}
                      </div>

                      <Popover
                        open={isComboboxOpen}
                        onOpenChange={setIsComboboxOpen}
                      >
                        <PopoverTrigger
                          type="button"
                          className="w-full h-8.5 justify-between text-left text-xs font-normal bg-background hover:bg-muted/50 border border-input rounded-md px-3 cursor-pointer flex items-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {itemName ? (
                            <div className="flex items-center gap-2 truncate">
                              {selectedItemCode && (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1 py-0 font-mono font-bold"
                                >
                                  {selectedItemCode}
                                </Badge>
                              )}
                              <span className="font-semibold text-foreground truncate">
                                {itemName}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Search className="w-3.5 h-3.5" />
                              Pilih barang...
                            </span>
                          )}
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </PopoverTrigger>

                        <PopoverContent
                          className="w-105 max-w-[90vw] p-0 z-70 shadow-2xl rounded-xl border border-border bg-popover"
                          align="start"
                        >
                          <Command
                            filter={(value, search) => {
                              return value
                                .toLowerCase()
                                .includes(search.toLowerCase())
                                ? 1
                                : 0;
                            }}
                          >
                            <CommandInput
                              placeholder="Cari nama atau kode barang..."
                              className="h-8.5 text-xs"
                            />
                            <CommandList className="max-h-60 overflow-y-auto">
                              <CommandEmpty className="p-3 text-center text-xs text-muted-foreground">
                                {isLoadingMasterItems ? (
                                  <div className="flex items-center justify-center gap-2 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                    <span>Memuat barang...</span>
                                  </div>
                                ) : (
                                  "Barang tidak ditemukan."
                                )}
                              </CommandEmpty>

                              <CommandGroup
                                heading={`Master Data Barang Kantor (${masterItems.length} Tersedia)`}
                              >
                                {masterItems.map((master) => {
                                  const isSelected =
                                    selectedItemId === master.id ||
                                    itemName === master.name;
                                  return (
                                    <CommandItem
                                      key={master.id}
                                      value={`${master.name} ${master.code} ${master.typeMerk || ""}`}
                                      onSelect={() =>
                                        handleSelectMasterItem(master)
                                      }
                                      className="cursor-pointer text-xs py-2 px-2.5 flex items-center justify-between gap-2 aria-selected:bg-muted"
                                    >
                                      <div className="flex items-start gap-2 min-w-0 flex-1">
                                        <Check
                                          className={cn(
                                            "w-3.5 h-3.5 mt-0.5 shrink-0 text-primary",
                                            isSelected
                                              ? "opacity-100"
                                              : "opacity-0",
                                          )}
                                        />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-semibold text-foreground truncate">
                                              {master.name}
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                                            <span className="text-muted-foreground">
                                              {master.code}
                                            </span>
                                            <span>•</span>
                                            <span className="font-medium text-foreground/80">
                                              {master.currentStock}{" "}
                                              {master.unit}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <span className="text-[11px] font-bold font-mono text-primary">
                                          {formatRupiah(master.unitPrice)}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  );
                                })}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="sm:col-span-5 space-y-1">
                      <Label className="text-xs font-semibold text-foreground">
                        Kategori BOQ <span className="text-rose-500">*</span>
                      </Label>
                      <Select
                        value={itemCategory}
                        onValueChange={(val) => setItemCategory(val || "ATK")}
                      >
                        <SelectTrigger className="h-8.5 text-xs w-full cursor-pointer">
                          <SelectValue placeholder="Pilih Kategori" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[220px]">
                          {ITEM_CATEGORIES.map((c) => (
                            <SelectItem
                              key={c.id}
                              value={c.id}
                              className="text-xs cursor-pointer"
                            >
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Baris 2: Qty, Satuan, Estimasi Harga */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">
                        Qty <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        type="number"
                        min="0.01"
                        step="any"
                        value={itemQty || ""}
                        onChange={(e) =>
                          setItemQty(parseFloat(e.target.value) || 0)
                        }
                        placeholder="1"
                        className="h-8.5 text-xs text-center font-medium"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-foreground">
                        Satuan <span className="text-rose-500">*</span>
                      </Label>
                      <Select
                        value={
                          units.find(
                            (u) =>
                              u.name.toLowerCase() ===
                              (itemUnit || "").toLowerCase(),
                          )?.name ||
                          itemUnit ||
                          (units.length > 0 ? units[0].name : "PCS")
                        }
                        onValueChange={(val) => setItemUnit(val || "PCS")}
                      >
                        <SelectTrigger className="h-8.5 text-xs w-full cursor-pointer font-medium uppercase">
                          <SelectValue placeholder="Pilih Satuan" />
                        </SelectTrigger>
                        <SelectContent className="max-h-56 overflow-y-auto min-w-[120px]">
                          {units.map((u) => (
                            <SelectItem
                              key={u.id}
                              value={u.name}
                              className="text-xs cursor-pointer font-medium uppercase"
                            >
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-xs font-semibold text-foreground">
                        Harga Satuan (Rp)
                      </Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={priceDisplay}
                        onChange={handlePriceChange}
                        placeholder="Rp 0"
                        className="h-8.5 text-xs text-right font-medium"
                      />
                    </div>
                  </div>

                  {/* Baris 3: Catatan / Spesifikasi Singkat */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Catatan / Spesifikasi (Opsional)
                    </Label>
                    <Textarea
                      value={itemNotes}
                      onChange={(e) => setItemNotes(e.target.value)}
                      placeholder="Merk, warna, tipe, atau catatan kebutuhan..."
                      className="h-8.5 text-xs"
                    />
                  </div>

                  {/* Footer Ringkas: Subtotal di kiri, Action di kanan */}
                  <div className="pt-3 border-t mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 rounded-lg border border-border/60">
                      <span className="text-[11px] text-muted-foreground">
                        Subtotal:
                      </span>
                      <span className="text-xs font-semibold   text-primary">
                        {formatRupiah(itemSubtotal)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsItemDialogOpen(false)}
                        className="h-8 text-xs font-medium cursor-pointer"
                      >
                        Batal
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        className="h-8 text-xs font-bold gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {editingItemIndex !== null
                          ? "Simpan Perubahan"
                          : "Tambahkan Item"}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
