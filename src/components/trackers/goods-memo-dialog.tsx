"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatJakartaDate } from "@/lib/date-utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  FileText,
  Plus,
  Trash2,
  Send,
  RotateCcw,
  CheckCircle2,
  Package,
  Wrench,
  Search,
  Check,
  RefreshCw,
  Clock,
  Building2,
  User,
  ArrowRight,
  ShieldCheck,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  XCircle,
  ChevronsUpDown,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import {
  createGoodsReleaseMemo,
  getGoodsReleaseMemos,
  recordGoodsReturn,
  approveGoodsReleaseMemo,
  rejectGoodsReleaseMemo,
  getApprovedSpbItemsForProject,
  GoodsMemoItemInput,
} from "@/app/actions/goods-memo";
import { getWarehouseItems, getUnits } from "@/app/actions/inventory";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface GoodsMemoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: {
    id: string;
    projectName: string;
    projectNumber?: string;
  };
}

export function GoodsMemoDialog({
  open,
  onOpenChange,
  project,
}: GoodsMemoDialogProps) {
  const [activeTab, setActiveTab] = useState<"create" | "list" | "return">(
    "create",
  );
  const [isPending, startTransition] = useTransition();

  // Master Data & Memo List
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [memos, setMemos] = useState<any[]>([]);
  const [approvedSpbItems, setApprovedSpbItems] = useState<any[]>([]);
  const [isLoadingMemos, setIsLoadingMemos] = useState(false);
  const [isLoadingSpbItems, setIsLoadingSpbItems] = useState(false);
  const [expandedMemos, setExpandedMemos] = useState<Record<string, boolean>>(
    {},
  );
  const [openComboboxIndex, setOpenComboboxIndex] = useState<number | null>(
    null,
  );

  const toggleMemoExpand = (memoId: string) => {
    setExpandedMemos((prev) => ({
      ...prev,
      [memoId]: !prev[memoId],
    }));
  };

  // Form State: Create Memo
  const [requesterName, setRequesterName] = useState("");
  const [division, setDivision] = useState("PRODUKSI");
  const [notes, setNotes] = useState("");

  // Two-Stage Queue Workflow States
  const [draftItem, setDraftItem] = useState<GoodsMemoItemInput>({
    itemName: "",
    itemType: "CONSUMABLE",
    qtyRequested: 1,
    unit: "PCS",
    notes: "",
  });
  const [queuedItems, setQueuedItems] = useState<GoodsMemoItemInput[]>([]);

  // Rejection State
  const [rejectingMemo, setRejectingMemo] = useState<any | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState("");

  const handleApproveMemo = (memoId: string) => {
    startTransition(async () => {
      const res = await approveGoodsReleaseMemo(memoId);
      if (res.success) {
        toast.success("Memo Pengeluaran Barang telah DISETUJUI oleh Gudang!");
        await loadData();
      } else {
        toast.error(res.error || "Gagal menyetujui memo");
      }
    });
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingMemo) return;
    if (!rejectReasonInput.trim()) {
      toast.warning("Alasan penolakan wajib diisi");
      return;
    }

    startTransition(async () => {
      const res = await rejectGoodsReleaseMemo(
        rejectingMemo.id,
        rejectReasonInput.trim(),
      );
      if (res.success) {
        toast.success(`Memo ${rejectingMemo.memoNumber} telah DITOLAK`);
        setRejectingMemo(null);
        setRejectReasonInput("");
        await loadData();
      } else {
        toast.error(res.error || "Gagal menolak memo");
      }
    });
  };
  const [selectedMemoForReturn, setSelectedMemoForReturn] = useState<
    any | null
  >(null);
  const [returnerName, setReturnerName] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnItemInputs, setReturnItemInputs] = useState<
    Record<
      string,
      {
        qty: number;
        condition: "SURPLUS" | "RETURNED_TOOL" | "DAMAGED";
        notes: string;
      }
    >
  >({});

  // Fetch data on open
  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, project?.id]);

  const loadData = async () => {
    setIsLoadingMemos(true);
    setIsLoadingSpbItems(true);
    try {
      const [whData, memoData, unitData, spbItemData] = await Promise.all([
        getWarehouseItems(),
        getGoodsReleaseMemos(project?.id),
        getUnits(),
        getApprovedSpbItemsForProject(project?.id),
      ]);
      setWarehouseItems(whData || []);
      setMemos(memoData || []);
      setAvailableUnits(unitData || []);
      setApprovedSpbItems(spbItemData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingMemos(false);
      setIsLoadingSpbItems(false);
    }
  };

  // Helper: Get remaining Qty for an SPB item considering items already in queue
  const getRemainingQtyForSpbItem = (
    spbItem: any,
    excludeQueueIndex?: number,
  ) => {
    if (!spbItem) return 0;
    const inQueue = queuedItems
      .filter(
        (q, idx) =>
          q.itemName === spbItem.itemName && idx !== excludeQueueIndex,
      )
      .reduce((sum, q) => sum + (q.qtyRequested || 0), 0);
    return Math.max(0, spbItem.qtyRemainingToRequest - inQueue);
  };

  // Helper: Add or Merge draftItem into queuedItems
  const handleAddToQueue = () => {
    if (!draftItem.itemName.trim()) {
      toast.warning("Pilih barang dari SPB disetujui terlebih dahulu");
      return;
    }
    if ((draftItem.qtyRequested || 0) <= 0) {
      toast.warning("Jumlah Qty harus lebih besar dari 0");
      return;
    }

    const selectedSpb = approvedSpbItems.find(
      (s) => s.itemName === draftItem.itemName,
    );

    if (
      selectedSpb &&
      selectedSpb.source === "TRADING" &&
      selectedSpb.isReadyToRequest === false
    ) {
      toast.warning(
        `Barang "${draftItem.itemName}" masih berstatus Menunggu PO dan belum selesai diproses oleh Purchasing/Gudang.`,
      );
      return;
    }

    // Check if item with SAME itemName & SAME itemType already exists in queuedItems
    const existingIndex = queuedItems.findIndex(
      (q) =>
        q.itemName.trim().toLowerCase() ===
          draftItem.itemName.trim().toLowerCase() &&
        q.itemType === draftItem.itemType,
    );

    const effectiveUnit = selectedSpb
      ? (selectedSpb.unit || "PCS").toUpperCase()
      : draftItem.unit;
    const finalDraftItem = { ...draftItem, unit: effectiveUnit };

    if (existingIndex !== -1) {
      // MERGE INTO EXISTING QUEUE ITEM!
      const existingItem = queuedItems[existingIndex];
      const mergedQty =
        (existingItem.qtyRequested || 0) + (finalDraftItem.qtyRequested || 0);

      // Validate mergedQty against SPB quota (excluding the existing item's previous qty in getRemainingQtyForSpbItem)
      if (selectedSpb) {
        const availableQuota = getRemainingQtyForSpbItem(
          selectedSpb,
          existingIndex,
        );
        if (mergedQty > availableQuota) {
          toast.error(
            `Tidak dapat menggabungkan: Total Qty (${mergedQty} ${effectiveUnit}) melebihi sisa kuota SPB (${availableQuota} ${effectiveUnit})`,
          );
          return;
        }
      }

      // Merge notes if present
      let mergedNotes = existingItem.notes || "";
      if (finalDraftItem.notes && finalDraftItem.notes.trim()) {
        mergedNotes = mergedNotes
          ? `${mergedNotes}; ${finalDraftItem.notes.trim()}`
          : finalDraftItem.notes.trim();
      }

      setQueuedItems((prev) => {
        const updated = [...prev];
        updated[existingIndex] = {
          ...existingItem,
          qtyRequested: mergedQty,
          unit: effectiveUnit,
          notes: mergedNotes,
        };
        return updated;
      });

      toast.success(
        `Barang '${finalDraftItem.itemName}' sudah ada di antrean. Kuantitas digabungkan menjadi ${mergedQty} ${effectiveUnit}!`,
      );
    } else {
      // NEW ITEM IN QUEUE
      if (selectedSpb) {
        const remainingQuota = getRemainingQtyForSpbItem(selectedSpb);
        if (finalDraftItem.qtyRequested > remainingQuota) {
          toast.error(
            `Qty (${finalDraftItem.qtyRequested} ${effectiveUnit}) melebihi sisa kuota SPB (${remainingQuota} ${effectiveUnit})`,
          );
          return;
        }
      }

      setQueuedItems((prev) => [...prev, finalDraftItem]);
      toast.success(
        `'${finalDraftItem.itemName}' berhasil ditambahkan ke antrean memo!`,
      );
    }

    // Reset draftItem form
    setDraftItem({
      itemName: "",
      itemType: "CONSUMABLE",
      qtyRequested: 1,
      unit: "PCS",
      notes: "",
      typeMerk: undefined,
    });
  };

  // Helper: Edit item in queue (loads item into draft form)
  const handleEditQueueItem = (index: number) => {
    const itemToEdit = queuedItems[index];
    setDraftItem({ ...itemToEdit });
    setQueuedItems((prev) => prev.filter((_, i) => i !== index));
    toast.info(`Memuat '${itemToEdit.itemName}' ke form input untuk diedit.`);
  };

  // Helper: Inline Qty Update directly in Queue Card
  const handleInlineUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      toast.warning("Kuantitas Qty minimal 1");
      return;
    }
    const targetItem = queuedItems[index];
    const selectedSpb = approvedSpbItems.find(
      (s) => s.itemName === targetItem.itemName,
    );
    if (selectedSpb) {
      const availableQuota = getRemainingQtyForSpbItem(selectedSpb, index);
      if (newQty > availableQuota) {
        toast.error(
          `Qty (${newQty} ${targetItem.unit}) melebihi sisa kuota SPB (${availableQuota} ${targetItem.unit})`,
        );
        return;
      }
    }

    setQueuedItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qtyRequested: newQty };
      return updated;
    });
  };

  // Helper: Remove item from queuedItems
  const handleRemoveFromQueue = (index: number) => {
    setQueuedItems((prev) => prev.filter((_, i) => i !== index));
    toast.info("Barang dihapus dari antrean memo");
  };

  // Submit Create Memo with queuedItems
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (project?.id && approvedSpbItems.length === 0) {
      toast.warning(
        "Tidak dapat membuat memo: Proyek ini belum memiliki Surat Permintaan Barang (SPB) yang disetujui.",
      );
      return;
    }

    if (!requesterName.trim()) {
      toast.warning("Mohon isi nama pemohon/penanggung jawab");
      return;
    }

    if (queuedItems.length === 0) {
      toast.warning(
        "Antrean memo masih kosong! Silakan tambahkan barang ke antrean terlebih dahulu dengan tombol '+ Tambahkan Ke Antrean Memo'.",
      );
      return;
    }

    startTransition(async () => {
      const res = await createGoodsReleaseMemo({
        projectId: project?.id,
        requesterName: requesterName.trim(),
        division,
        notes: notes.trim(),
        items: queuedItems,
      });

      if (res.success) {
        toast.success(
          `Request Memo ${res.data?.memoNumber} (${queuedItems.length} barang) berhasil dibuat & dikirim!`,
        );
        // Reset Form & Queue
        setNotes("");
        setQueuedItems([]);
        setDraftItem({
          itemName: "",
          itemType: "CONSUMABLE",
          qtyRequested: 1,
          unit: "PCS",
          notes: "",
        });
        await loadData();
        setActiveTab("list");
      } else {
        toast.error(res.error || "Gagal membuat memo pengeluaran barang");
      }
    });
  };

  // Prepare Return Form when selecting a memo
  const handleStartReturn = (memo: any) => {
    setSelectedMemoForReturn(memo);
    const initialInputs: Record<string, any> = {};
    memo.items.forEach((it: any) => {
      const maxReturnable = Math.max(0, it.qtyIssued - it.qtyReturned);
      initialInputs[it.id] = {
        qty: 0,
        condition:
          it.itemType === "NON_CONSUMABLE" ? "RETURNED_TOOL" : "SURPLUS",
        notes: "",
        maxReturnable,
      };
    });
    setReturnItemInputs(initialInputs);
    setActiveTab("return");
  };

  // Submit Return Goods
  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemoForReturn) return;
    if (!returnerName.trim()) {
      toast.warning("Mohon isi nama yang menyerahkan pengembalian");
      return;
    }

    const returnItemsToSubmit: Array<{
      memoItemId: string;
      qtyReturned: number;
      condition: "SURPLUS" | "RETURNED_TOOL" | "DAMAGED";
      notes?: string;
    }> = [];

    Object.entries(returnItemInputs).forEach(([memoItemId, data]) => {
      if (data.qty > 0) {
        returnItemsToSubmit.push({
          memoItemId,
          qtyReturned: data.qty,
          condition: data.condition,
          notes: data.notes || undefined,
        });
      }
    });

    if (returnItemsToSubmit.length === 0) {
      toast.warning(
        "Mohon isi kuantitas barang yang dikembalikan (minimal 1 barang)",
      );
      return;
    }

    startTransition(async () => {
      const res = await recordGoodsReturn({
        memoId: selectedMemoForReturn.id,
        returnedBy: returnerName.trim(),
        notes: returnNotes.trim(),
        items: returnItemsToSubmit,
      });

      if (res.success) {
        toast.success(
          `Pengembalian sisa/alat untuk Memo ${selectedMemoForReturn.memoNumber} berhasil dicatat!`,
        );
        setSelectedMemoForReturn(null);
        setReturnNotes("");
        await loadData();
        setActiveTab("list");
      } else {
        toast.error(res.error || "Gagal mencatat pengembalian barang");
      }
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-225! max-h-[92vh] sm:max-h-[90vh] w-[96vw] sm:w-full flex flex-col p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl bg-background">
          {/* Senior & Mobile Friendly Header */}
          <DialogHeader className="p-3.5 sm:p-6 pb-3 border-b border-border/40 bg-muted/15 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-xl font-bold text-foreground">
                    Memo Pengeluaran Barang
                  </DialogTitle>
                  <DialogDescription className="text-[11px] sm:text-sm text-muted-foreground font-medium mt-0.5">
                    <span className="hidden sm:inline">
                      Request barang ke gudang & sistem inventory terpisah •{" "}
                    </span>
                    {project?.projectName && (
                      <span className="text-primary font-semibold">
                        Proyek: {project.projectName}
                      </span>
                    )}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Tab Navigation */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-3.5 sm:px-6 bg-muted/10 border-b border-border/30 py-2 shrink-0">
              <TabsList className="grid grid-cols-3 bg-muted/30 p-1 rounded-xl sm:rounded-2xl h-10 sm:h-12 w-full">
                <TabsTrigger
                  value="create"
                  className="rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold gap-1 sm:gap-2 px-1 py-1 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-md"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="hidden sm:inline">1. Buat Request Memo</span>
                  <span className="sm:hidden">Buat Memo</span>
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  className="rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold gap-1 sm:gap-2 px-1 py-1 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-md"
                >
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  <span className="hidden sm:inline">
                    2. Daftar Memo ({memos.length})
                  </span>
                  <span className="sm:hidden">Daftar ({memos.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="return"
                  className="rounded-lg sm:rounded-xl text-[11px] sm:text-sm font-semibold gap-1 sm:gap-2 px-1 py-1 cursor-pointer data-[state=active]:bg-background data-[state=active]:shadow-md"
                >
                  <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
                  <span className="hidden sm:inline">
                    3. Pengembalian Sisa / Alat
                  </span>
                  <span className="sm:hidden">Pengembalian</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: CREATE MEMO */}
            <TabsContent
              value="create"
              className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 m-0 outline-hidden"
            >
              {project?.id &&
              !isLoadingSpbItems &&
              approvedSpbItems.length === 0 ? (
                <div className="p-6 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-4">
                  <div className="flex items-start gap-3.5">
                    <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-amber-900 dark:text-amber-100">
                        Belum Ada Barang SPB Siap Dikirim
                      </h4>
                      <p className="text-xs sm:text-sm font-medium leading-relaxed opacity-90">
                        Pengeluaran barang hanya dapat dilakukan untuk barang
                        SPB yang telah disetujui dan telah **selesai diproses**
                        (untuk barang Trading, barang harus sudah diterima /
                        selesai dibeli oleh tim Purchasing).
                      </p>
                    </div>
                  </div>
                  <div className="bg-background/80 p-3.5 rounded-xl border border-amber-500/20 text-xs font-semibold text-amber-900 dark:text-amber-100 flex items-center justify-between">
                    <span>
                      Jika barang Trading pada SPB masih berstatus
                      &quot;Menunggu PO&quot; atau &quot;PO Dibuat&quot;, mohon
                      selesaikan proses penerimaan barang di modul Purchasing
                      terlebih dahulu.
                    </span>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateSubmit} className="space-y-6">
                  {/* Senior Friendly User & Division Details */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 sm:gap-4 bg-muted/10 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-border/40">
                    <div className="space-y-1">
                      <Label className="text-[11px] sm:text-sm font-semibold text-foreground flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-primary shrink-0" />{" "}
                        <span className="truncate">Pemohon *</span>
                      </Label>
                      <Input
                        placeholder="Contoh: Pak Supri"
                        value={requesterName}
                        onChange={(e) => setRequesterName(e.target.value)}
                        className="h-9 sm:h-11 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-background border-border/60"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] sm:text-sm font-semibold text-foreground flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />{" "}
                        <span className="truncate">Divisi *</span>
                      </Label>
                      <Input
                        placeholder="Contoh: PRODUKSI"
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        className="h-9 sm:h-11 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold bg-background border-border/60"
                        required
                      />
                    </div>
                  </div>
                  {/* SECTION 1: DAFTAR ANTREAN BARANG DALAM MEMO (QUEUED ITEMS) */}
                  <div className="space-y-2.5 sm:space-y-3 pt-1 sm:pt-2">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 sm:gap-2">
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                        Daftar Antrean Memo ({queuedItems.length} Item)
                      </h4>
                      {queuedItems.length > 0 && (
                        <span className="text-[10px] sm:text-xs font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Siap Dikirim
                        </span>
                      )}
                    </div>

                    {queuedItems.length === 0 ? (
                      <div className="p-3.5 sm:p-5 text-center rounded-xl sm:rounded-2xl border-2 border-dashed border-border/60 bg-muted/10 space-y-1">
                        <Package className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground mx-auto opacity-50" />
                        <p className="text-xs font-semibold text-muted-foreground">
                          Belum ada barang di dalam antrean memo ini.
                        </p>
                        <p className="text-[10px] sm:text-[11px] text-muted-foreground/80">
                          Gunakan form{" "}
                          <strong className="text-foreground font-semibold">
                            &quot;Input Barang Permintaan&quot;
                          </strong>{" "}
                          di bawah untuk menambahkan barang ke antrean.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 sm:space-y-2.5">
                        {queuedItems.map((qItem, qIdx) => (
                          <div
                            key={qIdx}
                            className="p-2.5 sm:p-3.5 rounded-xl border border-border/70 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 shadow-2xs hover:border-primary/30 transition-all"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden w-full sm:w-auto">
                              <span className="font-extrabold text-[10px] sm:text-xs text-primary bg-primary/15 px-1.5 py-0.5 rounded-md border border-primary/20 shrink-0">
                                #{qIdx + 1}
                              </span>
                              <div className="space-y-0.5 overflow-hidden flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-xs sm:text-sm text-foreground truncate">
                                    {qItem.itemName}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] font-bold px-1.5 py-0.2 shrink-0 rounded",
                                      qItem.itemType === "CONSUMABLE"
                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                        : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30",
                                    )}
                                  >
                                    {qItem.itemType === "CONSUMABLE"
                                      ? "Bahan"
                                      : "Alat"}
                                  </Badge>
                                </div>
                                {qItem.typeMerk && (
                                  <p className="text-[10px] sm:text-[11px] font-semibold text-primary/90 truncate">
                                    Tipe/Merk: {qItem.typeMerk}
                                  </p>
                                )}
                                {qItem.notes && (
                                  <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">
                                    Catatan: {qItem.notes}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-border/30">
                              {/* Inline Qty Adjustment */}
                              <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 p-0.5 sm:p-1 rounded-lg sm:rounded-xl">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInlineUpdateQty(
                                      qIdx,
                                      qItem.qtyRequested - 1,
                                    )
                                  }
                                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-background hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                                  title="Kurangi Qty"
                                >
                                  -
                                </button>
                                <Input
                                  type="number"
                                  min={0.1}
                                  step="any"
                                  value={qItem.qtyRequested}
                                  onChange={(e) =>
                                    handleInlineUpdateQty(
                                      qIdx,
                                      Number(e.target.value),
                                    )
                                  }
                                  className="w-12 sm:w-14 h-6 sm:h-7 text-center font-extrabold text-xs bg-background border-border/60 p-0 rounded-md sm:rounded-lg text-primary shadow-none"
                                />
                                <span className="text-[10px] font-bold text-primary uppercase pr-1">
                                  {qItem.unit}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleInlineUpdateQty(
                                      qIdx,
                                      qItem.qtyRequested + 1,
                                    )
                                  }
                                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-md sm:rounded-lg bg-background hover:bg-muted text-foreground font-bold text-xs flex items-center justify-center cursor-pointer shadow-2xs"
                                  title="Tambah Qty"
                                >
                                  +
                                </button>
                              </div>

                              <div className="flex items-center gap-1">
                                {/* Edit Button */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditQueueItem(qIdx)}
                                  title="Edit barang ini di form"
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-primary hover:bg-primary/10 rounded-lg cursor-pointer flex items-center justify-center"
                                >
                                  <Edit3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </Button>

                                {/* Hapus Button */}
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveFromQueue(qIdx)}
                                  title="Hapus dari antrean"
                                  className="h-7 w-7 sm:h-8 sm:w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg cursor-pointer flex items-center justify-center"
                                >
                                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* SECTION 2: FORM INPUT BARANG PERMINTAAN */}
                  <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl border-2 border-primary/20 bg-card space-y-3 sm:space-y-4 shadow-2xs">
                    <div className="flex items-center justify-between border-b border-border/30 pb-2 sm:pb-3">
                      <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 sm:gap-2">
                        <Package className="w-4 h-4 text-primary" />
                        Input Barang Permintaan
                      </h4>
                      <span className="text-[10px] sm:text-[11px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        Form Tambah Barang
                      </span>
                    </div>

                    {/* Item Type Selector Card */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 pt-0.5">
                      <button
                        type="button"
                        onClick={() =>
                          setDraftItem((prev) => ({
                            ...prev,
                            itemType: "CONSUMABLE",
                          }))
                        }
                        className={cn(
                          "p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2.5",
                          draftItem.itemType === "CONSUMABLE"
                            ? "border-emerald-600 bg-emerald-500/10 text-emerald-950 dark:text-emerald-200 font-extrabold shadow-xs"
                            : "border-border/60 bg-muted/10 hover:bg-muted/30 text-muted-foreground font-semibold",
                        )}
                      >
                        <Package className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-emerald-600" />
                        <div>
                          <div className="text-[11px] sm:text-xs font-bold leading-tight">
                            Sekali Pakai (Bahan)
                          </div>
                          <div className="text-[10px] font-medium opacity-80 hidden sm:block">
                            Cat, kawat las, baut, sisa bisa dikembalikan
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDraftItem((prev) => ({
                            ...prev,
                            itemType: "NON_CONSUMABLE",
                          }))
                        }
                        className={cn(
                          "p-2.5 sm:p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2.5",
                          draftItem.itemType === "NON_CONSUMABLE"
                            ? "border-orange-600 bg-orange-500/10 text-orange-950 dark:text-orange-200 font-extrabold shadow-xs"
                            : "border-border/60 bg-muted/10 hover:bg-muted/30 text-muted-foreground font-semibold",
                        )}
                      >
                        <Wrench className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 text-orange-600" />
                        <div>
                          <div className="text-[11px] sm:text-xs font-bold leading-tight">
                            Bukan Sekali Pakai (Alat)
                          </div>
                          <div className="text-[10px] font-medium opacity-80 hidden sm:block">
                            Gerinda, mesin las, wajib dikembalikan
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Info Validasi Qty SPB di Atas Field Nama Barang */}
                    {(() => {
                      const selectedSpb = approvedSpbItems.find(
                        (s) => s.itemName === draftItem.itemName,
                      );
                      if (!selectedSpb) return null;
                      const remainingQuota =
                        getRemainingQtyForSpbItem(selectedSpb);

                      return (
                        <div className="flex items-center justify-between gap-1.5 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-muted/30 border border-border/50 text-[10px] sm:text-[11px] font-semibold flex-wrap">
                          <span className="text-muted-foreground font-medium flex items-center gap-1 truncate">
                            <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />{" "}
                            Info Kuota SPB ({selectedSpb.spbNumber}):
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="bg-background px-1.5 py-0.5 rounded border border-border/60 text-foreground">
                              Total:{" "}
                              <strong>
                                {selectedSpb.totalApprovedQty}{" "}
                                {selectedSpb.unit}
                              </strong>
                            </span>
                            <span className="bg-orange-500/10 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded border border-orange-500/20">
                              Diminta:{" "}
                              <strong>
                                {selectedSpb.qtyAlreadyRequested}{" "}
                                {selectedSpb.unit}
                              </strong>
                            </span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded font-bold border",
                                remainingQuota > 0
                                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                  : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
                              )}
                            >
                              Sisa:{" "}
                              <strong>
                                {remainingQuota} {selectedSpb.unit}
                              </strong>
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Inputs: Nama Barang, Qty, Satuan */}
                    <div className="grid grid-cols-12 gap-2.5 sm:gap-3 pt-0.5">
                      <div className="col-span-12 sm:col-span-7 space-y-1">
                        <Label className="text-xs font-semibold text-foreground">
                          Nama Barang / Material (Dari SPB) *
                        </Label>
                        {approvedSpbItems.length > 0 ? (
                          <Popover
                            open={openComboboxIndex === 999}
                            onOpenChange={(open) =>
                              setOpenComboboxIndex(open ? 999 : null)
                            }
                          >
                            <PopoverTrigger
                              role="combobox"
                              aria-expanded={openComboboxIndex === 999}
                              className="w-full min-h-9 sm:min-h-11 h-auto flex items-center justify-between text-xs font-semibold bg-background border border-border/80 px-2.5 py-1 cursor-pointer hover:bg-accent/40 rounded-lg sm:rounded-xl transition-all shadow-none outline-hidden"
                            >
                              {draftItem.itemName ? (
                                <div className="flex flex-col text-left overflow-hidden py-0.5 leading-tight">
                                  <span className="truncate font-bold text-foreground">
                                    {draftItem.itemName}
                                  </span>
                                  {draftItem.typeMerk && (
                                    <span className="text-[10px] font-semibold text-muted-foreground truncate">
                                      Tipe/Merk: {draftItem.typeMerk}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground font-normal truncate">
                                  -- Pilih Barang dari SPB Disetujui (
                                  {approvedSpbItems.length} Item) --
                                </span>
                              )}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 text-muted-foreground" />
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-[92vw] sm:w-120 p-0 rounded-xl shadow-xl border border-border/80 overflow-hidden bg-popover"
                              align="start"
                            >
                              <Command className="rounded-xl border-0">
                                <CommandInput
                                  placeholder="Cari nama barang / SPB..."
                                  className="h-9 text-xs font-medium"
                                />
                                <CommandList className="max-h-72 overflow-y-auto">
                                  <CommandEmpty className="py-4 text-xs text-muted-foreground text-center font-medium">
                                    Barang tidak ditemukan.
                                  </CommandEmpty>
                                  <CommandGroup
                                    heading={`Daftar SPB Disetujui (${approvedSpbItems.length} Item)`}
                                  >
                                    {approvedSpbItems.map((spbItem, spbIdx) => {
                                      const isSelected =
                                        draftItem.itemName === spbItem.itemName;
                                      const remainingQuota =
                                        getRemainingQtyForSpbItem(spbItem);
                                      const isExhausted = remainingQuota <= 0;
                                      const isNotReady =
                                        spbItem.source === "TRADING" &&
                                        spbItem.isReadyToRequest === false;
                                      const isDisabledItem =
                                        isExhausted || isNotReady;

                                      return (
                                        <CommandItem
                                          key={spbItem.id}
                                          value={`${spbIdx + 1} ${spbItem.itemName} ${spbItem.spbNumber} ${spbItem.source}`}
                                          disabled={isDisabledItem}
                                          onSelect={() => {
                                            if (isDisabledItem) return;
                                            setDraftItem((prev) => ({
                                              ...prev,
                                              itemName: spbItem.itemName,
                                              typeMerk:
                                                spbItem.typeMerk || undefined,
                                              unit: (
                                                spbItem.unit || "PCS"
                                              ).toUpperCase(),
                                              itemId:
                                                spbItem.materialId ||
                                                prev.itemId,
                                              itemCode:
                                                spbItem.itemCode ||
                                                prev.itemCode,
                                            }));
                                            setOpenComboboxIndex(null);
                                          }}
                                          className={cn(
                                            "p-2.5 border-b border-border/20 last:border-b-0 flex flex-col items-start gap-1 transition-all",
                                            isDisabledItem
                                              ? "opacity-50 pointer-events-none bg-muted/40 cursor-not-allowed select-none"
                                              : "cursor-pointer hover:bg-accent/60",
                                            isSelected
                                              ? "bg-primary/10 hover:bg-primary/15"
                                              : "",
                                          )}
                                        >
                                          <div className="flex items-center justify-between w-full gap-2">
                                            <div className="flex items-center gap-1.5 overflow-hidden">
                                              <span className="font-semibold text-[10px] text-primary bg-primary/15 px-1.5 py-0.2 rounded border border-primary/20 shrink-0">
                                                {spbIdx + 1}
                                              </span>
                                              <span className="font-bold text-xs text-foreground truncate">
                                                {spbItem.itemName}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                              {isNotReady ? (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] font-extrabold px-1.5 py-0.2 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30 rounded"
                                                >
                                                  MENUNGGU PO
                                                </Badge>
                                              ) : isExhausted ? (
                                                <Badge
                                                  variant="outline"
                                                  className="text-[9px] font-extrabold px-1.5 py-0.2 bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30 rounded"
                                                >
                                                  HABIS (SPB FULL)
                                                </Badge>
                                              ) : null}
                                              <Badge
                                                variant="outline"
                                                className={cn(
                                                  "text-[9px] font-bold px-1.5 py-0 shrink-0 rounded",
                                                  spbItem.source ===
                                                    "WAREHOUSE" ||
                                                    spbItem.source === "GUDANG"
                                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                                    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
                                                )}
                                              >
                                                {spbItem.source ===
                                                  "WAREHOUSE" ||
                                                spbItem.source === "GUDANG"
                                                  ? "Gudang"
                                                  : "Trading"}
                                              </Badge>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between w-full text-[10px] text-muted-foreground gap-2 pt-0.5">
                                            <div className="flex flex-col">
                                              <span className="truncate max-w-42.5 sm:max-w-52.5">
                                                No. SPB:{" "}
                                                <strong className="text-foreground font-semibold">
                                                  {spbItem.spbNumber}
                                                </strong>
                                              </span>
                                              {spbItem.typeMerk && (
                                                <span className="truncate max-w-42.5 sm:max-w-52.5">
                                                  Tipe/Merk:{" "}
                                                  <strong className="text-foreground font-semibold">
                                                    {spbItem.typeMerk}
                                                  </strong>
                                                </span>
                                              )}
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className="bg-muted px-1.5 py-0.2 rounded text-foreground font-medium">
                                                SPB:{" "}
                                                <strong>
                                                  {spbItem.totalApprovedQty}
                                                </strong>
                                              </span>
                                              <span className="bg-orange-500/10 text-orange-700 dark:text-orange-300 px-1.5 py-0.2 rounded font-medium border border-orange-500/20">
                                                Diminta:{" "}
                                                <strong>
                                                  {spbItem.qtyAlreadyRequested}
                                                </strong>
                                              </span>
                                              <span
                                                className={cn(
                                                  "px-1.5 py-0.2 rounded font-bold border",
                                                  remainingQuota > 0
                                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                                                    : "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
                                                )}
                                              >
                                                Sisa:{" "}
                                                <strong>
                                                  {remainingQuota}{" "}
                                                  {spbItem.unit}
                                                </strong>
                                              </span>
                                            </div>
                                          </div>
                                        </CommandItem>
                                      );
                                    })}
                                  </CommandGroup>
                                </CommandList>
                              </Command>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <Input
                            placeholder="e.g. Kawat Las LB-52 3.2mm / Mesin Gerinda 4 inch"
                            value={draftItem.itemName}
                            onChange={(e) =>
                              setDraftItem((prev) => ({
                                ...prev,
                                itemName: e.target.value,
                              }))
                            }
                            className="h-9 sm:h-11 rounded-lg sm:rounded-xl text-xs font-medium bg-background border-border/80"
                          />
                        )}
                      </div>

                      {/* Side-by-Side Qty and Satuan Inputs on Mobile */}
                      <div className="col-span-12 sm:col-span-5 grid grid-cols-12 gap-2">
                        {/* Qty Input */}
                        <div className="col-span-7 space-y-1">
                          <Label className="text-xs font-semibold text-foreground">
                            Jumlah (Qty) *
                          </Label>
                          {(() => {
                            const selectedSpb = approvedSpbItems.find(
                              (s) => s.itemName === draftItem.itemName,
                            );
                            const remainingQuota = selectedSpb
                              ? getRemainingQtyForSpbItem(selectedSpb)
                              : 999999;
                            const isOverQty = selectedSpb
                              ? (draftItem.qtyRequested || 0) > remainingQuota
                              : false;

                            return (
                              <>
                                <Input
                                  type="number"
                                  min={0.1}
                                  step="any"
                                  value={draftItem.qtyRequested}
                                  onChange={(e) =>
                                    setDraftItem((prev) => ({
                                      ...prev,
                                      qtyRequested: Number(e.target.value),
                                    }))
                                  }
                                  className={cn(
                                    "h-9 sm:h-11 rounded-lg sm:rounded-xl text-xs font-semibold bg-background border-border/80 text-foreground",
                                    isOverQty
                                      ? "border-red-500 text-red-600 focus-visible:ring-red-500"
                                      : "",
                                  )}
                                />
                                {isOverQty && (
                                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400 block pt-0.5">
                                    ⚠ Melebihi sisa SPB ({remainingQuota}{" "}
                                    {selectedSpb?.unit})
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        {/* Satuan Select */}
                        <div className="col-span-5 space-y-1">
                          {(() => {
                            const selectedSpb = approvedSpbItems.find(
                              (s) => s.itemName === draftItem.itemName,
                            );
                            const rawUnit = selectedSpb
                              ? (selectedSpb.unit || "PCS").trim()
                              : (draftItem.unit || "PCS").trim();

                            const matchedOption = availableUnits.find(
                              (u: any) =>
                                u.name.trim().toUpperCase() ===
                                rawUnit.toUpperCase(),
                            );
                            const selectValue = matchedOption
                              ? matchedOption.name
                              : rawUnit.toUpperCase();

                            return (
                              <>
                                <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                                  <span>Satuan *</span>
                                </Label>
                                <select
                                  value={selectValue}
                                  disabled={!!selectedSpb}
                                  onChange={(e) =>
                                    setDraftItem((prev) => ({
                                      ...prev,
                                      unit: e.target.value.toUpperCase(),
                                    }))
                                  }
                                  className={cn(
                                    "w-full h-9 sm:h-11 rounded-lg sm:rounded-xl text-xs font-semibold border border-border/80 px-1.5 sm:px-2 uppercase transition-all",
                                    selectedSpb
                                      ? "bg-muted/60 text-foreground font-bold cursor-not-allowed border-emerald-500/40 opacity-90"
                                      : "bg-background cursor-pointer",
                                  )}
                                >
                                  {!matchedOption && (
                                    <option value={rawUnit.toUpperCase()}>
                                      {rawUnit.toUpperCase()}
                                    </option>
                                  )}
                                  {availableUnits.length > 0 ? (
                                    availableUnits.map((u: any) => (
                                      <option key={u.id} value={u.name}>
                                        {u.name.toUpperCase()}
                                      </option>
                                    ))
                                  ) : (
                                    <>
                                      <option value="PCS">PCS</option>
                                      <option value="SET">SET</option>
                                      <option value="UNIT">UNIT</option>
                                      <option value="BOX">BOX</option>
                                      <option value="METER">METER</option>
                                      <option value="KG">KG</option>
                                      <option value="KALENG">KALENG</option>
                                      <option value="BATANG">BATANG</option>
                                      <option value="LEMBAR">LEMBAR</option>
                                    </>
                                  )}
                                </select>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Catatan Field */}
                    <div className="space-y-1">
                      <Input
                        placeholder="Catatan khusus untuk barang ini (opsional, contoh: untuk fabrikasi frame utama)"
                        value={draftItem.notes || ""}
                        onChange={(e) =>
                          setDraftItem((prev) => ({
                            ...prev,
                            notes: e.target.value,
                          }))
                        }
                        className="h-9 rounded-lg text-xs bg-muted/10 border-border/40 font-medium text-foreground"
                      />
                    </div>

                    {/* Tombol Tambahkan Ke Antrean Memo */}
                    {(() => {
                      const selectedSpb = approvedSpbItems.find(
                        (s) => s.itemName === draftItem.itemName,
                      );
                      const remainingQuota = selectedSpb
                        ? getRemainingQtyForSpbItem(selectedSpb)
                        : 999999;
                      const isOverQty = selectedSpb
                        ? (draftItem.qtyRequested || 0) > remainingQuota
                        : false;
                      const isDisabled =
                        !draftItem.itemName.trim() ||
                        (draftItem.qtyRequested || 0) <= 0 ||
                        isOverQty;

                      return (
                        <div className="pt-1">
                          <Button
                            type="button"
                            onClick={handleAddToQueue}
                            disabled={isDisabled}
                            className="w-full h-9 sm:h-11 rounded-lg sm:rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-bold text-xs sm:text-sm cursor-pointer shadow-md flex items-center justify-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />+ Tambahkan Ke Antrean
                            Memo
                          </Button>
                        </div>
                      );
                    })()}
                  </div>

                  {/* SECTION 3: TOMBOL FINAL KIRIM REQUEST MEMO */}
                  <div className="pt-1 sm:pt-2">
                    <Button
                      type="submit"
                      disabled={isPending || queuedItems.length === 0}
                      className="w-full h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-base cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                      Kirim Request Memo ({queuedItems.length} Barang Dalam
                      Antrean)
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>

            {/* TAB 2: MEMO LIST & INVENTORY SYNC */}
            <TabsContent
              value="list"
              className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 m-0 outline-hidden"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/30">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Daftar Memo Pengeluaran Barang
                  </h4>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="h-9 text-xs font-semibold rounded-xl gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
                </Button>
              </div>

              {isLoadingMemos ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs font-semibold">
                    Memuat data memo...
                  </span>
                </div>
              ) : memos.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-muted-foreground text-center bg-muted/10 rounded-2xl border border-dashed border-border/60 p-6 space-y-2">
                  <FileText className="w-10 h-10 opacity-30 text-primary" />
                  <h5 className="text-sm font-semibold text-foreground">
                    Belum Ada Request Memo
                  </h5>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Klik tab <strong>"1. Buat Request Memo"</strong> untuk
                    mengajukan barang ke gudang.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memos.map((memo, memoIdx) => {
                    const isExpanded = expandedMemos[memo.id] ?? memoIdx === 0;
                    return (
                      <div
                        key={memo.id}
                        className="rounded-2xl border border-border/60 bg-card overflow-hidden transition-all shadow-xs hover:border-primary/30"
                      >
                        {/* Accordion Header */}
                        <div
                          onClick={() => toggleMemoExpand(memo.id)}
                          className="p-4 sm:p-4.5 cursor-pointer hover:bg-muted/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 select-none"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded-xl bg-primary/10 text-primary font-semibold text-xs flex items-center justify-center shrink-0 border border-primary/20">
                              {memoIdx + 1}
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-sm text-primary">
                                  {memo.memoNumber}
                                </span>
                                <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-none font-bold text-[10px]">
                                  ✓ Terkirim
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-bold"
                                >
                                  {memo.items?.length || 0} Barang
                                </Badge>
                              </div>
                              <div className="text-xs text-foreground font-medium flex items-center gap-2 flex-wrap">
                                <span>
                                  Pemohon:{" "}
                                  <strong className="font-semibold">
                                    {memo.requesterName}
                                  </strong>{" "}
                                  ({memo.division})
                                </span>
                                <span>•</span>
                                <span>
                                  {formatJakartaDate(memo.createdAt, "datetime")}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                            {/* Status Badges: 1. PPIC Approval Status */}
                            {memo.status === "PENDING" ||
                            memo.status === "REQUESTED" ? (
                              <Badge className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span>Menunggu Approval PPIC</span>
                              </Badge>
                            ) : memo.status === "APPROVED" ||
                              memo.status === "ISSUED" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Disetujui PPIC</span>
                              </Badge>
                            ) : memo.status === "REJECTED" ? (
                              <Badge className="bg-red-500/10 text-red-800 dark:text-red-300 border border-red-500/30 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5 text-red-600" />
                                <span>Ditolak PPIC</span>
                              </Badge>
                            ) : memo.status === "PARTIALLY_RETURNED" ? (
                              <Badge className="bg-amber-100 text-amber-800 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                <span>Sebagian Dikembalikan</span>
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-100 text-emerald-800 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>Selesai / Dikembalikan</span>
                              </Badge>
                            )}

                            {/* Status Badges: 2. Warehouse Execution Status */}
                            {memo.status === "APPROVED" && (
                              memo.warehouseStatus === "ISSUED" ? (
                                <Badge className="bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/30 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                                  <span>Dikeluarkan Gudang</span>
                                </Badge>
                              ) : (
                                <Badge className="bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/30 font-extrabold px-3 py-1 text-xs rounded-full flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-sky-600 animate-pulse" />
                                  <span>Menunggu ACC Gudang</span>
                                </Badge>
                              )
                            )}



                            {/* Input Pengembalian button for APPROVED or PARTIALLY_RETURNED */}
                            {(memo.status === "APPROVED" ||
                              memo.status === "ISSUED" ||
                              memo.status === "PARTIALLY_RETURNED") && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartReturn(memo);
                                }}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs font-bold rounded-xl border-orange-500/30 text-orange-600 hover:bg-orange-50 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Input
                                Pengembalian
                              </Button>
                            )}

                            <div className="w-7 h-7 rounded-lg bg-muted/30 flex items-center justify-center text-muted-foreground ml-1">
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Accordion Content: Memo Items Table */}
                        {isExpanded && (
                          <div className="p-4 sm:p-5 pt-0 border-t border-border/30 bg-muted/5 space-y-3">
                            {memo.status === "REJECTED" && (
                              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 font-medium flex items-start gap-2.5 mt-3">
                                <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-600 mt-0.5" />
                                <div className="space-y-0.5">
                                  <strong className="font-extrabold text-sm block">
                                    Memo Ditolak oleh Tim Gudang
                                  </strong>
                                  {memo.rejectedReason ? (
                                    <p>
                                      Alasan:{" "}
                                      <span className="font-semibold italic">
                                        {memo.rejectedReason}
                                      </span>
                                    </p>
                                  ) : (
                                    <p>Catatan penolakan tidak tersedia.</p>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center justify-between pt-3">
                              <span className="text-xs font-semibold text-foreground">
                                Daftar Barang Yang Diminta
                                <span className="ml-1 text-xs font-semibold text-primary">
                                  ({memo.items?.length || 0} Item)
                                </span>
                              </span>
                            </div>

                            <div className="overflow-x-auto rounded-xl border border-border/40 bg-card">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-muted/40 text-muted-foreground font-extrabold border-b border-border/40">
                                  <tr>
                                    <th className="p-3 text-center w-12">No</th>
                                    <th className="p-3">Nama Barang</th>
                                    <th className="p-3 text-center">
                                      Tipe Barang
                                    </th>
                                    <th className="p-3 text-center">Diminta</th>
                                    <th className="p-3 text-center">
                                      Dikembalikan
                                    </th>
                                    <th className="p-3 text-center">
                                      Sisa Digunakan
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/20">
                                  {memo.items.map(
                                    (it: any, itemIdx: number) => {
                                      const remaining = Math.max(
                                        0,
                                        it.qtyIssued - it.qtyReturned,
                                      );
                                      return (
                                        <tr
                                          key={it.id}
                                          className="hover:bg-muted/10 transition-colors"
                                        >
                                          <td className="p-3 text-center font-extrabold text-muted-foreground bg-muted/10">
                                            {itemIdx + 1}
                                          </td>
                                          <td className="p-3 font-bold text-foreground">
                                            {it.itemName}
                                            {it.itemCode && (
                                              <span className="text-muted-foreground font-normal ml-1">
                                                ({it.itemCode})
                                              </span>
                                            )}
                                            {it.notes && (
                                              <p className="text-[11px] font-normal text-muted-foreground italic mt-0.5">
                                                Catatan: {it.notes}
                                              </p>
                                            )}
                                          </td>
                                          <td className="p-3 text-center">
                                            {it.itemType ===
                                            "NON_CONSUMABLE" ? (
                                              <Badge className="bg-orange-100 text-orange-800 border-none font-bold text-[10px]">
                                                🛠️ Alat / Equipment
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold text-[10px]">
                                                📦 Sekali Pakai
                                              </Badge>
                                            )}
                                          </td>
                                          <td className="p-3 text-center font-extrabold text-foreground">
                                            {it.qtyRequested} {it.unit}
                                          </td>
                                          <td className="p-3 text-center font-extrabold text-orange-600">
                                            {it.qtyReturned} {it.unit}
                                          </td>
                                          <td className="p-3 text-center font-extrabold text-emerald-600">
                                            {remaining} {it.unit}
                                          </td>
                                        </tr>
                                      );
                                    },
                                  )}
                                </tbody>
                              </table>
                            </div>

                            {/* Riwayat Request Pengembalian Barang & Status ACC Gudang */}
                            {memo.returns && memo.returns.length > 0 && (
                              <div className="pt-3 space-y-2">
                                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                  <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                                  Riwayat Request Pengembalian ke Gudang ({memo.returns.length})
                                </span>
                                <div className="space-y-2">
                                  {memo.returns.map((ret: any) => (
                                    <div key={ret.id} className="p-3 rounded-xl bg-background border border-border/60 text-xs space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-extrabold text-foreground">{ret.returnNumber}</span>
                                          <span className="text-muted-foreground">• Oleh {ret.returnedBy}</span>
                                        </div>
                                        {ret.warehouseStatus === "APPROVED" ? (
                                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-300 font-extrabold text-[10px]">
                                            ✅ Di-ACC Gudang ({ret.warehouseApprovedBy || "Gudang"})
                                          </Badge>
                                        ) : ret.warehouseStatus === "REJECTED" ? (
                                          <Badge className="bg-red-500/10 text-red-700 border-red-300 font-extrabold text-[10px]">
                                            ❌ Ditolak Gudang
                                          </Badge>
                                        ) : (
                                          <Badge className="bg-amber-500/10 text-amber-800 border-amber-300 font-extrabold text-[10px]">
                                            ⏳ Menunggu ACC Gudang
                                          </Badge>
                                        )}
                                      </div>
                                      {ret.notes && (
                                        <p className="text-[11px] text-muted-foreground italic">
                                          Catatan: {ret.notes}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* TAB 3: RETURN SURPLUS / TOOL FORM */}
            <TabsContent
              value="return"
              className="flex-1 overflow-y-auto p-3.5 sm:p-6 space-y-4 sm:space-y-6 m-0 outline-hidden"
            >
              {!selectedMemoForReturn ? (
                <div className="h-56 flex flex-col items-center justify-center text-muted-foreground text-center bg-muted/10 rounded-2xl border border-dashed border-border/60 p-6 space-y-3">
                  <RotateCcw className="w-10 h-10 opacity-30 text-orange-600" />
                  <h5 className="text-sm font-bold text-foreground">
                    Pilih Memo Yang Akan Dikembalikan
                  </h5>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Silakan buka tab <strong>"2. Daftar Memo"</strong> lalu klik
                    tombol <strong>"Input Pengembalian"</strong> pada memo yang
                    bersangkutan.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleReturnSubmit} className="space-y-6">
                  <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-xs space-y-1">
                    <div className="font-black text-sm text-orange-950 dark:text-orange-300 flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-orange-600" />
                      Form Pengembalian Barang{" "}
                      {selectedMemoForReturn.memoNumber}
                    </div>
                    <p className="text-foreground">
                      Pemohon Awal:{" "}
                      <strong>{selectedMemoForReturn.requesterName}</strong> (
                      {selectedMemoForReturn.division})
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <User className="w-4 h-4 text-primary" /> Nama Pengembali
                      / Penyerah *
                    </Label>
                    <Input
                      placeholder="Contoh: Pak Supri (Mengembalikan sisa cat & mesin las)"
                      value={returnerName}
                      onChange={(e) => setReturnerName(e.target.value)}
                      className="h-11 rounded-xl text-sm font-medium bg-background border-border/80"
                      required
                    />
                  </div>

                  {/* Items Return List */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-primary" />
                      Input Barang yang Dikembalikan Ke Gudang
                    </h4>

                    {selectedMemoForReturn.items.map((it: any) => {
                      const inputState = returnItemInputs[it.id] || {
                        qty: 0,
                        condition:
                          it.itemType === "NON_CONSUMABLE"
                            ? "RETURNED_TOOL"
                            : "SURPLUS",
                        notes: "",
                        maxReturnable: Math.max(
                          0,
                          it.qtyIssued - it.qtyReturned,
                        ),
                      };
                      const maxReturnable = Math.max(
                        0,
                        it.qtyIssued - it.qtyReturned,
                      );

                      return (
                        <div
                          key={it.id}
                          className="p-4 rounded-2xl border-2 border-border/60 bg-card space-y-3 shadow-2xs"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-2">
                            <div>
                              <span className="font-bold text-sm text-foreground">
                                {it.itemName}
                              </span>
                              <div className="text-xs text-muted-foreground font-semibold">
                                Dikeluarkan: {it.qtyIssued} {it.unit} • Sudah
                                Dikembalikan: {it.qtyReturned} {it.unit}
                              </div>
                            </div>

                            <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-xs px-3 py-1">
                              Maksimal Dikembalikan: {maxReturnable} {it.unit}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                            <div className="sm:col-span-6 space-y-1">
                              <Label className="text-xs font-semibold text-foreground">
                                Jumlah Dikembalikan *
                              </Label>
                              <Input
                                type="number"
                                min={0}
                                max={maxReturnable}
                                step="any"
                                value={inputState.qty}
                                onChange={(e) =>
                                  setReturnItemInputs({
                                    ...returnItemInputs,
                                    [it.id]: {
                                      ...inputState,
                                      qty: Math.min(
                                        maxReturnable,
                                        Number(e.target.value),
                                      ),
                                    },
                                  })
                                }
                                className="h-11 rounded-xl text-sm font-semibold text-foreground bg-background border-border/80"
                              />
                            </div>

                            <div className="sm:col-span-6 space-y-1">
                              <Label className="text-xs font-semibold text-foreground">
                                Kondisi / Alasan *
                              </Label>
                              <select
                                value={inputState.condition}
                                onChange={(e) =>
                                  setReturnItemInputs({
                                    ...returnItemInputs,
                                    [it.id]: {
                                      ...inputState,
                                      condition: e.target.value as any,
                                    },
                                  })
                                }
                                className="w-full h-11 rounded-xl text-xs font-semibold bg-background border border-border/80 px-2 cursor-pointer"
                              >
                                <option value="SURPLUS">
                                  🟢 Sisa Bahan (Sisa Lebih)
                                </option>
                                <option value="RETURNED_TOOL">
                                  🛠️ Alat Selesai Dipakai
                                </option>
                                <option value="DAMAGED">
                                  🔴 Barang Rusak / Perlu Repair
                                </option>
                              </select>
                            </div>

                            <div className="sm:col-span-12 space-y-1">
                              <Label className="text-xs font-semibold text-foreground">
                                Catatan Barang
                              </Label>
                              <Input
                                placeholder="e.g. Sisa 2 kg kawat las"
                                value={inputState.notes}
                                onChange={(e) =>
                                  setReturnItemInputs({
                                    ...returnItemInputs,
                                    [it.id]: {
                                      ...inputState,
                                      notes: e.target.value,
                                    },
                                  })
                                }
                                className="h-11 rounded-xl text-xs font-medium bg-background border-border/80"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSelectedMemoForReturn(null)}
                      className="h-12 rounded-xl font-semibold px-6 cursor-pointer"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 h-12 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm sm:text-base cursor-pointer shadow-lg shadow-orange-600/20 flex items-center justify-center gap-2"
                    >
                      {isPending ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <RotateCcw className="w-5 h-5" />
                      )}
                      Submit Pengembalian
                    </Button>
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog Penolakan Memo Gudang */}
      <Dialog
        open={!!rejectingMemo}
        onOpenChange={(open) => !open && setRejectingMemo(null)}
      >
        <DialogContent className="sm:max-w-md p-6 bg-background rounded-2xl border shadow-xl flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600 flex items-center gap-2">
              <XCircle className="w-5 h-5" /> Tolak Request Memo Pengeluaran
              Barang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Masukkan alasan penolakan memo{" "}
              <strong className="text-foreground">
                {rejectingMemo?.memoNumber}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Alasan Penolakan *
              </Label>
              <Textarea
                placeholder="Contoh: Stok kawat las LB-52 di gudang sedang habis / belum di-restock"
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="rounded-xl text-xs border-border/80 min-h-20"
                required
              />
            </div>
            <DialogFooter className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectingMemo(null)}
                className="h-10 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="h-10 text-xs font-bold rounded-xl bg-red-600 hover:bg-red-700 text-white cursor-pointer"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Tolak Memo"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
