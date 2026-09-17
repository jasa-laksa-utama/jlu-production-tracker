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
  RefreshCw,
  Clock,
  Building2,
  User,
  ShieldCheck,
  Loader2,
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
import { cn } from "@/lib/utils";

const getProcurementBadgeStyle = (color?: string) => {
  switch (color) {
    case "emerald":
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20";
    case "blue":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20";
    case "purple":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20";
    case "yellow":
    case "amber":
      return "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/20";
    case "orange":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20";
    case "indigo":
      return "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20";
    case "red":
    case "rose":
      return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20";
    default:
      return "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/20";
  }
};

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
  const [activeTab, setActiveTab] = useState<"create" | "list" | "return">("create");
  const [isPending, startTransition] = useTransition();

  // Master Data & Memo List
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [availableUnits, setAvailableUnits] = useState<any[]>([]);
  const [memos, setMemos] = useState<any[]>([]);
  const [approvedSpbItems, setApprovedSpbItems] = useState<any[]>([]);
  const [isLoadingMemos, setIsLoadingMemos] = useState(false);
  const [isLoadingSpbItems, setIsLoadingSpbItems] = useState(false);
  const [expandedMemos, setExpandedMemos] = useState<Record<string, boolean>>({});
  const [openComboboxIndex, setOpenComboboxIndex] = useState<number | null>(null);

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

  // Item Draft & Queue Workflow States
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

  // Return Form State
  const [selectedMemoForReturn, setSelectedMemoForReturn] = useState<any | null>(null);
  const [returnerName, setReturnerName] = useState("");
  const [returnNotes, setReturnNotes] = useState("");
  const [returnItemInputs, setReturnItemInputs] = useState<
    Record<
      string,
      {
        qty: number;
        condition: "SURPLUS" | "RETURNED_TOOL" | "DAMAGED";
        notes: string;
        maxReturnable: number;
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
  const getRemainingQtyForSpbItem = (spbItem: any, excludeQueueIndex?: number) => {
    if (!spbItem) return 0;
    const inQueue = queuedItems
      .filter(
        (q, idx) =>
          ((q.spbItemId && spbItem.id && q.spbItemId === spbItem.id) ||
            q.itemName.trim().toLowerCase() === spbItem.itemName.trim().toLowerCase()) &&
          idx !== excludeQueueIndex
      )
      .reduce((sum, q) => sum + (q.qtyRequested || 0), 0);
    return Math.max(0, spbItem.qtyRemainingToRequest - inQueue);
  };

  // Helper: Add or Merge draftItem into queuedItems
  const handleAddToQueue = () => {
    if (!draftItem.itemName.trim()) {
      toast.warning("Pilih barang dari SPB terlebih dahulu");
      return;
    }
    if ((draftItem.qtyRequested || 0) <= 0) {
      toast.warning("Jumlah kuantitas harus lebih besar dari 0");
      return;
    }

    const selectedSpb = approvedSpbItems.find(
      (s) =>
        (draftItem.spbItemId && s.id === draftItem.spbItemId) ||
        s.itemName.trim().toLowerCase() === draftItem.itemName.trim().toLowerCase()
    );

    if (selectedSpb && !selectedSpb.isReadyToRequest) {
      toast.error(
        `Barang "${draftItem.itemName}" belum dapat diajukan memo: ${selectedSpb.readinessReason || selectedSpb.procurementStatus}`
      );
      return;
    }

    const effectiveUnit = selectedSpb
      ? (selectedSpb.unit || "PCS").toUpperCase()
      : draftItem.unit;

    let resolvedItemCode = selectedSpb?.itemCode || draftItem.itemCode;
    let resolvedItemId = selectedSpb?.materialId || draftItem.itemId;
    if (!resolvedItemCode) {
      const matchWh = warehouseItems.find(
        (w) => w.name && w.name.trim().toLowerCase() === draftItem.itemName.trim().toLowerCase()
      );
      if (matchWh) {
        resolvedItemCode = matchWh.code;
        resolvedItemId = matchWh.id;
      }
    }

    const finalDraftItem = {
      ...draftItem,
      unit: effectiveUnit,
      spbItemId: selectedSpb?.id || draftItem.spbItemId,
      itemCode: resolvedItemCode,
      itemId: resolvedItemId,
    };

    const existingIndex = queuedItems.findIndex(
      (q) =>
        q.itemName.trim().toLowerCase() === draftItem.itemName.trim().toLowerCase() &&
        q.itemType === draftItem.itemType
    );

    if (existingIndex !== -1) {
      // Merge into existing item
      const existingItem = queuedItems[existingIndex];
      const mergedQty = (existingItem.qtyRequested || 0) + (finalDraftItem.qtyRequested || 0);

      if (selectedSpb) {
        const availableQuota = getRemainingQtyForSpbItem(selectedSpb, existingIndex);
        if (mergedQty > availableQuota) {
          toast.error(
            `Total kuantitas gabungan (${mergedQty} ${effectiveUnit}) melebihi sisa kuota SPB (${availableQuota} ${effectiveUnit})`
          );
          return;
        }
      }

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
          spbItemId: finalDraftItem.spbItemId || existingItem.spbItemId,
        };
        return updated;
      });

      toast.success(
        `Barang '${finalDraftItem.itemName}' diperbarui dalam antrean (${mergedQty} ${effectiveUnit}).`
      );
    } else {
      // New item
      if (selectedSpb) {
        const remainingQuota = getRemainingQtyForSpbItem(selectedSpb);
        if (finalDraftItem.qtyRequested > remainingQuota) {
          toast.error(
            `Jumlah (${finalDraftItem.qtyRequested} ${effectiveUnit}) melebihi sisa kuota SPB (${remainingQuota} ${effectiveUnit})`
          );
          return;
        }
      }

      setQueuedItems((prev) => [...prev, finalDraftItem]);
      toast.success(`'${finalDraftItem.itemName}' ditambahkan ke antrean memo.`);
    }

    // Reset draft form
    setDraftItem({
      itemName: "",
      itemType: "CONSUMABLE",
      qtyRequested: 1,
      unit: "PCS",
      notes: "",
      typeMerk: undefined,
      spbItemId: undefined,
      itemId: undefined,
      itemCode: undefined,
    });
  };

  const handleEditQueueItem = (index: number) => {
    const itemToEdit = queuedItems[index];
    setDraftItem({ ...itemToEdit });
    setQueuedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleInlineUpdateQty = (index: number, newQty: number) => {
    if (newQty <= 0) {
      toast.warning("Kuantitas minimal 1");
      return;
    }
    const targetItem = queuedItems[index];
    const selectedSpb = approvedSpbItems.find((s) => s.itemName === targetItem.itemName);
    if (selectedSpb) {
      const availableQuota = getRemainingQtyForSpbItem(selectedSpb, index);
      if (newQty > availableQuota) {
        toast.error(
          `Kuantitas (${newQty} ${targetItem.unit}) melebihi sisa kuota SPB (${availableQuota} ${targetItem.unit})`
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

  const handleRemoveFromQueue = (index: number) => {
    setQueuedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (project?.id && approvedSpbItems.length === 0) {
      toast.warning(
        "Tidak dapat membuat memo: Proyek belum memiliki Surat Permintaan Barang (SPB) yang disetujui."
      );
      return;
    }

    if (!requesterName.trim()) {
      toast.warning("Mohon isi nama pemohon");
      return;
    }

    if (queuedItems.length === 0) {
      toast.warning("Antrean memo masih kosong. Tambahkan barang terlebih dahulu.");
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
        toast.success(`Memo ${res.data?.memoNumber} (${queuedItems.length} barang) berhasil diajukan.`);
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

  const handleApproveMemo = (memoId: string) => {
    startTransition(async () => {
      const res = await approveGoodsReleaseMemo(memoId);
      if (res.success) {
        toast.success("Memo Pengeluaran Barang telah disetujui.");
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
      const res = await rejectGoodsReleaseMemo(rejectingMemo.id, rejectReasonInput.trim());
      if (res.success) {
        toast.success(`Memo ${rejectingMemo.memoNumber} telah ditolak.`);
        setRejectingMemo(null);
        setRejectReasonInput("");
        await loadData();
      } else {
        toast.error(res.error || "Gagal menolak memo");
      }
    });
  };

  const handleStartReturn = (memo: any) => {
    setSelectedMemoForReturn(memo);
    const initialInputs: Record<string, any> = {};
    memo.items.forEach((it: any) => {
      const maxReturnable = Math.max(0, it.qtyIssued - it.qtyReturned);
      initialInputs[it.id] = {
        qty: 0,
        condition: it.itemType === "NON_CONSUMABLE" ? "RETURNED_TOOL" : "SURPLUS",
        notes: "",
        maxReturnable,
      };
    });
    setReturnItemInputs(initialInputs);
    setActiveTab("return");
  };

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
      toast.warning("Mohon isi kuantitas barang yang dikembalikan (minimal 1)");
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
        toast.success(`Pengembalian barang untuk Memo ${selectedMemoForReturn.memoNumber} berhasil dicatat.`);
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
        <DialogContent className="h-[100dvh] sm:h-auto sm:max-h-[90vh] w-full sm:w-[95vw] sm:max-w-4xl flex flex-col p-0 overflow-hidden rounded-none sm:rounded-xl border-0 sm:border border-border bg-background shadow-2xl">
          {/* Header */}
          <DialogHeader className="px-2.5 py-2 sm:p-5 border-b border-border/60 bg-muted/20 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 pr-8 sm:pr-0">
              <div className="h-6 w-6 sm:h-9 sm:w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20">
                <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xs sm:text-lg font-bold tracking-tight text-foreground truncate">
                  Memo Pengeluaran Barang
                </DialogTitle>
                <DialogDescription className="text-[9px] sm:text-xs text-muted-foreground mt-0 truncate">
                  {project?.projectName ? (
                    <span>Proyek: <strong className="font-medium text-foreground">{project.projectName}</strong></span>
                  ) : (
                    <span>Permintaan pengeluaran stok gudang dan inventaris</span>
                  )}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Navigation Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-2 sm:px-6 bg-muted/10 border-b border-border/40 py-1 sm:py-2 shrink-0">
              <TabsList className="grid grid-cols-3 bg-muted/40 p-0.5 rounded-lg h-7 sm:h-10 w-full">
                <TabsTrigger
                  value="create"
                  className="rounded-md text-[9px] sm:text-xs font-medium gap-1 sm:gap-1.5 px-1 sm:px-2 py-0.5 sm:py-1.5 h-6 sm:h-auto data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  <Plus className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-primary shrink-0" />
                  <span className="truncate">Buat Memo</span>
                </TabsTrigger>
                <TabsTrigger
                  value="list"
                  className="rounded-md text-[9px] sm:text-xs font-medium gap-1 sm:gap-1.5 px-1 sm:px-2 py-0.5 sm:py-1.5 h-6 sm:h-auto data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  <Clock className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">Memo ({memos.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="return"
                  className="rounded-md text-[9px] sm:text-xs font-medium gap-1 sm:gap-1.5 px-1 sm:px-2 py-0.5 sm:py-1.5 h-6 sm:h-auto data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                >
                  <RotateCcw className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">Pengembalian</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: CREATE MEMO */}
            <TabsContent
              value="create"
              className="flex-1 overflow-y-auto p-2 sm:p-6 space-y-2 sm:space-y-4 m-0 outline-hidden"
            >
              {project?.id && !isLoadingSpbItems && approvedSpbItems.length === 0 ? (
                <div className="p-3 sm:p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-1 sm:space-y-2">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold">Belum Ada Dokumen SPB Disetujui</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        Proyek ini belum memiliki Surat Permintaan Barang (SPB) yang disetujui. Pengeluaran barang
                        hanya dapat diajukan berdasarkan item SPB yang telah diproses.
                      </p>
                    </div>
                  </div>
                </div>
              ) : project?.id && !isLoadingSpbItems && approvedSpbItems.every((it) => !it.isReadyToRequest) ? (
                <div className="p-3 sm:p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 space-y-3 sm:space-y-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold">Barang SPB Belum Siap Dikeluarkan</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">
                        Seluruh item SPB proyek masih dalam proses verifikasi persetujuan atau pemrosesan pengadaan.
                        Memo belum dapat diajukan sampai barang disetujui untuk dikeluarkan.
                      </p>
                    </div>
                  </div>

                  <div className="bg-background rounded-lg border border-border/80 overflow-hidden">
                    <div className="p-2 sm:p-2.5 bg-muted/30 border-b border-border text-[11px] sm:text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Status Barang SPB ({approvedSpbItems.length} Item)</span>
                      <span className="text-[10px] sm:text-[11px] text-muted-foreground font-normal">Kondisi Pengadaan & Gudang</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-border text-[11px] sm:text-xs">
                      {approvedSpbItems.map((spbItem, idx) => (
                        <div key={spbItem.id || idx} className="p-2.5 sm:p-3 flex items-center justify-between gap-2 sm:gap-3">
                          <div className="space-y-0.5 sm:space-y-1 min-w-0">
                            <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                              <span className="font-semibold text-foreground truncate">{spbItem.itemName}</span>
                              {spbItem.itemCode && (
                                <span className="text-[9px] sm:text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border/60">
                                  {spbItem.itemCode}
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={cn("text-[9px] sm:text-[10px] font-medium px-1.5 py-0 border", getProcurementBadgeStyle(spbItem.procurementBadgeColor))}
                              >
                                {spbItem.procurementStatus}
                              </Badge>
                              <Badge variant="outline" className="text-[9px] sm:text-[10px] text-muted-foreground">
                                {spbItem.source === "TRADING" ? "Trading" : "Gudang"}
                              </Badge>
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-muted-foreground">
                              No. SPB: {spbItem.spbNumber} • Kuota: {spbItem.totalApprovedQty} {spbItem.unit}
                            </p>
                            {spbItem.readinessReason && (
                              <p className="text-[10px] sm:text-[11px] text-amber-800 dark:text-amber-300">
                                {spbItem.readinessReason}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[11px] sm:text-xs font-medium text-muted-foreground">
                              Sisa: {spbItem.qtyRemainingToRequest} {spbItem.unit}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <form id="create-memo-form" onSubmit={handleCreateSubmit} className="space-y-2 sm:space-y-4">
                  {/* Requester & Division */}
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-3 p-1.5 sm:p-3 bg-muted/20 rounded-lg border border-border/60">
                    <div className="space-y-0.5">
                      <Label className="text-[10px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                        <User className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                        <span>Nama Pemohon *</span>
                      </Label>
                      <Input
                        placeholder="Nama penanggung jawab"
                        value={requesterName}
                        onChange={(e) => setRequesterName(e.target.value)}
                        className="h-7 sm:h-9 rounded-md text-[10px] sm:text-xs bg-background px-2"
                        required
                      />
                    </div>

                    <div className="space-y-0.5">
                      <Label className="text-[10px] sm:text-xs font-medium text-foreground flex items-center gap-1">
                        <Building2 className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-muted-foreground" />
                        <span>Divisi *</span>
                      </Label>
                      <Input
                        placeholder="Contoh: PRODUKSI"
                        value={division}
                        onChange={(e) => setDivision(e.target.value)}
                        className="h-7 sm:h-9 rounded-md text-[10px] sm:text-xs bg-background px-2"
                        required
                      />
                    </div>
                  </div>

                  {/* Input Barang Permintaan Panel */}
                  <div className="p-2 sm:p-3.5 rounded-lg border border-border bg-card space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1 sm:pb-2">
                      <h4 className="text-[10px] sm:text-xs font-semibold text-foreground flex items-center gap-1 sm:gap-1.5">
                        <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                        Pilih Barang dari SPB
                      </h4>
                      <span className="text-[9px] sm:text-[11px] text-muted-foreground hidden xs:inline">
                        Tambahkan item ke antrean memo
                      </span>
                    </div>

                    {/* Item Type Segmented Toggle */}
                    <div className="grid grid-cols-2 gap-1 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setDraftItem((prev) => ({ ...prev, itemType: "CONSUMABLE" }))}
                        className={cn(
                          "py-1 px-2 sm:p-2.5 rounded-md sm:rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2",
                          draftItem.itemType === "CONSUMABLE"
                            ? "border-emerald-600 bg-emerald-500/10 text-foreground font-semibold"
                            : "border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground"
                        )}
                      >
                        <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs font-medium leading-tight truncate">Bahan / Sekali Pakai</div>
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">Cat, kawat las, pelat, baut</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDraftItem((prev) => ({ ...prev, itemType: "NON_CONSUMABLE" }))}
                        className={cn(
                          "py-1 px-2 sm:p-2.5 rounded-md sm:rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-1.5 sm:gap-2",
                          draftItem.itemType === "NON_CONSUMABLE"
                            ? "border-orange-600 bg-orange-500/10 text-foreground font-semibold"
                            : "border-border bg-muted/10 hover:bg-muted/30 text-muted-foreground"
                        )}
                      >
                        <Wrench className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-600 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[10px] sm:text-xs font-medium leading-tight truncate">Alat / Pinjaman</div>
                          <div className="text-[9px] sm:text-[10px] text-muted-foreground hidden sm:block">Gerinda, mesin las, equipment</div>
                        </div>
                      </button>
                    </div>

                    {/* Combobox Barang SPB */}
                    <div className="space-y-0.5">
                      <Label className="text-[10px] sm:text-xs font-medium text-foreground">
                        Nama Barang (SPB) *
                      </Label>
                      {approvedSpbItems.length > 0 ? (
                        <Popover
                          open={openComboboxIndex === 999}
                          onOpenChange={(open) => setOpenComboboxIndex(open ? 999 : null)}
                        >
                          <PopoverTrigger
                            role="combobox"
                            aria-expanded={openComboboxIndex === 999}
                            className="w-full h-7 sm:h-9 flex items-center justify-between text-[10px] sm:text-xs bg-background border border-border px-2 sm:px-3 rounded-md cursor-pointer hover:bg-accent/40 transition-colors"
                          >
                            {draftItem.itemName ? (
                              <span className="truncate font-medium text-foreground flex items-center gap-1 sm:gap-1.5">
                                <span>{draftItem.itemName}</span>
                                {draftItem.itemCode && (
                                  <span className="text-[9px] sm:text-[10px] font-mono font-medium text-muted-foreground bg-muted px-1.5 py-0.2 rounded border border-border/50">
                                    {draftItem.itemCode}
                                  </span>
                                )}
                                {draftItem.typeMerk && (
                                  <span className="text-muted-foreground text-[9px] sm:text-[11px]">({draftItem.typeMerk})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground font-normal truncate">
                                Pilih barang SPB ({approvedSpbItems.length} item tersedia)
                              </span>
                            )}
                            <ChevronsUpDown className="ml-1.5 h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0 opacity-50" />
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[92vw] sm:w-[500px] p-0 rounded-lg shadow-md border border-border bg-popover"
                            align="start"
                          >
                            <Command className="rounded-lg border-0">
                              <CommandInput placeholder="Cari nama barang, kode, atau nomor SPB..." className="h-8 sm:h-9 text-[11px] sm:text-xs" />
                              <CommandList className="max-h-64 overflow-y-auto">
                                <CommandEmpty className="py-3 text-[11px] text-muted-foreground text-center">
                                  Barang tidak ditemukan.
                                </CommandEmpty>
                                <CommandGroup heading={`Barang SPB Disetujui (${approvedSpbItems.length})`}>
                                  {approvedSpbItems.map((spbItem, spbIdx) => {
                                    const remainingQuota = getRemainingQtyForSpbItem(spbItem);
                                    const isDisabledItem = !spbItem.isReadyToRequest || remainingQuota <= 0;

                                    return (
                                      <CommandItem
                                        key={spbItem.id}
                                        value={`${spbIdx + 1} ${spbItem.itemName} ${spbItem.itemCode || ""} ${spbItem.spbNumber} ${spbItem.source} ${spbItem.procurementStatus}`}
                                        disabled={isDisabledItem}
                                        onSelect={() => {
                                          if (isDisabledItem) return;
                                          setDraftItem((prev) => ({
                                            ...prev,
                                            spbItemId: spbItem.id,
                                            itemName: spbItem.itemName,
                                            typeMerk: spbItem.typeMerk || undefined,
                                            unit: (spbItem.unit || "PCS").toUpperCase(),
                                            itemId: spbItem.materialId || prev.itemId,
                                            itemCode: spbItem.itemCode || prev.itemCode,
                                          }));
                                          setOpenComboboxIndex(null);
                                        }}
                                        className={cn(
                                          "p-2 sm:p-2.5 border-b border-border/40 last:border-b-0 flex flex-col items-start gap-0.5 sm:gap-1 cursor-pointer",
                                          isDisabledItem
                                            ? "opacity-50 cursor-not-allowed bg-muted/20"
                                            : "hover:bg-accent/50"
                                        )}
                                      >
                                        <div className="flex items-center justify-between w-full gap-1.5">
                                          <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                                            <span className="font-semibold text-[11px] sm:text-xs text-foreground truncate">
                                              {spbItem.itemName}
                                            </span>
                                            {spbItem.itemCode && (
                                              <span className="text-[9px] sm:text-[10px] font-mono font-medium text-muted-foreground bg-muted/80 px-1 py-0.2 rounded border border-border/50 shrink-0">
                                                {spbItem.itemCode}
                                              </span>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <Badge
                                              variant="outline"
                                              className={cn("text-[9px] sm:text-[10px] font-medium px-1 sm:px-1.5 py-0 border", getProcurementBadgeStyle(spbItem.procurementBadgeColor))}
                                            >
                                              {spbItem.procurementStatus}
                                            </Badge>
                                            <Badge variant="outline" className="text-[9px] sm:text-[10px] text-muted-foreground">
                                              {spbItem.source === "TRADING" ? "Trading" : "Gudang"}
                                            </Badge>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between w-full text-[10px] sm:text-[11px] text-muted-foreground">
                                          <span>No. SPB: {spbItem.spbNumber}</span>
                                          <span>
                                            Sisa: <strong className="text-foreground">{remainingQuota} {spbItem.unit}</strong>
                                          </span>
                                        </div>

                                        {spbItem.readinessReason && !spbItem.isReadyToRequest && (
                                          <p className="text-[10px] sm:text-[11px] text-amber-800 dark:text-amber-300 mt-0.5">
                                            {spbItem.readinessReason}
                                          </p>
                                        )}
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
                          placeholder="Nama barang"
                          value={draftItem.itemName}
                          onChange={(e) => setDraftItem((prev) => ({ ...prev, itemName: e.target.value }))}
                          className="h-7 sm:h-9 text-[10px] sm:text-xs px-2"
                        />
                      )}
                    </div>

                    {/* Selected Item Summary Strip */}
                    {(() => {
                      const selectedSpb = approvedSpbItems.find(
                        (s) =>
                          (draftItem.spbItemId && s.id === draftItem.spbItemId) ||
                          s.itemName.trim().toLowerCase() === draftItem.itemName.trim().toLowerCase()
                      );
                      if (!selectedSpb) return null;
                      const remainingQuota = getRemainingQtyForSpbItem(selectedSpb);

                      return (
                        <div className="p-1.5 sm:p-2.5 rounded-md bg-muted/30 border border-border/80 text-[10px] sm:text-xs space-y-0.5 sm:space-y-1.5">
                          <div className="flex items-center justify-between gap-1 sm:gap-2 flex-wrap">
                            <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                              <span className="font-medium text-foreground flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
                                Kuotasi SPB ({selectedSpb.spbNumber})
                              </span>
                              {selectedSpb.itemCode && (
                                <span className="text-[8px] sm:text-[10px] font-mono font-medium text-muted-foreground bg-background px-1 py-0.2 rounded border border-border">
                                  {selectedSpb.itemCode}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn("text-[8px] sm:text-[10px] font-medium border px-1 py-0", getProcurementBadgeStyle(selectedSpb.procurementBadgeColor))}
                              >
                                {selectedSpb.procurementStatus}
                              </Badge>
                              <span className="text-muted-foreground text-[9px] sm:text-[11px]">
                                Total: <strong className="text-foreground">{selectedSpb.totalApprovedQty} {selectedSpb.unit}</strong> • 
                                Diminta: <strong className="text-foreground">{selectedSpb.qtyAlreadyRequested} {selectedSpb.unit}</strong> • 
                                Sisa: <strong className={remainingQuota > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                                  {remainingQuota} {selectedSpb.unit}
                                </strong>
                              </span>
                            </div>
                          </div>
                          {!selectedSpb.isReadyToRequest && selectedSpb.readinessReason && (
                            <p className="text-[9px] sm:text-[11px] text-amber-800 dark:text-amber-300">
                              {selectedSpb.readinessReason}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    {/* Qty, Unit, Note, and Add Button */}
                    <div className="grid grid-cols-12 gap-1.5 sm:gap-2.5 items-end">
                      <div className="col-span-6 sm:col-span-3 space-y-0.5">
                        <Label className="text-[10px] sm:text-xs font-medium text-foreground">Kuantitas *</Label>
                        <Input
                          type="number"
                          min={0.1}
                          step="any"
                          value={draftItem.qtyRequested}
                          onChange={(e) => setDraftItem((prev) => ({ ...prev, qtyRequested: Number(e.target.value) }))}
                          className="h-7 sm:h-9 text-[10px] sm:text-xs px-2"
                        />
                      </div>

                      <div className="col-span-6 sm:col-span-3 space-y-0.5">
                        <Label className="text-[10px] sm:text-xs font-medium text-foreground">Satuan *</Label>
                        <select
                          value={draftItem.unit}
                          disabled={!!approvedSpbItems.find((s) => s.itemName === draftItem.itemName)}
                          onChange={(e) => setDraftItem((prev) => ({ ...prev, unit: e.target.value.toUpperCase() }))}
                          className="w-full h-7 sm:h-9 rounded-md text-[10px] sm:text-xs border border-border bg-background px-2"
                        >
                          {availableUnits.length > 0 ? (
                            availableUnits.map((u: any) => (
                              <option key={u.id} value={u.name.toUpperCase()}>
                                {u.name.toUpperCase()}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="PCS">PCS</option>
                              <option value="SET">SET</option>
                              <option value="UNIT">UNIT</option>
                              <option value="METER">METER</option>
                              <option value="KG">KG</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div className="col-span-8 sm:col-span-4 space-y-0.5">
                        <Label className="text-[10px] sm:text-xs font-medium text-foreground">Catatan Barang (Opsional)</Label>
                        <Input
                          placeholder="Peruntukan / area kerja"
                          value={draftItem.notes || ""}
                          onChange={(e) => setDraftItem((prev) => ({ ...prev, notes: e.target.value }))}
                          className="h-7 sm:h-9 text-[10px] sm:text-xs px-2"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2">
                        {(() => {
                          const selectedSpb = approvedSpbItems.find((s) => s.itemName === draftItem.itemName);
                          const remainingQuota = selectedSpb ? getRemainingQtyForSpbItem(selectedSpb) : 999999;
                          const isOverQuota = selectedSpb ? (draftItem.qtyRequested || 0) > remainingQuota : false;
                          const isAddDisabled = !draftItem.itemName.trim() || (draftItem.qtyRequested || 0) <= 0 || isOverQuota;

                          return (
                            <Button
                              type="button"
                              onClick={handleAddToQueue}
                              disabled={isAddDisabled}
                              variant="secondary"
                              className="w-full h-7 sm:h-9 text-[10px] sm:text-xs font-medium gap-1 cursor-pointer px-2"
                            >
                              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> Tambah
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Queued Items List */}
                  <div className="space-y-1.5 sm:space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1 sm:pb-2">
                      <h4 className="text-[10px] sm:text-xs font-semibold text-foreground">
                        Daftar Antrean Memo ({queuedItems.length} Item)
                      </h4>
                      {queuedItems.length > 0 && (
                        <span className="text-[9px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Siap diajukan
                        </span>
                      )}
                    </div>

                    {queuedItems.length === 0 ? (
                      <div className="py-2.5 px-3 text-center rounded-lg border border-dashed border-border bg-muted/10">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">
                          Antrean masih kosong. Pilih barang di atas dan klik &quot;Tambah&quot;.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Mobile Card View (< sm) */}
                        <div className="block sm:hidden space-y-1.5">
                          {queuedItems.map((qItem, qIdx) => (
                            <div
                              key={qIdx}
                              className="p-2 rounded-lg border border-border bg-card space-y-1.5 shadow-2xs"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <div className="space-y-0.5 min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="font-semibold text-[10px] text-foreground truncate">
                                      {qItem.itemName}
                                    </span>
                                    {qItem.itemCode && (
                                      <span className="text-[8px] font-mono font-medium text-muted-foreground bg-muted/70 px-1 py-0.2 rounded border border-border/50">
                                        {qItem.itemCode}
                                      </span>
                                    )}
                                  </div>
                                  {qItem.typeMerk && (
                                    <div className="text-[9px] text-muted-foreground">Tipe: {qItem.typeMerk}</div>
                                  )}
                                </div>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[8px] font-medium px-1 py-0 border shrink-0",
                                    qItem.itemType === "CONSUMABLE"
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                      : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20"
                                  )}
                                >
                                  {qItem.itemType === "CONSUMABLE" ? "Bahan" : "Alat"}
                                </Badge>
                              </div>

                              {qItem.notes && (
                                <p className="text-[9px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded">
                                  {qItem.notes}
                                </p>
                              )}

                              <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50">
                                {/* Touch-friendly Stepper */}
                                <div className="inline-flex items-center gap-0.5 border border-border rounded px-1 py-0.5 bg-background h-6">
                                  <button
                                    type="button"
                                    onClick={() => handleInlineUpdateQty(qIdx, qItem.qtyRequested - 1)}
                                    className="w-5 h-5 rounded hover:bg-muted text-[10px] font-bold flex items-center justify-center cursor-pointer text-foreground"
                                    title="Kurangi"
                                  >
                                    -
                                  </button>
                                  <Input
                                    type="number"
                                    min={0.1}
                                    step="any"
                                    value={qItem.qtyRequested}
                                    onChange={(e) => handleInlineUpdateQty(qIdx, Number(e.target.value))}
                                    className="w-8 h-5 text-center text-[10px] p-0 border-0 shadow-none font-bold text-foreground"
                                  />
                                  <span className="text-[8px] text-muted-foreground uppercase px-0.5 font-medium">
                                    {qItem.unit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleInlineUpdateQty(qIdx, qItem.qtyRequested + 1)}
                                    className="w-5 h-5 rounded hover:bg-muted text-[10px] font-bold flex items-center justify-center cursor-pointer text-foreground"
                                    title="Tambah"
                                  >
                                    +
                                  </button>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditQueueItem(qIdx)}
                                    className="h-6 px-1.5 text-[9px] text-muted-foreground hover:text-foreground gap-0.5 cursor-pointer"
                                  >
                                    <Edit3 className="w-2.5 h-2.5" />
                                    <span>Edit</span>
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRemoveFromQueue(qIdx)}
                                    className="h-6 px-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 cursor-pointer"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table View (>= sm) */}
                        <div className="hidden sm:block rounded-lg border border-border overflow-hidden bg-card">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                              <tr>
                                <th className="p-2.5 text-center w-10">No</th>
                                <th className="p-2.5">Nama Barang</th>
                                <th className="p-2.5 text-center">Jenis</th>
                                <th className="p-2.5 text-center w-36">Kuantitas</th>
                                <th className="p-2.5">Catatan</th>
                                <th className="p-2.5 text-center w-16">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {queuedItems.map((qItem, qIdx) => (
                                <tr key={qIdx} className="hover:bg-muted/10 transition-colors">
                                  <td className="p-2.5 text-center text-muted-foreground font-medium">
                                    {qIdx + 1}
                                  </td>
                                  <td className="p-2.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-foreground">{qItem.itemName}</span>
                                      {qItem.itemCode && (
                                        <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                                          {qItem.itemCode}
                                        </span>
                                      )}
                                    </div>
                                    {qItem.typeMerk && (
                                      <div className="text-[11px] text-muted-foreground">Tipe: {qItem.typeMerk}</div>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <Badge
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] font-medium px-1.5 py-0 border",
                                        qItem.itemType === "CONSUMABLE"
                                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
                                          : "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20"
                                      )}
                                    >
                                      {qItem.itemType === "CONSUMABLE" ? "Bahan" : "Alat"}
                                    </Badge>
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <div className="inline-flex items-center gap-1 border border-border rounded-md px-1 py-0.5 bg-background">
                                      <button
                                        type="button"
                                        onClick={() => handleInlineUpdateQty(qIdx, qItem.qtyRequested - 1)}
                                        className="w-5 h-5 rounded hover:bg-muted text-xs font-semibold flex items-center justify-center cursor-pointer"
                                        title="Kurangi"
                                      >
                                        -
                                      </button>
                                      <Input
                                        type="number"
                                        min={0.1}
                                        step="any"
                                        value={qItem.qtyRequested}
                                        onChange={(e) => handleInlineUpdateQty(qIdx, Number(e.target.value))}
                                        className="w-12 h-6 text-center text-xs p-0 border-0 shadow-none font-semibold text-foreground"
                                      />
                                      <span className="text-[10px] text-muted-foreground uppercase pr-1 font-medium">
                                        {qItem.unit}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleInlineUpdateQty(qIdx, qItem.qtyRequested + 1)}
                                        className="w-5 h-5 rounded hover:bg-muted text-xs font-semibold flex items-center justify-center cursor-pointer"
                                        title="Tambah"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </td>
                                  <td className="p-2.5 text-muted-foreground text-[11px] truncate max-w-40">
                                    {qItem.notes || "-"}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleEditQueueItem(qIdx)}
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                        title="Edit"
                                      >
                                        <Edit3 className="w-3.5 h-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleRemoveFromQueue(qIdx)}
                                        className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer"
                                        title="Hapus"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Catatan Keseluruhan Memo */}
                  <div className="space-y-0.5 pt-0">
                    <Label className="text-[10px] sm:text-xs font-medium text-foreground">Catatan Tambahan Memo (Opsional)</Label>
                    <Input
                      placeholder="Keterangan keperluan memo untuk gudang dan PPIC"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="h-7 sm:h-9 text-[10px] sm:text-xs px-2"
                    />
                  </div>
                </form>
              )}
            </TabsContent>

            {/* TAB 2: MEMO LIST */}
            <TabsContent
              value="list"
              className="flex-1 overflow-y-auto p-2.5 sm:p-6 space-y-3 sm:space-y-4 m-0 outline-hidden"
            >
              <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-border/40">
                <h4 className="text-[11px] sm:text-xs font-semibold text-foreground">
                  Riwayat Memo Pengeluaran Barang ({memos.length})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadData}
                  className="h-7 sm:h-8 text-[10px] sm:text-xs font-medium gap-1 sm:gap-1.5 px-2 sm:px-3 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Refresh
                </Button>
              </div>

              {isLoadingMemos ? (
                <div className="h-40 flex items-center justify-center text-muted-foreground gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Memuat data memo...</span>
                </div>
              ) : memos.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-center bg-muted/10 rounded-lg border border-dashed border-border p-6 space-y-1.5">
                  <FileText className="w-8 h-8 opacity-40 text-muted-foreground" />
                  <h5 className="text-xs font-semibold text-foreground">Belum Ada Request Memo</h5>
                  <p className="text-[11px] text-muted-foreground">
                    Gunakan tab &quot;Buat Memo&quot; untuk mengajukan pengeluaran barang.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {memos.map((memo, memoIdx) => {
                    const isExpanded = expandedMemos[memo.id] ?? memoIdx === 0;

                    return (
                      <div
                        key={memo.id}
                        className="rounded-lg border border-border bg-card overflow-hidden transition-colors"
                      >
                        {/* Header Bar */}
                        <div
                          onClick={() => toggleMemoExpand(memo.id)}
                          className="p-2.5 sm:p-3.5 cursor-pointer hover:bg-muted/15 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2.5"
                        >
                          <div className="flex items-center gap-2 sm:gap-2.5">
                            <span className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-muted flex items-center justify-center text-[9px] sm:text-[10px] font-semibold text-muted-foreground shrink-0">
                              {memoIdx + 1}
                            </span>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                <span className="font-semibold text-[11px] sm:text-xs text-foreground">
                                  {memo.memoNumber}
                                </span>
                                <Badge variant="outline" className="text-[9px] sm:text-[10px] font-medium px-1.5 py-0">
                                  {memo.items?.length || 0} Barang
                                </Badge>
                              </div>
                              <div className="text-[10px] sm:text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <span>{memo.requesterName} ({memo.division})</span>
                                <span>•</span>
                                <span>{formatJakartaDate(memo.createdAt, "datetime")}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
                            {/* Status PPIC */}
                            {memo.status === "PENDING" || memo.status === "REQUESTED" ? (
                              <Badge className="bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                                Menunggu PPIC
                              </Badge>
                            ) : memo.status === "APPROVED" || memo.status === "ISSUED" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                                Disetujui PPIC
                              </Badge>
                            ) : memo.status === "REJECTED" ? (
                              <Badge className="bg-rose-500/10 text-rose-800 dark:text-rose-300 border border-rose-500/20 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                                Ditolak PPIC
                              </Badge>
                            ) : (
                              <Badge className="bg-muted text-muted-foreground border text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                                {memo.status}
                              </Badge>
                            )}

                            {/* Status Gudang */}
                            {memo.status === "APPROVED" && (
                              memo.warehouseStatus === "ISSUED" ? (
                                <Badge className="bg-blue-500/10 text-blue-800 dark:text-blue-300 border border-blue-500/20 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                                  Dikeluarkan Gudang
                                </Badge>
                              ) : (
                                <Badge className="bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/20 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5">
                                  Menunggu Gudang
                                </Badge>
                              )
                            )}

                            {/* Quick Action: Approve / Reject for PENDING */}
                            {(memo.status === "PENDING" || memo.status === "REQUESTED") && (
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApproveMemo(memo.id);
                                  }}
                                  className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-medium text-emerald-700 border-emerald-500/30 hover:bg-emerald-50 cursor-pointer"
                                >
                                  Setujui
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectingMemo(memo);
                                  }}
                                  className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-[11px] font-medium text-rose-700 border-rose-500/30 hover:bg-rose-50 cursor-pointer"
                                >
                                  Tolak
                                </Button>
                              </div>
                            )}

                            {/* Return action button */}
                            {(memo.status === "APPROVED" || memo.status === "ISSUED" || memo.status === "PARTIALLY_RETURNED") && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartReturn(memo);
                                }}
                                variant="outline"
                                size="sm"
                                className="h-6 sm:h-7 px-2 text-[10px] sm:text-[11px] font-medium gap-1 text-orange-600 border-orange-500/30 hover:bg-orange-50 cursor-pointer"
                              >
                                <RotateCcw className="w-3 h-3" /> Kembalikan
                              </Button>
                            )}

                            <div className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground ml-0.5">
                              {isExpanded ? <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> : <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Items Table */}
                        {isExpanded && (
                          <div className="p-3.5 pt-0 border-t border-border/60 bg-muted/5 space-y-3">
                            {memo.status === "REJECTED" && memo.rejectedReason && (
                              <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                                <strong>Alasan Penolakan:</strong> {memo.rejectedReason}
                              </div>
                            )}

                            {/* Dedicated Mobile View (< sm): Compact Item Cards */}
                            <div className="block sm:hidden space-y-2 mt-2">
                              {memo.items.map((it: any, itemIdx: number) => {
                                const remaining = Math.max(0, it.qtyIssued - it.qtyReturned);
                                const isWarehouseIssued =
                                  memo.warehouseStatus === "ISSUED" || (it.qtyIssued && it.qtyIssued > 0);

                                return (
                                  <div
                                    key={it.id || itemIdx}
                                    className="p-2.5 rounded-lg border border-border/70 bg-card space-y-2 shadow-2xs"
                                  >
                                    <div className="flex items-start justify-between gap-1.5">
                                      <div className="space-y-0.5 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-semibold text-[11px] text-foreground">
                                            {it.itemName}
                                          </span>
                                          {(it.itemCode || it.item?.code) && (
                                            <span className="text-[9px] font-mono font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded border border-border/40">
                                              {it.itemCode || it.item?.code}
                                            </span>
                                          )}
                                        </div>
                                        {it.notes && (
                                          <p className="text-[10px] text-muted-foreground italic">
                                            {it.notes}
                                          </p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[9px] font-medium px-1.5 py-0 border",
                                            it.itemType === "NON_CONSUMABLE"
                                              ? "bg-orange-500/10 text-orange-700 border-orange-500/20"
                                              : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                          )}
                                        >
                                          {it.itemType === "NON_CONSUMABLE" ? "Alat" : "Bahan"}
                                        </Badge>
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "text-[9px] font-medium px-1.5 py-0 border",
                                            isWarehouseIssued
                                              ? "bg-blue-500/10 text-blue-700 border-blue-500/20"
                                              : "bg-amber-500/10 text-amber-700 border-amber-500/20"
                                          )}
                                        >
                                          {isWarehouseIssued ? "Dikeluarkan" : "Belum Keluar"}
                                        </Badge>
                                      </div>
                                    </div>

                                    {/* 3-Col Metric Strip */}
                                    <div className="grid grid-cols-3 gap-1 p-1.5 rounded bg-muted/30 border border-border/50 text-center">
                                      <div>
                                        <div className="text-[9px] text-muted-foreground uppercase font-medium">Diminta</div>
                                        <div className="text-[11px] font-bold text-foreground">{it.qtyRequested} {it.unit}</div>
                                      </div>
                                      <div>
                                        <div className="text-[9px] text-muted-foreground uppercase font-medium">Kembali</div>
                                        <div className="text-[11px] font-bold text-orange-600">{it.qtyReturned} {it.unit}</div>
                                      </div>
                                      <div>
                                        <div className="text-[9px] text-muted-foreground uppercase font-medium">Sisa Digunakan</div>
                                        <div className="text-[11px] font-bold text-emerald-600">{remaining} {it.unit}</div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Desktop Table View (>= sm) */}
                            <div className="hidden sm:block overflow-x-auto rounded border border-border/60 bg-card mt-2">
                              <table className="w-full text-left text-xs">
                                <thead className="bg-muted/30 text-muted-foreground border-b border-border/60">
                                  <tr>
                                    <th className="p-2 text-center w-8">No</th>
                                    <th className="p-2">Nama Barang</th>
                                    <th className="p-2 text-center">Jenis</th>
                                    <th className="p-2 text-center">Status Gudang</th>
                                    <th className="p-2 text-center">Diminta</th>
                                    <th className="p-2 text-center">Dikembalikan</th>
                                    <th className="p-2 text-center">Sisa Digunakan</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                  {memo.items.map((it: any, itemIdx: number) => {
                                    const remaining = Math.max(0, it.qtyIssued - it.qtyReturned);
                                    const isWarehouseIssued =
                                      memo.warehouseStatus === "ISSUED" || (it.qtyIssued && it.qtyIssued > 0);

                                    return (
                                      <tr key={it.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="p-2 text-center text-muted-foreground">{itemIdx + 1}</td>
                                        <td className="p-2">
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            <span className="font-medium text-foreground">{it.itemName}</span>
                                            {(it.itemCode || it.item?.code) && (
                                              <span className="text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                                                {it.itemCode || it.item?.code}
                                              </span>
                                            )}
                                          </div>
                                          {it.notes && (
                                            <p className="text-[10px] text-muted-foreground">{it.notes}</p>
                                          )}
                                        </td>
                                        <td className="p-2 text-center">
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[10px] font-medium border",
                                              it.itemType === "NON_CONSUMABLE"
                                                ? "bg-orange-500/10 text-orange-700 border-orange-500/20"
                                                : "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                            )}
                                          >
                                            {it.itemType === "NON_CONSUMABLE" ? "Alat" : "Bahan"}
                                          </Badge>
                                        </td>
                                        <td className="p-2 text-center">
                                          {isWarehouseIssued ? (
                                            <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                              Dikeluarkan
                                            </span>
                                          ) : (
                                            <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                              Belum Keluar
                                            </span>
                                          )}
                                        </td>
                                        <td className="p-2 text-center font-semibold text-foreground">
                                          {it.qtyRequested} {it.unit}
                                        </td>
                                        <td className="p-2 text-center text-orange-600 font-semibold">
                                          {it.qtyReturned} {it.unit}
                                        </td>
                                        <td className="p-2 text-center text-emerald-600 font-semibold">
                                          {remaining} {it.unit}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Returns History */}
                            {memo.returns && memo.returns.length > 0 && (
                              <div className="pt-2 space-y-1.5">
                                <span className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                  <RotateCcw className="w-3.5 h-3.5 text-orange-600" />
                                  Riwayat Pengembalian ({memo.returns.length})
                                </span>
                                <div className="space-y-1.5">
                                  {memo.returns.map((ret: any) => (
                                    <div
                                      key={ret.id}
                                      className="p-2.5 rounded bg-background border border-border text-xs flex items-center justify-between"
                                    >
                                      <div>
                                        <span className="font-semibold text-foreground">{ret.returnNumber}</span>
                                        <span className="text-muted-foreground ml-2">Diserahkan oleh {ret.returnedBy}</span>
                                        {ret.notes && (
                                          <p className="text-[11px] text-muted-foreground mt-0.5">{ret.notes}</p>
                                        )}
                                      </div>
                                      <Badge
                                        variant="outline"
                                        className={cn(
                                          "text-[10px] font-medium border",
                                          ret.warehouseStatus === "APPROVED"
                                            ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                                            : ret.warehouseStatus === "REJECTED"
                                              ? "bg-rose-500/10 text-rose-700 border-rose-500/20"
                                              : "bg-amber-500/10 text-amber-800 border-amber-500/20"
                                        )}
                                      >
                                        {ret.warehouseStatus === "APPROVED"
                                          ? "Diterima Gudang"
                                          : ret.warehouseStatus === "REJECTED"
                                            ? "Ditolak Gudang"
                                            : "Menunggu Gudang"}
                                      </Badge>
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

            {/* TAB 3: RETURN FORM */}
            <TabsContent
              value="return"
              className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 m-0 outline-hidden"
            >
              {!selectedMemoForReturn ? (
                <div className="h-48 flex flex-col items-center justify-center text-center bg-muted/10 rounded-lg border border-dashed border-border p-6 space-y-1.5">
                  <RotateCcw className="w-8 h-8 opacity-40 text-orange-600" />
                  <h5 className="text-xs font-semibold text-foreground">Pilih Memo yang Akan Dikembalikan</h5>
                  <p className="text-[11px] text-muted-foreground">
                    Buka tab &quot;Daftar Memo&quot; lalu klik tombol &quot;Kembalikan&quot; pada memo yang diinginkan.
                  </p>
                </div>
              ) : (
                <form id="return-memo-form" onSubmit={handleReturnSubmit} className="space-y-4">
                  <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs space-y-0.5">
                    <div className="font-semibold text-orange-950 dark:text-orange-200">
                      Form Pengembalian Barang: {selectedMemoForReturn.memoNumber}
                    </div>
                    <p className="text-muted-foreground">
                      Pemohon Awal: {selectedMemoForReturn.requesterName} ({selectedMemoForReturn.division})
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] sm:text-xs font-medium text-foreground">Nama Penyerah / Pengembali *</Label>
                    <Input
                      placeholder="Nama personel yang mengembalikan barang"
                      value={returnerName}
                      onChange={(e) => setReturnerName(e.target.value)}
                      className="h-8 sm:h-9 text-[11px] sm:text-xs"
                      required
                    />
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    <h4 className="text-[11px] sm:text-xs font-semibold text-foreground">
                      Daftar Barang yang Dikembalikan
                    </h4>

                    {selectedMemoForReturn.items.map((it: any) => {
                      const inputState = returnItemInputs[it.id] || {
                        qty: 0,
                        condition: it.itemType === "NON_CONSUMABLE" ? "RETURNED_TOOL" : "SURPLUS",
                        notes: "",
                        maxReturnable: Math.max(0, it.qtyIssued - it.qtyReturned),
                      };
                      const maxReturnable = Math.max(0, it.qtyIssued - it.qtyReturned);

                      return (
                        <div key={it.id} className="p-2.5 sm:p-3 rounded-lg border border-border bg-card space-y-2 sm:space-y-2.5">
                          <div className="flex items-center justify-between gap-1.5 border-b border-border/40 pb-1.5">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-[11px] sm:text-xs text-foreground">{it.itemName}</span>
                                {(it.itemCode || it.item?.code) && (
                                  <span className="text-[9px] sm:text-[10px] font-mono font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded border border-border/40">
                                    {it.itemCode || it.item?.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                                Dikeluarkan: {it.qtyIssued} {it.unit} • Sudah Kembali: {it.qtyReturned} {it.unit}
                              </div>
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-medium text-primary shrink-0">
                              Maks: {maxReturnable} {it.unit}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-2.5">
                            <div className="sm:col-span-4 space-y-1">
                              <Label className="text-[11px] sm:text-xs font-medium text-foreground">Jumlah Dikembalikan *</Label>
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
                                      qty: Math.min(maxReturnable, Number(e.target.value)),
                                    },
                                  })
                                }
                                className="h-8 sm:h-9 text-[11px] sm:text-xs"
                              />
                            </div>

                            <div className="sm:col-span-4 space-y-1">
                              <Label className="text-[11px] sm:text-xs font-medium text-foreground">Kondisi *</Label>
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
                                className="w-full h-8 sm:h-9 rounded-md text-[11px] sm:text-xs border border-border bg-background px-2 cursor-pointer"
                              >
                                <option value="SURPLUS">Sisa Bahan (Surplus)</option>
                                <option value="RETURNED_TOOL">Alat Selesai Dipakai</option>
                                <option value="DAMAGED">Barang Rusak / Perlu Servis</option>
                              </select>
                            </div>

                            <div className="sm:col-span-4 space-y-1">
                              <Label className="text-[11px] sm:text-xs font-medium text-foreground">Catatan Barang</Label>
                              <Input
                                placeholder="Keterangan kondisi"
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
                                className="h-8 sm:h-9 text-[11px] sm:text-xs"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] sm:text-xs font-medium text-foreground">Catatan Umum (Opsional)</Label>
                    <Input
                      placeholder="Keterangan serah terima pengembalian"
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="h-8 sm:h-9 text-[11px] sm:text-xs"
                    />
                  </div>
                </form>
              )}
            </TabsContent>
          </Tabs>

          {/* Sticky Dialog Footer Actions */}
          <DialogFooter className="p-2 sm:p-4 border-t border-border/70 bg-background/95 backdrop-blur-xs flex flex-row items-center justify-between gap-1.5 sm:gap-3 shrink-0">
            {activeTab === "create" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8 sm:h-9 text-[11px] sm:text-xs font-medium px-3 sm:px-3.5 cursor-pointer"
                >
                  Tutup
                </Button>

                {project?.id && !isLoadingSpbItems && approvedSpbItems.length === 0 ? (
                  <Button
                    type="button"
                    disabled
                    variant="secondary"
                    className="h-8 sm:h-9 text-[11px] sm:text-xs font-medium opacity-60"
                  >
                    SPB Belum Ada
                  </Button>
                ) : project?.id && !isLoadingSpbItems && approvedSpbItems.every((it) => !it.isReadyToRequest) ? (
                  <Button
                    type="button"
                    disabled
                    variant="secondary"
                    className="h-8 sm:h-9 text-[11px] sm:text-xs font-medium opacity-60"
                  >
                    Barang Belum Siap
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    form="create-memo-form"
                    disabled={isPending || queuedItems.length === 0}
                    className="flex-1 sm:flex-initial h-8 sm:h-9 text-[11px] sm:text-sm font-semibold gap-1.5 sm:gap-2 px-3 sm:px-4 cursor-pointer"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>
                      Kirim Request Memo {queuedItems.length > 0 ? `(${queuedItems.length})` : ""}
                    </span>
                  </Button>
                )}
              </>
            )}

            {activeTab === "list" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="h-8 sm:h-9 text-[11px] sm:text-xs font-medium px-3 sm:px-3.5 cursor-pointer"
                >
                  Tutup
                </Button>

                <Button
                  type="button"
                  onClick={() => setActiveTab("create")}
                  className="flex-1 sm:flex-initial h-8 sm:h-9 text-[11px] sm:text-sm font-semibold gap-1.5 px-3 sm:px-4 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Buat Memo Baru</span>
                </Button>
              </>
            )}

            {activeTab === "return" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (selectedMemoForReturn) {
                      setSelectedMemoForReturn(null);
                      setActiveTab("list");
                    } else {
                      onOpenChange(false);
                    }
                  }}
                  className="h-8 sm:h-9 text-[11px] sm:text-xs font-medium px-3 sm:px-3.5 cursor-pointer"
                >
                  {selectedMemoForReturn ? "Batal" : "Tutup"}
                </Button>

                {selectedMemoForReturn ? (
                  <Button
                    type="submit"
                    form="return-memo-form"
                    disabled={isPending}
                    className="flex-1 sm:flex-initial h-8 sm:h-9 text-[11px] sm:text-sm font-semibold gap-1.5 px-3 sm:px-4 bg-orange-600 hover:bg-orange-700 text-white cursor-pointer"
                  >
                    {isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="w-3.5 h-3.5" />
                    )}
                    <span>Submit Pengembalian</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => setActiveTab("list")}
                    className="flex-1 sm:flex-initial h-8 sm:h-9 text-[11px] sm:text-sm font-medium gap-1.5 px-3 sm:px-4 cursor-pointer"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Pilih Dari Riwayat</span>
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Penolakan Memo PPIC */}
      <Dialog open={!!rejectingMemo} onOpenChange={(open) => !open && setRejectingMemo(null)}>
        <DialogContent className="sm:max-w-md p-5 bg-background rounded-lg border shadow-lg flex flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-rose-600 flex items-center gap-1.5">
              <XCircle className="w-4 h-4" /> Tolak Memo Pengeluaran Barang
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Masukkan alasan penolakan untuk memo <strong className="text-foreground">{rejectingMemo?.memoNumber}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRejectSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-foreground">Alasan Penolakan *</Label>
              <Textarea
                placeholder="Jelaskan alasan penolakan memo ini"
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="rounded-md text-xs min-h-20"
                required
              />
            </div>
            <DialogFooter className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectingMemo(null)}
                className="h-8 text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-8 text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Tolak Memo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
