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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  FileText,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Printer,
  Wrench,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import dynamic from "next/dynamic";
import {
  createSPJ,
  getSPJHistory,
  deleteSPJ,
  updateSPJ,
  updateSPJItemStatus,
  CreateSPJItemInput,
} from "@/app/actions/spj";
import { SPJPDFDocument } from "./spj-pdf-document";

const PDFViewer = dynamic(
  () => import("@react-pdf/renderer").then((m) => m.PDFViewer),
  {
    ssr: false,
    loading: () => (
      <div className="h-125 w-full flex flex-col items-center justify-center text-muted-foreground gap-3 bg-zinc-900 border border-zinc-800 rounded-lg">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm font-semibold">Memuat PDF Viewer...</span>
      </div>
    ),
  },
);

interface CreateSPJDialogProps {
  project: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

type QueuedSPJItem = CreateSPJItemInput & { id: string };

export function CreateSPJDialog({
  project,
  open,
  onOpenChange,
  onSuccess,
}: CreateSPJDialogProps) {
  const [activeTab, setActiveTab] = useState("create");
  const [loading, setLoading] = useState(false);

  // Form State
  const [spjNumberInput, setSpjNumberInput] = useState("");
  const [currentItem, setCurrentItem] = useState<CreateSPJItemInput>({
    name: "",
    qty: 1,
    unit: "ls",
    note: "",
  });
  const [pendingItems, setPendingItems] = useState<QueuedSPJItem[]>([]);

  // History State
  const [spjHistory, setSpjHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedSpj, setExpandedSpj] = useState<Record<string, boolean>>({});

  // Editing State
  const [editingSpj, setEditingSpj] = useState<any | null>(null);

  // PDF Preview State
  const [previewSpj, setPreviewSpj] = useState<any | null>(null);

  // Delete Confirmation State
  const [deleteConfirmSpj, setDeleteConfirmSpj] = useState<any | null>(null);

  useEffect(() => {
    if (open && project?.id) {
      fetchHistory();
    }
  }, [open, project?.id]);

  const fetchHistory = async () => {
    if (!project?.id) return;
    setLoadingHistory(true);
    try {
      const history = await getSPJHistory(project.id);
      setSpjHistory(history);
    } catch (err) {
      console.error("Failed to fetch SPJ history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleSpjExpand = (spjId: string) => {
    setExpandedSpj((prev) => ({
      ...prev,
      [spjId]: !prev[spjId],
    }));
  };

  const handleAddToQueue = () => {
    if (!currentItem.name || !currentItem.name.trim()) {
      toast.warning("Nama jasa / deskripsi pekerjaan wajib diisi!");
      return;
    }
    if (!currentItem.qty || currentItem.qty <= 0) {
      toast.warning("Jumlah (Qty) harus lebih dari 0!");
      return;
    }

    setPendingItems((prev) => [
      ...prev,
      {
        name: currentItem.name.trim(),
        qty: currentItem.qty,
        unit: currentItem.unit || "ls",
        note: currentItem.note?.trim() || "",
        id: Math.random().toString(),
      },
    ]);

    setCurrentItem({ name: "", qty: 1, unit: "ls", note: "" });
    toast.success(`Jasa "${currentItem.name.trim()}" masuk ke antrean.`);
  };

  const handleRemoveFromQueue = (id: string) => {
    setPendingItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditQueueItem = (item: QueuedSPJItem) => {
    setCurrentItem({
      name: item.name,
      qty: item.qty,
      unit: item.unit,
      note: item.note || "",
    });
    handleRemoveFromQueue(item.id);
  };

  const resetForm = () => {
    setEditingSpj(null);
    setPendingItems([]);
    setCurrentItem({ name: "", qty: 1, unit: "ls", note: "" });
    setSpjNumberInput("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!project?.id) {
      toast.error("Proyek tidak valid");
      return;
    }

    if (!spjNumberInput.trim()) {
      toast.warning("Nomor SPJ wajib diisi");
      return;
    }

    if (pendingItems.length === 0) {
      toast.warning(
        "Antrean barang/jasa masih kosong. Masukkan minimal 1 item ke antrean.",
      );
      return;
    }

    setLoading(true);
    try {
      const itemsPayload: CreateSPJItemInput[] = pendingItems.map((item) => ({
        name: item.name,
        qty: item.qty,
        unit: item.unit,
        note: item.note,
      }));

      if (editingSpj) {
        const res = await updateSPJ(
          editingSpj.id,
          itemsPayload,
          spjNumberInput.trim(),
        );
        if (res.success) {
          toast.success("SPJ berhasil diperbarui");
          resetForm();
          fetchHistory();
          setActiveTab("history");
          if (onSuccess) onSuccess();
        } else {
          toast.error(res.error || "Gagal memperbarui SPJ");
        }
      } else {
        const res = await createSPJ(
          project.id,
          itemsPayload,
          spjNumberInput.trim(),
        );
        if (res.success) {
          toast.success("Surat Permintaan Jasa (SPJ) berhasil dibuat");
          resetForm();
          fetchHistory();
          setActiveTab("history");
          if (onSuccess) onSuccess();
        } else {
          toast.error(res.error || "Gagal membuat SPJ");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (spj: any) => {
    setEditingSpj(spj);
    setSpjNumberInput(spj.spjNumber);
    setPendingItems(
      spj.items.map((it: any) => ({
        id: it.id || Math.random().toString(),
        name: it.name,
        qty: it.qty,
        unit: it.unit || "ls",
        note: it.note || "",
      })),
    );
    setActiveTab("create");
  };

  const handleDelete = (spj: any) => {
    setDeleteConfirmSpj(spj);
  };

  const handleConfirmDeleteSpj = async () => {
    if (!deleteConfirmSpj) return;
    setLoading(true);
    try {
      const res = await deleteSPJ(deleteConfirmSpj.id);
      if (res.success) {
        toast.success("SPJ berhasil dihapus");
        fetchHistory();
        setDeleteConfirmSpj(null);
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal menghapus SPJ");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus SPJ");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateItemStatus = async (
    itemId: string,
    newStatus: "APPROVED" | "REJECTED" | "PENDING",
  ) => {
    try {
      const res = await updateSPJItemStatus(itemId, newStatus);
      if (res.success) {
        toast.success("Status item SPJ berhasil diperbarui");
        fetchHistory();
        if (onSuccess) onSuccess();
      } else {
        toast.error(res.error || "Gagal memperbarui status item");
      }
    } catch (err: any) {
      toast.error(err.message || "Gagal memperbarui status item");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="md:max-w-250! max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-border shadow-2xl bg-background">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex flex-col flex-1 overflow-hidden"
          >
            {/* Header with Title & Top-Right Tabs */}
            <DialogHeader className="p-6 pb-2 shrink-0">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                    <Wrench className="w-6 h-6 text-emerald-600" />
                    Surat Permintaan Jasa (SPJ)
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Kelola dan cetak permintaan pengerjaan jasa untuk project
                    ini.
                  </DialogDescription>
                </div>
                <TabsList className="grid w-72 grid-cols-2 bg-muted/50 p-1">
                  <TabsTrigger
                    value="create"
                    className="text-xs font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    {editingSpj ? "Edit SPJ" : "Buat SPJ"}
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="text-xs font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white transition-all cursor-pointer"
                  >
                    Riwayat SPJ
                  </TabsTrigger>
                </TabsList>
              </div>
            </DialogHeader>

            {/* Project Summary Info Bar */}
            <div className="mx-6 mb-4 p-4 rounded-xl bg-muted/30 border border-border/50 grid grid-cols-4 gap-6 text-xs shrink-0">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Project Name
                </Label>
                <p className="font-medium truncate text-foreground">
                  {project?.projectName || "-"}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Nomor Project
                </Label>
                <p className="font-medium text-foreground">
                  {project?.projectNumber ||
                    project?.id?.slice(-8).toUpperCase()}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Client
                </Label>
                <p className="font-medium truncate text-foreground">
                  {project?.customer?.company || project?.customer?.name || "-"}
                </p>
              </div>
              <div className="space-y-1 border-l pl-6">
                <Label className="text-xs text-muted-foreground font-semibold">
                  Status
                </Label>
                <p className="font-medium text-emerald-600">
                  {spjHistory.length} Dokumen Terbit
                </p>
              </div>
            </div>

            {/* TAB 1: FORM BUAT SPJ */}
            <TabsContent
              value="create"
              className="flex-1 overflow-hidden flex flex-col m-0 p-0 border-0 outline-none"
            >
              <div className="flex-1 overflow-y-auto px-6 py-2">
                <form onSubmit={handleSubmit} className="space-y-6 pb-6">
                  {/* SPJ Document Number Input */}
                  <div className="p-5 rounded-2xl border-2 border-border/40 bg-background space-y-3 shadow-xs">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="spjNumberInput"
                          className="text-xs font-semibold text-muted-foreground"
                        >
                          Nomor SPJ *
                        </Label>
                        {editingSpj && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={resetForm}
                            className="h-6 text-xs font-semibold text-muted-foreground hover:text-foreground"
                          >
                            Batal Edit
                          </Button>
                        )}
                      </div>
                      <Input
                        id="spjNumberInput"
                        placeholder="e.g. SPJ/PROJECT-2026-07-001/001"
                        value={spjNumberInput}
                        onChange={(e) => setSpjNumberInput(e.target.value)}
                        className="h-11 rounded-xl bg-muted/20 border-border text-sm font-semibold focus:border-emerald-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Antrean Items Section (Positioned above input form) */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-foreground">
                        Daftar Antrean Jasa yang Akan Diterbitkan (
                        {pendingItems.length} Item)
                      </h3>
                    </div>

                    {pendingItems.length === 0 ? (
                      <div className="p-8 rounded-2xl border-2 border-dashed border-border/60 bg-muted/5 flex flex-col items-center justify-center text-center space-y-2">
                        <Wrench className="w-8 h-8 text-emerald-600/30" />
                        <p className="text-xs font-semibold text-muted-foreground">
                          Belum ada item dalam antrean. Isi form di bawah lalu
                          klik{" "}
                          <strong className="text-foreground">
                            "Masukkan ke Antrean"
                          </strong>
                          .
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {pendingItems.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="p-3.5 rounded-xl border border-border/60 bg-card flex items-center justify-between gap-4 shadow-2xs hover:border-emerald-500/30 transition-colors"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-500/20">
                                {idx + 1}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-foreground truncate">
                                  {item.name}
                                </h4>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Qty:{" "}
                                  <strong className="text-emerald-600 font-bold">
                                    {item.qty} {item.unit?.toUpperCase()}
                                  </strong>
                                  {item.note && ` • Catatan: ${item.note}`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditQueueItem(item)}
                                className="h-8 px-2.5 text-xs font-semibold rounded-lg cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFromQueue(item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input Form Item Jasa (Single Input + Antrean Button) */}
                  <div className="p-5 rounded-2xl border-2 border-border/40 bg-background space-y-4 shadow-xs">
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                      Input Detail Pekerjaan Jasa
                    </h3>

                    <div className="grid grid-cols-12 gap-3">
                      {/* Nama Jasa */}
                      <div className="col-span-12 sm:col-span-6 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Nama Jasa / Deskripsi Pekerjaan *
                        </Label>
                        <Input
                          placeholder="e.g. Jasa Machining Bubut Shaft / Jasa Galvanizing"
                          value={currentItem.name}
                          onChange={(e) =>
                            setCurrentItem((prev: CreateSPJItemInput) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          className="h-10 text-xs font-medium rounded-xl bg-background border-border"
                        />
                      </div>

                      {/* Qty */}
                      <div className="col-span-6 sm:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Jumlah (Qty) *
                        </Label>
                        <Input
                          type="number"
                          min={0.1}
                          step="any"
                          value={currentItem.qty}
                          onChange={(e) =>
                            setCurrentItem((prev: CreateSPJItemInput) => ({
                              ...prev,
                              qty: Number(e.target.value),
                            }))
                          }
                          className="h-10 text-xs rounded-xl bg-background border-border font-medium"
                        />
                      </div>

                      {/* Satuan */}
                      <div className="col-span-6 sm:col-span-3 space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Satuan *
                        </Label>
                        <select
                          value={currentItem.unit}
                          onChange={(e) =>
                            setCurrentItem((prev: CreateSPJItemInput) => ({
                              ...prev,
                              unit: e.target.value,
                            }))
                          }
                          className="w-full h-10 rounded-xl text-xs font-medium bg-background border border-border px-3 cursor-pointer uppercase"
                        >
                          <option value="ls">LS (LUMP SUM)</option>
                          <option value="pcs">PCS</option>
                          <option value="unit">UNIT</option>
                          <option value="set">SET</option>
                          <option value="jam">JAM</option>
                          <option value="hari">HARI</option>
                          <option value="m2">M²</option>
                          <option value="m3">M³</option>
                          <option value="kg">KG</option>
                        </select>
                      </div>
                    </div>

                    {/* Catatan Opsional + Button Masukkan Ke Antrean */}
                    <div className="flex flex-col sm:flex-row items-end gap-3 pt-1">
                      <div className="flex-1 space-y-1.5 w-full">
                        <Label className="text-xs font-semibold text-muted-foreground">
                          Catatan (Opsional)
                        </Label>
                        <Input
                          placeholder="Tambahkan catatan khusus..."
                          value={currentItem.note || ""}
                          onChange={(e) =>
                            setCurrentItem((prev: CreateSPJItemInput) => ({
                              ...prev,
                              note: e.target.value,
                            }))
                          }
                          className="h-10 text-xs rounded-xl bg-background border-border"
                        />
                      </div>
                      <Button
                        type="button"
                        onClick={handleAddToQueue}
                        className="h-10 px-5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                      >
                        <Plus className="w-4 h-4" /> Masukkan ke Antrean
                      </Button>
                    </div>
                  </div>
                </form>
              </div>

              {/* Submit Footer Bar with explicit padding */}
              <div className="p-4 px-6 border-t border-border bg-muted/20 shrink-0 flex items-center justify-end gap-3 rounded-b-2xl">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                  className="h-10 text-xs font-semibold px-4 rounded-xl cursor-pointer"
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading || pendingItems.length === 0}
                  className="h-10 px-6 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4" />
                      {editingSpj
                        ? "Simpan Perubahan SPJ"
                        : `Terbitkan Dokumen SPJ (${pendingItems.length} Item)`}
                    </>
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* TAB 2: DAFTAR & HISTORY SPJ */}
            <TabsContent
              value="history"
              className="flex-1 overflow-y-auto px-6 py-4 space-y-4 m-0 border-0 outline-none"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Daftar Surat Permintaan Jasa (SPJ)
                  </h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchHistory}
                  className="h-8 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
                </Button>
              </div>

              {loadingHistory ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="text-xs font-semibold">
                    Memuat data SPJ...
                  </span>
                </div>
              ) : spjHistory.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-muted-foreground text-center bg-muted/10 rounded-2xl border border-dashed border-border/60 p-6 space-y-2">
                  <Wrench className="w-10 h-10 opacity-30 text-emerald-600" />
                  <h5 className="text-sm font-semibold text-foreground">
                    Belum Ada Surat Permintaan Jasa (SPJ)
                  </h5>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Klik tab <strong>"Buat SPJ"</strong> untuk mengajukan
                    pekerjaan jasa.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {spjHistory.map((spj, spjIdx) => {
                    const isExpanded = expandedSpj[spj.id] ?? spjIdx === 0;
                    return (
                      <div
                        key={spj.id}
                        className="rounded-2xl border border-border/60 bg-card overflow-hidden transition-all shadow-xs hover:border-emerald-500/30"
                      >
                        {/* Accordion Header */}
                        <div
                          onClick={() => toggleSpjExpand(spj.id)}
                          className="p-4 sm:p-4.5 cursor-pointer hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-xl bg-emerald-500/10 text-emerald-600 font-semibold text-xs flex items-center justify-center shrink-0 border border-emerald-500/20">
                              {spjIdx + 1}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-emerald-600">
                                  {spj.spjNumber}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold"
                                >
                                  {spj.items?.length || 0} Item Jasa
                                </Badge>
                              </div>
                              <div className="text-xs text-foreground font-medium flex items-center gap-2 flex-wrap">
                                <span>
                                  Pengaju:{" "}
                                  <strong className="font-semibold">
                                    {spj.makerName || "User"}
                                  </strong>
                                </span>
                                <span>•</span>
                                <span>
                                  {format(
                                    new Date(spj.createdAt),
                                    "dd MMM yyyy HH:mm",
                                    { locale: id },
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                            {/* Document Status Badge */}
                            {spj.status === "APPROVED" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none font-bold text-[10px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Disetujui</span>
                              </Badge>
                            ) : spj.status === "REJECTED" ? (
                              <Badge className="bg-red-500/10 text-red-700 dark:text-red-300 border-none font-bold text-[10px] flex items-center gap-1">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>Ditolak</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-none font-bold text-[10px] flex items-center gap-1">
                                <Clock className="w-3 h-3 text-amber-600" />
                                <span>Menunggu Approval</span>
                              </Badge>
                            )}

                            {/* Actions */}
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewSpj(spj);
                              }}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold rounded-xl border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 cursor-pointer flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print / PDF
                            </Button>

                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(spj);
                              }}
                              variant="outline"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold rounded-xl cursor-pointer flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
                            </Button>

                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(spj);
                              }}
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>

                            <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground ml-1">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Accordion Content - Item List Table with Item Status */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 pt-0 border-t border-border/30 bg-muted/5 space-y-3">
                            <div className="flex items-center justify-between pt-3">
                              <span className="text-xs font-semibold text-foreground">
                                Daftar Pekerjaan / Jasa (
                                {spj.items?.length || 0} Item)
                              </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-border/40 bg-card">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-muted/40 text-muted-foreground font-extrabold border-b border-border/40">
                                  <tr>
                                    <th className="p-3 text-center w-12">No</th>
                                    <th className="p-3">
                                      Nama Jasa / Pekerjaan
                                    </th>
                                    <th className="p-3 text-center">
                                      Jumlah (Qty)
                                    </th>
                                    <th className="p-3">Catatan</th>
                                    <th className="p-3 text-center">
                                      Status Item
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                  {spj.items.map((it: any, itemIdx: number) => (
                                    <tr
                                      key={it.id}
                                      className="hover:bg-muted/10 transition-colors"
                                    >
                                      <td className="p-3 text-center font-bold text-muted-foreground bg-muted/10">
                                        {itemIdx + 1}
                                      </td>
                                      <td className="p-3 font-semibold text-foreground">
                                        {it.name}
                                      </td>
                                      <td className="p-3 text-center font-bold text-emerald-600">
                                        {it.qty} {it.unit || "ls"}
                                      </td>
                                      <td className="p-3 text-muted-foreground">
                                        {it.note || "-"}
                                      </td>
                                      <td className="p-3 text-center">
                                        {it.status === "APPROVED" ? (
                                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none font-bold text-[10px] flex items-center justify-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                            <span>Disetujui</span>
                                          </Badge>
                                        ) : it.status === "REJECTED" ? (
                                          <Badge className="bg-red-500/10 text-red-700 dark:text-red-300 border-none font-bold text-[10px] flex items-center justify-center gap-1">
                                            <XCircle className="w-3 h-3 text-red-600" />
                                            <span>Ditolak</span>
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-none font-bold text-[10px] flex items-center justify-center gap-1">
                                            <Clock className="w-3 h-3 text-amber-600" />
                                            <span>Menunggu</span>
                                          </Badge>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* PDF PREVIEW MODAL */}
      <Dialog
        open={!!previewSpj}
        onOpenChange={(open) => !open && setPreviewSpj(null)}
      >
        <DialogContent className="sm:max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border border-border/80 shadow-2xl bg-background">
          <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-border/40 bg-muted/15 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Cetak / Export PDF SPJ: {previewSpj?.spjNumber}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Pratinjau dokumen Surat Permintaan Jasa sebelum dicetak.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 p-4 bg-zinc-900 overflow-hidden">
            {previewSpj && (
              <PDFViewer className="w-full h-full rounded-xl border-none">
                <SPJPDFDocument spj={previewSpj} project={project} />
              </PDFViewer>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION DIALOG */}
      <Dialog
        open={!!deleteConfirmSpj}
        onOpenChange={(open) => !open && setDeleteConfirmSpj(null)}
      >
        <DialogContent className="sm:max-w-md rounded-2xl border border-border shadow-2xl bg-background">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-bold text-base">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Hapus Surat Permintaan Jasa
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 text-muted-foreground">
              Apakah Anda yakin ingin menghapus dokumen{" "}
              <strong className="text-foreground font-semibold">
                {deleteConfirmSpj?.spjNumber}
              </strong>
              ? Tindakan ini tidak dapat dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmSpj(null)}
              disabled={loading}
              className="rounded-xl text-xs font-semibold cursor-pointer"
            >
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDeleteSpj}
              disabled={loading}
              className="rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Hapus SPJ"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
