"use client";

import React, { useState, useEffect, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  RotateCcw,
  ClipboardList,
  Edit2,
  Save,
  X,
  Loader2,
  Tag,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getSubComponents,
  addSubComponent,
  bulkAddSubComponents,
  updateSubComponent,
  deleteSubComponent,
  toggleSubComponentComplete,
  bulkMarkSubComponentsComplete,
  ComponentType,
} from "@/app/actions/sub-components";

interface SubComponentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  componentId: string;
  componentName: string;
  unitName?: string;
  type: ComponentType;
  readOnly?: boolean;
  mode?: "CONFIG" | "PROGRESS" | "READONLY";
}

export function SubComponentDialog({
  open,
  onOpenChange,
  componentId,
  componentName,
  unitName,
  type = "STRUCTURE",
  readOnly = false,
  mode = "CONFIG",
}: SubComponentDialogProps) {
  const isEffectiveReadOnly = readOnly || mode === "READONLY";
  const isConfigMode = mode === "CONFIG" && !isEffectiveReadOnly;
  const isProgressMode = mode === "PROGRESS";

  const [isPending, startTransition] = useTransition();
  const [subItems, setSubItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "LIST" | "ADD_SINGLE" | "BULK_PASTE"
  >("LIST");

  // Single Add Form State
  const [singleName, setSingleName] = useState("");
  const [singleQty, setSingleQty] = useState(1);
  const [singleSatuan, setSingleSatuan] = useState("pcs");
  const [singleDimension, setSingleDimension] = useState("");
  const [singleMarking, setSingleMarking] = useState("");

  // Bulk Paste State
  const [bulkText, setBulkText] = useState("");

  // Delete Confirmation State
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({
    isOpen: false,
    id: "",
    name: "",
  });

  // Inline Editing State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    qty: number;
    satuan: string;
    dimension: string;
    markingCode: string;
  }>({
    name: "",
    qty: 1,
    satuan: "pcs",
    dimension: "",
    markingCode: "",
  });

  const fetchItems = async () => {
    if (!componentId) return;
    setIsLoading(true);
    try {
      const res = await getSubComponents(componentId, type);
      if (res.success && res.data) {
        setSubItems(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && componentId) {
      fetchItems();
      setActiveTab("LIST");
      setEditingId(null);
    }
  }, [open, componentId, type]);

  const completedCount = subItems.filter((i) => i.isCompleted).length;
  const totalCount = subItems.length;
  const completionPercent =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleToggleComplete = (id: string, currentStatus: boolean) => {
    startTransition(async () => {
      const res = await toggleSubComponentComplete(id, type, !currentStatus);
      if (res.success) {
        setSubItems((prev) =>
          prev.map((i) =>
            i.id === id
              ? {
                  ...i,
                  isCompleted: !currentStatus,
                  completedAt: !currentStatus ? new Date() : null,
                }
              : i,
          ),
        );
        toast.success(
          !currentStatus
            ? "Sub-komponen ditandai selesai"
            : "Status diubah ke pending",
        );
      } else {
        toast.error(res.error || "Gagal mengubah status");
      }
    });
  };

  const handleBulkMark = (targetStatus: boolean) => {
    startTransition(async () => {
      const res = await bulkMarkSubComponentsComplete(
        componentId,
        type,
        targetStatus,
      );
      if (res.success) {
        setSubItems((prev) =>
          prev.map((i) => ({
            ...i,
            isCompleted: targetStatus,
            completedAt: targetStatus ? new Date() : null,
          })),
        );
        toast.success(
          targetStatus
            ? "Semua sub-komponen ditandai selesai"
            : "Semua sub-komponen di-reset ke pending",
        );
      } else {
        toast.error(res.error || "Gagal mengubah status");
      }
    });
  };

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName.trim()) {
      toast.error("Nama sub-komponen wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await addSubComponent(componentId, type, {
        name: singleName,
        qty: singleQty,
        satuan: singleSatuan,
        dimension: singleDimension,
        markingCode: singleMarking,
      });

      if (res.success) {
        toast.success("Sub-komponen berhasil ditambahkan");
        setSingleName("");
        setSingleDimension("");
        setSingleMarking("");
        setSingleQty(1);
        setActiveTab("LIST");
        fetchItems();
      } else {
        toast.error(res.error || "Gagal menambahkan");
      }
    });
  };

  const handleBulkPasteSubmit = () => {
    if (!bulkText.trim()) {
      toast.error("Teks input masih kosong");
      return;
    }

    // Format per baris: Nama Part, Qty, Satuan, Dimensi, Marking (dipisahkan koma atau tab)
    const lines = bulkText.split("\n").filter((l) => l.trim().length > 0);
    const parsedItems = lines
      .map((line) => {
        const parts = line.includes("\t") ? line.split("\t") : line.split(",");
        const name = parts[0]?.trim() || "";
        const qty = parseInt(parts[1]?.trim() || "1", 10) || 1;
        const satuan = parts[2]?.trim() || "pcs";
        const dimension = parts[3]?.trim() || "";
        const markingCode = parts[4]?.trim() || "";
        return { name, qty, satuan, dimension, markingCode };
      })
      .filter((item) => item.name.length > 0);

    if (parsedItems.length === 0) {
      toast.error("Tidak ada data valid yang dapat diproses");
      return;
    }

    startTransition(async () => {
      const res = await bulkAddSubComponents(componentId, type, parsedItems);
      if (res.success) {
        toast.success(`${res.count} sub-komponen berhasil ditambahkan`);
        setBulkText("");
        setActiveTab("LIST");
        fetchItems();
      } else {
        toast.error(res.error || "Gagal menambahkan data massal");
      }
    });
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirm.id) return;
    startTransition(async () => {
      const res = await deleteSubComponent(deleteConfirm.id, type);
      if (res.success) {
        setSubItems((prev) => prev.filter((i) => i.id !== deleteConfirm.id));
        toast.success("Sub-komponen dihapus");
        setDeleteConfirm({ isOpen: false, id: "", name: "" });
      } else {
        toast.error(res.error || "Gagal menghapus");
      }
    });
  };

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      qty: item.qty || 1,
      satuan: item.satuan || "pcs",
      dimension: item.dimension || item.spec || "",
      markingCode: item.markingCode || "",
    });
  };

  const saveEdit = (id: string) => {
    startTransition(async () => {
      const res = await updateSubComponent(id, type, {
        name: editForm.name,
        qty: editForm.qty,
        satuan: editForm.satuan,
        dimension: editForm.dimension,
        markingCode: editForm.markingCode,
      });

      if (res.success) {
        toast.success("Sub-komponen diperbarui");
        setEditingId(null);
        fetchItems();
      } else {
        toast.error(res.error || "Gagal memperbarui");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl! max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border-border/80 shadow-2xl">
        {/* Header Bersih & Ringkas */}
        <DialogHeader className="p-5 pb-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-foreground">
                    {isConfigMode
                      ? `Konfigurasi Sub-Part: ${componentName}`
                      : `Checklist Progres Sub-Part: ${componentName}`}
                  </DialogTitle>
                  <DialogDescription className="text-xs font-semibold text-muted-foreground">
                    {unitName ? `Unit: ${unitName} • ` : ""}
                    Tipe:{" "}
                    <span className="font-semibold text-muted-foreground">
                      {type === "STRUCTURE" ? "Struktur" : "Mekanikal"}
                    </span>
                    {isConfigMode ? (
                      <span className="text-primary font-medium ml-1.5 bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                        ⚙️ Master Data Sub-Part
                      </span>
                    ) : (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium ml-1.5 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px]">
                        ✓ Update Progres Pengerjaan
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Status Progress Mini */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-semibold px-2.5 py-0.5 rounded-md",
                    completionPercent === 100
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                      : completionPercent > 0
                        ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                        : "bg-muted text-muted-foreground border-border",
                  )}
                >
                  {completedCount} / {totalCount} Part Selesai (
                  {completionPercent}%)
                </Badge>
              </div>
              <div className="w-36 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all duration-300",
                    completionPercent === 100 ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Sub-Header & Navigation */}
          {isConfigMode ? (
            /* Mode Konfigurasi: Tab Menu Lengkap */
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40">
              <div className="flex items-center gap-1.5 bg-muted/60 p-0.5 rounded-lg">
                <Button
                  type="button"
                  variant={activeTab === "LIST" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("LIST")}
                  className="h-7 text-xs font-medium px-3 rounded-md shadow-none cursor-pointer"
                >
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
                  Daftar Part ({totalCount})
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "ADD_SINGLE" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("ADD_SINGLE")}
                  className="h-7 text-xs font-medium px-3 rounded-md shadow-none cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Tambah Part
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "BULK_PASTE" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab("BULK_PASTE")}
                  className="h-7 text-xs font-medium px-3 rounded-md shadow-none cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Paste Banyak
                </Button>
              </div>

              {/* Quick Actions */}
              {totalCount > 0 && activeTab === "LIST" && (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleBulkMark(true)}
                    className="h-7 text-[11px] font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Tandai Semua Selesai
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleBulkMark(false)}
                    className="h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                </div>
              )}
            </div>
          ) : (
            /* Mode Progress: Bar Checklist Bersih */
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-border/40">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">
                  Daftar Part Pengerjaan:{" "}
                  <span className="font-bold text-foreground">
                    {totalCount} part
                  </span>
                </span>
              </div>

              {/* Quick Actions Progress */}
              {totalCount > 0 && !isEffectiveReadOnly && (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleBulkMark(true)}
                    className="h-7 text-[11px] font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 cursor-pointer shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                    Tandai Semua Selesai
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleBulkMark(false)}
                    className="h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Isi Dialog */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs">Memuat daftar sub-komponen...</p>
            </div>
          ) : activeTab === "ADD_SINGLE" && isConfigMode ? (
            /* Mode Tambah 1 Part (Hanya di Mode Config) */
            <form
              onSubmit={handleAddSingle}
              className="space-y-4 max-w-lg mx-auto py-2"
            >
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Nama Sub-Komponen / Part{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder="Contoh: UNP 120 L=6000mm, Stiffener Plate 6mm"
                  value={singleName}
                  onChange={(e) => setSingleName(e.target.value)}
                  className="h-9 text-xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Jumlah (Qty)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={singleQty}
                    onChange={(e) =>
                      setSingleQty(parseInt(e.target.value, 10) || 1)
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Satuan</Label>
                  <Input
                    placeholder="pcs / set / kg"
                    value={singleSatuan}
                    onChange={(e) => setSingleSatuan(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Dimensi / Spesifikasi (Opsional)
                  </Label>
                  <Input
                    placeholder="Contoh: t=6mm, 150x200"
                    value={singleDimension}
                    onChange={(e) => setSingleDimension(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    Kode Marking (Opsional)
                  </Label>
                  <Input
                    placeholder="Contoh: P01 / SF-01-A"
                    value={singleMarking}
                    onChange={(e) => setSingleMarking(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("LIST")}
                  className="h-9 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isPending || !singleName.trim()}
                  className="h-9 text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Simpan Sub-Komponen
                </Button>
              </div>
            </form>
          ) : activeTab === "BULK_PASTE" && isConfigMode ? (
            /* Mode Bulk Paste (Hanya di Mode Config) */
            <div className="space-y-3 py-1">
              <div className="bg-muted/40 p-3 rounded-xl border border-border/50 text-xs space-y-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-primary" />
                  Format Paste Cepat (1 baris per sub-part):
                </p>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Ketik atau paste dari Excel:{" "}
                  <code className="bg-background px-1 py-0.5 rounded text-primary font-mono">
                    Nama Part, Qty, Satuan, Dimensi, Kode Marking
                  </code>
                </p>
                <p className="text-muted-foreground text-[10px] italic">
                  Contoh: <br />
                  UNP 120 L=6000, 2, pcs, Profil UNP, P01
                  <br />
                  Angle Bar L50.50.5, 6, pcs, L=1200mm, P02
                  <br />
                  Stiffener Plate, 12, pcs, t=6mm, P03
                </p>
              </div>

              <Textarea
                placeholder="Paste daftar sub-komponen di sini..."
                rows={7}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                className="text-xs font-mono resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab("LIST")}
                  className="h-9 text-xs font-semibold cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isPending || !bulkText.trim()}
                  onClick={handleBulkPasteSubmit}
                  className="h-9 text-xs font-bold shadow-sm cursor-pointer"
                >
                  {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Proses & Tambahkan Data
                </Button>
              </div>
            </div>
          ) : (
            /* Mode Tabel Daftar Sub-Komponen */
            <div>
              {subItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-2xl p-6 bg-muted/10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Layers className="w-6 h-6 opacity-40" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">
                    {isConfigMode
                      ? "Belum Ada Rincian Sub-Komponen"
                      : "Belum Ada Sub-Komponen yang Dikonfigurasi"}
                  </h4>
                  <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
                    {isConfigMode
                      ? "Komponen ini belum memiliki sub-part. Tambahkan part pembentuk agar tim QC & Produksi dapat memverifikasi fisik pengerjaan secara rinci."
                      : "Komponen ini belum memiliki rincian sub-part. Penambahan & konfigurasi master data sub-part dapat dilakukan di menu Kelola Unit & Komponen."}
                  </p>
                  {isConfigMode && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setActiveTab("ADD_SINGLE")}
                        className="h-8 text-xs font-bold rounded-lg cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1.5" />
                        Tambah Part Pertama
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveTab("BULK_PASTE")}
                        className="h-8 text-xs font-semibold rounded-lg cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 mr-1.5" />
                        Paste Banyak
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-border/60 rounded-xl overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-muted/40">
                      <TableRow className="h-9 border-b border-border/60 hover:bg-transparent">
                        <TableHead className="w-12 text-center text-xs font-semibold">
                          Checklist
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Nama Sub-Part
                        </TableHead>
                        <TableHead className="w-20 text-center text-xs font-semibold">
                          Qty
                        </TableHead>
                        <TableHead className="text-xs font-semibold">
                          Dimensi / Spek
                        </TableHead>
                        <TableHead className="w-28 text-xs font-semibold">
                          Marking
                        </TableHead>
                        {isConfigMode && (
                          <TableHead className="w-20 text-right text-xs font-semibold pr-4">
                            Aksi
                          </TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subItems.map((item) => {
                        const isEditing = editingId === item.id;
                        return (
                          <TableRow
                            key={item.id}
                            className={cn(
                              "h-10 transition-colors border-b border-border/40 hover:bg-muted/30",
                              item.isCompleted ? "bg-emerald-500/5" : "",
                            )}
                          >
                            {/* Checkbox Status */}
                            <TableCell className="text-center p-2">
                              <Checkbox
                                checked={item.isCompleted}
                                onCheckedChange={() =>
                                  handleToggleComplete(
                                    item.id,
                                    item.isCompleted,
                                  )
                                }
                                disabled={isPending || isEffectiveReadOnly}
                                className="cursor-pointer data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                              />
                            </TableCell>

                            {/* Nama Part */}
                            <TableCell className="py-2">
                              {isEditing && isConfigMode ? (
                                <Input
                                  value={editForm.name}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      name: e.target.value,
                                    })
                                  }
                                  className="h-7 text-xs"
                                  autoFocus
                                />
                              ) : (
                                <div className="flex flex-col">
                                  <span
                                    className={cn(
                                      "text-xs font-semibold transition-all",
                                      item.isCompleted
                                        ? "line-through text-muted-foreground"
                                        : "text-foreground",
                                    )}
                                  >
                                    {item.name}
                                  </span>
                                  {item.isCompleted && (
                                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                                      ✓ Selesai Produksi {item.completedBy ? `(oleh ${item.completedBy})` : ""}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* Qty & Satuan */}
                            <TableCell className="text-center py-2">
                              {isEditing && isConfigMode ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={editForm.qty}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        qty: parseInt(e.target.value, 10) || 1,
                                      })
                                    }
                                    className="h-7 w-12 text-center text-xs p-1"
                                  />
                                  <Input
                                    value={editForm.satuan}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        satuan: e.target.value,
                                      })
                                    }
                                    className="h-7 w-12 text-xs p-1"
                                  />
                                </div>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-[11px] font-semibold px-1.5 py-0.5"
                                >
                                  {item.qty} {item.satuan || "pcs"}
                                </Badge>
                              )}
                            </TableCell>

                            {/* Dimensi */}
                            <TableCell className="py-2 text-xs text-foreground">
                              {isEditing && isConfigMode ? (
                                <Input
                                  value={editForm.dimension}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      dimension: e.target.value,
                                    })
                                  }
                                  className="h-7 text-xs"
                                  placeholder="Dimensi..."
                                />
                              ) : (
                                item.dimension ||
                                item.spec || (
                                  <span className="text-muted-foreground/40 italic">
                                    -
                                  </span>
                                )
                              )}
                            </TableCell>

                            {/* Kode Marking */}
                            <TableCell className="py-2">
                              {isEditing && isConfigMode ? (
                                <Input
                                  value={editForm.markingCode}
                                  onChange={(e) =>
                                    setEditForm({
                                      ...editForm,
                                      markingCode: e.target.value,
                                    })
                                  }
                                  className="h-7 text-xs"
                                  placeholder="Kode..."
                                />
                              ) : item.markingCode ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono bg-background border-primary/30 text-primary px-1.5 py-0.5"
                                >
                                  <Tag className="w-2.5 h-2.5 mr-1" />
                                  {item.markingCode}
                                </Badge>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/40">
                                  -
                                </span>
                              )}
                            </TableCell>

                            {/* Aksi (Hanya di Config Mode) */}
                            {isConfigMode && (
                              <TableCell className="text-right py-2 pr-3">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => saveEdit(item.id)}
                                      disabled={isPending}
                                      className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => setEditingId(null)}
                                      className="h-7 w-7 text-muted-foreground hover:bg-muted cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => startEdit(item)}
                                      className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="ghost"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          isOpen: true,
                                          id: item.id,
                                          name: item.name,
                                        })
                                      }
                                      className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-500/10 cursor-pointer"
                                      title="Hapus Sub-Komponen"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border/60 bg-muted/10 flex items-center justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 text-xs font-semibold px-4 cursor-pointer"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Modal Konfirmasi Hapus Sederhana */}
    <Dialog
      open={deleteConfirm.isOpen}
      onOpenChange={(isOpen) => {
        if (!isOpen) setDeleteConfirm({ isOpen: false, id: "", name: "" });
      }}
    >
      <DialogContent className="max-w-xs! p-4.5 rounded-xl gap-3.5 shadow-xl border-border/80">
        <DialogHeader className="p-0 space-y-1">
          <DialogTitle className="text-sm font-semibold text-foreground">
            Hapus Sub-Komponen?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Yakin ingin menghapus{" "}
            <span className="font-semibold text-foreground">
              "{deleteConfirm.name}"
            </span>
            ?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="-mx-4.5 -mb-4.5 p-3 flex-row justify-end gap-2 bg-muted/30 border-t border-border/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              setDeleteConfirm({ isOpen: false, id: "", name: "" })
            }
            className="h-7.5 text-xs font-semibold px-3 rounded-md cursor-pointer"
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleConfirmDelete}
            className="h-7.5 text-xs font-semibold px-3 rounded-md gap-1.5 cursor-pointer bg-red-600 hover:bg-red-700 text-white"
          >
            {isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Hapus
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
);
}
